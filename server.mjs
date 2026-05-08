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
const costTrackingConfig = {
  provider: "fal",
  model: "openai/gpt-image-2/edit",
  currency: (process.env.AI_GENERATION_COST_CURRENCY || "USD").trim().toUpperCase() || "USD",
  estimatedCostPerGeneration: normalizeCostNumber(process.env.AI_GENERATION_ESTIMATED_COST_PER_GENERATION, 0.04),
  unitType: "generation_request"
};
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

app.use((error, req, res, next) => {
  if (!error) return next();
  if (req.path?.startsWith("/api/")) {
    return sendApiError(res, 400, "invalid_json", "Request JSON ไม่ถูกต้อง");
  }
  return next(error);
});

validateStartupConfig();

async function requireUser(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) {
      return res.status(401).json({ ok: false, code: "auth_required", error: "Authentication required." });
    }

    const user = await getUserFromAccessToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, code: "invalid_session", error: "Invalid or expired session." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth failed:", readableError(error));
    res.status(401).json({ ok: false, code: "invalid_session", error: "Invalid or expired session." });
  }
}

function sendApiError(res, status, code, error) {
  return res.status(status).json({
    ok: false,
    code,
    error
  });
}

function safeRuntimeEnv() {
  if (process.env.RENDER) return "render";
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function validateStartupConfig() {
  const missingCritical = [];
  const warnings = [];
  if (!supabaseUrl) missingCritical.push("SUPABASE_URL");
  if (!supabaseAnonKey) missingCritical.push("SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missingCritical.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.FAL_KEY?.trim()) warnings.push("FAL_KEY is missing; generation requests will return a safe configuration error.");

  if (getGoogleDriveAuthMode() === "oauth" || googleDriveRootFolderId) {
    if (!googleDriveRootFolderId) warnings.push("GOOGLE_DRIVE_ROOT_FOLDER_ID is missing; Google Drive export will be disabled.");
    if (!googleOAuthClientId || !googleOAuthClientSecret) warnings.push("Google OAuth client config is incomplete; admin Google Drive connection will be unavailable.");
  }

  if (missingCritical.length) {
    throw new Error(`Missing required server configuration: ${missingCritical.join(", ")}`);
  }
  warnings.forEach((warning) => console.warn(`[config] ${warning}`));
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
      return res.status(403).json({
        ok: false,
        code: "admin_required",
        error: "เฉพาะ Admin เท่านั้นที่ใช้งานส่วนนี้ได้"
      });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error("Admin check failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "admin_check_failed",
      error: "ตรวจสอบสิทธิ์ Admin ไม่สำเร็จ"
    });
  }
}

function logMonitoringRequest(req, res, next) {
  console.info("[monitoring] request received");
  console.info("[monitoring] range", normalizeKpiRange(req.query.range));
  res.on("finish", () => {
    console.info("[monitoring] response sent", { status: res.statusCode });
  });
  next();
}

async function requireMonitoringAdminUser(req, res, next) {
  try {
    console.info("[monitoring] user id/email", {
      id: req.user?.id || "",
      email: req.user?.email || ""
    });
    const profile = await getProfileForUser(req.user);
    if (!profile?.is_active || profile.must_change_password || profile.role !== "admin") {
      return res.status(403).json({
        ok: false,
        code: "admin_required",
        error: "Admin access required."
      });
    }
    req.profile = profile;
    console.info("[monitoring] admin verified");
    next();
  } catch (error) {
    console.error("[monitoring] admin check failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "monitoring_error",
      error: "ตรวจสอบสิทธิ์ Monitoring ไม่สำเร็จ"
    });
  }
}

app.get("/api/admin/monitoring", logMonitoringRequest, requireUser, requireMonitoringAdminUser, async (req, res) => {
  try {
    const range = normalizeKpiRange(req.query.range);
    const pagination = normalizeMonitoringPagination(req.query);
    const monitoring = await buildMonitoringCenter(range, pagination);
    res.json({ ok: true, ...monitoring });
  } catch (error) {
    console.error("[monitoring] failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "monitoring_error",
      error: "โหลด Monitoring / Error Center ไม่สำเร็จ"
    });
  }
});

app.get("/api/admin/costs", requireUser, requireAdminUser, async (req, res) => {
  try {
    const range = normalizeKpiRange(req.query.range);
    const pagination = normalizeProductionPagination(req.query);
    const costs = await buildCostUsageDashboard(range, pagination);
    res.json({ ok: true, ...costs });
  } catch (error) {
    console.error("[costs] failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "cost_usage_failed",
      error: "โหลด Cost / Usage Tracking ไม่สำเร็จ"
    });
  }
});

app.use("/vendor/supabase", express.static(path.join(__dirname, "node_modules/@supabase/supabase-js/dist/umd")));
app.use(express.static(__dirname));
app.use("/approved", express.static(approvedDir));

app.get("/api/health", async (_req, res) => {
  const googleDriveStatus = await getSafeGoogleDriveStatus();
  res.json({
    ok: true,
    service: "image-workflow",
    time: new Date().toISOString(),
    env: safeRuntimeEnv(),
    checks: {
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
      googleDriveConfigured: isGoogleDriveApiConfigured() || isGoogleOAuthConfigured(),
      googleDriveConnected: googleDriveStatus.connected === true,
      falConfigured: Boolean(process.env.FAL_KEY)
    },
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
    console.error("Profile load failed:", readableError(error));
    res.status(500).json({ ok: false, code: "profile_load_failed", error: "โหลดข้อมูลผู้ใช้งานไม่สำเร็จ" });
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
    console.error("Password changed flag failed:", readableError(error));
    res.status(500).json({ ok: false, code: "password_changed_failed", error: "บันทึกสถานะรหัสผ่านใหม่ไม่สำเร็จ" });
  }
});

app.get("/api/admin/users", requireUser, requireAdminUser, async (_req, res) => {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const latestActivityByActor = await readLatestActivityByActor();
    const users = (profiles || []).map((profile) => serializeAdminUserProfile(profile, latestActivityByActor.get(profile.id)));
    res.json({ ok: true, users });
  } catch (error) {
    console.error("Admin users list failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "admin_users_failed",
      error: "โหลดรายชื่อผู้ใช้งานไม่สำเร็จ"
    });
  }
});

app.post("/api/admin/users", requireUser, requireAdminUser, async (req, res) => {
  try {
    const payloadResult = buildAdminUserCreatePayload(req.body);
    if (!payloadResult.ok) {
      return res.status(400).json({
        ok: false,
        code: payloadResult.code,
        error: payloadResult.error
      });
    }

    const payload = payloadResult.payload;
    const existingProfileResult = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", payload.email)
      .maybeSingle();

    if (existingProfileResult.error) throw existingProfileResult.error;
    if (existingProfileResult.data) {
      return res.status(409).json({
        ok: false,
        code: "profile_already_exists",
        error: "อีเมลนี้มี profile อยู่แล้ว กรุณาใช้รายการเดิมใน Staff Management"
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
        role: payload.role
      }
    });

    if (authError) {
      return res.status(isAuthUserExistsError(authError) ? 409 : 400).json({
        ok: false,
        code: isAuthUserExistsError(authError) ? "auth_user_already_exists" : "auth_user_create_failed",
        error: isAuthUserExistsError(authError)
          ? "อีเมลนี้มี Supabase Auth user อยู่แล้ว กรุณาใช้บัญชีเดิมหรือเพิ่ม profile ให้ตรงกับ Auth user"
          : "สร้าง Auth user ไม่สำเร็จ"
      });
    }

    const createdUser = authData?.user;
    if (!createdUser?.id) {
      return res.status(500).json({
        ok: false,
        code: "auth_user_missing",
        error: "สร้าง Auth user แล้วแต่ไม่พบรหัสผู้ใช้งาน"
      });
    }

    const profileInsert = {
      id: createdUser.id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      is_active: payload.is_active,
      must_change_password: payload.must_change_password
    };
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert(profileInsert)
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .single();

    if (profileError) {
      console.error("Profile insert failed after auth user creation:", {
        authUserId: createdUser.id,
        email: payload.email,
        error: readableError(profileError)
      });
      return res.status(500).json({
        ok: false,
        code: "profile_insert_failed",
        error: "สร้าง Auth user แล้ว แต่สร้าง profile ไม่สำเร็จ กรุณาตรวจสอบใน Supabase ก่อนลองใหม่"
      });
    }

    await recordAuditEvent({
      actorId: req.user.id,
      eventType: "user_created",
      eventJson: {
        admin_user_id: req.user.id,
        admin_email: req.profile?.email || req.user.email || "",
        created_user_id: profile.id,
        created_user_email: profile.email || "",
        role: profile.role,
        is_active: profile.is_active !== false,
        must_change_password: profile.must_change_password === true
      }
    });

    res.status(201).json({
      ok: true,
      user: serializeAdminUserProfile(profile)
    });
  } catch (error) {
    console.error("Admin user create failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "admin_user_create_failed",
      error: "สร้างผู้ใช้งานไม่สำเร็จ"
    });
  }
});

app.patch("/api/admin/users/:id/password", requireUser, requireAdminUser, async (req, res) => {
  try {
    const userId = String(req.params.id || "").trim();
    if (!isValidUuid(userId)) {
      return res.status(400).json({
        ok: false,
        code: "invalid_user_id",
        error: "รหัสผู้ใช้งานไม่ถูกต้อง"
      });
    }

    const passwordResult = buildAdminPasswordResetPayload(req.body);
    if (!passwordResult.ok) {
      return res.status(400).json({
        ok: false,
        code: passwordResult.code,
        error: passwordResult.error
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({
        ok: false,
        code: "user_not_found",
        error: "ไม่พบ profile ของผู้ใช้งานนี้"
      });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: passwordResult.temporaryPassword
    });
    if (authError) {
      console.error("Admin password reset auth update failed:", {
        targetUserId: userId,
        targetEmail: profile.email || "",
        error: readableError(authError)
      });
      return res.status(400).json({
        ok: false,
        code: "auth_password_update_failed",
        error: "รีเซ็ตรหัสผ่านใน Supabase Auth ไม่สำเร็จ"
      });
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId)
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .single();

    if (updateError) {
      console.error("Profile must_change_password update failed after auth password reset:", {
        targetUserId: userId,
        targetEmail: profile.email || "",
        error: readableError(updateError)
      });
      return res.status(500).json({
        ok: false,
        code: "profile_password_flag_update_failed",
        error: "รีเซ็ตรหัสใน Auth แล้ว แต่ตั้งสถานะบังคับเปลี่ยนรหัสไม่สำเร็จ กรุณาตรวจสอบ profile ก่อนลองใหม่"
      });
    }

    await recordAuditEvent({
      actorId: req.user.id,
      eventType: "user_password_reset",
      eventJson: {
        admin_user_id: req.user.id,
        admin_email: req.profile?.email || req.user.email || "",
        target_user_id: updatedProfile.id,
        target_email: updatedProfile.email || ""
      }
    });

    res.json({
      ok: true,
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email || "",
        must_change_password: updatedProfile.must_change_password === true,
        is_active: updatedProfile.is_active !== false
      }
    });
  } catch (error) {
    console.error("Admin password reset failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "admin_password_reset_failed",
      error: "รีเซ็ตรหัสผ่านไม่สำเร็จ"
    });
  }
});

app.patch("/api/admin/users/:id", requireUser, requireAdminUser, async (req, res) => {
  try {
    const userId = String(req.params.id || "").trim();
    if (!isValidUuid(userId)) {
      return res.status(400).json({
        ok: false,
        code: "invalid_user_id",
        error: "รหัสผู้ใช้งานไม่ถูกต้อง"
      });
    }

    const patchResult = buildAdminUserPatch(req.body);
    if (!patchResult.ok) {
      return res.status(400).json({
        ok: false,
        code: patchResult.code,
        error: patchResult.error
      });
    }

    if (!Object.keys(patchResult.patch).length) {
      return res.status(400).json({
        ok: false,
        code: "empty_patch",
        error: "ไม่มีข้อมูลที่ต้องอัปเดต"
      });
    }

    const { data: existingProfile, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingProfile) {
      return res.status(404).json({
        ok: false,
        code: "user_not_found",
        error: "ไม่พบผู้ใช้งานนี้"
      });
    }

    const safetyResult = await validateAdminUserPatchSafety({
      actorId: req.user.id,
      existingProfile,
      patch: patchResult.patch
    });
    if (!safetyResult.ok) {
      return res.status(400).json({
        ok: false,
        code: safetyResult.code,
        error: safetyResult.error
      });
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(patchResult.patch)
      .eq("id", userId)
      .select("id, email, full_name, role, is_active, must_change_password, created_at")
      .single();

    if (updateError) throw updateError;

    await recordProfileUpdateAuditEvents({
      actorId: req.user.id,
      before: existingProfile,
      after: updatedProfile,
      changedFields: Object.keys(patchResult.patch)
    });

    const latestActivityByActor = await readLatestActivityByActor();
    res.json({
      ok: true,
      user: serializeAdminUserProfile(updatedProfile, latestActivityByActor.get(updatedProfile.id))
    });
  } catch (error) {
    console.error("Admin user update failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "admin_user_update_failed",
      error: "อัปเดตผู้ใช้งานไม่สำเร็จ"
    });
  }
});

app.get("/api/jobs", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const result = await buildProductionJobsView(req.query);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Jobs production view failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "jobs_view_failed",
      error: "โหลดรายการงานไม่สำเร็จ"
    });
  }
});

app.get("/api/assets", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const result = await buildProductionAssetsView(req.query);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Assets production view failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "assets_view_failed",
      error: "โหลดคลังภาพไม่สำเร็จ"
    });
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
    console.error("Job create failed:", readableError(error));
    res.status(500).json({ ok: false, code: "job_create_failed", error: "สร้างงานไม่สำเร็จ" });
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
      if (isNoRowsError(error)) return sendApiError(res, 404, "job_not_found", "Job not found.");
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

    res.json({
      ok: true,
      job: sanitizeWorkflowJobDetail(job),
      generations: generations.map(sanitizeWorkflowGenerationDetail),
      assets,
      qc_checks: qcChecks,
      approvals
    });
  } catch (error) {
    console.error("Job detail failed:", readableError(error));
    res.status(500).json({ ok: false, code: "job_detail_failed", error: "โหลดรายละเอียดงานไม่สำเร็จ" });
  }
});

app.post("/api/qc-checks", requireUser, async (req, res) => {
  const generationId = String(req.body.generation_id || req.body.generationId || "").trim();
  if (!generationId) return sendApiError(res, 400, "generation_required", "Missing generation_id.");

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return sendApiError(res, 404, "generation_not_found", "Generation not found.");

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
  if (!generationId) return sendApiError(res, 400, "generation_required", "Missing generation_id.");

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return sendApiError(res, 404, "generation_not_found", "Generation not found.");

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
      return sendApiError(res, 400, "nothing_to_update", "Nothing to update.");
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("created_by", req.user.id)
      .select("*")
      .single();

    if (error) {
      if (isNoRowsError(error)) return sendApiError(res, 404, "job_not_found", "Job not found.");
      throw error;
    }

    res.json({ ok: true, job });
  } catch (error) {
    console.error("Job update failed:", readableError(error));
    res.status(500).json({ ok: false, code: "job_update_failed", error: "อัปเดตงานไม่สำเร็จ" });
  }
});

