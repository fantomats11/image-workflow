import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { fal } from "@fal-ai/client";
import { google } from "googleapis";
import { getUserFromAccessToken, supabaseAdmin } from "./lib/supabase-admin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required .env for Phase 1 auth:
// SUPABASE_URL and SUPABASE_ANON_KEY are used to initialize the browser client.
// SUPABASE_SERVICE_ROLE_KEY is server-only and validates access tokens.
// DATABASE_URL is reserved for later server-side Postgres work and must never be exposed to the browser.
// FAL_KEY, PORT, APP_TIMEZONE, and PUBLIC_BASE_URL keep the existing local generation workflow running.
const PORT = Number(process.env.PORT || 8765);
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const uploadDir = path.join(__dirname, "uploads");
const approvedDir = path.join(__dirname, "approved");
const metricsDir = path.join(__dirname, "metrics");
const metricsFile = path.join(metricsDir, "events.jsonl");
const appTimezone = process.env.APP_TIMEZONE || "Asia/Bangkok";
const driveOutputDir = process.env.DRIVE_OUTPUT_DIR?.trim();
const googleDriveRootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
const googleDriveAuthMode = (process.env.GOOGLE_DRIVE_AUTH_MODE || "").trim().toLowerCase();
const googleOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const googleOAuthRedirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || `http://127.0.0.1:${PORT}/api/google/oauth/callback`;
const googleDriveTokenPath = resolveProjectPath(process.env.GOOGLE_DRIVE_TOKEN_PATH || ".oauth/google-token.json");
const shouldCreateMissingSkuFolder = process.env.GOOGLE_DRIVE_CREATE_SKU_FOLDER === "true";
const keepLocalApproved = process.env.KEEP_LOCAL_APPROVED !== "false";
let generationQueue = Promise.resolve();
let activeGenerations = 0;
let pendingGenerations = 0;
const generationJobs = new Map();
let googleDriveClientPromise = null;
const googleOAuthStateById = new Map();

await Promise.all([
  fs.mkdir(uploadDir, { recursive: true }),
  fs.mkdir(approvedDir, { recursive: true }),
  fs.mkdir(metricsDir, { recursive: true }),
  fs.mkdir(path.dirname(googleDriveTokenPath), { recursive: true }),
  driveOutputDir ? fs.mkdir(driveOutputDir, { recursive: true }) : Promise.resolve()
]);

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const app = express();
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(express.json({ limit: "2mb" }));
app.use("/vendor/supabase", express.static(path.join(__dirname, "node_modules/@supabase/supabase-js/dist/umd")));
app.use(express.static(__dirname));
app.use("/approved", express.static(approvedDir));

async function requireUser(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const user = await getUserFromAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth failed:", readableError(error));
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

async function attachUserIfPresent(req, _res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (token) {
      req.user = await getUserFromAccessToken(token);
    }
  } catch (error) {
    console.warn(error?.message || readableError(error));
  }
  next();
}