app.post("/api/admin/jobs/:jobId/retry", requireUser, requireAdminUser, async (req, res) => {
  try {
    const result = await retryGenerationForJob({
      jobId: String(req.params.jobId || "").trim(),
      generationId: String(req.body?.generationId || req.body?.generation_id || "").trim() || null,
      adminUserId: req.user.id
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    console.error("Job retry failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "job_retry_failed",
      error: error.publicMessage || "Retry งานไม่สำเร็จ"
    });
  }
});

app.post("/api/admin/generations/:generationId/retry", requireUser, requireAdminUser, async (req, res) => {
  try {
    const result = await retryGenerationForJob({
      generationId: String(req.params.generationId || "").trim(),
      adminUserId: req.user.id
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    console.error("Generation retry failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "generation_retry_failed",
      error: error.publicMessage || "Retry generation ไม่สำเร็จ"
    });
  }
});

app.post("/api/admin/jobs/:jobId/retry-export", requireUser, requireAdminUser, async (req, res) => {
  try {
    const result = await retryJobExport({
      jobId: String(req.params.jobId || "").trim(),
      adminUserId: req.user.id
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    console.error("Export retry failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "export_retry_failed",
      error: error.publicMessage || "Retry export ไม่สำเร็จ"
    });
  }
});

app.post("/api/admin/jobs/:jobId/mark-failed", requireUser, requireAdminUser, async (req, res) => {
  try {
    const result = await markStuckJobFailed({
      jobId: String(req.params.jobId || "").trim(),
      adminUserId: req.user.id,
      reason: cleanOptionalString(req.body?.reason) || "Marked failed by admin from recovery UI"
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    console.error("Mark stuck job failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "mark_failed_failed",
      error: error.publicMessage || "Mark as failed ไม่สำเร็จ"
    });
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
      logGenerateDiagnostic("request received", {
        userId: req.user.id,
        email: req.user.email || "",
        productFileCount: req.files?.productImages?.length || 0,
        modelFileCount: req.files?.modelImages?.length || 0
      });
      const profileCheck = await getWorkflowProfileForUser(req.user.id);
      if (!profileCheck.ok) {
        logGenerateDiagnostic("blocked", {
          userId: req.user.id,
          email: req.user.email || "",
          code: profileCheck.code,
          reason: profileCheck.error
        });
        return res.status(profileCheck.status).json({ ok: false, code: profileCheck.code, error: profileCheck.error });
      }
      logGenerateDiagnostic("profile ok", {
        userId: req.user.id,
        email: req.user.email || "",
        role: profileCheck.profile.role,
        isActive: profileCheck.profile.is_active,
        mustChangePassword: profileCheck.profile.must_change_password
      });

      const validation = validateGenerateRequest(req);
      if (validation) {
        logGenerateDiagnostic("blocked", {
          userId: req.user.id,
          email: req.user.email || "",
          code: validation.code || "invalid_request",
          reason: validation.error,
          productFileCount: req.files?.productImages?.length || 0,
          modelFileCount: req.files?.modelImages?.length || 0
        });
        return res.status(validation.status).json({ ok: false, code: validation.code || "invalid_request", error: validation.error });
      }

      pruneGenerationJobs();
      const dbJob = await prepareGenerationJob(req.body, req.user.id);
      const generation = await createGenerationRow(dbJob.id, req.body, req.user.id);
      logGenerateDiagnostic("job/generation created", {
        userId: req.user.id,
        email: req.user.email || "",
        role: profileCheck.profile.role,
        jobId: dbJob.id,
        generationId: generation?.id || null,
        productFileCount: req.files?.productImages?.length || 0,
        modelFileCount: req.files?.modelImages?.length || 0
      });
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
        error: null,
        userId: req.user.id
      };
      generationJobs.set(jobId, job);

      res.json({ ok: true, jobId, databaseJobId: dbJob.id, generationId: generation?.id || null, job: serializeRuntimeGenerationJob(job) });

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
      logGenerateDiagnostic("error", {
        userId: req.user?.id || "",
        email: req.user?.email || "",
        reason: readableError(error)
      });
      res.status(500).json({ ok: false, code: "generate_start_failed", error: readableError(error) });
    }
  }
);

app.get("/api/generate/jobs/:jobId", requireUser, async (req, res) => {
  const job = generationJobs.get(req.params.jobId);
  if (!job) return sendApiError(res, 404, "generation_job_not_found", "Generation job not found.");
  const profile = await getProfileForUser(req.user).catch(() => null);
  if (job.userId && job.userId !== req.user.id && profile?.role !== "admin") {
    return sendApiError(res, 403, "generation_job_forbidden", "ไม่มีสิทธิ์ดูสถานะ generation นี้");
  }
  res.json({ ok: true, job: serializeRuntimeGenerationJob(job) });
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
    if (validation) return res.status(validation.status).json({ ok: false, code: validation.code || "invalid_request", error: validation.error });
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
    console.error("Legacy generate failed:", readableError(error));
    res.status(500).json({ ok: false, code: "generate_failed", error: "Generate ไม่สำเร็จ" });
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
    console.error("Metrics today failed:", readableError(error));
    res.status(500).json({ ok: false, code: "metrics_failed", error: "โหลด metrics ไม่สำเร็จ" });
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
    console.error("Metrics failed:", readableError(error));
    res.status(500).json({ ok: false, code: "metrics_failed", error: "โหลด metrics ไม่สำเร็จ" });
  }
});

app.get("/api/kpi/summary", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const range = normalizeKpiRange(req.query.range);
    const kpi = await buildKpiSummary(range);
    res.json({ ok: true, ...kpi });
  } catch (error) {
    console.error("KPI summary failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "kpi_summary_failed",
      error: "โหลด KPI Dashboard ไม่สำเร็จ"
    });
  }
});

app.get("/api/google/oauth/status", requireUser, requireAdminUser, async (_req, res) => {
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
    res.status(500).json({ ok: false, code: "google_oauth_status_failed", error: "ตรวจสอบสถานะ Google Drive ไม่สำเร็จ" });
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
    res.json({ ok: true, authUrl });
  } catch (error) {
    console.error("Google OAuth start failed:", readableError(error));
    res.status(500).json({ ok: false, code: "google_oauth_start_failed", error: "เปิดลิงก์เชื่อมต่อ Google Drive ไม่สำเร็จ" });
  }
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    if (!code) return res.status(400).send("Missing Google OAuth code.");
    const state = String(req.query.state || "").trim();
    const statePayload = state ? googleOAuthStateById.get(state) : null;
    if (state) googleOAuthStateById.delete(state);
    if (!statePayload || Date.now() - statePayload.createdAt > 10 * 60 * 1000) {
      return res.status(401).json({
        ok: false,
        code: "invalid_oauth_state",
        error: "Google OAuth state ไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มเชื่อมต่อใหม่จากหน้า Settings"
      });
    }
    const updatedBy = statePayload.userId;

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
    res.status(500).json({ ok: false, code: "google_oauth_callback_failed", error: "เชื่อมต่อ Google Drive ไม่สำเร็จ" });
  }
});