async function requireAdminUser(req, res, next) {
  try {
    const profile = await getProfileForUser(req.user);
    if (!profile?.is_active || profile.must_change_password || profile.role !== "admin") {
      return res.status(403).json({ error: "เฉพาะ Admin เท่านั้นที่เชื่อมต่อ Google Drive ได้" });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error("Admin check failed:", readableError(error));
    res.status(500).json({ error: "ตรวจสอบสิทธิ์ Admin ไม่สำเร็จ" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    falConfigured: Boolean(process.env.FAL_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    driveOutputConfigured: Boolean(driveOutputDir),
    googleDriveApiConfigured: isGoogleDriveApiConfigured(),
    googleDriveAuthMode: getGoogleDriveAuthMode(),
    queue: {
      active: activeGenerations,
      pending: pendingGenerations
    },
    jobs: generationJobs.size
  });
});

app.get("/api/supabase/config", (_req, res) => {
  res.json({
    ok: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl: supabaseUrl || "",
    supabaseAnonKey: supabaseAnonKey || ""
  });
});

app.get("/api/me", requireUser, async (req, res) => {
  try {
    const profile = await getProfileForUser(req.user);
    res.json({
      ok: true,
      profile_exists: Boolean(profile),
      ...(profile || buildMissingProfileStatus(req.user))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.post("/api/me/password-changed", requireUser, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", req.user.id)
      .select("id, email, full_name, role, is_active, must_change_password")
      .single();

    if (error) {
      if (isNoRowsError(error)) {
        return res.status(404).json({
          ok: false,
          code: "profile_missing",
          error: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
        });
      }
      throw error;
    }

    await recordAuditEvent({
      actorId: req.user.id,
      eventType: "user_password_changed",
      eventJson: { user_id: req.user.id }
    });

    res.json({ ok: true, ...normalizeProfile(profile, req.user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.get("/api/jobs", requireUser, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 100));
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("created_by", req.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ ok: true, jobs: data || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.post("/api/jobs", requireUser, async (req, res) => {
  try {
    const payload = buildJobInsert(req.body, req.user.id);
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    await recordAuditEvent({
      actorId: req.user.id,
      jobId: job.id,
      eventType: "job_created",
      eventJson: { job }
    });
    res.status(201).json({ ok: true, job });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.get("/api/jobs/:id", requireUser, async (req, res) => {
  try {
    const jobId = String(req.params.id || "").trim();
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("created_by", req.user.id)
      .single();

    if (error) {
      if (isNoRowsError(error)) return res.status(404).json({ error: "Job not found." });
      throw error;
    }

    let generations = [];
    const generationsResult = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (!generationsResult.error) {
      generations = generationsResult.data || [];
    } else {
      console.warn(generationsResult.error?.message || readableError(generationsResult.error));
    }

    let assets = [];
    const assetsResult = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (!assetsResult.error) {
      assets = assetsResult.data || [];
    } else {
      console.warn(assetsResult.error?.message || readableError(assetsResult.error));
    }

    const generationIds = generations.map((generation) => generation.id).filter(Boolean);
    let qcChecks = [];
    let approvals = [];
    if (generationIds.length) {
      const qcChecksResult = await supabaseAdmin
        .from("qc_checks")
        .select("*")
        .in("generation_id", generationIds)
        .order("checked_at", { ascending: false });
      if (!qcChecksResult.error) {
        qcChecks = qcChecksResult.data || [];
      } else {
        console.warn(qcChecksResult.error?.message || readableError(qcChecksResult.error));
      }

      const approvalsResult = await supabaseAdmin
        .from("approvals")
        .select("*")
        .in("generation_id", generationIds)
        .order("approved_at", { ascending: false });
      if (!approvalsResult.error) {
        approvals = approvalsResult.data || [];
      } else {
        console.warn(approvalsResult.error?.message || readableError(approvalsResult.error));
      }
    }

    res.json({ ok: true, job, generations, assets, qc_checks: qcChecks, approvals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.post("/api/qc-checks", requireUser, async (req, res) => {
  const generationId = String(req.body.generation_id || req.body.generationId || "").trim();
  if (!generationId) return res.status(400).json({ error: "Missing generation_id." });

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return res.status(404).json({ error: "Generation not found." });

    const score = Number(req.body.score);
    const payload = {
      generation_id: generationId,
      checklist_json: req.body.checklist_json ?? req.body.checklistJson ?? {},
      score: Number.isFinite(score) ? score : null,
      passed: Boolean(req.body.passed),
      checked_by: req.user.id,
      checked_at: new Date().toISOString()
    };

    const { data: qcCheck, error } = await supabaseAdmin
      .from("qc_checks")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.warn(error.message || readableError(error));
      return res.json({ ok: false, error: "QC check was not recorded." });
    }

    await recordAuditEvent({
      actorId: req.user.id,
      jobId: generation.job_id,
      generationId,
      eventType: "qc_submitted",
      eventJson: {
        qc_check_id: qcCheck?.id || null,
        score: payload.score,
        passed: payload.passed
      }
    });

    res.status(201).json({ ok: true, qcCheck });
  } catch (error) {
    console.warn(error?.message || readableError(error));
    res.json({ ok: false, error: "QC check was not recorded." });
  }
});

app.post("/api/approvals", requireUser, async (req, res) => {
  const generationId = String(req.body.generation_id || req.body.generationId || "").trim();
  if (!generationId) return res.status(400).json({ error: "Missing generation_id." });

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return res.status(404).json({ error: "Generation not found." });

    const exportPath = cleanOptionalString(req.body.export_path || req.body.exportPath);
    const note = cleanOptionalString(req.body.note);

    await recordAuditEvent({
      actorId: req.user.id,
      jobId: generation.job_id,
      generationId,
      eventType: "hero_approved",
      eventJson: { export_path: exportPath }
    });

    const existingApprovalResult = await supabaseAdmin
      .from("approvals")
      .select("*")
      .eq("generation_id", generationId)
      .order("approved_at", { ascending: false })
      .limit(1);

    if (existingApprovalResult.error) {
      console.warn(existingApprovalResult.error.message || readableError(existingApprovalResult.error));
    } else if (existingApprovalResult.data?.length) {
      return res.json({ ok: true, approval: existingApprovalResult.data[0], duplicate: true });
    }

    const payload = {
      generation_id: generationId,
      approved_by: req.user.id,
      approved_at: new Date().toISOString(),
      export_path: exportPath,
      note
    };

    const { data: approval, error } = await supabaseAdmin
      .from("approvals")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.warn(error.message || readableError(error));
      await recordAuditEvent({
        actorId: req.user.id,
        jobId: generation.job_id,
        generationId,
        eventType: "approval_record_failed",
        eventJson: { error: readableError(error), export_path: exportPath }
      });
      return res.json({ ok: false, error: "Approval was not recorded." });
    }

    await recordAuditEvent({
      actorId: req.user.id,
      jobId: generation.job_id,
      generationId,
      eventType: "approval_recorded",
      eventJson: {
        approval_id: approval?.id || null,
        export_path: exportPath
      }
    });

    res.status(201).json({ ok: true, approval });
  } catch (error) {
    console.warn(error?.message || readableError(error));
    await recordAuditEvent({
      actorId: req.user.id,
      generationId,
      eventType: "approval_record_failed",
      eventJson: { error: readableError(error) }
    });
    res.json({ ok: false, error: "Approval was not recorded." });
  }
});

app.patch("/api/jobs/:id", requireUser, async (req, res) => {
  try {
    const jobId = String(req.params.id || "").trim();
    const patch = buildJobPatch(req.body);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("created_by", req.user.id)
      .select("*")
      .single();

    if (error) {
      if (isNoRowsError(error)) return res.status(404).json({ error: "Job not found." });
      throw error;
    }

    res.json({ ok: true, job });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.post(
  "/api/generate/start",
  requireUser,
  upload.fields([
    { name: "productImages", maxCount: 10 },
    { name: "modelImages", maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const validation = validateGenerateRequest(req);
      if (validation) return res.status(validation.status).json({ error: validation.error });

      pruneGenerationJobs();
      const dbJob = await prepareGenerationJob(req.body, req.user.id);
      const generation = await createGenerationRow(dbJob.id, req.body, req.user.id);
      await recordUploadedReferenceAssets({
        jobId: dbJob.id,
        userId: req.user.id,
        productFiles: req.files?.productImages || [],
        modelFiles: req.files?.modelImages || []
      });
      const jobId = dbJob.id;
      const job = {
        id: jobId,
        jobId,
        databaseJobId: dbJob.id,
        generationId: generation?.id || null,
        status: "queued",
        message: "รับงานแล้ว กำลังเตรียม reference",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestId: null,
        images: [],
        error: null
      };
      generationJobs.set(jobId, job);

      res.json({ ok: true, jobId, databaseJobId: dbJob.id, generationId: generation?.id || null, job });

      runGenerationJob(jobId, {
        userId: req.user.id,
        dbJobId: dbJob.id,
        generationId: generation?.id || null,
        body: { ...req.body },
        files: {
          productImages: req.files?.productImages || [],
          modelImages: req.files?.modelImages || []
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: readableError(error) });
    }
  }
);

app.get("/api/generate/jobs/:jobId", (req, res) => {
  const job = generationJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Generation job not found." });
  res.json({ ok: true, job });
});

app.post(
  "/api/generate",
  requireUser,
  upload.fields([
    { name: "productImages", maxCount: 10 },
    { name: "modelImages", maxCount: 5 }
  ]),
  async (req, res) => {
  try {
    const validation = validateGenerateRequest(req);
    if (validation) return res.status(validation.status).json({ error: validation.error });
    const data = await runGeneration({
      body: req.body,
      files: {
        productImages: req.files?.productImages || [],
        modelImages: req.files?.modelImages || []
      }
    });
    await recordMetric({
      type: "generated",
      imageCount: data.images.length,
      ...metadataFromBody(req.body),
      requestId: data.requestId,
      jobId: null
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
  }
);

app.get("/api/ops", requireUser, (_req, res) => {
  res.json({
    ok: true,
    queue: {
      active: activeGenerations,
      pending: pendingGenerations
    },
    storage: {
      approvedDir,
      driveOutputDir: driveOutputDir || null,
      keepLocalApproved
    }
  });
});

app.get("/api/metrics/today", requireUser, async (_req, res) => {
  try {
    const date = localDateKey();
    res.json({
      ok: true,
      date,
      ...(await summarizeMetrics(date))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.get("/api/metrics", requireUser, async (req, res) => {
  try {
    const date = String(req.query.date || localDateKey()).trim();
    res.json({
      ok: true,
      date,
      ...(await summarizeMetrics(date))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.get("/api/google/oauth/status", async (_req, res) => {
  try {
    const integrationToken = await readIntegrationToken("google_drive");
    const fileTokenExists = await fileExists(googleDriveTokenPath);
    const supabaseTokenExists = hasUsableGoogleOAuthToken(integrationToken?.token_json);
    const tokenExists = supabaseTokenExists || fileTokenExists;
    res.json({
      ok: true,
      mode: getGoogleDriveAuthMode(),
      configured: isGoogleOAuthConfigured(),
      tokenExists,
      connected: getGoogleDriveAuthMode() === "oauth" && isGoogleOAuthConfigured() && tokenExists,
      provider: integrationToken?.provider || (fileTokenExists ? "google" : null),
      updatedAt: integrationToken?.updated_at || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: readableError(error) });
  }
});

app.get("/api/google/oauth/start", requireUser, requireAdminUser, (req, res) => {
  try {
    const oauth2Client = createGoogleOAuthClient();
    const state = randomUUID();
    googleOAuthStateById.set(state, { userId: req.user.id, createdAt: Date.now() });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      state,
      scope: ["https://www.googleapis.com/auth/drive"]
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send(readableError(error));
  }
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    if (!code) return res.status(400).send("Missing Google OAuth code.");
    const state = String(req.query.state || "").trim();
    const statePayload = state ? googleOAuthStateById.get(state) : null;
    if (state) googleOAuthStateById.delete(state);
    const updatedBy = statePayload && Date.now() - statePayload.createdAt <= 10 * 60 * 1000 ? statePayload.userId : null;

    const oauth2Client = createGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    const existingTokens = await readGoogleOAuthToken();
    const mergedTokens = { ...existingTokens, ...tokens };
    await saveGoogleOAuthToken(mergedTokens, { updatedBy, eventType: "google_drive_connected" });

    googleDriveClientPromise = null;
    res.send(`
      <!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Google Drive Connected</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 40px; background: #f4f6f5; color: #18201f; }
            .card { max-width: 620px; margin: auto; background: white; border: 1px solid #dfe5e2; border-radius: 12px; padding: 28px; box-shadow: 0 18px 55px rgba(19,32,30,.1); }
            a { color: #b90911; font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>เชื่อมต่อ Google Drive สำเร็จ</h1>
            <p>ระบบจะอัปโหลดไฟล์เข้า Google Drive ในนามบัญชีที่คุณเพิ่งอนุญาต จากนี้กลับไปหน้า Winter Image Desk แล้วลอง Approve อีกครั้งได้เลย</p>
            <p><a href="/">กลับไปหน้าแอป</a></p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send(readableError(error));
  }
});

app.post("/api/approve", attachUserIfPresent, async (req, res) => {
  try {
    const imageUrl = String(req.body.imageUrl || "").trim();
    const jobName = sanitizeFileName(String(req.body.jobName || "approved-image"));
    const sku = sanitizeSku(String(req.body.sku || ""));
    if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl." });

    const extension = extensionFromUrl(imageUrl) || "png";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${stamp}_${jobName}.${extension}`;
    const approvedPath = path.join(approvedDir, fileName);

    await downloadFile(imageUrl, approvedPath);
    const approvedFileStat = await fs.stat(approvedPath);

    let drivePath = null;
    let googleDriveFile = null;
    if (driveOutputDir) {
      const skuFolder = sku ? await findSkuFolder(driveOutputDir, sku) : null;
      drivePath = path.join(skuFolder || driveOutputDir, fileName);
      await fs.copyFile(approvedPath, drivePath);
    }
    if (googleDriveRootFolderId) {
      googleDriveFile = await uploadApprovedFileToGoogleDrive({
        localPath: approvedPath,
        fileName,
        extension,
        sku
      });
    }

    const remoteSaved = Boolean(drivePath || googleDriveFile);
    await recordApprovedExportAsset({
      jobId: String(req.body.jobId || req.body.job_id || "").trim(),
      userId: req.user?.id || null,
      fileName,
      extension,
      fileSize: approvedFileStat.size,
      approvedPath,
      drivePath,
      googleDriveFile
    });

    let localDeleted = false;
    if (!keepLocalApproved && remoteSaved) {
      await fs.unlink(approvedPath);
      localDeleted = true;
    }

    await recordMetric({
      type: "approved",
      imageCount: 1,
      ...metadataFromBody(req.body),
      fileName,
      localDeleted,
      savedToLocalDrive: Boolean(drivePath),
      savedToGoogleDrive: Boolean(googleDriveFile),
      skuMatched: Boolean((drivePath && sku && path.dirname(drivePath) !== driveOutputDir) || googleDriveFile?.skuMatched)
    });

    res.json({
      ok: true,
      approvedPath: localDeleted ? null : approvedPath,
      localDeleted,
      drivePath,
      skuMatched: Boolean(drivePath && sku && path.dirname(drivePath) !== driveOutputDir),
      googleDriveFile,
      browserUrl: localDeleted ? null : `/approved/${fileName}`
    });
  } catch (error) {
    console.error(error);
    if (googleDriveRootFolderId) {
      await recordAuditEvent({
        actorId: req.user?.id || null,
        eventType: "google_drive_export_failed",
        eventJson: { error: readableError(error), jobId: String(req.body.jobId || req.body.job_id || "").trim() || null }
      });
    }
    res.status(500).json({ error: readableError(error) });
  }
});

function normalizeFalImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => {
      if (typeof image === "string") return { url: image };
      return {
        url: image.url,
        width: image.width,
        height: image.height,
        contentType: image.content_type || image.contentType
      };
    })
    .filter((image) => image.url);
}

function parseImageSize(value) {
  const size = String(value || "square_hd").trim();
  const customMatch = size.match(/^custom_(\d{3,4})x(\d{3,4})$/);
  if (customMatch) {
    return {
      width: Number(customMatch[1]),
      height: Number(customMatch[2])
    };
  }
  return size;
}

function validateGenerateRequest(req) {
  if (!process.env.FAL_KEY) {
    return { status: 400, error: "Missing FAL_KEY in .env" };
  }
  const productFiles = req.files?.productImages || [];
  if (!productFiles.length) {
    return { status: 400, error: "Please attach at least one product image." };
  }
  const prompt = String(req.body.prompt || "").trim();
  if (!prompt) {
    return { status: 400, error: "Missing prompt." };
  }
  return null;
}

async function runGenerationJob(jobId, request) {
  try {
    const data = await runGeneration(request, (status, message) => {
      updateGenerationJob(jobId, { status, message });
      updateGenerationProgress(request, status).catch((error) => {
        console.error("Failed to update generation progress:", readableError(error));
      });
    });
    try {
      await markGenerationDone(request, data);
    } catch (dbError) {
      console.error("Failed to mark generation done:", readableError(dbError));
    }
    updateGenerationJob(jobId, {
      status: "done",
      message: "Generate สำเร็จ",
      requestId: data.requestId,
      images: data.images,
      usage: data.usage || null
    });
    await recordMetric({
      type: "generated",
      imageCount: data.images.length,
      ...metadataFromBody(request.body),
      requestId: data.requestId,
      jobId
    });
  } catch (error) {
    console.error(error);
    try {
      await markGenerationFailed(request, error);
    } catch (dbError) {
      console.error("Failed to mark generation failed:", readableError(dbError));
    }
    updateGenerationJob(jobId, {
      status: "error",
      message: "Generate ไม่สำเร็จ",
      error: readableError(error)
    });
  }
}

async function runGeneration(request, onProgress = () => {}) {
  const productFiles = request.files.productImages || [];
  const modelFiles = request.files.modelImages || [];
  const body = request.body || {};
  const prompt = String(body.prompt || "").trim();

  onProgress("uploading", "กำลังอัปโหลดภาพ reference ไปยัง storage");
  const productImageUrls = await uploadFilesToFal(productFiles);
  const modelImageUrls = await uploadFilesToFal(modelFiles);
  const extraImageUrls = parseExtraImageUrls(body.extraImageUrls);
  const imageUrls = [...extraImageUrls, ...productImageUrls, ...modelImageUrls];

  const input = {
    prompt,
    image_urls: imageUrls,
    image_size: parseImageSize(body.imageSize || "square_hd"),
    quality: String(body.quality || "high"),
    num_images: Math.max(1, Math.min(Number(body.numImages || 1), 4)),
    output_format: String(body.outputFormat || "png")
  };

  if (process.env.OPENAI_API_KEY) {
    input.openai_api_key = process.env.OPENAI_API_KEY;
  }

  onProgress("queued", "อยู่ในคิว generate ของ server");
  const result = await enqueueGeneration(async () => {
    onProgress("generating", "กำลังสร้างภาพ อาจใช้เวลาสักครู่");
    return fal.subscribe("openai/gpt-image-2/edit", {
      input,
      logs: true
    });
  });

  const images = normalizeFalImages(result.data?.images);
  if (!images.length) {
    throw new Error("Generation finished but no image URL was returned.");
  }

  return {
    ok: true,
    requestId: result.requestId,
    productImageUrls,
    modelImageUrls,
    extraImageUrls,
    images,
    usage: result.data?.usage || null
  };
}

function updateGenerationJob(jobId, patch) {
  const job = generationJobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

function pruneGenerationJobs() {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [jobId, job] of generationJobs) {
    if (new Date(job.updatedAt).getTime() < cutoff) {
      generationJobs.delete(jobId);
    }
  }
}

function buildJobInsert(body = {}, userId) {
  const metadata = metadataFromBody(body);
  const sku = sanitizeSku(String(body.sku || ""));
  const brand = cleanJobValue(body.brand || body.brandName, "");
  return {
    sku,
    product_name: cleanJobValue(body.productName || body.product_name || sku || metadata.productSubtypeLabel || metadata.category, "Untitled product"),
    brand,
    brand_profile: metadata.brandProfile,
    category: metadata.category,
    product_subtype_value: metadata.productSubtypeValue,
    product_subtype_label: metadata.productSubtypeLabel,
    image_type: metadata.imageType,
    status: cleanJobValue(body.status, "draft"),
    form_json: buildFormJson(body),
    created_by: userId
  };
}

function buildJobPatch(body = {}) {
  const patch = {};
  if (typeof body.status === "string") {
    patch.status = cleanJobValue(body.status, "draft");
  }
  if (body.form_json !== undefined || body.formJson !== undefined) {
    patch.form_json = normalizeJsonObject(body.form_json ?? body.formJson);
  }
  return patch;
}

async function prepareGenerationJob(body = {}, userId) {
  const requestedJobId = String(body.jobId || body.job_id || "").trim();
  const jobPatch = {
    ...buildJobPatch({ form_json: buildFormJson(body) }),
    status: "queued"
  };

  if (requestedJobId) {
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .update(jobPatch)
      .eq("id", requestedJobId)
      .eq("created_by", userId)
      .select("*")
      .single();

    if (error) {
      if (isNoRowsError(error)) throw new Error("Job not found.");
      throw error;
    }
    return job;
  }

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .insert({ ...buildJobInsert({ ...body, status: "queued" }, userId), status: "queued" })
    .select("*")
    .single();

  if (error) throw error;
  await recordAuditEvent({
    actorId: userId,
    jobId: job.id,
    eventType: "job_created",
    eventJson: { job }
  });
  return job;
}

async function createGenerationRow(jobId, body = {}, userId) {
  const generation = {
    job_id: jobId,
    kind: cleanJobValue(body.jobKind || body.kind, "hero"),
    prompt: String(body.prompt || "").trim(),
    model: "openai/gpt-image-2/edit",
    request_id: null,
    status: "queued",
    created_by: userId,
    error_message: null
  };

  const { data, error } = await supabaseAdmin
    .from("generations")
    .insert(generation)
    .select("*")
    .single();

  if (error) throw error;
  await recordAuditEvent({
    actorId: userId,
    jobId,
    generationId: data.id,
    eventType: "generation_started",
    eventJson: { generation: data }
  });
  return data;
}

async function updateGenerationProgress(request, status) {
  if (!request?.generationId) return;
  if (!["uploading", "queued", "generating"].includes(status)) return;

  const generationStatus = status === "queued" ? "queued" : "running";
  await supabaseAdmin
    .from("generations")
    .update({ status: generationStatus })
    .eq("id", request.generationId);

  await supabaseAdmin
    .from("jobs")
    .update({ status: generationStatus === "running" ? "generating" : "queued" })
    .eq("id", request.dbJobId)
    .eq("created_by", request.userId);
}

async function markGenerationDone(request, data) {
  if (!request?.generationId || !request?.dbJobId) return;
  const completedAt = new Date().toISOString();
  const imageAsset = await recordGeneratedImageAsset(request, data);

  const generationPatch = {
    status: "done",
    request_id: data.requestId || null,
    completed_at: completedAt,
    error_message: null
  };
  if (imageAsset?.id) {
    generationPatch.image_asset_id = imageAsset.id;
  }

  const generationResult = await supabaseAdmin
    .from("generations")
    .update(generationPatch)
    .eq("id", request.generationId);
  if (generationResult.error) {
    console.warn(generationResult.error?.message || readableError(generationResult.error));
    if (generationPatch.image_asset_id) {
      const fallbackPatch = { ...generationPatch };
      delete fallbackPatch.image_asset_id;
      const fallbackResult = await supabaseAdmin
        .from("generations")
        .update(fallbackPatch)
        .eq("id", request.generationId);
      if (fallbackResult.error) {
        console.warn(fallbackResult.error?.message || readableError(fallbackResult.error));
      }
    }
  }

  await supabaseAdmin
    .from("jobs")
    .update({
      status: "hero_ready",
      form_json: buildFormJson(request.body)
    })
    .eq("id", request.dbJobId)
    .eq("created_by", request.userId);

  await recordAuditEvent({
    actorId: request.userId,
    jobId: request.dbJobId,
    generationId: request.generationId,
    eventType: "generation_completed",
    eventJson: { requestId: data.requestId || null }
  });
}

async function markGenerationFailed(request, error) {
  if (!request?.generationId || !request?.dbJobId) return;
  const errorMessage = readableError(error);

  await supabaseAdmin
    .from("generations")
    .update({
      status: "failed",
      error_message: errorMessage
    })
    .eq("id", request.generationId);

  await supabaseAdmin
    .from("jobs")
    .update({
      status: "failed",
      form_json: buildFormJson(request.body)
    })
    .eq("id", request.dbJobId)
    .eq("created_by", request.userId);

  await recordAuditEvent({
    actorId: request.userId,
    jobId: request.dbJobId,
    generationId: request.generationId,
    eventType: "generation_failed",
    eventJson: { errorMessage }
  });
}

async function getOwnedGeneration(generationId, userId) {
  if (!generationId || !userId) return null;
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, job_id, created_by")
    .eq("id", generationId)
    .eq("created_by", userId)
    .single();

  if (error) {
    if (isNoRowsError(error)) return null;
    throw error;
  }
  return data;
}

async function getProfileForUser(user) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, is_active, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeProfile(data, user) : null;
}

function normalizeProfile(profile, user) {
  return {
    id: profile.id,
    email: profile.email || user.email || "",
    full_name: profile.full_name || "",
    role: String(profile.role || "staff").toLowerCase() === "admin" ? "admin" : "staff",
    is_active: profile.is_active !== false,
    must_change_password: profile.must_change_password === true
  };
}

function buildMissingProfileStatus(user) {
  return {
    id: user.id,
    email: user.email || "",
    full_name: "",
    role: "staff",
    is_active: false,
    must_change_password: false
  };
}

async function recordAuditEvent({ actorId, jobId = null, generationId = null, eventType, eventJson = {} }) {
  const payload = {
    actor_id: actorId,
    job_id: jobId,
    generation_id: generationId,
    event_type: eventType,
    event_json: eventJson
  };

  try {
    const { error } = await supabaseAdmin.from("audit_events").insert(payload);
    if (error) {
      console.warn(readableError(error));
    }
  } catch (error) {
    console.warn(readableError(error));
  }
}

async function recordUploadedReferenceAssets({ jobId, userId, productFiles = [], modelFiles = [] }) {
  if (!jobId || !userId) return;
  const batches = [
    { type: "product_reference", bucket: "product-references", folder: "product", files: productFiles },
    { type: "model_reference", bucket: "model-references", folder: "model", files: modelFiles }
  ];

  for (const batch of batches) {
    for (const file of batch.files) {
      const fallbackPayload = {
        job_id: jobId,
        type: batch.type,
        bucket: "local",
        storage_key: localStorageKey(file.path),
        public_url: null,
        file_name: file.originalname || path.basename(file.path || ""),
        mime_type: file.mimetype || null,
        file_size: Number.isFinite(file.size) ? file.size : null,
        created_by: userId
      };
      const storageKey = `jobs/${jobId}/references/${batch.folder}/${safeStorageFileName(file)}`;
      const storagePayload = await buildLocalStorageAssetPayload({
        bucket: batch.bucket,
        localPath: file.path,
        storageKey,
        contentType: file.mimetype || null,
        fallbackPayload,
        actorId: userId,
        jobId,
        generationId: null
      });

      await recordAsset(storagePayload, {
        actorId: userId,
        jobId,
        eventType: "asset_recorded"
      });
    }
  }
}

async function recordGeneratedImageAsset(request, data) {
  const image = data?.images?.[0];
  if (!request?.dbJobId || !request?.userId || !image?.url) return null;
  const kind = cleanMetricValue(request.body?.jobKind || request.body?.kind, "hero").toLowerCase();
  const type = kind === "hero" ? "hero_generated" : "support_generated";
  const fileName = fileNameFromUrl(image.url) || `${data.requestId || request.generationId || "generated-image"}.png`;
  const extension = extensionFromUrl(image.url) || path.extname(fileName).replace(".", "") || "png";

  const fallbackPayload = {
    job_id: request.dbJobId,
    type,
    bucket: "remote_url",
    storage_key: image.url,
    public_url: image.url,
    file_name: fileName,
    mime_type: image.contentType || mimeTypeFromExtension(extension),
    file_size: null,
    created_by: request.userId
  };
  const storageKey = `jobs/${request.dbJobId}/generated/hero/${request.generationId || data.requestId || randomUUID()}.${extension}`;
  const storagePayload = type === "hero_generated"
    ? await buildRemoteStorageAssetPayload({
      bucket: "generated-images",
      imageUrl: image.url,
      storageKey,
      fallbackPayload,
      actorId: request.userId,
      jobId: request.dbJobId,
      generationId: request.generationId
    })
    : fallbackPayload;

  return recordAsset(storagePayload, {
    actorId: request.userId,
    jobId: request.dbJobId,
    generationId: request.generationId,
    eventType: "asset_recorded"
  });
}

async function recordApprovedExportAsset({ jobId, userId, fileName, extension, fileSize, approvedPath, drivePath, googleDriveFile }) {
  if (!jobId || !userId) return null;
  const savedPath = googleDriveFile?.id
    ? googleDriveFile.id
    : drivePath || approvedPath;
  if (!savedPath) return null;

  const fallbackPayload = {
    job_id: jobId,
    type: "approved_export",
    bucket: googleDriveFile ? "google_drive" : "local",
    storage_key: savedPath,
    public_url: googleDriveFile?.webViewLink || null,
    file_name: fileName || googleDriveFile?.name || path.basename(savedPath),
    mime_type: mimeTypeFromExtension(extension),
    file_size: Number.isFinite(fileSize) ? fileSize : null,
    created_by: userId
  };
  const storagePayload = approvedPath
    ? await buildLocalStorageAssetPayload({
      bucket: "approved-images",
      localPath: approvedPath,
      storageKey: `jobs/${jobId}/approved/${safeStorageFileName({ originalname: fileName, filename: path.basename(fileName) })}`,
      contentType: mimeTypeFromExtension(extension),
      fallbackPayload,
      actorId: userId,
      jobId,
      generationId: null
    })
    : fallbackPayload;

  return recordAsset(storagePayload, {
    actorId: userId,
    jobId,
    eventType: "approved_export_recorded"
  });
}

async function buildLocalStorageAssetPayload({ bucket, localPath, storageKey, contentType, fallbackPayload, actorId, jobId, generationId }) {
  try {
    const storageFile = await uploadLocalFileToSupabaseStorage({
      bucket,
      localPath,
      storageKey,
      contentType
    });
    await recordAuditEvent({
      actorId,
      jobId,
      generationId,
      eventType: "storage_uploaded",
      eventJson: { bucket, storageKey }
    });
    return {
      ...fallbackPayload,
      bucket,
      storage_key: storageKey,
      public_url: storageFile.publicUrl || null,
      mime_type: storageFile.contentType || fallbackPayload.mime_type || null,
      file_size: Number.isFinite(storageFile.fileSize) ? storageFile.fileSize : fallbackPayload.file_size
    };
  } catch (error) {
    console.warn(error?.message || readableError(error));
    await recordAuditEvent({
      actorId,
      jobId,
      generationId,
      eventType: "storage_upload_failed",
      eventJson: { bucket, storageKey, errorMessage: readableError(error) }
    });
    return fallbackPayload;
  }
}

async function buildRemoteStorageAssetPayload({ bucket, imageUrl, storageKey, fallbackPayload, actorId, jobId, generationId }) {
  try {
    const storageFile = await uploadRemoteImageToSupabaseStorage({
      bucket,
      imageUrl,
      storageKey
    });
    await recordAuditEvent({
      actorId,
      jobId,
      generationId,
      eventType: "storage_uploaded",
      eventJson: { bucket, storageKey }
    });
    return {
      ...fallbackPayload,
      bucket,
      storage_key: storageKey,
      public_url: storageFile.publicUrl || null,
      mime_type: storageFile.contentType || fallbackPayload.mime_type || null,
      file_size: Number.isFinite(storageFile.fileSize) ? storageFile.fileSize : fallbackPayload.file_size
    };
  } catch (error) {
    console.warn(error?.message || readableError(error));
    await recordAuditEvent({
      actorId,
      jobId,
      generationId,
      eventType: "storage_upload_failed",
      eventJson: { bucket, storageKey, errorMessage: readableError(error) }
    });
    return fallbackPayload;
  }
}

async function uploadLocalFileToSupabaseStorage({ bucket, localPath, storageKey, contentType }) {
  const fileBuffer = await fs.readFile(localPath);
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storageKey, fileBuffer, {
      contentType: contentType || "application/octet-stream",
      upsert: true
    });
  if (error) throw error;
  const publicUrl = await getSignedUrlOrPublicUrl({ bucket, storageKey });
  return {
    bucket,
    storageKey,
    publicUrl,
    contentType: contentType || null,
    fileSize: fileBuffer.byteLength
  };
}

async function uploadRemoteImageToSupabaseStorage({ bucket, imageUrl, storageKey }) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image for Supabase Storage: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storageKey, imageBuffer, {
      contentType,
      upsert: true
    });
  if (error) throw error;
  const publicUrl = await getSignedUrlOrPublicUrl({ bucket, storageKey });
  return {
    bucket,
    storageKey,
    publicUrl,
    contentType,
    fileSize: imageBuffer.byteLength
  };
}

async function getSignedUrlOrPublicUrl({ bucket, storageKey }) {
  const signedResult = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storageKey, 60 * 60 * 24 * 7);
  if (!signedResult.error && signedResult.data?.signedUrl) {
    return signedResult.data.signedUrl;
  }

  const publicResult = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(storageKey);
  return publicResult.data?.publicUrl || null;
}

async function recordAsset(payload, { actorId, jobId, generationId = null, eventType }) {
  try {
    const { data: asset, error } = await supabaseAdmin
      .from("assets")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;

    await recordAuditEvent({
      actorId,
      jobId,
      generationId,
      eventType,
      eventJson: {
        assetId: asset.id,
        type: asset.type,
        bucket: asset.bucket,
        storageKey: asset.storage_key
      }
    });
    return asset;
  } catch (error) {
    console.warn(error?.message || readableError(error));
    return null;
  }
}

function buildFormJson(body = {}) {
  const metadata = metadataFromBody(body);
  return {
    ...metadata,
    brand: cleanJobValue(body.brand || body.brandName, ""),
    productName: cleanJobValue(body.productName || body.product_name, ""),
    prompt: String(body.prompt || "").trim(),
    imageSize: cleanJobValue(body.imageSize, "square_hd"),
    quality: cleanJobValue(body.quality, "high"),
    numImages: Math.max(1, Math.min(Number(body.numImages || 1), 4)),
    outputFormat: cleanJobValue(body.outputFormat, "png"),
    extraImageUrls: parseExtraImageUrls(body.extraImageUrls)
  };
}

function normalizeJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function cleanJobValue(value, fallback = "") {
  const text = String(value || "").normalize("NFKC").trim();
  return (text || fallback).slice(0, 240);
}

function cleanOptionalString(value) {
  const text = String(value || "").normalize("NFKC").trim();
  return text ? text.slice(0, 1000) : null;
}

function isNoRowsError(error) {
  return error?.code === "PGRST116" || /0 rows|no rows|multiple \(or no\) rows/i.test(error?.message || "");
}

function parseExtraImageUrls(value) {
  if (!value) return [];
  try {
    const urls = JSON.parse(String(value));
    if (!Array.isArray(urls)) return [];
    return urls
      .map((url) => String(url || "").trim())
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 6);
  } catch {
    return [];
  }
}

function enqueueGeneration(task) {
  pendingGenerations += 1;
  const run = generationQueue
    .catch(() => undefined)
    .then(async () => {
      pendingGenerations -= 1;
      activeGenerations += 1;
      try {
        return await task();
      } finally {
        activeGenerations -= 1;
      }
    });
  generationQueue = run.catch(() => undefined);
  return run;
}

async function uploadFilesToFal(files) {
  const urls = [];
  for (const file of files) {
    const sourceBuffer = await fs.readFile(file.path);
    const sourceFile = new File([sourceBuffer], file.originalname, {
      type: file.mimetype || "image/png"
    });
    urls.push(await fal.storage.upload(sourceFile));
  }
  return urls;
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  await pipeline(response.body, createWriteStream(destinationPath));
}

function extensionFromUrl(url) {
  try {
    const parsed = new URL(url);
    const extension = path.extname(parsed.pathname).replace(".", "").toLowerCase();
    return ["png", "jpg", "jpeg", "webp"].includes(extension) ? extension : "";
  } catch {
    return "";
  }
}

function fileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return sanitizeFileName(path.basename(parsed.pathname, path.extname(parsed.pathname))) + (path.extname(parsed.pathname) || "");
  } catch {
    return "";
  }
}

function localStorageKey(filePath) {
  const storagePath = String(filePath || "").trim();
  if (!storagePath) return "";
  const relativePath = path.isAbsolute(storagePath) ? path.relative(__dirname, storagePath) : storagePath;
  return relativePath.split(path.sep).join("/");
}

function sanitizeFileName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "approved-image";
}

function safeStorageFileName(file = {}) {
  const originalName = String(file.originalname || file.filename || "image").trim();
  const originalExtension = path.extname(originalName);
  const extension = safeFileExtension(originalExtension) || extensionFromMimeType(file.mimetype);
  const baseName = sanitizeFileName(path.basename(originalName, originalExtension) || "image");
  const filePrefix = file.filename && file.filename !== originalName
    ? `${sanitizeFileName(file.filename)}-`
    : "";
  return `${filePrefix}${baseName}${extension ? `.${extension}` : ""}`;
}

function safeFileExtension(value) {
  const extension = String(value || "").replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(extension) ? extension : "";
}

function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  return "";
}

function sanitizeSku(value) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, "-")
    .slice(0, 120);
}

function normalizeSkuForMatch(value) {
  return sanitizeSku(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]+/g, "");
}

async function findSkuFolder(rootDir, sku) {
  const target = normalizeSkuForMatch(sku);
  if (!target) return null;

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  const exactMatch = directories.find((entry) => normalizeSkuForMatch(entry.name) === target);
  if (exactMatch) return path.join(rootDir, exactMatch.name);

  const partialMatch = directories.find((entry) => {
    const normalizedName = normalizeSkuForMatch(entry.name);
    return normalizedName.includes(target) || target.includes(normalizedName);
  });

  return partialMatch ? path.join(rootDir, partialMatch.name) : null;
}

async function getGoogleDriveClient() {
  if (!googleDriveClientPromise) {
    googleDriveClientPromise = createGoogleDriveClient();
  }
  return googleDriveClientPromise;
}

async function createGoogleDriveClient() {
  if (!googleDriveRootFolderId) return null;

  if (getGoogleDriveAuthMode() === "oauth") {
    const oauth2Client = createGoogleOAuthClient();
    const tokens = await readGoogleOAuthToken();
    if (!tokens?.refresh_token && !tokens?.access_token) {
      throw new Error("Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน");
    }
    oauth2Client.setCredentials(tokens);
    oauth2Client.on("tokens", async (newTokens) => {
      try {
        await saveGoogleOAuthToken(newTokens, { eventType: "google_drive_token_refreshed" });
      } catch (error) {
        console.error("Failed to save refreshed Google OAuth token:", readableError(error));
      }
    });
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  let auth;
  const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON?.trim();
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
  } else {
    auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
  }

  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

async function uploadApprovedFileToGoogleDrive({ localPath, fileName, extension, sku }) {
  const drive = await getGoogleDriveClient();
  if (!drive) return null;

  const targetFolderId = sku
    ? await findGoogleDriveSkuFolder(drive, googleDriveRootFolderId, sku)
    : googleDriveRootFolderId;

  if (!targetFolderId) {
    throw new Error(`Google Drive SKU folder not found for "${sku}".`);
  }

  const createdFile = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [targetFolderId]
    },
    media: {
      mimeType: mimeTypeFromExtension(extension),
      body: createReadStream(localPath)
    },
    fields: "id,name,webViewLink,parents",
    supportsAllDrives: true
  });

  return {
    id: createdFile.data.id,
    name: createdFile.data.name,
    webViewLink: createdFile.data.webViewLink || null,
    parentFolderId: targetFolderId,
    skuMatched: Boolean(sku && targetFolderId !== googleDriveRootFolderId)
  };
}

function resolveProjectPath(value) {
  const resolved = String(value || "").trim();
  if (!resolved) return "";
  return path.isAbsolute(resolved) ? resolved : path.join(__dirname, resolved);
}

function getGoogleDriveAuthMode() {
  if (googleDriveAuthMode) return googleDriveAuthMode;
  return isGoogleOAuthConfigured() ? "oauth" : "service-account";
}

function isGoogleOAuthConfigured() {
  return Boolean(googleOAuthClientId && googleOAuthClientSecret && googleOAuthRedirectUri);
}

function isGoogleDriveApiConfigured() {
  if (!googleDriveRootFolderId) return false;
  if (getGoogleDriveAuthMode() === "oauth") return isGoogleOAuthConfigured();
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_DRIVE_CREDENTIALS_JSON);
}

function createGoogleOAuthClient() {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Missing Google OAuth config. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env.");
  }
  return new google.auth.OAuth2(googleOAuthClientId, googleOAuthClientSecret, googleOAuthRedirectUri);
}

async function readGoogleOAuthToken() {
  const integrationToken = await readIntegrationToken("google_drive");
  if (integrationToken?.token_json) return integrationToken.token_json;

  try {
    return JSON.parse(await fs.readFile(googleDriveTokenPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function saveGoogleOAuthToken(tokens, { updatedBy = null, eventType = "google_drive_token_refreshed" } = {}) {
  const existingToken = await readIntegrationToken("google_drive");
  const existingTokenJson = existingToken?.token_json || {};
  const mergedTokens = { ...existingTokenJson, ...tokens };
  if (!tokens.refresh_token && existingTokenJson.refresh_token) {
    mergedTokens.refresh_token = existingTokenJson.refresh_token;
  }

  const { error } = await supabaseAdmin.from("integration_tokens").upsert(
    {
      id: "google_drive",
      provider: "google",
      token_json: mergedTokens,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  if (error) throw error;

  googleDriveClientPromise = null;
  await recordAuditEvent({
    actorId: updatedBy,
    eventType,
    eventJson: { provider: "google", integration: "google_drive" }
  });
}

async function readIntegrationToken(id) {
  const { data, error } = await supabaseAdmin
    .from("integration_tokens")
    .select("id, provider, token_json, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function hasUsableGoogleOAuthToken(tokens) {
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findGoogleDriveSkuFolder(drive, rootFolderId, sku) {
  const target = normalizeSkuForMatch(sku);
  if (!target) return rootFolderId;

  const folders = await listGoogleDriveChildFolders(drive, rootFolderId);
  const exactMatch = folders.find((folder) => normalizeSkuForMatch(folder.name) === target);
  if (exactMatch) return exactMatch.id;

  const partialMatch = folders.find((folder) => {
    const normalizedName = normalizeSkuForMatch(folder.name);
    return normalizedName.includes(target) || target.includes(normalizedName);
  });
  if (partialMatch) return partialMatch.id;

  if (shouldCreateMissingSkuFolder) {
    const createdFolder = await drive.files.create({
      requestBody: {
        name: sanitizeSku(sku),
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId]
      },
      fields: "id,name"
    });
    return createdFolder.data.id;
  }

  return rootFolderId;
}

async function listGoogleDriveChildFolders(drive, rootFolderId) {
  const folders = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${escapeGoogleDriveQueryValue(rootFolderId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    folders.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return folders;
}

function escapeGoogleDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function mimeTypeFromExtension(extension) {
  const normalized = String(extension || "png").toLowerCase();
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  if (normalized === "webp") return "image/webp";
  return "image/png";
}

function metadataFromBody(body = {}) {
  return {
    operatorName: cleanMetricValue(body.operatorName, "ไม่ระบุผู้ใช้งาน"),
    sku: sanitizeSku(String(body.sku || "")),
    brandProfile: cleanMetricValue(body.brandProfile || body.brand_profile, "ไม่ระบุแบรนด์ปลายทาง"),
    category: cleanMetricValue(body.category, "ไม่ระบุหมวด"),
    productSubtypeValue: cleanMetricValue(body.productSubtypeValue || body.product_subtype_value, "auto"),
    productSubtypeLabel: cleanMetricValue(body.productSubtypeLabel || body.product_subtype_label, "ระบบเลือกจากภาพอ้างอิง"),
    imageType: cleanMetricValue(body.imageType || body.image_type, "ไม่ระบุรูปแบบ"),
    shotType: cleanMetricValue(body.shotType || body.shot_type, "ระบบเลือกให้อัตโนมัติ"),
    jobKind: cleanMetricValue(body.jobKind, "hero"),
    shot: cleanMetricValue(body.shot, body.shotType || "Hero")
  };
}

function cleanMetricValue(value, fallback = "") {
  const text = String(value || "").normalize("NFKC").trim();
  return (text || fallback).slice(0, 160);
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function recordMetric(event) {
  const now = new Date();
  const metricEvent = {
    id: randomUUID(),
    createdAt: now.toISOString(),
    localDate: localDateKey(now),
    ...event
  };
  await fs.appendFile(metricsFile, `${JSON.stringify(metricEvent)}\n`, "utf8");
}

async function readMetricEvents() {
  try {
    const raw = await fs.readFile(metricsFile, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function summarizeMetrics(date) {
  const events = (await readMetricEvents()).filter((event) => event.localDate === date);
  const byUser = new Map();
  const totals = createMetricBucket("รวมทั้งหมด");

  for (const event of events) {
    const operatorName = cleanMetricValue(event.operatorName, "ไม่ระบุผู้ใช้งาน");
    const bucket = byUser.get(operatorName) || createMetricBucket(operatorName);
    applyMetricEvent(bucket, event);
    applyMetricEvent(totals, event);
    byUser.set(operatorName, bucket);
  }

  return {
    totals: serializeMetricBucket(totals),
    users: Array.from(byUser.values())
      .map(serializeMetricBucket)
      .sort((a, b) => b.approvedImages - a.approvedImages || b.generatedImages - a.generatedImages || a.operatorName.localeCompare(b.operatorName, "th"))
  };
}

function createMetricBucket(operatorName) {
  return {
    operatorName,
    generatedImages: 0,
    approvedImages: 0,
    skus: new Set(),
    brands: new Set(),
    categories: new Set(),
    subtypes: new Set()
  };
}

function applyMetricEvent(bucket, event) {
  const count = Math.max(1, Number(event.imageCount || 1));
  if (event.type === "generated") bucket.generatedImages += count;
  if (event.type === "approved") bucket.approvedImages += count;
  if (event.sku) bucket.skus.add(String(event.sku));
  if (event.brandProfile) bucket.brands.add(String(event.brandProfile));
  if (event.category) bucket.categories.add(String(event.category));
  if (event.productSubtypeLabel || event.productSubtypeValue) {
    bucket.subtypes.add(String(event.productSubtypeLabel || event.productSubtypeValue));
  }
}

function serializeMetricBucket(bucket) {
  return {
    operatorName: bucket.operatorName,
    generatedImages: bucket.generatedImages,
    approvedImages: bucket.approvedImages,
    uniqueSkus: bucket.skus.size,
    uniqueBrands: bucket.brands.size,
    uniqueCategories: bucket.categories.size,
    uniqueSubtypes: bucket.subtypes.size,
    skus: Array.from(bucket.skus).sort(),
    brands: Array.from(bucket.brands).sort(),
    categories: Array.from(bucket.categories).sort(),
    subtypes: Array.from(bucket.subtypes).sort()
  };
}

function readableError(error) {
  const message = error?.body?.detail || error?.message || String(error);
  if (/openai_api_key/i.test(message)) {
    return "The fal model requires OPENAI_API_KEY. Add it to .env and restart the server.";
  }
  if (/Service Accounts do not have storage quota/i.test(message)) {
    return "Google Drive upload failed because service accounts do not have My Drive storage quota. Set GOOGLE_DRIVE_AUTH_MODE=oauth, connect Google Drive at /api/google/oauth/start, then approve again.";
  }
  return message;
}

app.listen(PORT, () => {
  console.log(`Winter Image Desk running on http://127.0.0.1:${PORT}`);
});