app.post("/api/approve", requireUser, async (req, res) => {
  try {
    const imageUrl = String(req.body.imageUrl || "").trim();
    const jobName = sanitizeFileName(String(req.body.jobName || "approved-image"));
    const sku = sanitizeSku(String(req.body.sku || ""));
    if (!imageUrl) return sendApiError(res, 400, "image_url_required", "Missing imageUrl.");

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
    console.error("Approve/export failed:", readableError(error));
    if (googleDriveRootFolderId) {
      await recordAuditEvent({
        actorId: req.user?.id || null,
        eventType: "google_drive_export_failed",
        eventJson: { error: readableError(error), jobId: String(req.body.jobId || req.body.job_id || "").trim() || null }
      });
    }
    res.status(500).json({ ok: false, code: "approve_failed", error: readableError(error) });
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
    return { status: 400, code: "missing_fal_key", error: "Server ยังไม่พร้อมสำหรับ Generate กรุณาติดต่อผู้ดูแลระบบ" };
  }
  const productFiles = req.files?.productImages || [];
  if (!productFiles.length) {
    return { status: 400, code: "missing_product_image", error: "กรุณาอัปโหลดภาพสินค้าอย่างน้อย 1 รูป" };
  }
  const prompt = String(req.body.prompt || "").trim();
  if (!prompt) {
    return { status: 400, code: "missing_prompt", error: "ส่งงาน generate ไม่สำเร็จ: ไม่พบ prompt" };
  }
  return null;
}

async function runGenerationJob(jobId, request) {
  try {
    logGenerateDiagnostic("generation worker started", {
      userId: request.userId,
      jobId: request.dbJobId,
      generationId: request.generationId,
      productFileCount: request.files?.productImages?.length || 0,
      modelFileCount: request.files?.modelImages?.length || 0
    });
    const data = await runGeneration(request, (status, message) => {
      updateGenerationJob(jobId, { status, message });
      updateGenerationProgress(request, status).catch((error) => {
        console.error("Failed to update generation progress:", readableError(error));
      });
    });
    logGenerateDiagnostic("after FAL call", {
      userId: request.userId,
      jobId: request.dbJobId,
      generationId: request.generationId,
      imageCount: data.images?.length || 0,
      requestId: data.requestId || null
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
    if (request.retryAudit?.requestedBy) {
      await recordAuditEvent({
        actorId: request.retryAudit.requestedBy,
        jobId: request.dbJobId,
        generationId: request.generationId,
        eventType: "retry_completed",
        eventJson: {
          previous_generation_id: request.retryAudit.previousGenerationId || null,
          request_id: data.requestId || null
        }
      });
    }
  } catch (error) {
    console.error(error);
    logGenerateDiagnostic("error", {
      userId: request.userId,
      jobId: request.dbJobId,
      generationId: request.generationId,
      reason: readableError(error)
    });
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
    if (request.retryAudit?.requestedBy) {
      await recordAuditEvent({
        actorId: request.retryAudit.requestedBy,
        jobId: request.dbJobId,
        generationId: request.generationId,
        eventType: "retry_failed",
        eventJson: {
          previous_generation_id: request.retryAudit.previousGenerationId || null,
          error: readableError(error)
        }
      });
    }
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
    logGenerateDiagnostic("before FAL call", {
      userId: request.userId,
      jobId: request.dbJobId,
      generationId: request.generationId,
      imageUrlCount: imageUrls.length,
      productFileCount: productFiles.length,
      modelFileCount: modelFiles.length
    });
    request.providerCallStarted = true;
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

function serializeRuntimeGenerationJob(job = {}) {
  const safe = { ...job };
  delete safe.userId;
  return safe;
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

async function retryGenerationForJob({ jobId = "", generationId = "", adminUserId }) {
  const target = await resolveRetryTarget({ jobId, generationId });
  const retryCheck = await validateGenerationRetryable(target);
  if (!retryCheck.ok) throw publicError(409, retryCheck.code, retryCheck.error);

  const referenceUrls = await collectRetryReferenceUrls(target.job.id, target.job.form_json);
  if (!referenceUrls.length) {
    await recordAuditEvent({
      actorId: adminUserId,
      jobId: target.job.id,
      generationId: target.generation?.id || null,
      eventType: "retry_failed",
      eventJson: { reason: "no_reference_urls" }
    });
    throw publicError(400, "retry_reference_missing", "Retry ไม่ได้ เพราะไม่พบ reference image URL ที่ใช้สร้างงานเดิม");
  }

  const retryBody = buildRetryGenerateBody(target, referenceUrls);
  if (!String(retryBody.prompt || "").trim()) {
    throw publicError(400, "retry_prompt_missing", "Retry ไม่ได้ เพราะไม่พบ prompt เดิมของ generation");
  }
  await markStuckActiveGenerationsBeforeRetry(target.job.id, adminUserId);
  const newGeneration = await createGenerationRow(target.job.id, retryBody, target.job.created_by, {
    retry: true,
    retryRequestedBy: adminUserId,
    previousGenerationId: target.generation?.id || null
  });
  await supabaseAdmin
    .from("jobs")
    .update({ status: "queued", form_json: normalizeJsonObject(target.job.form_json) })
    .eq("id", target.job.id);

  const runtimeJob = createRuntimeGenerationJob(target.job.id, newGeneration.id, "Retry queued by admin", target.job.created_by);
  generationJobs.set(target.job.id, runtimeJob);

  await recordAuditEvent({
    actorId: adminUserId,
    jobId: target.job.id,
    generationId: newGeneration.id,
    eventType: target.generation?.id ? "generation_retry_requested" : "job_retry_requested",
    eventJson: {
      previous_generation_id: target.generation?.id || null,
      reference_count: referenceUrls.length,
      provider: costTrackingConfig.provider,
      model: costTrackingConfig.model,
      units: 1,
      unit_type: costTrackingConfig.unitType,
      estimated_cost: estimateGenerationCost(),
      currency: costTrackingConfig.currency,
      status: "queued",
      retry: true,
      failure: false,
      cost_basis: "configured_estimate"
    }
  });

  runGenerationJob(target.job.id, {
    userId: target.job.created_by,
    dbJobId: target.job.id,
    generationId: newGeneration.id,
    body: retryBody,
    files: {
      productImages: [],
      modelImages: []
    },
    retryAudit: {
      requestedBy: adminUserId,
      previousGenerationId: target.generation?.id || null
    }
  });

  return {
    jobId: target.job.id,
    generationId: newGeneration.id,
    status: "queued",
    message: "ส่ง retry เข้าคิวแล้ว"
  };
}

async function resolveRetryTarget({ jobId = "", generationId = "" }) {
  let generation = null;
  if (generationId) {
    const { data, error } = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw publicError(404, "generation_not_found", "ไม่พบ generation ที่ต้องการ retry");
    generation = data;
    jobId = generation.job_id;
  }
  if (!jobId) throw publicError(400, "job_required", "ไม่พบ job id สำหรับ retry");

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw publicError(404, "job_not_found", "ไม่พบงานที่ต้องการ retry");

  if (!generation) {
    const { data, error } = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    generation = data?.[0] || null;
  }

  return { job, generation };
}

async function validateGenerationRetryable({ job, generation }) {
  const active = await readActiveGenerationForJob(job.id);
  if (active && !isStuckGeneration(active)) {
    return { ok: false, code: "retry_active_generation_exists", error: "งานนี้มี generation ที่กำลังทำงานอยู่แล้ว" };
  }
  if (generation && isRetryableGeneration(generation)) return { ok: true };
  if (generation && isStuckGeneration(generation)) return { ok: true };
  if (isFailedStatus(job.status)) return { ok: true };
  if (isStuckJobStatus(job.status, job.updated_at || job.created_at)) return { ok: true };
  return { ok: false, code: "retry_not_allowed", error: "สถานะงานนี้ยังไม่เข้าเงื่อนไข retry" };
}

async function readActiveGenerationForJob(jobId) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, status, created_at, updated_at")
    .eq("job_id", jobId)
    .in("status", ["queued", "running", "generating", "processing", "uploading", "pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("Active generation check failed:", readableError(error));
    return null;
  }
  return data?.[0] || null;
}

async function markStuckActiveGenerationsBeforeRetry(jobId, adminUserId) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, status, created_at, updated_at")
    .eq("job_id", jobId)
    .in("status", ["queued", "running", "generating", "processing", "uploading", "pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("Stuck generation cleanup failed:", readableError(error));
    return [];
  }
  const stuckIds = (data || []).filter(isStuckGeneration).map((generation) => generation.id);
  if (!stuckIds.length) return [];
  await supabaseAdmin
    .from("generations")
    .update({ status: "failed", error_message: "Marked failed before admin retry because generation was stuck" })
    .in("id", stuckIds);
  await recordAuditEvent({
    actorId: adminUserId,
    jobId,
    eventType: "stuck_job_marked_failed",
    eventJson: {
      reason: "Marked stuck active generations failed before retry",
      generation_ids: stuckIds
    }
  });
  return stuckIds;
}

async function recoverAbandonedGenerationQueue() {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, job_id, status, created_at, updated_at")
    .in("status", ["queued", "running", "generating", "processing", "uploading", "pending", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.warn("[queue-recovery] scan failed:", readableError(error));
    return;
  }

  const abandoned = (data || []).filter(isStuckGeneration);
  if (!abandoned.length) return;

  const generationIds = abandoned.map((generation) => generation.id).filter(Boolean);
  const jobIds = Array.from(new Set(abandoned.map((generation) => generation.job_id).filter(Boolean)));
  const reason = "Marked failed by server startup recovery because the active generation was abandoned";

  const generationResult = await supabaseAdmin
    .from("generations")
    .update({ status: "failed", error_message: reason })
    .in("id", generationIds);
  if (generationResult.error) {
    console.warn("[queue-recovery] generation update failed:", readableError(generationResult.error));
    return;
  }

  if (jobIds.length) {
    const jobResult = await supabaseAdmin
      .from("jobs")
      .update({ status: "failed" })
      .in("id", jobIds);
    if (jobResult.error) {
      console.warn("[queue-recovery] job update failed:", readableError(jobResult.error));
    }
  }

  for (const jobId of jobIds) {
    const jobGenerationIds = abandoned
      .filter((generation) => generation.job_id === jobId)
      .map((generation) => generation.id);
    await recordAuditEvent({
      actorId: null,
      jobId,
      eventType: "stuck_job_marked_failed",
      eventJson: {
        reason,
        generation_ids: jobGenerationIds,
        source: "server_startup_recovery"
      }
    });
  }

  console.info("[queue-recovery] abandoned generations marked failed", {
    generations: generationIds.length,
    jobs: jobIds.length
  });
}

async function collectRetryReferenceUrls(jobId, formJson = {}) {
  const urls = new Set(parseExtraImageUrls(normalizeJsonObject(formJson).extraImageUrls));
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("type, public_url, storage_key")
    .eq("job_id", jobId)
    .in("type", ["product_reference", "model_reference", "hero_generated", "support_generated"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    console.warn("Retry references unavailable:", readableError(error));
  }
  (data || []).forEach((asset) => {
    [asset.public_url, asset.storage_key].forEach((value) => {
      const url = safeRetryUrl(value);
      if (url) urls.add(url);
    });
  });
  return Array.from(urls).slice(0, 6);
}

function buildRetryGenerateBody({ job, generation }, referenceUrls) {
  const formJson = normalizeJsonObject(job.form_json);
  return {
    ...formJson,
    prompt: generation?.prompt || formJson.prompt || "",
    jobKind: generation?.kind || formJson.jobKind || "hero",
    kind: generation?.kind || formJson.jobKind || "hero",
    jobId: job.id,
    sku: job.sku || formJson.sku || "",
    productName: job.product_name || formJson.productName || "",
    brand: job.brand || formJson.brand || "",
    category: job.category || formJson.category || "",
    imageSize: formJson.imageSize || "square_hd",
    quality: formJson.quality || "high",
    numImages: formJson.numImages || 1,
    outputFormat: formJson.outputFormat || "png",
    extraImageUrls: JSON.stringify(referenceUrls)
  };
}

function createRuntimeGenerationJob(jobId, generationId, message, userId = null) {
  return {
    id: jobId,
    jobId,
    databaseJobId: jobId,
    generationId,
    status: "queued",
    message,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requestId: null,
    images: [],
    error: null,
    userId
  };
}

async function createGenerationRow(jobId, body = {}, userId, options = {}) {
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
    eventJson: {
      generation_id: data.id,
      kind: data.kind || null,
      status: data.status || null,
      provider: costTrackingConfig.provider,
      model: data.model || costTrackingConfig.model,
      units: 1,
      unit_type: costTrackingConfig.unitType,
      estimated_cost: estimateGenerationCost(),
      currency: costTrackingConfig.currency,
      cost_basis: "configured_estimate",
      retry: options.retry === true,
      failure: false,
      previous_generation_id: options.previousGenerationId || null,
      retry_requested_by: options.retryRequestedBy || null
    }
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
    eventJson: buildGenerationUsageEventJson({
      status: "done",
      requestId: data.requestId || null,
      retry: request.retryAudit?.requestedBy ? true : false,
      failure: false,
      usage: data.usage || null,
      imageCount: data.images?.length || null,
      previousGenerationId: request.retryAudit?.previousGenerationId || null
    })
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
    eventJson: buildGenerationUsageEventJson({
      status: "failed",
      requestId: null,
      retry: request.retryAudit?.requestedBy ? true : false,
      failure: true,
      errorMessage,
      providerCallStarted: request.providerCallStarted === true,
      previousGenerationId: request.retryAudit?.previousGenerationId || null
    })
  });
}

async function markStuckJobFailed({ jobId, adminUserId, reason }) {
  if (!jobId) throw publicError(400, "job_required", "ไม่พบ job id");
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job) throw publicError(404, "job_not_found", "ไม่พบงานที่ต้องการ mark failed");
  if (!isStuckJobStatus(job.status, job.updated_at || job.created_at)) {
    throw publicError(409, "job_not_stuck", "งานนี้ยังไม่เข้าเงื่อนไข stuck ที่ mark failed ได้");
  }

  const { data: generations, error: generationsError } = await supabaseAdmin
    .from("generations")
    .select("id, status, created_at, updated_at")
    .eq("job_id", jobId)
    .in("status", ["queued", "running", "generating", "processing", "uploading", "pending", "in_progress"]);
  if (generationsError) throw generationsError;

  await supabaseAdmin
    .from("jobs")
    .update({ status: "failed" })
    .eq("id", jobId);

  const generationIds = (generations || []).map((generation) => generation.id).filter(Boolean);
  if (generationIds.length) {
    await supabaseAdmin
      .from("generations")
      .update({ status: "failed", error_message: reason })
      .in("id", generationIds);
  }

  await recordAuditEvent({
    actorId: adminUserId,
    jobId,
    eventType: "stuck_job_marked_failed",
    eventJson: {
      reason,
      generation_ids: generationIds
    }
  });

  return {
    jobId,
    generationId: generationIds[0] || null,
    status: "failed",
    message: "Mark as failed สำเร็จ"
  };
}

async function retryJobExport({ jobId, adminUserId }) {
  if (!jobId) throw publicError(400, "job_required", "ไม่พบ job id");
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job) throw publicError(404, "job_not_found", "ไม่พบงานที่ต้องการ retry export");

  const source = await findRetryExportSource(jobId);
  if (!source?.imageUrl) {
    await recordAuditEvent({
      actorId: adminUserId,
      jobId,
      eventType: "retry_failed",
      eventJson: { reason: "export_source_missing" }
    });
    throw publicError(400, "export_source_missing", "Retry export ไม่ได้ เพราะไม่พบ approved/generated image URL ที่ใช้ส่งออกซ้ำ");
  }

  const extension = extensionFromUrl(source.imageUrl) || "png";
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_${sanitizeFileName(job.sku || job.product_name || "retry-export")}.${extension}`;
  const approvedPath = path.join(approvedDir, fileName);

  try {
    await recordAuditEvent({
      actorId: adminUserId,
      jobId,
      generationId: source.generationId || null,
      eventType: "export_retry_requested",
      eventJson: { source_asset_id: source.assetId || null }
    });

    await downloadFile(source.imageUrl, approvedPath);
    const approvedFileStat = await fs.stat(approvedPath);
    let googleDriveFile = null;
    if (googleDriveRootFolderId) {
      googleDriveFile = await uploadApprovedFileToGoogleDrive({
        localPath: approvedPath,
        fileName,
        extension,
        sku: job.sku || ""
      });
    }

    await recordApprovedExportAsset({
      jobId,
      userId: adminUserId,
      fileName,
      extension,
      fileSize: approvedFileStat.size,
      approvedPath,
      drivePath: null,
      googleDriveFile
    });

    if (!keepLocalApproved && googleDriveFile) {
      await fs.unlink(approvedPath).catch(() => {});
    }

    await recordAuditEvent({
      actorId: adminUserId,
      jobId,
      generationId: source.generationId || null,
      eventType: "retry_completed",
      eventJson: {
        retry_type: "export",
        google_drive_file_id: googleDriveFile?.id || null
      }
    });

    return {
      jobId,
      generationId: source.generationId || null,
      status: googleDriveFile ? "google_drive" : "exported",
      message: "Retry export สำเร็จ",
      googleDriveFile: googleDriveFile ? {
        id: googleDriveFile.id,
        name: googleDriveFile.name,
        webViewLink: googleDriveFile.webViewLink || null
      } : null
    };
  } catch (error) {
    await recordAuditEvent({
      actorId: adminUserId,
      jobId,
      generationId: source.generationId || null,
      eventType: "retry_failed",
      eventJson: { retry_type: "export", error: readableError(error) }
    });
    throw error;
  }
}

async function findRetryExportSource(jobId) {
  const { data: assets, error } = await supabaseAdmin
    .from("assets")
    .select("id, type, public_url, storage_key, created_at")
    .eq("job_id", jobId)
    .in("type", ["approved_export", "hero_generated", "support_generated"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const asset = (assets || []).find((item) => safeRetryUrl(item.public_url || item.storage_key));
  if (!asset) return null;
  const generationId = await findGenerationIdForAsset(jobId, asset.id);
  return {
    assetId: asset.id,
    generationId,
    imageUrl: safeRetryUrl(asset.public_url || asset.storage_key)
  };
}

async function findGenerationIdForAsset(jobId, assetId) {
  const { data, error } = await supabaseAdmin
    .from("audit_events")
    .select("generation_id")
    .eq("job_id", jobId)
    .contains("event_json", { assetId })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0]?.generation_id || null;
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

function sanitizeWorkflowJobDetail(job = {}) {
  const formJson = normalizeJsonObject(job.form_json);
  const safeFormJson = { ...formJson };
  delete safeFormJson.prompt;
  delete safeFormJson.extraImageUrls;
  return {
    ...job,
    form_json: safeFormJson
  };
}

function sanitizeWorkflowGenerationDetail(generation = {}) {
  const safe = { ...generation };
  delete safe.prompt;
  return safe;
}

async function getWorkflowProfileForUser(userId) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, is_active, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) {
    return {
      ok: false,
      status: 403,
      code: "profile_missing",
      error: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
    };
  }

  const role = String(profile.role || "").trim().toLowerCase();
  if (!["admin", "staff"].includes(role)) {
    return {
      ok: false,
      status: 403,
      code: "invalid_role",
      error: "บัญชีนี้ไม่มีสิทธิ์หรือยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
    };
  }
  if (profile.is_active === false) {
    return {
      ok: false,
      status: 403,
      code: "inactive_profile",
      error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
    };
  }
  if (profile.must_change_password === true) {
    return {
      ok: false,
      status: 403,
      code: "password_change_required",
      error: "กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนเริ่มใช้งาน"
    };
  }

  return {
    ok: true,
    profile: {
      ...profile,
      role,
      is_active: profile.is_active !== false,
      must_change_password: profile.must_change_password === true
    }
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

function buildGenerationUsageEventJson({
  status,
  requestId = null,
  retry = false,
  failure = false,
  usage = null,
  imageCount = null,
  errorMessage = "",
  providerCallStarted = true,
  previousGenerationId = null
} = {}) {
  const costApplies = failure ? providerCallStarted === true : true;
  return {
    provider: costTrackingConfig.provider,
    model: costTrackingConfig.model,
    units: 1,
    unit_type: costTrackingConfig.unitType,
    estimated_cost: costApplies ? estimateGenerationCost() : null,
    currency: costTrackingConfig.currency,
    status: status || null,
    retry: retry === true,
    failure: failure === true,
    provider_call_started: providerCallStarted === true,
    cost_basis: costApplies ? "configured_estimate" : "unknown_before_provider_call",
    request_id: requestId || null,
    image_count: Number.isFinite(imageCount) ? imageCount : null,
    previous_generation_id: previousGenerationId || null,
    usage: sanitizeProviderUsage(usage),
    errorMessage: errorMessage ? safeMonitoringText(errorMessage, 220) : null
  };
}

function sanitizeProviderUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const safe = {};
  Object.entries(usage).slice(0, 20).forEach(([key, value]) => {
    const safeKey = safeMonitoringText(key, 60);
    if (!safeKey || /token|secret|key|prompt|payload/i.test(safeKey)) return;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === null) {
      safe[safeKey] = typeof value === "string" ? safeMonitoringText(value, 120) : value;
    }
  });
  return Object.keys(safe).length ? safe : null;
}

function normalizeCostNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function estimateGenerationCost() {
  return roundCost(costTrackingConfig.estimatedCostPerGeneration);
}

function roundCost(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 1000000) / 1000000;
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
  if (Array.isArray(value)) {
    return value
      .map((url) => String(url || "").trim())
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 6);
  }
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

function logGenerateDiagnostic(message, details = {}) {
  console.info("[generate/start]", message, sanitizeLogObject(details));
}

function sanitizeLogObject(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeLogObject(item, depth + 1));
  if (typeof value === "object") {
    const safe = {};
    Object.entries(value).slice(0, 40).forEach(([key, item]) => {
      if (/password|token|secret|service_role|fal_key|openai_api_key|token_json|prompt|payload/i.test(key)) {
        safe[key] = "[hidden]";
        return;
      }
      safe[key] = sanitizeLogObject(item, depth + 1);
    });
    return safe;
  }
  return "[unsupported]";
}

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token|service_role|password|token_json|fal_key|openai_api_key)[=:]\s*([^&\s,}]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .slice(0, 1000);
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

function normalizeKpiRange(value) {
  const range = String(value || "7d").trim().toLowerCase();
  if (["today", "7d", "30d", "all"].includes(range)) return range;
  return "7d";
}

function getKpiRangeMeta(range) {
  const todayKey = localDateKey();
  if (range === "all") {
    return {
      range,
      label: "ทั้งหมด",
      since: null,
      todayKey
    };
  }

  const days = range === "today" ? 1 : range === "30d" ? 30 : 7;
  const todayStart = zonedDateStartUtc(todayKey);
  const sinceDate = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    range,
    label: range === "today" ? "วันนี้" : range === "30d" ? "30 วันที่ผ่านมา" : "7 วันที่ผ่านมา",
    since: sinceDate.toISOString(),
    todayKey
  };
}

function zonedDateStartUtc(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimezoneOffsetMs(utcGuess, appTimezone);
  const candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
  const correctedOffset = getTimezoneOffsetMs(candidate, appTimezone);
  return correctedOffset === offset
    ? candidate
    : new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - correctedOffset);
}

function getTimezoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour === "24" ? "0" : values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
}

async function buildKpiSummary(range) {
  const rangeMeta = getKpiRangeMeta(range);
  const limit = range === "all" ? 5000 : 3000;
  const warnings = [];

  const [
    jobsResult,
    generationsResult,
    approvalsResult,
    assetsResult,
    qcChecksResult,
    auditEventsResult
  ] = await Promise.all([
    readKpiRows("jobs", "id, sku, product_name, brand, category, status, created_by, created_at", {
      since: rangeMeta.since,
      limit
    }),
    readKpiRows("generations", "id, job_id, kind, request_id, status, created_by, created_at, completed_at, error_message", {
      since: rangeMeta.since,
      limit
    }),
    readKpiRows("approvals", "id, generation_id, approved_by, approved_at, export_path", {
      since: rangeMeta.since,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit
    }),
    readKpiRows("assets", "id, job_id, type, bucket, created_by, created_at", {
      since: rangeMeta.since,
      limit
    }),
    readKpiRows("qc_checks", "id, generation_id, passed, checked_by, checked_at", {
      since: rangeMeta.since,
      dateColumn: "checked_at",
      orderColumn: "checked_at",
      limit,
      optional: true
    }),
    readKpiRows("audit_events", "id, actor_id, job_id, generation_id, event_type, created_at", {
      since: rangeMeta.since,
      limit: 20,
      optional: true
    })
  ]);

  if (qcChecksResult.error) warnings.push(createWarning("qc_unavailable", "ยังอ่านข้อมูล QC ไม่ได้ จึงยังคำนวณ QC pass rate ไม่ได้"));
  if (auditEventsResult.error) warnings.push(createWarning("audit_unavailable", "ยังอ่าน recent activity จาก audit events ไม่ได้"));

  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const assets = assetsResult.data;
  const qcChecks = qcChecksResult.data;
  const auditEvents = auditEventsResult.data;

  [jobsResult, generationsResult, approvalsResult, assetsResult, qcChecksResult].forEach((result) => {
    if (result.limited) {
      warnings.push(createWarning("data_limited", `ข้อมูล ${result.table} ถูกจำกัดที่ ${result.limit.toLocaleString("th-TH")} แถวเพื่อประสิทธิภาพ`));
    }
  });

  const userIds = collectUserIds(jobs, generations, approvals, qcChecks, auditEvents, assets);
  const profiles = await readKpiProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const generationById = new Map(generations.map((generation) => [generation.id, generation]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const approvedGenerationIds = new Set(approvals.map((approval) => approval.generation_id).filter(Boolean));
  const generatedGenerations = generations.filter((generation) => isSuccessfulGenerationStatus(generation.status));
  const generatedGenerationIds = new Set(generatedGenerations.map((generation) => generation.id));
  const failedGenerationIds = new Set(
    generations.filter((generation) => isFailedStatus(generation.status) || generation.error_message).map((generation) => generation.id)
  );
  const failedJobIds = new Set(jobs.filter((job) => isFailedStatus(job.status)).map((job) => job.id));
  generations.forEach((generation) => {
    if (failedGenerationIds.has(generation.id) && generation.job_id) failedJobIds.add(generation.job_id);
  });

  const exportedAssets = assets.filter((asset) => String(asset.type || "").toLowerCase() === "approved_export");
  const exported = exportedAssets.length || approvals.filter((approval) => approval.export_path).length;
  const qcGenerationIds = new Set(qcChecks.map((check) => check.generation_id).filter(Boolean));
  const qcPassed = qcChecks.filter((check) => check.passed === true).length;
  const pendingApproval = generatedGenerations.filter((generation) => !approvedGenerationIds.has(generation.id)).length;
  const approved = approvals.length;
  const generated = generatedGenerations.length;
  const failed = failedJobIds.size || failedGenerationIds.size;
  const activeStaffIds = collectActiveStaffIds(jobs, generations, approvals, qcChecks, auditEvents, assets);
  const averageTurnaroundMinutes = calculateAverageTurnaroundMinutes(approvals, generationById, jobById);

  const summary = {
    totalJobs: jobs.length,
    generated,
    approved,
    pendingApproval,
    failed,
    approvalRate: generated ? roundMetric((approved / generated) * 100) : null,
    qcPassRate: qcChecks.length ? roundMetric((qcPassed / qcChecks.length) * 100) : null,
    averageTurnaroundMinutes,
    activeStaff: activeStaffIds.size
  };

  if (failed > 0) warnings.push(createWarning("failed_jobs", `มีงาน failed ${failed.toLocaleString("th-TH")} งานในช่วงนี้`));
  if (pendingApproval > 0) warnings.push(createWarning("pending_approvals", `มีงานรอ approve ${pendingApproval.toLocaleString("th-TH")} งาน`));
  if (!summary.totalJobs && !generated && !approved) warnings.push(createWarning("no_activity", "ยังไม่มี production activity ในช่วงเวลานี้"));
  if (generated && failed / Math.max(generated + failed, 1) >= 0.2) {
    warnings.push(createWarning("high_failure_rate", "อัตรา failure สูงกว่าปกติ ควรตรวจสอบ generation queue และ input ล่าสุด"));
  }

  const googleDriveStatus = await getSafeGoogleDriveStatus();
  if (!googleDriveStatus.connected) warnings.push(createWarning("google_drive_disconnected", "Google Drive ยังไม่ connected หรือ token ใช้งานไม่ได้"));

  return {
    range,
    rangeLabel: rangeMeta.label,
    generatedAt: new Date().toISOString(),
    summary,
    executiveSummary: buildExecutiveSummary(rangeMeta.label, summary),
    warnings: dedupeWarnings(warnings),
    trends: buildKpiTrends({ jobs, generations, approvals, assets }),
    funnel: buildKpiFunnel({ created: jobs.length, generated, qcChecked: qcGenerationIds.size, approved, exported }),
    statusBreakdown: buildStatusBreakdown(jobs, generations),
    staffPerformance: buildStaffPerformance({
      jobs,
      generations,
      approvals,
      qcChecks,
      profileById,
      generatedGenerationIds,
      failedGenerationIds
    }),
    recentActivity: buildRecentActivity({
      auditEvents,
      jobs,
      generations,
      approvals,
      profileById
    }),
    systemHealth: {
      googleDrive: googleDriveStatus
    }
  };
}

async function buildMonitoringCenter(range, paginationInput = normalizeMonitoringPagination()) {
  const rangeMeta = getKpiRangeMeta(range);
  const limit = range === "all" ? 5000 : 2500;
  const readWarnings = [];

  const [
    jobsResult,
    generationsResult,
    approvalsResult,
    assetsResult,
    auditEventsResult
  ] = await Promise.all([
    readMonitoringRows("jobs", [
      "id, sku, product_name, status, created_by, created_at, updated_at",
      "id, sku, product_name, status, created_by, created_at"
    ], {
      since: rangeMeta.since,
      limit
    }),
    readMonitoringRows("generations", [
      "id, job_id, kind, request_id, status, created_by, created_at, updated_at, completed_at, error_message",
      "id, job_id, kind, request_id, status, created_by, created_at, completed_at, error_message"
    ], {
      since: rangeMeta.since,
      limit
    }),
    readMonitoringRows("approvals", [
      "id, generation_id, approved_by, approved_at, export_path, note",
      "id, generation_id, approved_by, approved_at, export_path"
    ], {
      since: rangeMeta.since,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit
    }),
    readMonitoringRows("assets", [
      "id, job_id, type, bucket, storage_key, public_url, created_by, created_at",
      "id, job_id, type, bucket, created_by, created_at"
    ], {
      since: rangeMeta.since,
      limit,
      optional: true
    }),
    readMonitoringRows("audit_events", [
      "id, actor_id, job_id, generation_id, event_type, event_json, created_at",
      "id, actor_id, job_id, generation_id, event_type, created_at"
    ], {
      since: rangeMeta.since,
      limit,
      optional: true
    })
  ]);

  [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult].forEach((result) => {
    if (result.error) {
      readWarnings.push(createWarning(`${result.table}_unavailable`, `ยังอ่านข้อมูล ${result.table} ไม่ได้ จึงแสดงผลส่วนนั้นเป็นค่าว่าง`));
    }
    if (result.limited) {
      readWarnings.push(createWarning(`${result.table}_limited`, `ข้อมูล ${result.table} ถูกจำกัดที่ ${result.limit.toLocaleString("th-TH")} แถวเพื่อประสิทธิภาพ`));
    }
  });

  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const assets = assetsResult.data;
  const auditEvents = auditEventsResult.data;
  const userIds = collectMonitoringUserIds(jobs, generations, approvals, assets, auditEvents);
  const profiles = await readKpiProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const generationById = new Map(generations.map((generation) => [generation.id, generation]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const approvedGenerationIds = new Set(approvals.map((approval) => approval.generation_id).filter(Boolean));

  const failedJobs = jobs.filter((job) => isFailedStatus(job.status));
  const failedGenerations = generations.filter((generation) => isFailedStatus(generation.status) || generation.error_message);
  const exportFailureEvents = auditEvents.filter((event) => isExportFailureEvent(event.event_type));
  const storageFailureEvents = auditEvents.filter((event) => isStorageFailureEvent(event.event_type));
  const approvalFailureEvents = auditEvents.filter((event) => isApprovalFailureEvent(event.event_type));
  const systemFailureEvents = auditEvents.filter((event) => isMonitoringFailureEvent(event.event_type));
  const pendingApprovals = generations.filter(
    (generation) => isSuccessfulGenerationStatus(generation.status) && !approvedGenerationIds.has(generation.id)
  );
  const stuckJobs = buildMonitoringStuckItems({ jobs, generations, profileById });
  const googleDriveStatus = await getSafeGoogleDriveStatus();

  const failedItems = buildMonitoringFailedItems({
    failedJobs,
    failedGenerations,
    failureEvents: systemFailureEvents,
    jobById,
    generationById,
    profileById
  });
  const recentErrors = failedItems.slice(0, 30);
  const latestErrorTime = recentErrors[0]?.time || null;
  const recentSystemEvents = buildMonitoringRecentEvents({ auditEvents, jobById, generationById, profileById });
  const pagination = buildMonitoringPaginationMeta(paginationInput, {
    stuckJobs: stuckJobs.length,
    failedItems: failedItems.length,
    recentSystemEvents: recentSystemEvents.length
  });

  const warnings = [
    ...readWarnings,
    ...buildMonitoringWarnings({
      googleDriveStatus,
      failedJobs,
      failedGenerations,
      exportFailureEvents,
      storageFailureEvents,
      approvalFailureEvents,
      stuckJobs,
      pendingApprovals,
      jobs,
      generations,
      approvals,
      auditEvents
    })
  ];
  const dedupedWarnings = dedupeWarnings(warnings);

  return {
    range,
    rangeLabel: rangeMeta.label,
    generatedAt: new Date().toISOString(),
    health: {
      googleDriveConnected: googleDriveStatus.connected,
      recentActivityExists: Boolean(jobs.length || generations.length || approvals.length || auditEvents.length),
      failedJobs: failedJobs.length,
      failedGenerations: failedGenerations.length,
      pendingApprovals: pendingApprovals.length,
      stuckJobs: stuckJobs.length,
      warningsCount: dedupedWarnings.length
    },
    integrationHealth: {
      googleDrive: {
        mode: googleDriveStatus.mode,
        configured: googleDriveStatus.configured,
        connected: googleDriveStatus.connected,
        updatedAt: googleDriveStatus.updatedAt
      }
    },
    pagination,
    summary: {
      totalErrors: failedJobs.length + failedGenerations.length + exportFailureEvents.length + storageFailureEvents.length + approvalFailureEvents.length,
      failedJobs: failedJobs.length,
      failedGenerations: failedGenerations.length,
      failedExports: exportFailureEvents.length,
      stuckJobs: stuckJobs.length,
      storageFailures: storageFailureEvents.length,
      approvalFailures: approvalFailureEvents.length,
      pendingApprovals: pendingApprovals.length,
      warningsCount: dedupedWarnings.length,
      latestErrorTime
    },
    warnings: dedupedWarnings,
    stuckJobs: paginateMonitoringItems(stuckJobs, pagination),
    failedItems: paginateMonitoringItems(failedItems, pagination),
    recentErrors,
    recentSystemEvents: paginateMonitoringItems(recentSystemEvents, pagination)
  };
}

async function buildCostUsageDashboard(range, paginationInput = normalizeProductionPagination()) {
  const rangeMeta = getKpiRangeMeta(range);
  const readLimit = range === "all" ? 7000 : 3500;
  const warnings = [];

  const [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult] = await Promise.all([
    readMonitoringRows("jobs", [
      "id, sku, product_name, brand, category, status, created_by, created_at, updated_at, form_json",
      "id, sku, product_name, status, created_by, created_at, updated_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("generations", [
      "id, job_id, kind, request_id, status, model, created_by, created_at, updated_at, completed_at, error_message",
      "id, job_id, kind, request_id, status, created_by, created_at, completed_at, error_message"
    ], {
      since: rangeMeta.since,
      limit: readLimit
    }),
    readMonitoringRows("approvals", [
      "id, generation_id, approved_by, approved_at, export_path",
      "id, generation_id, approved_by, approved_at"
    ], {
      since: rangeMeta.since,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("assets", [
      "id, job_id, type, bucket, created_by, created_at",
      "id, job_id, type, created_by, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("audit_events", [
      "id, actor_id, job_id, generation_id, event_type, event_json, created_at",
      "id, actor_id, job_id, generation_id, event_type, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    })
  ]);

  [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult].forEach((result) => {
    if (result.error) {
      warnings.push(createWarning(`${result.table}_unavailable`, `ยังอ่านข้อมูล ${result.table} ไม่ได้ จึงคำนวณบางส่วนจากข้อมูลที่มี`));
    }
    if (result.limited) {
      warnings.push(createWarning(`${result.table}_limited`, `ข้อมูล ${result.table} ถูกจำกัดที่ ${result.limit.toLocaleString("th-TH")} แถวเพื่อประสิทธิภาพ`));
    }
  });

  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const assets = assetsResult.data;
  const auditEvents = auditEventsResult.data;
  const userIds = collectMonitoringUserIds(jobs, generations, approvals, assets, auditEvents);
  const profiles = await readKpiProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const generationById = new Map(generations.map((generation) => [generation.id, generation]));
  const auditEventsByGenerationId = groupAuditEventsByGenerationId(auditEvents);
  const retryGenerationIds = collectRetryGenerationIds(auditEvents);
  const approvedGenerationIds = new Set(approvals.map((approval) => approval.generation_id).filter(Boolean));
  const approvedAssetsByJobId = groupBy(
    assets.filter((asset) => String(asset.type || "").toLowerCase() === "approved_export"),
    "job_id"
  );
  const approvalsByJobId = new Map();
  approvals.forEach((approval) => {
    const generation = generationById.get(approval.generation_id);
    if (!generation?.job_id) return;
    if (!approvalsByJobId.has(generation.job_id)) approvalsByJobId.set(generation.job_id, []);
    approvalsByJobId.get(generation.job_id).push(approval);
  });

  const generationCosts = generations.map((generation) => {
    const cost = getEstimatedGenerationCost(generation, auditEventsByGenerationId.get(generation.id) || []);
    return {
      generation,
      estimatedCost: cost,
      isRetry: retryGenerationIds.has(generation.id),
      isFailed: isFailedStatus(generation.status) || Boolean(generation.error_message),
      isSuccessful: isSuccessfulGenerationStatus(generation.status)
    };
  });

  const totalGenerations = generationCosts.length;
  const successfulGenerations = generationCosts.filter((item) => item.isSuccessful).length;
  const failedGenerations = generationCosts.filter((item) => item.isFailed).length;
  const retryGenerations = generationCosts.filter((item) => item.isRetry).length;
  const approvedOutputs = approvals.length || assets.filter((asset) => String(asset.type || "").toLowerCase() === "approved_export").length;
  const estimatedTotalCost = sumCosts(generationCosts.map((item) => item.estimatedCost));
  const estimatedFailedCost = sumCosts(generationCosts.filter((item) => item.isFailed).map((item) => item.estimatedCost));
  const estimatedRetryCost = sumCosts(generationCosts.filter((item) => item.isRetry).map((item) => item.estimatedCost));
  const jobIdsWithGenerations = new Set(generations.map((generation) => generation.job_id).filter(Boolean));

  const summary = {
    totalGenerations,
    successfulGenerations,
    failedGenerations,
    retryGenerations,
    approvedOutputs,
    estimatedTotalCost,
    estimatedFailedCost,
    estimatedRetryCost,
    averageCostPerApprovedOutput: approvedOutputs ? roundCost(estimatedTotalCost / approvedOutputs) : null,
    averageCostPerJob: jobIdsWithGenerations.size ? roundCost(estimatedTotalCost / jobIdsWithGenerations.size) : null,
    currency: costTrackingConfig.currency
  };

  if (!totalGenerations) warnings.push(createWarning("no_usage", "ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้"));
  if (!approvedOutputs && totalGenerations) warnings.push(createWarning("no_approved_outputs", "ยังไม่มี approved output ในช่วงนี้ จึงยังคำนวณต้นทุนต่อ approved output ไม่ได้"));

  const jobCostRows = buildJobCostRows({
    generationCosts,
    jobById,
    profileById,
    approvalsByJobId,
    approvedAssetsByJobId
  });
  const recentCostEvents = buildRecentCostEvents({
    auditEvents,
    jobById,
    generationById,
    profileById
  });
  const pagination = buildCostPaginationMeta(paginationInput, {
    jobCosts: jobCostRows.length,
    recentCostEvents: recentCostEvents.length
  });

  return {
    range,
    rangeLabel: rangeMeta.label,
    generatedAt: new Date().toISOString(),
    costModel: {
      provider: costTrackingConfig.provider,
      model: costTrackingConfig.model,
      currency: costTrackingConfig.currency,
      estimatedCostPerGeneration: estimateGenerationCost(),
      unitType: costTrackingConfig.unitType,
      label: "estimated"
    },
    summary,
    executiveSummary: buildCostExecutiveSummary(rangeMeta.label, summary),
    trends: buildCostTrends(generationCosts),
    staffUsage: buildCostStaffUsage({ generationCosts, approvals, generationById, profileById }),
    jobCosts: paginateProductionItems(jobCostRows, pagination),
    recentCostEvents: paginateProductionItems(recentCostEvents, pagination),
    pagination,
    notes: [
      "ตัวเลขนี้เป็น estimated cost จากจำนวน generation และราคาที่ตั้งค่าไว้ในระบบ ไม่ใช่ invoice จริง",
      "ไม่รวมค่าใช้จ่าย Google Drive, Supabase Storage, network หรือ invoice จาก provider ที่อยู่นอก event generation",
      ...dedupeWarnings(warnings).map((warning) => warning.message)
    ],
    warnings: dedupeWarnings(warnings)
  };
}

function groupAuditEventsByGenerationId(events = []) {
  const groups = new Map();
  events.forEach((event) => {
    if (!event.generation_id) return;
    if (!groups.has(event.generation_id)) groups.set(event.generation_id, []);
    groups.get(event.generation_id).push(event);
  });
  return groups;
}

function collectRetryGenerationIds(events = []) {
  const ids = new Set();
  events.forEach((event) => {
    const type = String(event.event_type || "").toLowerCase();
    const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
    if ((type.includes("retry") || eventJson.retry === true) && event.generation_id) {
      ids.add(event.generation_id);
    }
  });
  return ids;
}

function getEstimatedGenerationCost(generation, events = []) {
  const costEvent = events
    .map((event) => event?.event_json && typeof event.event_json === "object" ? event.event_json : {})
    .find((eventJson) => Number.isFinite(Number(eventJson.estimated_cost)));
  if (costEvent) return roundCost(Number(costEvent.estimated_cost));
  if (isActiveWorkStatus(generation.status)) return 0;
  return estimateGenerationCost();
}

function sumCosts(values = []) {
  return roundCost(values.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0)) || 0;
}

function buildCostExecutiveSummary(label, summary) {
  if (!summary.totalGenerations) return `${label} ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้`;
  const avgOutput = summary.averageCostPerApprovedOutput === null || summary.averageCostPerApprovedOutput === undefined
    ? "ยังไม่มีข้อมูลเพียงพอ"
    : `${formatCost(summary.averageCostPerApprovedOutput)} ${summary.currency}`;
  return `${label} มีการ generate ${formatThaiNumber(summary.totalGenerations)} ครั้ง, retry ${formatThaiNumber(summary.retryGenerations)} ครั้ง, estimated cost รวม ${formatCost(summary.estimatedTotalCost)} ${summary.currency}, approved output ${formatThaiNumber(summary.approvedOutputs)} ภาพ, ต้นทุนเฉลี่ยต่อ approved output เท่ากับ ${avgOutput}`;
}

function buildCostTrends(generationCosts = []) {
  const byDate = new Map();
  const ensure = (timestamp) => {
    const date = localDateKey(new Date(timestamp || Date.now()));
    if (!byDate.has(date)) {
      byDate.set(date, { date, generations: 0, successful: 0, failed: 0, retry: 0, estimatedCost: 0 });
    }
    return byDate.get(date);
  };

  generationCosts.forEach((item) => {
    const bucket = ensure(item.generation.completed_at || item.generation.created_at);
    bucket.generations += 1;
    if (item.isSuccessful) bucket.successful += 1;
    if (item.isFailed) bucket.failed += 1;
    if (item.isRetry) bucket.retry += 1;
    bucket.estimatedCost = roundCost(bucket.estimatedCost + Number(item.estimatedCost || 0));
  });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildCostStaffUsage({ generationCosts, approvals, generationById, profileById }) {
  const byUser = new Map();
  const ensure = (userId) => {
    const id = userId || "unknown";
    if (!byUser.has(id)) {
      const profile = profileById.get(id);
      byUser.set(id, {
        userId: id === "unknown" ? null : id,
        name: profile?.full_name || profile?.email || "ไม่ระบุผู้ใช้งาน",
        email: profile?.email || "",
        generations: 0,
        successful: 0,
        failed: 0,
        retryCount: 0,
        approvedOutputs: 0,
        estimatedCost: 0,
        latestActivity: null
      });
    }
    return byUser.get(id);
  };

  generationCosts.forEach((item) => {
    const bucket = ensure(item.generation.created_by);
    bucket.generations += 1;
    if (item.isSuccessful) bucket.successful += 1;
    if (item.isFailed) bucket.failed += 1;
    if (item.isRetry) bucket.retryCount += 1;
    bucket.estimatedCost = roundCost(bucket.estimatedCost + Number(item.estimatedCost || 0));
    bucket.latestActivity = latestTimestamp([bucket.latestActivity, item.generation.completed_at, item.generation.created_at]);
  });
  approvals.forEach((approval) => {
    const generation = generationById.get(approval.generation_id);
    const bucket = ensure(generation?.created_by || approval.approved_by);
    bucket.approvedOutputs += 1;
    bucket.latestActivity = latestTimestamp([bucket.latestActivity, approval.approved_at]);
  });

  return Array.from(byUser.values())
    .sort((a, b) => b.estimatedCost - a.estimatedCost || b.generations - a.generations)
    .slice(0, 30);
}

function buildJobCostRows({ generationCosts, jobById, profileById, approvalsByJobId, approvedAssetsByJobId }) {
  const byJob = new Map();
  generationCosts.forEach((item) => {
    const jobId = item.generation.job_id || "unknown";
    const job = jobById.get(jobId);
    if (!byJob.has(jobId)) {
      byJob.set(jobId, {
        jobId: jobId === "unknown" ? null : jobId,
        jobShortId: shortServerId(jobId),
        sku: safeProductionText(job?.sku || job?.form_json?.sku || ""),
        productName: safeProductionText(job?.product_name || job?.form_json?.productName || "Untitled product"),
        status: job?.status || "unknown",
        createdBy: serializeProductionUser(profileById.get(job?.created_by), job?.created_by),
        generationCount: 0,
        retryCount: 0,
        successful: 0,
        failed: 0,
        approvedOutputs: 0,
        exportStatus: "not_exported",
        estimatedCost: 0,
        averageCostPerOutput: null,
        latestActivity: null
      });
    }
    const bucket = byJob.get(jobId);
    bucket.generationCount += 1;
    if (item.isRetry) bucket.retryCount += 1;
    if (item.isSuccessful) bucket.successful += 1;
    if (item.isFailed) bucket.failed += 1;
    bucket.estimatedCost = roundCost(bucket.estimatedCost + Number(item.estimatedCost || 0));
    bucket.latestActivity = latestTimestamp([bucket.latestActivity, item.generation.completed_at, item.generation.created_at]);
  });

  byJob.forEach((bucket) => {
    const approvals = bucket.jobId ? approvalsByJobId.get(bucket.jobId) || [] : [];
    const approvedAssets = bucket.jobId ? approvedAssetsByJobId.get(bucket.jobId) || [] : [];
    bucket.approvedOutputs = approvals.length || approvedAssets.length;
    bucket.exportStatus = approvedAssets.some((asset) => asset.bucket === "google_drive") ? "google_drive" : approvedAssets.length ? "exported" : bucket.approvedOutputs ? "approved" : "not_exported";
    bucket.averageCostPerOutput = bucket.approvedOutputs ? roundCost(bucket.estimatedCost / bucket.approvedOutputs) : null;
  });

  return Array.from(byJob.values()).sort((a, b) => b.estimatedCost - a.estimatedCost || b.generationCount - a.generationCount);
}

function buildRecentCostEvents({ auditEvents, jobById, generationById, profileById }) {
  const costTypes = new Set([
    "generation_started",
    "generation_completed",
    "generation_failed",
    "generation_retry_requested",
    "job_retry_requested",
    "retry_completed",
    "retry_failed"
  ]);

  return auditEvents
    .filter((event) => costTypes.has(String(event.event_type || "")) || String(event.event_type || "").includes("retry"))
    .map((event) => {
      const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
      const generation = event.generation_id ? generationById.get(event.generation_id) : null;
      const jobId = event.job_id || generation?.job_id || null;
      const job = jobId ? jobById.get(jobId) : null;
      const profile = profileById.get(event.actor_id || generation?.created_by);
      return {
        id: event.id,
        time: event.created_at || null,
        user: formatProfileName(profile),
        email: profile?.email || "",
        jobId,
        jobShortId: shortServerId(jobId),
        generationId: event.generation_id || null,
        generationShortId: shortServerId(event.generation_id),
        eventType: event.event_type || "usage",
        status: eventJson.status || statusFromEventType(event.event_type) || generation?.status || "recorded",
        estimatedCost: Number.isFinite(Number(eventJson.estimated_cost)) ? roundCost(Number(eventJson.estimated_cost)) : getEstimatedGenerationCost(generation || {}, [event]),
        currency: eventJson.currency || costTrackingConfig.currency,
        provider: eventJson.provider || costTrackingConfig.provider,
        model: safeProductionText(eventJson.model || generation?.model || costTrackingConfig.model, 120),
        retry: eventJson.retry === true || String(event.event_type || "").toLowerCase().includes("retry"),
        failure: eventJson.failure === true || isFailedStatus(eventJson.status || generation?.status) || String(event.event_type || "").toLowerCase().includes("failed"),
        sku: safeProductionText(job?.sku || "")
      };
    })
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function buildCostPaginationMeta(input, totalsByList) {
  const totalItems = Math.max(0, ...Object.values(totalsByList).map((value) => Number(value || 0)));
  const base = buildProductionPaginationMeta(input, totalItems);
  return {
    ...base,
    totals: {
      jobCosts: Number(totalsByList.jobCosts || 0),
      recentCostEvents: Number(totalsByList.recentCostEvents || 0)
    }
  };
}

function formatCost(value) {
  const cost = Number(value || 0);
  return cost.toLocaleString("en-US", {
    minimumFractionDigits: cost && Math.abs(cost) < 1 ? 4 : 2,
    maximumFractionDigits: 4
  });
}

async function buildProductionJobsView(query = {}) {
  const range = normalizeKpiRange(query.range);
  const paginationInput = normalizeProductionPagination(query);
  const statusFilter = String(query.status || "").trim().toLowerCase();
  const search = String(query.q || "").trim().toLowerCase();
  const rangeMeta = getKpiRangeMeta(range);
  const readLimit = range === "all" ? 5000 : 2500;

  const [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult] = await Promise.all([
    readMonitoringRows("jobs", [
      "id, sku, product_name, brand, category, image_type, status, created_by, created_at, updated_at, form_json",
      "id, sku, product_name, brand, category, image_type, status, created_by, created_at, form_json"
    ], {
      since: rangeMeta.since,
      limit: readLimit
    }),
    readMonitoringRows("generations", [
      "id, job_id, kind, request_id, status, created_by, created_at, updated_at, completed_at, error_message",
      "id, job_id, kind, request_id, status, created_by, created_at, completed_at, error_message"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("approvals", [
      "id, generation_id, approved_by, approved_at, export_path",
      "id, generation_id, approved_by, approved_at"
    ], {
      since: rangeMeta.since,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("assets", [
      "id, job_id, type, bucket, public_url, storage_key, created_by, created_at",
      "id, job_id, type, bucket, created_by, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("audit_events", [
      "id, actor_id, job_id, generation_id, event_type, event_json, created_at",
      "id, actor_id, job_id, generation_id, event_type, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    })
  ]);

  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const assets = assetsResult.data;
  const auditEvents = auditEventsResult.data;
  const userIds = collectMonitoringUserIds(jobs, generations, approvals, assets, auditEvents);
  const profiles = await readKpiProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const generationsByJobId = groupBy(generations, "job_id");
  const assetsByJobId = groupBy(assets, "job_id");
  const auditEventsByJobId = groupAuditEventsByProductionJobId(auditEvents);
  const approvalGenerationIds = new Set(approvals.map((approval) => approval.generation_id).filter(Boolean));
  const approvalByGenerationId = new Map(approvals.map((approval) => [approval.generation_id, approval]));

  const rows = jobs
    .map((job) => serializeProductionJob({
      job,
      generations: generationsByJobId.get(job.id) || [],
      assets: assetsByJobId.get(job.id) || [],
      auditEvents: auditEventsByJobId.get(job.id) || [],
      approvalGenerationIds,
      approvalByGenerationId,
      profile: profileById.get(job.created_by)
    }))
    .filter((job) => {
      if (statusFilter && String(job.status || "").toLowerCase() !== statusFilter) return false;
      if (!search) return true;
      const haystack = [
        job.id,
        job.sku,
        job.productName,
        job.brand,
        job.category,
        job.status,
        job.createdBy?.email,
        job.createdBy?.name,
        job.generationStatus,
        job.approvalStatus,
        job.exportStatus
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });

  const pagination = buildProductionPaginationMeta(paginationInput, rows.length);
  return {
    range,
    rangeLabel: rangeMeta.label,
    jobs: paginateProductionItems(rows, pagination),
    pagination
  };
}

async function buildProductionAssetsView(query = {}) {
  const range = normalizeKpiRange(query.range);
  const paginationInput = normalizeProductionPagination(query);
  const typeFilter = normalizeProductionAssetFilter(query.type);
  const jobIdFilter = String(query.jobId || "").trim().toLowerCase();
  const search = String(query.q || "").trim().toLowerCase();
  const rangeMeta = getKpiRangeMeta(range);
  const readLimit = range === "all" ? 5000 : 2500;

  const [assetsResult, jobsResult, generationsResult, approvalsResult, auditEventsResult] = await Promise.all([
    readMonitoringRows("assets", [
      "id, job_id, type, bucket, storage_key, public_url, file_name, mime_type, file_size, created_by, created_at",
      "id, job_id, type, bucket, storage_key, public_url, created_by, created_at",
      "id, job_id, type, bucket, created_by, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit
    }),
    readMonitoringRows("jobs", [
      "id, sku, product_name, brand, category, status, created_by, created_at",
      "id, sku, product_name, status, created_by, created_at"
    ], {
      since: null,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("generations", [
      "id, job_id, kind, request_id, status, created_by, created_at, completed_at",
      "id, job_id, kind, status, created_by, created_at, completed_at"
    ], {
      since: null,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("approvals", [
      "id, generation_id, approved_by, approved_at, export_path",
      "id, generation_id, approved_by, approved_at"
    ], {
      since: null,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("audit_events", [
      "id, actor_id, job_id, generation_id, event_type, event_json, created_at",
      "id, actor_id, job_id, generation_id, event_type, created_at"
    ], {
      since: rangeMeta.since,
      limit: readLimit,
      optional: true
    })
  ]);

  const assets = assetsResult.data;
  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const auditEvents = auditEventsResult.data;
  const userIds = collectMonitoringUserIds(assets, jobs, generations, approvals, auditEvents);
  const profiles = await readKpiProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const generationsByJobId = groupBy(generations, "job_id");
  const approvalByGenerationId = new Map(approvals.map((approval) => [approval.generation_id, approval]));
  const generationIdByAssetId = buildGenerationIdByAssetId(auditEvents);

  const serializedAssets = assets
    .map((asset) => serializeProductionAsset({
      asset,
      job: jobById.get(asset.job_id),
      generations: generationsByJobId.get(asset.job_id) || [],
      generationId: generationIdByAssetId.get(asset.id) || null,
      approvalByGenerationId,
      profile: profileById.get(asset.created_by)
    }));
  const rows = buildCanonicalProductionAssets(serializedAssets)
    .filter((asset) => {
      if (!matchesProductionAssetType(asset, typeFilter)) return false;
      if (jobIdFilter && !String(asset.jobId || "").toLowerCase().includes(jobIdFilter)) return false;
      if (!search) return true;
      const haystack = [
        asset.id,
        asset.jobId,
        asset.generationId,
        asset.sku,
        asset.productName,
        asset.type,
        asset.typeGroup,
        asset.fileName,
        asset.bucket,
        asset.storagePath,
        asset.googleDriveLink,
        ...(asset.statusBadges || []),
        asset.createdBy?.email,
        asset.createdBy?.name
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });

  const pagination = buildProductionPaginationMeta(paginationInput, rows.length);
  return {
    range,
    rangeLabel: rangeMeta.label,
    assets: paginateProductionItems(rows, pagination),
    pagination
  };
}

function normalizeProductionAssetFilter(value) {
  const type = String(value || "outputs").trim().toLowerCase();
  if (["outputs", "hero", "support", "approved", "references", "all"].includes(type)) return type;
  return "outputs";
}

function matchesProductionAssetType(asset, filter) {
  if (filter === "all") return true;
  if (filter === "outputs") return ["hero", "support", "approved"].includes(asset.typeGroup);
  if (filter === "references") return asset.typeGroup === "reference";
  if (filter === "approved") return asset.typeGroup === "approved" || (asset.statusBadges || []).some((status) => ["approved", "exported"].includes(status));
  return asset.typeGroup === filter;
}

function normalizeProductionPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const requestedPageSize = Number.parseInt(String(query.pageSize || "10"), 10) || 10;
  const allowedPageSizes = new Set([10, 50, 100]);
  const pageSize = allowedPageSizes.has(requestedPageSize) ? requestedPageSize : 10;
  return { page, pageSize };
}

function buildProductionPaginationMeta(input, totalItems) {
  const safeTotal = Math.max(0, Number(totalItems || 0));
  const totalPages = Math.max(1, Math.ceil(safeTotal / input.pageSize));
  const page = Math.min(Math.max(1, input.page), totalPages);
  return {
    page,
    pageSize: input.pageSize,
    totalItems: safeTotal,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

function paginateProductionItems(items, pagination) {
  const start = (pagination.page - 1) * pagination.pageSize;
  return items.slice(start, start + pagination.pageSize);
}

function serializeProductionJob({ job, generations, assets, auditEvents, approvalGenerationIds, approvalByGenerationId, profile }) {
  const sortedGenerations = [...generations].sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0));
  const latestGeneration = sortedGenerations[0] || null;
  const heroGeneration = sortedGenerations.find((generation) => String(generation.kind || "").toLowerCase() === "hero") || sortedGenerations[0] || null;
  const supportGenerations = sortedGenerations.filter((generation) => String(generation.kind || "").toLowerCase() !== "hero");
  const approvedGeneration = sortedGenerations.find((generation) => approvalGenerationIds.has(generation.id));
  const approval = approvedGeneration ? approvalByGenerationId.get(approvedGeneration.id) : null;
  const exportAsset = assets.find((asset) => String(asset.type || "").toLowerCase() === "approved_export");
  const exportUrl = safeUrl(approval?.export_path || exportAsset?.public_url || "");
  const hasValidExportLink = Boolean(exportUrl);
  const exportFailureEvents = auditEvents.filter((event) => monitoringFailureType(event.event_type) === "export" && isMonitoringFailureEvent(event.event_type));
  const latestExportFailureAt = latestTimestamp(exportFailureEvents.map((event) => event.created_at));
  const latestExportSuccessAt = latestTimestamp([exportAsset?.created_at, hasValidExportLink ? approval?.approved_at : null]);
  const hasExportFailureAfterSuccess = latestExportFailureAt && (!latestExportSuccessAt || new Date(latestExportFailureAt) > new Date(latestExportSuccessAt));
  const isGoogleDriveExport = exportAsset?.bucket === "google_drive" || /^https?:\/\/(?:drive|docs)\.google\.com\//i.test(exportUrl);
  const exportStatus = hasValidExportLink
    ? isGoogleDriveExport ? "google_drive" : "exported"
    : hasExportFailureAfterSuccess ? "export_failed" : "not_exported";
  const canRetryExport = Boolean((approval || exportAsset) && !hasValidExportLink);
  const latestActivityAt = latestTimestamp([
    job.updated_at,
    job.created_at,
    latestGeneration?.completed_at,
    latestGeneration?.created_at,
    approval?.approved_at,
    exportAsset?.created_at,
    ...auditEvents.map((event) => event.created_at)
  ]);

  return {
    id: job.id,
    shortId: shortServerId(job.id),
    sku: safeProductionText(job.sku || job.form_json?.sku || ""),
    productName: safeProductionText(job.product_name || job.form_json?.productName || "Untitled product"),
    brand: safeProductionText(job.brand || job.form_json?.brand || ""),
    category: safeProductionText(job.category || job.form_json?.category || ""),
    imageType: safeProductionText(job.image_type || job.form_json?.imageType || ""),
    status: job.status || "unknown",
    createdAt: job.created_at || null,
    updatedAt: job.updated_at || null,
    createdBy: serializeProductionUser(profile, job.created_by),
    generationStatus: latestGeneration?.status || "",
    latestGenerationId: latestGeneration?.id || null,
    heroStatus: heroGeneration?.status || "",
    supportStatus: supportGenerations.length
      ? summarizeProductionStatuses(supportGenerations.map((generation) => generation.status))
      : "",
    approvalStatus: approval ? "approved" : "pending",
    approvedAt: approval?.approved_at || null,
    exportStatus,
    exportUrl,
    exportActionLabel: exportStatus === "export_failed" ? "Retry Export" : "Export",
    latestActivityAt,
    assetCount: assets.length,
    generationCount: generations.length,
    retryable: isFailedStatus(job.status) || isRetryableGeneration(latestGeneration) || isStuckJobStatus(job.status, job.updated_at || job.created_at) || isStuckGeneration(latestGeneration),
    canMarkFailed: isStuckJobStatus(job.status, job.updated_at || job.created_at) || isStuckGeneration(latestGeneration),
    canRetryExport
  };
}

function serializeProductionAsset({ asset, job, generations, generationId, approvalByGenerationId, profile }) {
  const typeGroup = classifyProductionAssetType(asset.type);
  const relatedGeneration = generationId
    ? generations.find((generation) => generation.id === generationId)
    : inferAssetGeneration(asset, generations, approvalByGenerationId);
  const approval = relatedGeneration ? approvalByGenerationId.get(relatedGeneration.id) : null;
  const publicUrl = safeUrl(asset.public_url || "");
  const storagePath = safeProductionText(asset.storage_key || "");
  const googleDriveLink = asset.bucket === "google_drive" ? safeUrl(asset.public_url || asset.storage_key || approval?.export_path || "") : "";
  const previewUrl = bestProductionAssetPreviewUrl({
    typeGroup,
    bucket: asset.bucket,
    publicUrl,
    storagePath
  });
  return {
    id: asset.id,
    shortId: shortServerId(asset.id),
    jobId: asset.job_id || null,
    jobShortId: shortServerId(asset.job_id),
    generationId: relatedGeneration?.id || generationId || null,
    generationShortId: shortServerId(relatedGeneration?.id || generationId),
    sku: safeProductionText(job?.sku || ""),
    productName: safeProductionText(job?.product_name || "Untitled product"),
    type: asset.type || "asset",
    typeGroup,
    bucket: asset.bucket || "",
    fileName: safeProductionText(asset.file_name || path.basename(String(asset.storage_key || "")) || ""),
    mimeType: asset.mime_type || "",
    fileSize: Number.isFinite(asset.file_size) ? asset.file_size : null,
    previewUrl,
    imageUrl: previewUrl,
    storagePath,
    googleDriveLink,
    createdAt: asset.created_at || null,
    createdBy: serializeProductionUser(profile, asset.created_by),
    status: productionAssetStatus(asset, approval)
  };
}

function buildCanonicalProductionAssets(assets) {
  const canonicalByKey = new Map();
  const passthrough = [];
  const generatedByJobId = groupBy(
    assets.filter((asset) => ["hero", "support"].includes(asset.typeGroup)),
    "jobId"
  );

  assets.forEach((asset) => {
    if (!["hero", "support", "approved"].includes(asset.typeGroup)) {
      passthrough.push(withAssetStatusBadges(asset));
      return;
    }

    const mergeSource = chooseCanonicalMergeSource(asset, generatedByJobId);
    const key = canonicalOutputKey(mergeSource);
    const current = canonicalByKey.get(key);
    canonicalByKey.set(key, mergeCanonicalProductionAsset(current, asset, mergeSource));
  });

  return [...canonicalByKey.values(), ...passthrough].sort((left, right) => {
    const leftTime = new Date(left.latestActivityAt || left.createdAt || 0).getTime() || 0;
    const rightTime = new Date(right.latestActivityAt || right.createdAt || 0).getTime() || 0;
    return rightTime - leftTime;
  });
}

function chooseCanonicalMergeSource(asset, generatedByJobId) {
  if (asset.generationId) return asset;
  if (asset.typeGroup !== "approved" || !asset.jobId) return asset;
  const generated = generatedByJobId.get(asset.jobId) || [];
  return generated.length === 1 ? generated[0] : asset;
}

function canonicalOutputKey(asset) {
  if (asset.jobId && asset.generationId) return `job:${asset.jobId}:generation:${asset.generationId}`;
  const role = ["hero", "support"].includes(asset.typeGroup) ? asset.typeGroup : "approved";
  const source = asset.imageUrl || asset.previewUrl || asset.storagePath || asset.googleDriveLink || asset.id;
  return `job:${asset.jobId || "unknown"}:${role}:${source}`;
}

function mergeCanonicalProductionAsset(current, asset, mergeSource) {
  const base = current || withAssetStatusBadges({ ...mergeSource });
  const next = { ...base };
  const statusBadges = new Set([...(next.statusBadges || []), ...assetStatusBadges(asset)]);
  const sourceIds = new Set([...(next.sourceAssetIds || []), asset.id].filter(Boolean));

  const incomingPreview = bestProductionAssetPreviewUrl({
    typeGroup: asset.typeGroup,
    bucket: asset.bucket,
    publicUrl: asset.imageUrl || asset.previewUrl,
    storagePath: asset.storagePath
  });
  if (!next.previewUrl && incomingPreview) {
    next.previewUrl = incomingPreview;
    next.imageUrl = incomingPreview;
  }

  if (!["hero", "support"].includes(next.typeGroup) && ["hero", "support"].includes(asset.typeGroup)) {
    next.typeGroup = asset.typeGroup;
    next.type = asset.type;
    next.fileName = asset.fileName || next.fileName;
  }
  if (!next.generationId && asset.generationId) {
    next.generationId = asset.generationId;
    next.generationShortId = asset.generationShortId;
  }
  if (!next.googleDriveLink && asset.googleDriveLink) next.googleDriveLink = asset.googleDriveLink;
  if (!next.storagePath && asset.storagePath) next.storagePath = asset.storagePath;
  if (!next.bucket || next.bucket === "google_drive") next.bucket = asset.bucket || next.bucket;
  if (!next.createdBy?.email && asset.createdBy?.email) next.createdBy = asset.createdBy;

  next.latestActivityAt = latestTimestamp([next.latestActivityAt, next.createdAt, asset.createdAt]);
  next.statusBadges = Array.from(statusBadges);
  next.sourceAssetIds = Array.from(sourceIds);
  next.status = summarizeAssetStatusBadges(next.statusBadges);
  next.id = next.id || asset.id;
  next.shortId = next.shortId || asset.shortId;
  return next;
}

function withAssetStatusBadges(asset) {
  const statusBadges = assetStatusBadges(asset);
  return {
    ...asset,
    statusBadges,
    sourceAssetIds: asset.id ? [asset.id] : [],
    latestActivityAt: asset.createdAt || null,
    status: summarizeAssetStatusBadges(statusBadges) || asset.status
  };
}

function assetStatusBadges(asset) {
  const badges = [];
  if (["hero", "support"].includes(asset.typeGroup)) badges.push("generated");
  if (asset.status === "approved" || asset.typeGroup === "approved") badges.push("approved");
  if (asset.status === "google_drive" || asset.googleDriveLink || String(asset.bucket || "").toLowerCase() === "google_drive") badges.push("exported");
  if (!badges.length && asset.status) badges.push(asset.status);
  return Array.from(new Set(badges));
}

function summarizeAssetStatusBadges(badges = []) {
  const values = new Set(badges);
  if (values.has("exported")) return "exported";
  if (values.has("approved")) return "approved";
  if (values.has("generated")) return "generated";
  return badges[0] || "";
}

function serializeProductionUser(profile, fallbackId = "") {
  return {
    id: profile?.id || fallbackId || null,
    email: profile?.email || "",
    name: profile?.full_name || profile?.email || ""
  };
}

function groupBy(items, key) {
  const groups = new Map();
  items.forEach((item) => {
    const value = item?.[key];
    if (!value) return;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  });
  return groups;
}

function groupAuditEventsByProductionJobId(events = []) {
  const groups = new Map();
  events.forEach((event) => {
    const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
    const jobId = event.job_id || eventJson.jobId || eventJson.job_id || null;
    if (!jobId) return;
    if (!groups.has(jobId)) groups.set(jobId, []);
    groups.get(jobId).push(event);
  });
  return groups;
}

function latestTimestamp(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function summarizeProductionStatuses(statuses) {
  const normalized = statuses.map((status) => String(status || "").toLowerCase()).filter(Boolean);
  if (!normalized.length) return "";
  if (normalized.some((status) => isFailedStatus(status))) return "has_failed";
  if (normalized.every((status) => isSuccessfulGenerationStatus(status))) return "done";
  if (normalized.some((status) => ["running", "generating", "queued"].includes(status))) return "in_progress";
  return normalized[0] || "";
}

function classifyProductionAssetType(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("reference")) return "reference";
  if (value.includes("hero")) return "hero";
  if (value.includes("support")) return "support";
  if (value.includes("approved") || value.includes("export")) return "approved";
  return "other";
}

function productionAssetStatus(asset, approval) {
  if (asset.bucket === "google_drive") return "google_drive";
  if (approval) return "approved";
  if (asset.public_url) return "available";
  return "metadata_only";
}

function inferAssetGeneration(asset, generations, approvalByGenerationId = new Map()) {
  const typeGroup = classifyProductionAssetType(asset.type);
  if (typeGroup === "hero") return generations.find((generation) => String(generation.kind || "").toLowerCase() === "hero") || null;
  if (typeGroup === "support") return generations.find((generation) => String(generation.kind || "").toLowerCase() !== "hero") || null;
  if (typeGroup === "approved") {
    const approvedGenerations = generations
      .map((generation) => ({ generation, approval: approvalByGenerationId.get(generation.id) }))
      .filter((item) => item.approval);
    if (approvedGenerations.length === 1) return approvedGenerations[0].generation;
    if (approvedGenerations.length > 1) {
      const assetTime = new Date(asset.created_at || 0).getTime() || 0;
      return approvedGenerations
        .sort((left, right) => {
          const leftTime = new Date(left.approval.approved_at || left.generation.completed_at || left.generation.created_at || 0).getTime() || 0;
          const rightTime = new Date(right.approval.approved_at || right.generation.completed_at || right.generation.created_at || 0).getTime() || 0;
          if (assetTime) return Math.abs(leftTime - assetTime) - Math.abs(rightTime - assetTime);
          return rightTime - leftTime;
        })[0]?.generation || null;
    }
  }
  return null;
}

function bestProductionAssetPreviewUrl({ bucket = "", publicUrl = "", storagePath = "" } = {}) {
  const candidates = [publicUrl, storagePath].map(safeUrl).filter(Boolean);
  return candidates.find(isEmbeddableProductionImageUrl) || "";
}

function isEmbeddableProductionImageUrl(value) {
  const url = safeUrl(value);
  if (!url) return false;
  if (/\/\/(?:drive|docs)\.google\.com\//i.test(url)) return false;
  return true;
}

function buildGenerationIdByAssetId(auditEvents) {
  const map = new Map();
  auditEvents.forEach((event) => {
    const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
    if (eventJson.assetId && event.generation_id) map.set(eventJson.assetId, event.generation_id);
  });
  return map;
}

function safeUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) || text.startsWith("/") ? text.slice(0, 1000) : "";
}

function safeProductionText(value, maxLength = 240) {
  return String(value || "")
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token|service_role|password|token_json)[=:]\s*([^&\s,}]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function publicError(status, code, publicMessage) {
  const error = new Error(publicMessage);
  error.status = status;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function isRetryableGeneration(generation) {
  return Boolean(generation && (isFailedStatus(generation.status) || generation.error_message));
}

function isActiveWorkStatus(status) {
  return ["queued", "running", "processing", "generating", "uploading", "pending", "in_progress"].includes(String(status || "").trim().toLowerCase());
}

function isStuckGeneration(generation) {
  if (!generation || !isActiveWorkStatus(generation.status)) return false;
  return minutesSince(generation.updated_at || generation.created_at) >= 30;
}

function isStuckJobStatus(status, timestamp) {
  if (!isActiveWorkStatus(status)) return false;
  return minutesSince(timestamp) >= 30;
}

function safeRetryUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text.slice(0, 1000) : "";
}

function shortServerId(value) {
  return String(value || "").slice(0, 8);
}

function normalizeMonitoringPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const requestedPageSize = Number.parseInt(String(query.pageSize || "10"), 10) || 10;
  const allowedPageSizes = new Set([10, 50, 100]);
  const pageSize = allowedPageSizes.has(requestedPageSize) ? requestedPageSize : 10;
  return { page, pageSize };
}

function buildMonitoringPaginationMeta(input, totalsByList) {
  const totalItems = Math.max(0, ...Object.values(totalsByList).map((value) => Number(value || 0)));
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(Math.max(1, input.page), totalPages);
  return {
    page,
    pageSize: input.pageSize,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    totals: {
      stuckJobs: Number(totalsByList.stuckJobs || 0),
      failedItems: Number(totalsByList.failedItems || 0),
      recentSystemEvents: Number(totalsByList.recentSystemEvents || 0)
    }
  };
}

function paginateMonitoringItems(items, pagination) {
  const start = (pagination.page - 1) * pagination.pageSize;
  return items.slice(start, start + pagination.pageSize);
}

async function readMonitoringRows(table, selects, { since = null, dateColumn = "created_at", orderColumn = "created_at", limit = 2500, optional = false } = {}) {
  const selectOptions = Array.isArray(selects) ? selects : [selects];
  let lastError = null;
  for (const select of selectOptions) {
    try {
      let query = supabaseAdmin.from(table).select(select);
      if (since) query = query.gte(dateColumn, since);
      const { data, error } = await query.order(orderColumn, { ascending: false }).limit(limit);
      if (error) throw error;
      const rows = data || [];
      return { table, data: rows, error: null, limit, limited: rows.length >= limit };
    } catch (error) {
      lastError = error;
    }
  }

  if (optional) {
    console.warn(`Optional monitoring table ${table} unavailable:`, readableError(lastError));
    return { table, data: [], error: lastError, limit, limited: false };
  }
  throw lastError;
}

function collectMonitoringUserIds(...groups) {
  const ids = new Set();
  groups.flat().forEach((item) => {
    [item?.created_by, item?.approved_by, item?.checked_by, item?.actor_id, item?.updated_by].forEach((id) => {
      if (id) ids.add(id);
    });
  });
  return ids;
}

function buildMonitoringWarnings({
  googleDriveStatus,
  failedJobs,
  failedGenerations,
  exportFailureEvents,
  storageFailureEvents,
  approvalFailureEvents,
  stuckJobs,
  pendingApprovals,
  jobs,
  generations,
  approvals,
  auditEvents
}) {
  const warnings = [];
  if (!googleDriveStatus.connected) {
    warnings.push(createWarning("google_drive_disconnected", "Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน"));
  }
  if (failedJobs.length) warnings.push(createWarning("failed_jobs", `มี jobs failed ${formatThaiNumber(failedJobs.length)} งานในช่วงนี้`));
  if (failedGenerations.length) warnings.push(createWarning("failed_generations", `มี generation failed ${formatThaiNumber(failedGenerations.length)} รายการในช่วงนี้`));
  if (exportFailureEvents.length) warnings.push(createWarning("failed_exports", `มี export/Google Drive failure ${formatThaiNumber(exportFailureEvents.length)} รายการ`));
  if (storageFailureEvents.length) warnings.push(createWarning("storage_failures", `มี Supabase Storage failure ${formatThaiNumber(storageFailureEvents.length)} รายการ`));
  if (approvalFailureEvents.length) warnings.push(createWarning("approval_failures", `มี approve/save failure ${formatThaiNumber(approvalFailureEvents.length)} รายการ`));
  if (stuckJobs.length) warnings.push(createWarning("stuck_jobs", `พบงานที่อาจค้างเกิน 30 นาที ${formatThaiNumber(stuckJobs.length)} รายการ`));
  if (pendingApprovals.length) warnings.push(createWarning("pending_approvals", `มีงาน generate สำเร็จแต่ยังไม่ approve ${formatThaiNumber(pendingApprovals.length)} รายการ`));
  if (!jobs.length && !generations.length && !approvals.length && !auditEvents.length) {
    warnings.push(createWarning("no_recent_activity", "ยังไม่มี production activity ในช่วงเวลานี้"));
  }
  return warnings;
}

function buildMonitoringStuckItems({ jobs, generations, profileById }) {
  const now = Date.now();
  const thresholdMinutes = 30;
  const activeStatuses = new Set(["queued", "running", "processing", "generating", "uploading", "pending", "in_progress"]);
  const rows = [];

  jobs.forEach((job) => {
    const status = String(job.status || "").trim().toLowerCase();
    if (!activeStatuses.has(status)) return;
    const anchor = job.updated_at || job.created_at;
    const ageMinutes = minutesSince(anchor, now);
    if (ageMinutes < thresholdMinutes) return;
    rows.push({
      id: `job:${job.id}`,
      type: "job",
      jobId: job.id,
      generationId: null,
      status: job.status || "unknown",
      createdAt: job.created_at || null,
      updatedAt: job.updated_at || job.created_at || null,
      user: formatProfileName(profileById.get(job.created_by)),
      ageMinutes,
      detail: safeMonitoringText(job.product_name || job.sku || "job is still active"),
      recommendedAction: "ตรวจสอบ queue/server log แล้วพิจารณา retry หรือสร้างงานใหม่ถ้างานค้างจริง",
      retryable: true,
      canMarkFailed: true,
      canRetryExport: false
    });
  });

  generations.forEach((generation) => {
    const status = String(generation.status || "").trim().toLowerCase();
    if (!activeStatuses.has(status) || generation.completed_at) return;
    const anchor = generation.updated_at || generation.created_at;
    const ageMinutes = minutesSince(anchor, now);
    if (ageMinutes < thresholdMinutes) return;
    rows.push({
      id: `generation:${generation.id}`,
      type: "generation",
      jobId: generation.job_id || null,
      generationId: generation.id,
      status: generation.status || "unknown",
      createdAt: generation.created_at || null,
      updatedAt: generation.updated_at || generation.created_at || null,
      user: formatProfileName(profileById.get(generation.created_by)),
      ageMinutes,
      detail: safeMonitoringText(`${generation.kind || "generation"} ${generation.request_id || ""}`.trim()),
      recommendedAction: "ตรวจสอบ FAL/generation queue ถ้าไม่มีผลลัพธ์ให้ retry จาก job เดิม",
      retryable: true,
      canMarkFailed: true,
      canRetryExport: false
    });
  });

  return rows.sort((a, b) => b.ageMinutes - a.ageMinutes);
}

function buildMonitoringFailedItems({ failedJobs, failedGenerations, failureEvents, jobById, generationById, profileById }) {
  const rows = [
    ...failedJobs.map((job) => ({
      id: `job:${job.id}`,
      time: job.updated_at || job.created_at || null,
      type: "generate",
      status: job.status || "failed",
      user: formatProfileName(profileById.get(job.created_by)),
      jobId: job.id,
      generationId: null,
      detail: safeMonitoringText(job.product_name || job.sku || "job status failed"),
      recommendedAction: "เปิดงานนี้ ตรวจสอบ reference/input ล่าสุด แล้ว retry generation ถ้าข้อมูลพร้อม",
      retryable: true,
      canMarkFailed: false,
      canRetryExport: false
    })),
    ...failedGenerations.map((generation) => {
      const job = generation.job_id ? jobById.get(generation.job_id) : null;
      return {
        id: `generation:${generation.id}`,
        time: generation.completed_at || generation.updated_at || generation.created_at || null,
        type: "generate",
        status: generation.status || "failed",
        user: formatProfileName(profileById.get(generation.created_by)),
        jobId: generation.job_id || null,
        generationId: generation.id,
        detail: safeMonitoringText(generation.error_message || generation.request_id || job?.product_name || "generation failed"),
        recommendedAction: "ตรวจสอบ FAL error/input image แล้ว Generate ใหม่จากงานเดิมเมื่อแก้สาเหตุแล้ว",
        retryable: true,
        canMarkFailed: false,
        canRetryExport: false
      };
    }),
    ...failureEvents.map((event) => {
      const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
      const eventJobId = event.job_id || eventJson.jobId || eventJson.job_id || null;
      const generation = event.generation_id ? generationById.get(event.generation_id) : null;
      const job = eventJobId ? jobById.get(eventJobId) : generation?.job_id ? jobById.get(generation.job_id) : null;
      return {
        id: `event:${event.id}`,
        time: event.created_at || null,
        type: monitoringFailureType(event.event_type),
        status: statusFromEventType(event.event_type) || "failed",
        user: formatProfileName(profileById.get(event.actor_id)),
        jobId: eventJobId || generation?.job_id || null,
        generationId: event.generation_id || null,
        detail: safeMonitoringEventDetail(event),
        recommendedAction: recommendedMonitoringAction(event.event_type, job),
        retryable: monitoringFailureType(event.event_type) === "generate",
        canMarkFailed: false,
        canRetryExport: monitoringFailureType(event.event_type) === "export"
      };
    })
  ];

  return rows
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function buildMonitoringRecentEvents({ auditEvents, jobById, generationById, profileById }) {
  const relatedTypes = new Set([
    "generation_started",
    "generation_completed",
    "generation_failed",
    "approval_recorded",
    "approval_record_failed",
    "approved_export_recorded",
    "google_drive_connected",
    "google_drive_export_failed",
    "storage_upload_failed",
    "user_created",
    "user_password_reset",
    "user_profile_updated"
  ]);

  return auditEvents
    .filter((event) => relatedTypes.has(String(event.event_type || "")))
    .map((event) => {
      const generation = event.generation_id ? generationById.get(event.generation_id) : null;
      const job = event.job_id ? jobById.get(event.job_id) : generation?.job_id ? jobById.get(generation.job_id) : null;
      return {
        id: event.id,
        time: event.created_at || null,
        eventType: event.event_type || "activity",
        status: statusFromEventType(event.event_type) || "recorded",
        user: formatProfileName(profileById.get(event.actor_id)),
        jobId: event.job_id || generation?.job_id || null,
        generationId: event.generation_id || null,
        detail: safeMonitoringEventDetail(event) || safeMonitoringText(job?.product_name || job?.sku || "")
      };
    })
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function minutesSince(value, now = Date.now()) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  return Math.max(0, Math.round((now - timestamp) / 60000));
}

function isMonitoringFailureEvent(eventType) {
  const type = String(eventType || "").toLowerCase();
  return type.includes("failed") || type.includes("failure") || type.includes("error");
}

function isExportFailureEvent(eventType) {
  const type = String(eventType || "").toLowerCase();
  return type.includes("export") && isMonitoringFailureEvent(type);
}

function isStorageFailureEvent(eventType) {
  const type = String(eventType || "").toLowerCase();
  return type.includes("storage") && isMonitoringFailureEvent(type);
}

function isApprovalFailureEvent(eventType) {
  const type = String(eventType || "").toLowerCase();
  return (type.includes("approval") || type.includes("approve")) && isMonitoringFailureEvent(type);
}

function monitoringFailureType(eventType) {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("generation")) return "generate";
  if (type.includes("approval") || type.includes("approve")) return "approve";
  if (type.includes("export") || type.includes("drive")) return "export";
  if (type.includes("storage")) return "storage";
  return "system";
}

function recommendedMonitoringAction(eventType, job = null) {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("drive") || type.includes("export")) return "ตรวจสอบ Google Drive connection/folder permission แล้ว approve/export ใหม่";
  if (type.includes("storage")) return "ตรวจสอบ Supabase Storage bucket/permission และดูว่า asset fallback ถูกบันทึกไว้หรือไม่";
  if (type.includes("approval") || type.includes("approve")) return "ตรวจสอบ approval record และ export path จากนั้น approve/save ใหม่ถ้าจำเป็น";
  if (type.includes("generation")) return "ตรวจสอบ FAL error และ reference image ก่อน retry generation";
  return job?.id ? "เปิดงานที่เกี่ยวข้องแล้วตรวจสอบ log ล่าสุด" : "ตรวจสอบ system log และ audit event ล่าสุด";
}

function safeMonitoringEventDetail(event) {
  const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
  const candidates = [
    eventJson.errorMessage,
    eventJson.error,
    eventJson.message,
    eventJson.provider && eventJson.integration ? `${eventJson.provider} ${eventJson.integration}` : "",
    eventJson.assetId ? `asset ${eventJson.assetId}` : "",
    event.event_type
  ];
  return safeMonitoringText(candidates.find(Boolean) || "");
}

function safeMonitoringText(value, maxLength = 180) {
  return String(value || "")
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token|service_role|password|token_json)[=:]\s*([^&\s,}]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function readKpiRows(table, select, { since = null, dateColumn = "created_at", orderColumn = "created_at", limit = 3000, optional = false } = {}) {
  try {
    let query = supabaseAdmin.from(table).select(select);
    if (since) query = query.gte(dateColumn, since);
    const { data, error } = await query.order(orderColumn, { ascending: false }).limit(limit);
    if (error) throw error;
    const rows = data || [];
    return { table, data: rows, error: null, limit, limited: rows.length >= limit };
  } catch (error) {
    if (optional) {
      console.warn(`Optional KPI table ${table} unavailable:`, readableError(error));
      return { table, data: [], error, limit, limited: false };
    }
    throw error;
  }
}

async function readKpiProfiles(userIds) {
  if (!userIds.size) return [];
  const ids = Array.from(userIds).filter(Boolean).slice(0, 500);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .in("id", ids);
  if (error) {
    console.warn("KPI profiles unavailable:", readableError(error));
    return [];
  }
  return data || [];
}

async function getSafeGoogleDriveStatus() {
  try {
    const integrationToken = await readIntegrationToken("google_drive");
    const fileTokenExists = await fileExists(googleDriveTokenPath);
    const tokenExists = hasUsableGoogleOAuthToken(integrationToken?.token_json) || fileTokenExists;
    return {
      mode: getGoogleDriveAuthMode(),
      configured: isGoogleOAuthConfigured(),
      connected: getGoogleDriveAuthMode() === "oauth" && isGoogleOAuthConfigured() && tokenExists,
      tokenExists,
      updatedAt: integrationToken?.updated_at || null
    };
  } catch (error) {
    console.warn("Google Drive KPI status unavailable:", readableError(error));
    return {
      mode: getGoogleDriveAuthMode(),
      configured: isGoogleOAuthConfigured(),
      connected: false,
      tokenExists: false,
      updatedAt: null
    };
  }
}

function collectUserIds(...groups) {
  const ids = new Set();
  groups.flat().forEach((item) => {
    [item?.created_by, item?.approved_by, item?.checked_by, item?.actor_id].forEach((id) => {
      if (id) ids.add(id);
    });
  });
  return ids;
}

function collectActiveStaffIds(...groups) {
  return collectUserIds(...groups);
}

function isSuccessfulGenerationStatus(status) {
  return ["done", "completed", "complete", "success", "succeeded"].includes(String(status || "").trim().toLowerCase());
}

function isFailedStatus(status) {
  return ["failed", "error", "errored", "cancelled", "canceled"].includes(String(status || "").trim().toLowerCase());
}

function roundMetric(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function calculateAverageTurnaroundMinutes(approvals, generationById, jobById) {
  const durations = approvals
    .map((approval) => {
      const generation = generationById.get(approval.generation_id);
      const job = generation?.job_id ? jobById.get(generation.job_id) : null;
      const start = job?.created_at || generation?.created_at;
      if (!start || !approval.approved_at) return null;
      const minutes = (new Date(approval.approved_at).getTime() - new Date(start).getTime()) / 60000;
      return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
    })
    .filter((value) => value !== null);
  if (!durations.length) return null;
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}

function buildExecutiveSummary(label, summary) {
  const pieces = [
    `${label} มีงานทั้งหมด ${formatThaiNumber(summary.totalJobs)} งาน`,
    `generate แล้ว ${formatThaiNumber(summary.generated)} งาน`,
    `approve แล้ว ${formatThaiNumber(summary.approved)} งาน`,
    `ยังรอ approve ${formatThaiNumber(summary.pendingApproval)} งาน`
  ];
  if (summary.failed > 0) pieces.push(`และมีงาน failed ${formatThaiNumber(summary.failed)} งาน`);
  return pieces.join(", ");
}

function buildKpiTrends({ jobs, generations, approvals, assets }) {
  const byDate = new Map();
  const ensure = (timestamp) => {
    const date = localDateKey(new Date(timestamp));
    if (!byDate.has(date)) byDate.set(date, { date, jobs: 0, generated: 0, approved: 0, exported: 0, failed: 0 });
    return byDate.get(date);
  };

  jobs.forEach((job) => {
    if (job.created_at) ensure(job.created_at).jobs += 1;
    if (isFailedStatus(job.status) && job.created_at) ensure(job.created_at).failed += 1;
  });
  generations.forEach((generation) => {
    const timestamp = generation.completed_at || generation.created_at;
    if (isSuccessfulGenerationStatus(generation.status) && timestamp) ensure(timestamp).generated += 1;
    if ((isFailedStatus(generation.status) || generation.error_message) && timestamp) ensure(timestamp).failed += 1;
  });
  approvals.forEach((approval) => {
    if (approval.approved_at) ensure(approval.approved_at).approved += 1;
  });
  assets
    .filter((asset) => String(asset.type || "").toLowerCase() === "approved_export")
    .forEach((asset) => {
      if (asset.created_at) ensure(asset.created_at).exported += 1;
    });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildKpiFunnel({ created, generated, qcChecked, approved, exported }) {
  const stages = [
    { key: "created", label: "Created", value: created, calculable: true },
    { key: "generated", label: "Generated", value: generated, calculable: true },
    { key: "qc_checked", label: "QC Checked", value: qcChecked, calculable: qcChecked > 0 },
    { key: "approved", label: "Approved", value: approved, calculable: true },
    { key: "exported", label: "Exported", value: exported, calculable: true }
  ];

  return stages.map((stage, index) => {
    const previous = index === 0 ? stage.value : stages[index - 1].value;
    return {
      ...stage,
      percentOfCreated: created ? roundMetric((stage.value / created) * 100) : null,
      percentOfPrevious: previous ? roundMetric((stage.value / previous) * 100) : null
    };
  });
}

function buildStatusBreakdown(jobs, generations) {
  const byStatus = new Map();
  const ensure = (status) => {
    const normalized = String(status || "unknown").trim() || "unknown";
    if (!byStatus.has(normalized)) byStatus.set(normalized, { status: normalized, jobs: 0, generations: 0, total: 0 });
    return byStatus.get(normalized);
  };
  jobs.forEach((job) => {
    const bucket = ensure(job.status);
    bucket.jobs += 1;
    bucket.total += 1;
  });
  generations.forEach((generation) => {
    const bucket = ensure(generation.status);
    bucket.generations += 1;
    bucket.total += 1;
  });
  return Array.from(byStatus.values()).sort((a, b) => b.total - a.total || a.status.localeCompare(b.status));
}

function buildStaffPerformance({ jobs, generations, approvals, qcChecks, profileById, generatedGenerationIds, failedGenerationIds }) {
  const byUser = new Map();
  const ensure = (userId) => {
    const id = userId || "unknown";
    if (!byUser.has(id)) {
      const profile = profileById.get(id);
      byUser.set(id, {
        userId: id === "unknown" ? null : id,
        name: profile?.full_name || profile?.email || "ไม่ระบุผู้ใช้งาน",
        email: profile?.email || "",
        role: profile?.role || "",
        jobsCreated: 0,
        generationsCreated: 0,
        approvalsCompleted: 0,
        qcChecked: 0,
        successCount: 0,
        failCount: 0,
        latestActivity: null
      });
    }
    return byUser.get(id);
  };
  const touch = (userId, timestamp) => {
    const bucket = ensure(userId);
    if (timestamp && (!bucket.latestActivity || new Date(timestamp) > new Date(bucket.latestActivity))) {
      bucket.latestActivity = timestamp;
    }
    return bucket;
  };

  jobs.forEach((job) => {
    const bucket = touch(job.created_by, job.created_at);
    bucket.jobsCreated += 1;
  });
  generations.forEach((generation) => {
    const bucket = touch(generation.created_by, generation.completed_at || generation.created_at);
    bucket.generationsCreated += 1;
    if (generatedGenerationIds.has(generation.id)) bucket.successCount += 1;
    if (failedGenerationIds.has(generation.id)) bucket.failCount += 1;
  });
  approvals.forEach((approval) => {
    const bucket = touch(approval.approved_by, approval.approved_at);
    bucket.approvalsCompleted += 1;
  });
  qcChecks.forEach((check) => {
    const bucket = touch(check.checked_by, check.checked_at);
    bucket.qcChecked += 1;
  });

  return Array.from(byUser.values())
    .sort((a, b) => {
      const latestDiff = new Date(b.latestActivity || 0) - new Date(a.latestActivity || 0);
      return latestDiff || b.approvalsCompleted - a.approvalsCompleted || b.generationsCreated - a.generationsCreated;
    })
    .slice(0, 20);
}

function buildRecentActivity({ auditEvents, jobs, generations, approvals, profileById }) {
  const source = auditEvents.length
    ? auditEvents.map((event) => ({
      timestamp: event.created_at,
      user: formatProfileName(profileById.get(event.actor_id)),
      action: event.event_type || "activity",
      status: statusFromEventType(event.event_type),
      jobId: event.job_id || null,
      generationId: event.generation_id || null
    }))
    : [
      ...jobs.map((job) => ({
        timestamp: job.created_at,
        user: formatProfileName(profileById.get(job.created_by)),
        action: "job_created",
        status: job.status || "created",
        jobId: job.id,
        generationId: null
      })),
      ...generations.map((generation) => ({
        timestamp: generation.completed_at || generation.created_at,
        user: formatProfileName(profileById.get(generation.created_by)),
        action: "generation",
        status: generation.status || "",
        jobId: generation.job_id || null,
        generationId: generation.id
      })),
      ...approvals.map((approval) => ({
        timestamp: approval.approved_at,
        user: formatProfileName(profileById.get(approval.approved_by)),
        action: "approval_recorded",
        status: approval.export_path ? "exported" : "approved",
        jobId: null,
        generationId: approval.generation_id || null
      }))
    ];

  return source
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
}

function statusFromEventType(eventType) {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("failed")) return "failed";
  if (type.includes("approved") || type.includes("approval")) return "approved";
  if (type.includes("export") || type.includes("drive")) return "exported";
  if (type.includes("completed")) return "completed";
  if (type.includes("started") || type.includes("created")) return "created";
  return "";
}

function formatProfileName(profile) {
  return profile?.full_name || profile?.email || "ไม่ระบุผู้ใช้งาน";
}

function createWarning(code, message) {
  return { code, message };
}

function dedupeWarnings(warnings) {
  const byCode = new Map();
  warnings.forEach((warning) => {
    if (!byCode.has(warning.code)) byCode.set(warning.code, warning);
  });
  return Array.from(byCode.values());
}

function formatThaiNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function buildAdminUserCreatePayload(body = {}) {
  const email = normalizeEmail(body.email);
  const fullName = cleanOptionalString(body.full_name ?? body.fullName) || "";
  const role = String(body.role || "staff").trim().toLowerCase();
  const temporaryPassword = String(body.temporary_password ?? body.temporaryPassword ?? "").trim();
  const confirmPassword = String(body.confirm_temporary_password ?? body.confirmTemporaryPassword ?? "").trim();
  const isActive = Object.prototype.hasOwnProperty.call(body, "is_active") ? body.is_active : true;
  const mustChangePassword = Object.prototype.hasOwnProperty.call(body, "must_change_password") ? body.must_change_password : true;

  if (!isValidEmail(email)) {
    return {
      ok: false,
      code: "invalid_email",
      error: "อีเมลไม่ถูกต้อง"
    };
  }
  if (fullName.length > 160) {
    return {
      ok: false,
      code: "invalid_full_name",
      error: "ชื่อพนักงานยาวเกินไป"
    };
  }
  if (!["admin", "staff"].includes(role)) {
    return {
      ok: false,
      code: "invalid_role",
      error: "Role ต้องเป็น admin หรือ staff เท่านั้น"
    };
  }
  if (temporaryPassword.length < 8) {
    return {
      ok: false,
      code: "weak_temporary_password",
      error: "Temporary password ต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }
  if (temporaryPassword !== confirmPassword) {
    return {
      ok: false,
      code: "password_mismatch",
      error: "Temporary password และ confirm password ไม่ตรงกัน"
    };
  }
  if (typeof isActive !== "boolean" || typeof mustChangePassword !== "boolean") {
    return {
      ok: false,
      code: "invalid_status",
      error: "สถานะต้องเป็น true หรือ false เท่านั้น"
    };
  }

  return {
    ok: true,
    payload: {
      email,
      full_name: fullName,
      role,
      temporaryPassword,
      is_active: isActive,
      must_change_password: mustChangePassword
    }
  };
}

function buildAdminPasswordResetPayload(body = {}) {
  const temporaryPassword = String(body.temporaryPassword ?? body.temporary_password ?? "").trim();
  if (temporaryPassword.length < 8) {
    return {
      ok: false,
      code: "weak_temporary_password",
      error: "Temporary password ต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }
  return {
    ok: true,
    temporaryPassword
  };
}

function buildAdminUserPatch(body = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, "full_name") || Object.prototype.hasOwnProperty.call(body, "fullName")) {
    const fullName = cleanOptionalString(body.full_name ?? body.fullName) || "";
    if (fullName.length > 160) {
      return {
        ok: false,
        code: "invalid_full_name",
        error: "ชื่อพนักงานยาวเกินไป"
      };
    }
    patch.full_name = fullName;
  }

  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = String(body.role || "").trim().toLowerCase();
    if (!["admin", "staff"].includes(role)) {
      return {
        ok: false,
        code: "invalid_role",
        error: "Role ต้องเป็น admin หรือ staff เท่านั้น"
      };
    }
    patch.role = role;
  }

  for (const field of ["is_active", "must_change_password"]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== "boolean") {
        return {
          ok: false,
          code: `invalid_${field}`,
          error: "สถานะต้องเป็น true หรือ false เท่านั้น"
        };
      }
      patch[field] = body[field];
    }
  }

  return { ok: true, patch };
}

async function validateAdminUserPatchSafety({ actorId, existingProfile, patch }) {
  const isSelf = actorId === existingProfile.id;
  if (isSelf && patch.is_active === false) {
    return {
      ok: false,
      code: "self_deactivation_blocked",
      error: "ไม่สามารถปิดใช้งานบัญชี Admin ของตัวเองได้"
    };
  }

  const currentRole = String(existingProfile.role || "").trim().toLowerCase();
  const targetRole = patch.role || currentRole;
  const targetActive = Object.prototype.hasOwnProperty.call(patch, "is_active")
    ? patch.is_active
    : existingProfile.is_active !== false;
  const removesActiveAdmin = currentRole === "admin" && (targetRole !== "admin" || targetActive === false);
  if (!removesActiveAdmin) return { ok: true };

  const hasOtherAdmin = await hasAnotherActiveAdmin(existingProfile.id);
  if (!hasOtherAdmin) {
    return {
      ok: false,
      code: "last_admin_blocked",
      error: "ไม่สามารถเปลี่ยนหรือปิด admin คนสุดท้ายได้"
    };
  }

  return { ok: true };
}

async function hasAnotherActiveAdmin(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("role", "admin")
    .eq("is_active", true)
    .neq("id", userId)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

function normalizeEmail(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function isAuthUserExistsError(error) {
  return /already registered|already exists|user.*exists|email.*exists/i.test(error?.message || "");
}

async function readLatestActivityByActor() {
  try {
    const { data, error } = await supabaseAdmin
      .from("audit_events")
      .select("actor_id, event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const latestByActor = new Map();
    (data || []).forEach((event) => {
      if (event.actor_id && !latestByActor.has(event.actor_id)) {
        latestByActor.set(event.actor_id, {
          type: event.event_type || "",
          at: event.created_at || null
        });
      }
    });
    return latestByActor;
  } catch (error) {
    console.warn("Latest user activity unavailable:", readableError(error));
    return new Map();
  }
}

function serializeAdminUserProfile(profile, latestActivity = null) {
  return {
    id: profile.id,
    email: profile.email || "",
    full_name: profile.full_name || "",
    role: String(profile.role || "staff").trim().toLowerCase() === "admin" ? "admin" : "staff",
    is_active: profile.is_active !== false,
    must_change_password: profile.must_change_password === true,
    created_at: profile.created_at || null,
    latest_activity: latestActivity
  };
}

async function recordProfileUpdateAuditEvents({ actorId, before, after, changedFields }) {
  const safeBefore = serializeAdminUserProfile(before);
  const safeAfter = serializeAdminUserProfile(after);
  const eventJson = {
    target_user_id: after.id,
    target_email: after.email || "",
    changed_fields: changedFields,
    before: safeBefore,
    after: safeAfter
  };

  await recordAuditEvent({
    actorId,
    eventType: "user_profile_updated",
    eventJson
  });

  if (safeBefore.role !== safeAfter.role) {
    await recordAuditEvent({
      actorId,
      eventType: "user_role_changed",
      eventJson
    });
  }
  if (safeBefore.is_active !== safeAfter.is_active) {
    await recordAuditEvent({
      actorId,
      eventType: safeAfter.is_active === false ? "user_deactivated" : "user_activated",
      eventJson
    });
  }
  if ((before.must_change_password === true) !== (after.must_change_password === true)) {
    await recordAuditEvent({
      actorId,
      eventType: "user_password_change_required_updated",
      eventJson
    });
  }
}

function readableError(error) {
  const message = error?.body?.detail || error?.message || String(error);
  if (/openai_api_key/i.test(message)) {
    return "The fal model requires OPENAI_API_KEY. Add it to .env and restart the server.";
  }
  if (/Service Accounts do not have storage quota/i.test(message)) {
    return "Google Drive upload failed because service accounts do not have My Drive storage quota. Set GOOGLE_DRIVE_AUTH_MODE=oauth, connect Google Drive at /api/google/oauth/start, then approve again.";
  }
  return redactSensitiveText(message);
}

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    code: "api_not_found",
    error: "ไม่พบ API endpoint นี้"
  });
});

app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  if (!req.accepts("html")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Winter Image Desk running on http://127.0.0.1:${PORT}`);
  recoverAbandonedGenerationQueue().catch((error) => {
    console.warn("[queue-recovery] failed:", readableError(error));
  });
});
