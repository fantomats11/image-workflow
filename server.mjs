import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { fal } from "@fal-ai/client";
import { google } from "googleapis";
import { isDryRun } from "./lib/automation/env.mjs";
import { getUserFromAccessToken, supabaseAdmin } from "./lib/supabase-admin.mjs";
import { processAutomationTaskCore } from "./lib/automation/automation-worker-core.mjs";
import { registerAutomationBatch } from "./lib/automation/batch-registry.mjs";
import { buildSupabaseMediaAssetManifestForBatch } from "./lib/automation/supabase-media-asset-manifest.mjs";
import { buildLineImageProxyUrl } from "./lib/automation/line-image-proxy-url.mjs";
import { createFalImageProvider } from "./lib/automation/fal-image-provider.mjs";
import { persistLiveGenerationExecution } from "./lib/automation/live-generation-persistence.mjs";
import {
  buildReferenceStagingManifestFromBatchItems,
  stageMediaManifestAssetsForLiveGeneration
} from "./lib/automation/live-generation-input-staging.mjs";
import { buildModelInputStagingManifest } from "./lib/automation/model-input-staging.mjs";
import { buildReferenceAssetResolution } from "./lib/automation/reference-asset-resolution.mjs";
import { listGoogleDriveReferenceImageFiles } from "./lib/automation/google-drive-reference-files.mjs";
import { extractDriveIdFromUrl } from "./lib/automation/product-catalog-sheet-refresh.mjs";
import { buildHeroReviewSupportAssets } from "./lib/automation/hero-review-support-assets.mjs";
import { buildSupportReviewDecisionState } from "./lib/automation/support-review-decision-state.mjs";
import { buildLiveSupportCandidateManifest } from "./lib/automation/live-support-candidate-manifest.mjs";
import { buildMediaExportPreflightGate } from "./lib/automation/media-export-preflight-gate.mjs";
import { GENERATE_BATCH_TASK } from "./lib/automation/pilot-generation-execution-plan.mjs";
import { WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK } from "./lib/automation/wordpress-media-preflight.mjs";
import { buildMonitoringWordPressPreflights } from "./lib/automation/wordpress-preflight-monitoring.mjs";
import { buildLineBatchApprovalTaskRequests } from "./lib/automation/line-batch-approval-plan.mjs";
import {
  buildWordPressMediaAttachExecutionPlanFlex,
  buildWordPressMediaRemoteRefetchPreflightFlex,
  buildWordPressMediaAttachConfirmationFlex,
  buildWordPressMediaPreflightFlex,
  buildWordPressPreflightFlex,
  buildLineKeywordBatchReviewFlex,
  pushLineMessage
} from "./lib/automation/line-client.mjs";
import {
  buildLineKeywordBatchIntakeResult,
  buildLineKeywordBatchTextMessages,
  loadLineKeywordBatchCatalogSnapshot,
  parseLineKeywordBatchCommand
} from "./lib/automation/line-keyword-batch-intake.mjs";
import { renderAiHubImageReviewPage } from "./lib/automation/ai-hub-review-page.mjs";
import { buildAiHubReviewDecisionSubmission } from "./lib/automation/ai-hub-review-decision-workflow.mjs";
import { renderAiHubReviewWorkspacePage } from "./lib/automation/ai-hub-review-workspace-page.mjs";
import {
  resolveBatchWorkflowState,
  resolveItemWorkflowState
} from "./lib/automation/e2e-workflow-state.mjs";
import {
  buildApprovedHeroAnchor,
  mergeApprovedHeroAnchorMetadata
} from "./lib/automation/hero-approval-anchor.mjs";
import {
  buildBatchReviewPayload,
  isBatchCancelable,
  isItemRetryable,
  isItemSkippable
} from "./lib/automation/batch-review-contract.mjs";
import {
  buildWebSkuReferenceContract,
  findWebSkuPickerItemBySku,
  getCachedWebSkuPickerSkuIndex,
  loadWebSkuPickerSkuIndex,
  loadWebSkuPickerCatalogSnapshot,
  searchWebSkuPickerCatalog,
  WEB_SKU_PICKER_MIN_QUERY_LENGTH
} from "./lib/automation/web-sku-picker-catalog.mjs";
import {
  buildWorkerModeStartupWarnings,
  buildWorkerQueueSafetySummary,
  resolveWorkerRuntimeConfig
} from "./lib/automation/worker-runtime-config.mjs";
import {
  buildSecurityHeaders,
  isAllowedImageUpload,
  parseSafeImageUrls,
  validateRemoteImageUrl,
  validateUploadedImageFiles,
  verifyHmacSha256Base64
} from "./lib/security/input-security.mjs";
import { shouldSkipRetryExport } from "./lib/automation/export-asset-verification.mjs";

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
const outputsDir = path.resolve(__dirname, "../../outputs");
const liveInputStagingDir = process.env.AI_GENERATION_INPUT_STAGING_DIR?.trim() ||
  path.join("/tmp", "image-workflow-live-inputs");
const liveGeneratedDir = process.env.AI_GENERATION_GENERATED_DIR?.trim() ||
  path.join("/tmp", "image-workflow-generated");
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
const lineChannelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
const lineTargetUserId = process.env.LINE_TARGET_USER_ID?.trim();
const lineImageProxySecret = process.env.LINE_IMAGE_PROXY_SECRET?.trim() || lineChannelSecret;
const automationEmbeddedWorkerEnabled = isBooleanEnvEnabled("AUTOMATION_EMBEDDED_WORKER");
const automationWorkerId = process.env.AUTOMATION_WORKER_ID?.trim() || `web-${process.pid}`;
const automationWorkerPollIntervalMs = Math.max(
  1000,
  Number(process.env.AUTOMATION_WORKER_POLL_INTERVAL_MS || 5000) || 5000
);
const costTrackingConfig = {
  provider: "fal",
  model: "openai/gpt-image-2/edit",
  currency: (process.env.AI_GENERATION_COST_CURRENCY || "USD").trim().toUpperCase() || "USD",
  estimatedCostPerGeneration: normalizeCostNumber(process.env.AI_GENERATION_ESTIMATED_COST_PER_GENERATION, 0.04),
  unitType: "generation_request"
};
const supabaseStorageBuckets = ["product-references", "model-references", "generated-images", "approved-images"];
let generationQueue = Promise.resolve();
let activeGenerations = 0;
let pendingGenerations = 0;
const generationJobs = new Map();
const rateLimitBuckets = new Map();
const seenLineWebhookEventIds = new Map();
let googleDriveClientPromise = null;
let webSkuPickerIndexWarmPromise = null;
const googleDriveReferenceFilesCache = new Map();
const googleDriveReferenceStagingCache = new Map();
const googleDriveReferenceFilesCacheTtlMs = Math.max(
  30_000,
  Number(process.env.GOOGLE_DRIVE_REFERENCE_FILES_CACHE_TTL_MS || 300_000) || 300_000
);
const googleDriveReferenceStagingCacheTtlMs = Math.max(
  30_000,
  Number(process.env.GOOGLE_DRIVE_REFERENCE_STAGING_CACHE_TTL_MS || 300_000) || 300_000
);
const googleDriveReferenceFilesTimeoutMs = Math.max(
  2_000,
  Number(process.env.GOOGLE_DRIVE_REFERENCE_FILES_TIMEOUT_MS || 8_000) || 8_000
);
const googleDriveReferenceStageTimeoutMs = Math.max(
  5_000,
  Number(process.env.GOOGLE_DRIVE_REFERENCE_STAGE_TIMEOUT_MS || 20_000) || 20_000
);
const googleDriveReferenceStageMaxBytes = Math.max(
  1024 * 1024,
  Number(process.env.GOOGLE_DRIVE_REFERENCE_STAGE_MAX_BYTES || 20 * 1024 * 1024) || 20 * 1024 * 1024
);
const googleOAuthStateById = new Map();
let automationEmbeddedWorkerRunning = false;
let automationEmbeddedWorkerLastRunAt = null;
let automationEmbeddedWorkerLastError = null;
let automationEmbeddedWorkerProcessedTasks = 0;
let falImageProviderPromise = null;

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
app.disable("x-powered-by");
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (isAllowedImageUpload(file)) return callback(null, true);
    const error = new Error("Unsupported image upload type.");
    error.code = "UNSUPPORTED_IMAGE_UPLOAD";
    return callback(error);
  }
});

app.use((req, res, next) => {
  const headers = buildSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  next();
});

app.post("/api/line/webhook", rateLimit({ keyPrefix: "line", windowMs: 60_000, max: 120 }), express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
  if (!isLineWebhookConfigured()) {
    return res.status(503).json({
      ok: false,
      code: "line_not_configured",
      error: "LINE webhook is not configured."
    });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
  const signature = Array.isArray(req.headers["x-line-signature"])
    ? req.headers["x-line-signature"][0]
    : req.headers["x-line-signature"];

  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).json({
      ok: false,
      code: "bad_line_signature",
      error: "Invalid LINE signature."
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (_error) {
    return res.status(400).json({
      ok: false,
      code: "invalid_line_payload",
      error: "Invalid LINE webhook payload."
    });
  }

  res.json({ ok: true });
  const dedupedPayload = dedupeLineWebhookPayload(payload);
  if (!dedupedPayload.events.length) return;
  handleLineWebhookPayload(dedupedPayload).catch((error) => {
    console.error("[line] webhook handling failed:", readableError(error));
  });
});

app.use(express.json({ limit: "2mb" }));

app.use((error, req, res, next) => {
  if (!error) return next();
  if (req.path?.startsWith("/api/")) {
    return sendApiError(res, 400, "invalid_json", "Request JSON ไม่ถูกต้อง");
  }
  return next(error);
});

app.get("/api/public/line-image/:fileId", async (req, res) => {
  const fileId = String(req.params.fileId || "").trim();
  const exp = String(req.query.exp || "").trim();
  const sig = String(req.query.sig || "").trim();
  if (!isValidDriveFileId(fileId)) {
    return sendApiError(res, 400, "invalid_file_id", "Invalid image file id.");
  }
  if (!verifyLineImageProxySignature({ fileId, exp, sig })) {
    return sendApiError(res, 403, "invalid_image_signature", "Invalid or expired image link.");
  }

  try {
    const drive = await getGoogleDriveClient();
    if (!drive) return sendApiError(res, 503, "google_drive_unavailable", "Google Drive is not connected.");

    const metadataResult = await drive.files.get({
      fileId,
      fields: "name,mimeType,size"
    });
    const mimeType = metadataResult.data?.mimeType || "image/jpeg";
    if (!/^image\//i.test(mimeType)) {
      return sendApiError(res, 415, "unsupported_image_type", "File is not an image.");
    }

    const mediaResult = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    res.setHeader("Content-Type", mimeType);
    if (metadataResult.data?.size) res.setHeader("Content-Length", String(metadataResult.data.size));
    res.setHeader("Cache-Control", "public, max-age=86400");
    mediaResult.data.on("error", (error) => {
      console.warn(readableError(error));
      if (!res.headersSent) res.status(500).end();
    });
    mediaResult.data.pipe(res);
  } catch (error) {
    console.warn(error?.message || readableError(error));
    if (!res.headersSent) {
      res.status(500).json({ ok: false, code: "line_image_proxy_failed", error: "โหลดรูปภาพไม่สำเร็จ" });
    }
  }
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

function handleImageUploadFields(fields) {
  const middleware = upload.fields(fields);
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) return next();
      return handleUploadError(error, res);
    });
  };
}

function handleUploadError(error, res) {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return sendApiError(res, 413, "image_upload_too_large", "ไฟล์รูปภาพต้องไม่เกิน 20MB ต่อไฟล์");
  }
  if (error?.code === "LIMIT_UNEXPECTED_FILE") {
    return sendApiError(res, 400, "unexpected_upload_field", "ช่องอัปโหลดรูปภาพไม่ถูกต้อง");
  }
  if (error?.code === "UNSUPPORTED_IMAGE_UPLOAD") {
    return sendApiError(res, 415, "unsupported_image_upload", "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP เท่านั้น");
  }
  console.warn("[upload] rejected:", readableError(error));
  return sendApiError(res, 400, "upload_rejected", "อัปโหลดไฟล์ไม่สำเร็จ");
}

function isAiHubLocalReviewEnabled() {
  if (process.env.AI_HUB_LOCAL_REVIEW_ENABLED === "true") return true;
  if (process.env.AI_HUB_LOCAL_REVIEW_ENABLED === "false") return false;
  return process.env.NODE_ENV !== "production" && !process.env.RENDER;
}

async function resolveAiHubReviewBundlePath(bundleName) {
  const requestedName = String(bundleName || "").trim();
  if (requestedName) {
    if (!/^[A-Za-z0-9._-]+\.json$/.test(requestedName)) {
      throw publicError(400, "invalid_bundle_name", "ชื่อ bundle ไม่ถูกต้อง");
    }
    return path.join(outputsDir, requestedName);
  }

  const envBundlePath = resolveProjectPath(process.env.AI_HUB_REVIEW_BUNDLE_PATH || "");
  if (envBundlePath) return envBundlePath;

  const latestBundle = await findLatestAiHubReviewBundle();
  if (latestBundle) return latestBundle;
  throw publicError(404, "ai_hub_review_bundle_not_found", "ไม่พบ AI HUB review bundle ใน outputs");
}

async function resolveAiHubReviewWorkspacePath() {
  const envWorkspacePath = resolveProjectPath(process.env.AI_HUB_REVIEW_WORKSPACE_PATH || "");
  if (envWorkspacePath) return envWorkspacePath;
  const workspacePath = path.join(outputsDir, "ai-hub-review-workspace.json");
  try {
    const stat = await fs.stat(workspacePath);
    if (stat.isFile()) return workspacePath;
  } catch (_error) {
    // Fall through to a clear user-facing error.
  }
  throw publicError(404, "ai_hub_review_workspace_not_found", "ยังไม่พบ AI HUB review workspace กรุณารัน npm run build:ai-hub-workspace ก่อน");
}

async function findLatestAiHubReviewBundle() {
  let entries = [];
  try {
    entries = await fs.readdir(outputsDir, { withFileTypes: true });
  } catch (_error) {
    return "";
  }

  const bundleFiles = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^ai-hub-image-review-bundle.*\.json$/i.test(entry.name)) continue;
    const filePath = path.join(outputsDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat?.isFile()) bundleFiles.push({ filePath, mtimeMs: stat.mtimeMs });
  }
  bundleFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return bundleFiles[0]?.filePath || "";
}

async function readJsonFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const text = await fs.readFile(resolvedPath, "utf8");
  return JSON.parse(text);
}

async function writeAiHubReviewDecisionArtifacts({ bundlePath, submission }) {
  const stem = buildAiHubDecisionArtifactStem(bundlePath, submission);
  const decisionsPath = path.join(outputsDir, `${stem}-decisions.json`);
  const actionPlanPath = path.join(outputsDir, `${stem}-action-plan.json`);
  await fs.mkdir(outputsDir, { recursive: true });
  await fs.writeFile(decisionsPath, `${JSON.stringify(submission.decisions, null, 2)}\n`, "utf8");
  await fs.writeFile(actionPlanPath, `${JSON.stringify(submission.action_plan, null, 2)}\n`, "utf8");
  return { decisionsPath, actionPlanPath };
}

function buildAiHubDecisionArtifactStem(bundlePath, submission) {
  const bundleBase = path.basename(bundlePath, ".json")
    .replace(/^ai-hub-image-review-bundle-?/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "") || "review-bundle";
  const primarySku = submission.action_plan?.items?.[0]?.sku || "multi-sku";
  const timestamp = safeTimestampForFile(submission.created_at || new Date().toISOString());
  return `ai-hub-review-${sanitizeFileName(primarySku)}-${bundleBase}-${timestamp}`;
}

function safeTimestampForFile(value) {
  return String(value || "")
    .replace(/[^0-9A-Za-z]+/g, "")
    .slice(0, 15) || String(Date.now());
}

function resolveAllowedAiHubImagePath(value) {
  const rawPath = String(value || "").trim();
  if (!rawPath) throw publicError(400, "missing_image_path", "ไม่พบ path รูปภาพ");
  const imagePath = path.resolve(rawPath);
  const allowedRoots = [outputsDir, approvedDir, uploadDir].map((root) => path.resolve(root));
  if (!allowedRoots.some((root) => isPathInside(imagePath, root))) {
    throw publicError(403, "local_image_path_not_allowed", "ไม่อนุญาตให้อ่านไฟล์นอกพื้นที่ review outputs");
  }
  if (!/\.(png|jpe?g|webp|gif)$/i.test(imagePath)) {
    throw publicError(415, "unsupported_local_image_type", "รองรับเฉพาะไฟล์รูปภาพเท่านั้น");
  }
  return imagePath;
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function contentTypeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function renderAiHubReviewErrorPage(error) {
  const status = error.status || 500;
  const message = error.publicMessage || "โหลด AI HUB review bundle ไม่สำเร็จ";
  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>AI HUB Review Error</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4f1;color:#1f2421;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(100% - 32px,520px);border:1px solid #ded8ce;border-radius:10px;background:#fffdfa;padding:28px;box-shadow:0 14px 40px rgba(39,35,30,.08)}p{color:#5d6660;line-height:1.6}</style></head><body><main class="card"><p>AI HUB Review</p><h1>${status}</h1><p>${escapeInlineHtml(message)}</p></main></body></html>`;
}

function escapeInlineHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeRuntimeEnv() {
  if (process.env.RENDER) return "render";
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function safeBuildVersion() {
  return process.env.APP_VERSION?.trim() || process.env.npm_package_version?.trim() || "1.0.0";
}

function safeBuildCommit() {
  const commit = process.env.RENDER_GIT_COMMIT?.trim() || process.env.GIT_COMMIT?.trim() || "";
  if (!/^[a-f0-9]{7,40}$/i.test(commit)) return "";
  return commit.slice(0, 12);
}

function isSupabaseStorageConfigured() {
  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && supabaseStorageBuckets.length);
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
  if (isSupabaseStorageConfigured()) {
    console.info(`[config] Supabase Storage best-effort uploads enabled for ${supabaseStorageBuckets.length} expected buckets.`);
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
  const workerRuntime = resolveWorkerRuntimeConfig(process.env);
  const googleDriveConfigured = isGoogleDriveApiConfigured() || isGoogleOAuthConfigured();
  const storageConfigured = isSupabaseStorageConfigured();
  const lineConfigured = isLineWebhookConfigured();
  const status = workerRuntime.wordpress_live_writes_enabled ? "blocked" : "ok";
  res.json({
    ok: true,
    status,
    service: "image-workflow",
    version: safeBuildVersion(),
    commit: safeBuildCommit() || null,
    time: new Date().toISOString(),
    env: safeRuntimeEnv(),
    worker_mode: workerRuntime.worker_mode,
    embedded_worker_enabled: workerRuntime.embedded_worker_enabled,
    dedicated_worker_expected: workerRuntime.dedicated_worker_expected,
    live_generation_enabled: workerRuntime.live_generation_enabled,
    dry_run: workerRuntime.dry_run,
    support_after_hero_approval_enabled: workerRuntime.support_after_hero_approval_enabled,
    wordpress_dry_run: workerRuntime.wordpress_dry_run,
    wordpress_live_writes_enabled: workerRuntime.wordpress_live_writes_enabled,
    google_drive_configured: googleDriveConfigured,
    google_drive_connected: googleDriveStatus.connected === true,
    storage_configured: storageConfigured,
    line_configured: lineConfigured,
    checks: {
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
      googleDriveConfigured,
      googleDriveConnected: googleDriveStatus.connected === true,
      falConfigured: Boolean(process.env.FAL_KEY),
      storageConfigured,
      lineConfigured
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
    automationWorker: {
      mode: workerRuntime.worker_mode,
      embedded: automationEmbeddedWorkerEnabled,
      dedicatedExpected: workerRuntime.dedicated_worker_expected,
      allowMultipleWorkers: workerRuntime.allow_multiple_workers,
      multipleWorkersConfigured: workerRuntime.multiple_workers_configured,
      running: automationEmbeddedWorkerRunning,
      lastRunAt: automationEmbeddedWorkerLastRunAt,
      lastError: automationEmbeddedWorkerLastError,
      processedTasks: automationEmbeddedWorkerProcessedTasks,
      queueSafety: buildWorkerQueueSafetySummary()
    },
    jobs: generationJobs.size
  });
});

app.get("/ai-hub/review", async (req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return res.status(403).send("AI HUB local review is disabled in this environment.");
  }

  try {
    const bundlePath = await resolveAiHubReviewBundlePath(req.query.bundle);
    const bundle = await readJsonFile(bundlePath);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderAiHubImageReviewPage(bundle, {
      bundleName: path.basename(bundlePath)
    }));
  } catch (error) {
    console.error("[ai-hub-review] page failed:", readableError(error));
    res.status(error.status || 500).type("html").send(renderAiHubReviewErrorPage(error));
  }
});

app.get("/ai-hub/workspace", async (_req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return res.status(403).send("AI HUB local workspace is disabled in this environment.");
  }

  try {
    const workspacePath = await resolveAiHubReviewWorkspacePath();
    const workspace = await readJsonFile(workspacePath);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderAiHubReviewWorkspacePage(workspace, {
      workspaceName: path.basename(workspacePath)
    }));
  } catch (error) {
    console.error("[ai-hub-workspace] page failed:", readableError(error));
    res.status(error.status || 500).type("html").send(renderAiHubReviewErrorPage(error));
  }
});

app.get("/api/ai-hub/review-bundle", async (req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return sendApiError(res, 403, "ai_hub_review_disabled", "AI HUB local review is disabled.");
  }

  try {
    const bundlePath = await resolveAiHubReviewBundlePath(req.query.bundle);
    const bundle = await readJsonFile(bundlePath);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      bundle_name: path.basename(bundlePath),
      bundle
    });
  } catch (error) {
    console.error("[ai-hub-review] bundle failed:", readableError(error));
    res.status(error.status || 500).json({
      ok: false,
      code: error.code || "ai_hub_review_bundle_failed",
      error: error.publicMessage || "โหลด AI HUB review bundle ไม่สำเร็จ"
    });
  }
});

app.get("/api/ai-hub/workspace", async (_req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return sendApiError(res, 403, "ai_hub_review_disabled", "AI HUB local workspace is disabled.");
  }

  try {
    const workspacePath = await resolveAiHubReviewWorkspacePath();
    const workspace = await readJsonFile(workspacePath);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      workspace_name: path.basename(workspacePath),
      workspace
    });
  } catch (error) {
    console.error("[ai-hub-workspace] api failed:", readableError(error));
    res.status(error.status || 500).json({
      ok: false,
      code: error.code || "ai_hub_workspace_failed",
      error: error.publicMessage || "โหลด AI HUB review workspace ไม่สำเร็จ"
    });
  }
});

app.post("/api/ai-hub/review-decisions", async (req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return sendApiError(res, 403, "ai_hub_review_disabled", "AI HUB local review is disabled.");
  }

  try {
    const bundlePath = await resolveAiHubReviewBundlePath(req.body?.bundle || req.query.bundle);
    const bundle = await readJsonFile(bundlePath);
    const reviewer = String(req.body?.reviewer || "").trim() || "local-reviewer";
    const submission = buildAiHubReviewDecisionSubmission({
      reviewBundle: bundle,
      decisions: Array.isArray(req.body?.decisions) ? req.body.decisions : [],
      reviewer,
      source: "ai_hub_local_review_console"
    });
    const artifactPaths = await writeAiHubReviewDecisionArtifacts({
      bundlePath,
      submission
    });

    res.status(201).json({
      ok: true,
      dry_run: true,
      live_write_allowed: false,
      bundle_name: path.basename(bundlePath),
      decisions_path: artifactPaths.decisionsPath,
      action_plan_path: artifactPaths.actionPlanPath,
      summary: submission.summary,
      action_plan_summary: submission.action_plan.summary
    });
  } catch (error) {
    console.error("[ai-hub-review] decisions failed:", readableError(error));
    res.status(error.status || 500).json({
      ok: false,
      code: error.code || "ai_hub_review_decisions_failed",
      error: error.publicMessage || "บันทึก AI HUB review decisions ไม่สำเร็จ"
    });
  }
});

app.get("/api/ai-hub/local-image", async (req, res) => {
  if (!isAiHubLocalReviewEnabled()) {
    return sendApiError(res, 403, "ai_hub_review_disabled", "AI HUB local review is disabled.");
  }

  try {
    const imagePath = resolveAllowedAiHubImagePath(req.query.path);
    const stat = await fs.stat(imagePath);
    if (!stat.isFile()) throw publicError(404, "local_image_not_found", "ไม่พบไฟล์รูปภาพนี้");
    res.setHeader("Content-Type", contentTypeFromPath(imagePath));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, max-age=60");
    createReadStream(imagePath).pipe(res);
  } catch (error) {
    console.error("[ai-hub-review] image failed:", readableError(error));
    if (!res.headersSent) {
      res.status(error.status || 500).json({
        ok: false,
        code: error.code || "ai_hub_local_image_failed",
        error: error.publicMessage || "โหลดรูปภาพ local ไม่สำเร็จ"
      });
    }
  }
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

app.get("/api/catalog/sku-search", requireUser, async (req, res) => {
  try {
    const query = cleanOptionalString(req.query.q);
    if (!query) {
      return res.json({
        ok: true,
        query: "",
        total: 0,
        items: []
      });
    }
    if (query.length < WEB_SKU_PICKER_MIN_QUERY_LENGTH) {
      return res.json({
        ok: true,
        query,
        total: 0,
        items: [],
        min_query_length: WEB_SKU_PICKER_MIN_QUERY_LENGTH
      });
    }

    const snapshot = await loadWebSkuPickerCatalogSnapshot();
    const result = searchWebSkuPickerCatalog({
      rows: snapshot.rows,
      query,
      branch: cleanOptionalString(req.query.branch),
      category: cleanOptionalString(req.query.category),
      limit: req.query.limit
    });
    res.json({
      ...result,
      source: snapshot.source,
      catalog: {
        source: snapshot.source,
        row_count: snapshot.rows.length
      }
    });
  } catch (error) {
    console.error("SKU search failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "sku_search_failed",
      error: "ค้นหา SKU จาก catalog ไม่สำเร็จ"
    });
  }
});

app.get("/api/catalog/sku/:sku", requireUser, async (req, res) => {
  try {
    const result = await readWebSkuPickerItemFast(req.params.sku);
    logExactSkuLookupDiagnostic({
      sku: req.params.sku,
      status: result.warming ? "warming" : result.item ? "found" : "not_found",
      diagnostics: result.diagnostics
    });
    if (result.warming) {
      return res.status(202).json({
        ok: false,
        code: "catalog_warming",
        status: "warming",
        error: "กำลังเตรียมข้อมูล catalog ครั้งแรก...",
        retry_after_ms: result.retryAfterMs || 1000,
        diagnostics: result.diagnostics
      });
    }
    if (!result.item) {
      return res.status(404).json({
        ok: false,
        code: "catalog_sku_not_found",
        error: "ไม่พบ SKU นี้ใน catalog"
      });
    }
    res.json({
      ok: true,
      item: result.item,
      source: "catalog_snapshot",
      diagnostics: result.diagnostics
    });
  } catch (error) {
    console.error("Exact SKU lookup failed:", readableError(error));
    res.status(500).json({
      ok: false,
      code: "catalog_sku_lookup_failed",
      error: "โหลดข้อมูล SKU จาก catalog ไม่สำเร็จ"
    });
  }
});

app.get("/api/catalog/sku/:sku/references", requireUser, async (req, res) => {
  try {
    const item = await readWebSkuPickerItem(req.params.sku);
    if (!item) {
      return res.status(404).json({
        ok: false,
        code: "catalog_sku_not_found",
        error: "ไม่พบ SKU นี้ใน catalog"
      });
    }
    const referencePayload = await buildWebSkuReferencePayload(item);
    res.json({
      ok: true,
      ...referencePayload
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("SKU reference load failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "sku_reference_load_failed",
      error: error.publicMessage || "โหลด reference ของ SKU ไม่สำเร็จ"
    });
  }
});

async function readWebSkuPickerItem(sku = "") {
  const index = await loadWebSkuPickerSkuIndex();
  return findWebSkuPickerItemBySku(index, sku);
}

async function readWebSkuPickerItemFast(sku = "", { warmWaitMs = 700, retryAfterMs = 1000 } = {}) {
  const startedAt = Date.now();
  const cachedIndex = await getCachedWebSkuPickerSkuIndex();
  if (cachedIndex) {
    const lookupStartedAt = Date.now();
    const item = findWebSkuPickerItemBySku(cachedIndex, sku);
    const lookupMs = Date.now() - lookupStartedAt;
    return {
      warming: false,
      item,
      diagnostics: {
        load_ms: Number(cachedIndex?.diagnostics?.load_ms || 0),
        normalize_ms: Number(cachedIndex?.diagnostics?.normalize_ms || 0),
        lookup_ms: lookupMs,
        total_ms: Date.now() - startedAt
      }
    };
  }

  const warmStartedAt = Date.now();
  if (!webSkuPickerIndexWarmPromise) {
    webSkuPickerIndexWarmPromise = delay(warmWaitMs + 50)
      .then(() => loadWebSkuPickerSkuIndex())
      .finally(() => {
        webSkuPickerIndexWarmPromise = null;
      });
  }

  const raceResult = await Promise.race([
    webSkuPickerIndexWarmPromise.then((index) => ({ index })),
    delay(warmWaitMs).then(() => ({ warming: true }))
  ]);

  if (raceResult.warming) {
    return {
      warming: true,
      retryAfterMs,
      diagnostics: {
        load_ms: Date.now() - warmStartedAt,
        normalize_ms: 0,
        lookup_ms: 0,
        total_ms: Date.now() - startedAt
      }
    };
  }

  const lookupStartedAt = Date.now();
  const item = findWebSkuPickerItemBySku(raceResult.index, sku);
  const lookupMs = Date.now() - lookupStartedAt;
  return {
    warming: false,
    item,
    diagnostics: {
      load_ms: Number(raceResult.index?.diagnostics?.load_ms || 0),
      normalize_ms: Number(raceResult.index?.diagnostics?.normalize_ms || 0),
      lookup_ms: lookupMs,
      total_ms: Date.now() - startedAt
    }
  };
}

function logExactSkuLookupDiagnostic({ sku = "", status = "", diagnostics = {} } = {}) {
  console.info("[catalog] exact sku lookup", {
    sku: sanitizeSku(sku),
    status,
    load_ms: Number(diagnostics.load_ms || 0),
    normalize_ms: Number(diagnostics.normalize_ms || 0),
    lookup_ms: Number(diagnostics.lookup_ms || 0),
    total_ms: Number(diagnostics.total_ms || 0)
  });
}

async function buildWebSkuReferencePayload(item = {}) {
  const folderId = cleanOptionalString(
    extractDriveIdFromUrl(item.reference_drive_id || "")
    || item.reference_drive_id
    || extractDriveIdFromUrl(item.reference_url || "")
  );
  let resolvedReferenceAssets = [];
  let resolutionSummary = {
    google_drive_checked: false,
    selected_reference_count: 0,
    file_count: 0,
    blockers: []
  };

  if (folderId && isValidDriveFileId(folderId)) {
    try {
      const drive = await getGoogleDriveClient();
      if (drive) {
        const files = await listGoogleDriveReferenceFilesCached(drive, folderId);
        const resolution = buildReferenceAssetResolution({
          batch: { batch_id: null },
          batchItems: [{
            sku: item.sku,
            product_name: item.product_name,
            reference_drive_id: folderId,
            reference_url: item.reference_url
          }],
          filesByFolderId: { [folderId]: files }
        });
        const resolutionItem = resolution.items?.[0] || {};
        resolvedReferenceAssets = resolutionItem.selected_reference_assets || [];
        resolvedReferenceAssets = await stageWebSkuReferenceAssetsForGeneration({
          drive,
          item,
          assets: resolvedReferenceAssets
        });
        resolutionSummary = {
          google_drive_checked: true,
          selected_reference_count: resolvedReferenceAssets.length,
          file_count: Number(resolutionItem.file_count || 0),
          image_file_count: Number(resolutionItem.image_file_count || 0),
          staged_reference_count: resolvedReferenceAssets.filter((asset) => asset.staged_public_url).length,
          staging_failed_count: resolvedReferenceAssets.filter((asset) => asset.staging_status === "staging_failed").length,
          blockers: resolutionItem.blockers || []
        };
      } else {
        resolutionSummary.blockers = ["google_drive_not_configured"];
      }
    } catch (error) {
      console.warn(`Web SKU reference Drive read failed: ${readableError(error)}`);
      resolutionSummary.blockers = ["google_drive_reference_read_failed"];
    }
  }

  const contract = buildWebSkuReferenceContract({
    item,
    resolvedReferenceAssets,
    buildPreviewUrl: ({ driveFileId = "", fileName = "" } = {}) => {
      if (!isValidDriveFileId(driveFileId)) return "";
      return buildSignedLineImageProxyUrl({ driveFileId, fileName });
    }
  });

  return {
    sku: item.sku,
    product_name: item.product_name || "",
    branch: item.branch || "",
    category: item.category || "",
    subcategory: item.subcategory || "",
    source: "catalog_snapshot",
    reference_source_fields: {
      reference_drive_id_present: Boolean(item.reference_drive_id),
      reference_url_present: Boolean(item.reference_url),
      reference_verified: item.reference_verified || "",
      reference_lookup_strategy: item.reference_lookup_strategy || "",
      source_file: item.source_file || "",
      source_row: item.source_row || ""
    },
    ...contract,
    resolution_summary: resolutionSummary
  };
}

async function resolveCatalogReferencesForGenerateRequest(req) {
  const sku = cleanOptionalString(req.body?.catalogReferenceSku);
  const autoUseCatalogReferences = req.body?.catalogReferenceAutoUse === "true";
  const requestedKeys = parseJsonArray(req.body?.catalogReferenceKeys)
    .map((key) => cleanOptionalString(key))
    .filter(Boolean);
  if (!sku && !requestedKeys.length && !autoUseCatalogReferences) return;
  if (!sku || (!requestedKeys.length && !autoUseCatalogReferences)) {
    throw publicError(400, "missing_catalog_reference_selection", "กรุณาเลือก SKU และ reference ที่ต้องการใช้กับ Hero");
  }

  const item = await readWebSkuPickerItem(sku);
  if (!item) {
    throw publicError(404, "catalog_sku_not_found", "ไม่พบ SKU นี้ใน catalog");
  }

  const referencePayload = await buildWebSkuReferencePayload(item);
  const referenceByKey = new Map((referencePayload.references || []).map((reference) => [reference.reference_key, reference]));
  const stageableReferences = (referencePayload.references || [])
    .filter((reference) => reference.stage_available && reference.generation_url);
  const keysToUse = requestedKeys.length
    ? [...new Set(requestedKeys)].slice(0, 6)
    : stageableReferences.map((reference) => reference.reference_key).slice(0, 6);
  const selectedReferences = [];
  for (const key of keysToUse) {
    const reference = referenceByKey.get(key);
    if (!reference) {
      throw publicError(400, "unknown_catalog_reference_key", "reference ที่เลือกไม่ตรงกับ catalog ของ SKU นี้");
    }
    selectedReferences.push(reference);
  }

  const nonStageable = selectedReferences.find((reference) => !reference.stage_available || !reference.generation_url);
  if (nonStageable) {
    throw publicError(400, "catalog_reference_not_stageable", "reference ที่เลือกยังใช้ Generate Hero โดยตรงไม่ได้ กรุณาอัปโหลดภาพสินค้าเอง");
  }
  if (!selectedReferences.length) {
    throw publicError(400, "catalog_reference_not_stageable", "ยังโหลดรูป reference จาก Google Drive มาใช้กับ Hero ไม่ได้ กรุณาอัปโหลดภาพสินค้าเองหรือตรวจสิทธิ์ Google Drive");
  }

  const catalogReferenceUrls = selectedReferences.map((reference) => reference.generation_url).filter(Boolean);
  req.body.extraImageUrls = JSON.stringify(catalogReferenceUrls.slice(0, 6));
  req.body.catalogReferenceResolved = "true";
  req.body.catalogReferenceResolvedCount = String(catalogReferenceUrls.length);
  req.body.catalogReferenceResolvedSku = item.sku;
}

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

app.get("/api/automation/batches/:batchId/review", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const context = await readAutomationBatchReviewContext(req.params.batchId);
    if (!context.batch) return sendApiError(res, 404, "batch_not_found", "ไม่พบ batch ที่ต้องการตรวจ");
    res.json(buildBatchReviewPayload({ ...context, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() }));
  } catch (error) {
    console.error("Batch review load failed:", readableError(error));
    res.status(500).json({ ok: false, code: "batch_review_failed", error: "โหลด Batch Review ไม่สำเร็จ" });
  }
});

app.post("/api/automation/batches/:batchId/confirm", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const context = await readAutomationBatchReviewContext(req.params.batchId);
    if (!context.batch) return sendApiError(res, 404, "batch_not_found", "ไม่พบ batch ที่ต้องการยืนยัน");

    const payload = buildBatchReviewPayload({ ...context, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() });
    if (!payload.allowed_actions.some((action) => action.type === "confirm_batch") &&
      !["hero_queued", "hero_generating", "hero_waiting_review", "hero_approved", "support_ready", "support_queued", "support_generating", "support_waiting_review", "support_approved", "export_ready", "exported"].includes(payload.state)) {
      return res.status(409).json({
        ok: false,
        code: "batch_confirm_not_allowed",
        error: "Batch นี้ยังไม่พร้อมให้ยืนยัน",
        review: payload
      });
    }

    await confirmAutomationBatchFromReview({ batch: context.batch, actorId: req.user.id });
    const updated = await readAutomationBatchReviewContext(context.batch.id);
    res.json(buildBatchReviewPayload({ ...updated, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() }));
  } catch (error) {
    console.error("Batch confirm failed:", readableError(error));
    res.status(500).json({ ok: false, code: "batch_confirm_failed", error: "ยืนยัน Batch ไม่สำเร็จ" });
  }
});

app.post("/api/automation/batches/:batchId/cancel", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const context = await readAutomationBatchReviewContext(req.params.batchId);
    if (!context.batch) return sendApiError(res, 404, "batch_not_found", "ไม่พบ batch ที่ต้องการยกเลิก");
    const review = buildBatchReviewPayload({ ...context, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() });
    if (["cancelled"].includes(review.state) || ["cancelled", "rejected"].includes(String(context.batch.status || "").trim().toLowerCase())) {
      return res.json(review);
    }
    const hasActiveGeneration = context.tasks.some((task) => ["queued", "running"].includes(String(task.status || "").toLowerCase()));
    if (!isBatchCancelable({
      batchState: review.state,
      batchStatus: context.batch.status,
      hasActiveGeneration
    })) {
      return res.status(409).json({
        ok: false,
        code: "batch_cancel_not_allowed",
        error: "Batch นี้ยกเลิกไม่ได้ในสถานะปัจจุบัน",
        review
      });
    }

    await cancelAutomationBatchFromReview({ batch: context.batch, actorId: req.user.id });
    const updated = await readAutomationBatchReviewContext(context.batch.id);
    res.json(buildBatchReviewPayload({ ...updated, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() }));
  } catch (error) {
    console.error("Batch cancel failed:", readableError(error));
    res.status(500).json({ ok: false, code: "batch_cancel_failed", error: "ยกเลิก Batch ไม่สำเร็จ" });
  }
});

app.post("/api/automation/batch-items/:itemId/skip", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const itemContext = await readAutomationBatchItemActionContext(req.params.itemId);
    if (!itemContext.item) return sendApiError(res, 404, "batch_item_not_found", "ไม่พบ SKU ที่ต้องการข้าม");
    const workflowItem = normalizeAutomationBatchItemForWorkflow(itemContext.item);
    const itemWorkflow = resolveItemWorkflowState({ item: workflowItem, tasks: itemContext.tasks });
    const review = buildBatchReviewPayload({ ...itemContext, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() });
    if (itemWorkflow.state === "skipped" || ["skipped", "rejected"].includes(String(itemContext.item.status || "").trim().toLowerCase())) {
      return res.json(review);
    }
    if (!isItemSkippable({ item: workflowItem, workflow: itemWorkflow, tasks: itemContext.tasks })) {
      return res.status(409).json({
        ok: false,
        code: "item_skip_not_allowed",
        error: "SKU นี้ข้ามไม่ได้ในสถานะปัจจุบัน",
        review
      });
    }

    await skipAutomationBatchItemFromReview({ item: itemContext.item, actorId: req.user.id });
    const updated = await readAutomationBatchReviewContext(itemContext.batch.id);
    res.json(buildBatchReviewPayload({ ...updated, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() }));
  } catch (error) {
    console.error("Batch item skip failed:", readableError(error));
    res.status(500).json({ ok: false, code: "batch_item_skip_failed", error: "ข้าม SKU ไม่สำเร็จ" });
  }
});

app.post("/api/automation/batch-items/:itemId/retry", requireUser, async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({
        ok: false,
        code: profileCheck.code,
        error: profileCheck.error
      });
    }

    const itemContext = await readAutomationBatchItemActionContext(req.params.itemId);
    if (!itemContext.item) return sendApiError(res, 404, "batch_item_not_found", "ไม่พบ SKU ที่ต้องการ retry");
    const workflowItem = normalizeAutomationBatchItemForWorkflow(itemContext.item);
    const itemWorkflow = resolveItemWorkflowState({ item: workflowItem, tasks: itemContext.tasks });
    const review = buildBatchReviewPayload({ ...itemContext, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() });
    if (hasBatchReviewRetryTaskForItem(itemContext.tasks, itemContext.item.id)) {
      return res.json(review);
    }
    if (!isItemRetryable({ item: workflowItem, workflow: itemWorkflow, tasks: itemContext.tasks })) {
      return res.status(409).json({
        ok: false,
        code: "item_retry_not_allowed",
        error: "SKU นี้ยังไม่เข้าเงื่อนไข retry",
        review
      });
    }

    await retryAutomationBatchItemFromReview({
      batch: itemContext.batch,
      item: itemContext.item,
      itemState: itemWorkflow.state,
      actorId: req.user.id
    });
    const updated = await readAutomationBatchReviewContext(itemContext.batch.id);
    res.json(buildBatchReviewPayload({ ...updated, profile: profileCheck.profile, hrefBase: getPublicBaseUrl() }));
  } catch (error) {
    console.error("Batch item retry failed:", readableError(error));
    res.status(500).json({ ok: false, code: "batch_item_retry_failed", error: "Retry SKU ไม่สำเร็จ" });
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

app.get("/api/review/hero", requireUser, async (req, res) => {
  let generationId = String(req.query.generation_id || req.query.generationId || "").trim();
  const assetId = String(req.query.asset_id || req.query.assetId || "").trim();
  if (!generationId && assetId) {
    generationId = await resolveGenerationIdFromOwnedAsset(assetId, req.user.id);
  }
  if (!generationId) return sendApiError(res, 400, "generation_required", "Missing generation_id.");

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return sendApiError(res, 404, "generation_not_found", "Generation not found.");

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", generation.job_id)
      .maybeSingle();
    if (jobError) throw jobError;

    const [assetsResult, generationsResult, approvalsResult] = await Promise.all([
      supabaseAdmin
        .from("assets")
        .select("*")
        .eq("job_id", generation.job_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("generations")
        .select("id, job_id, kind, request_id, status, image_asset_id, prompt, completed_at, created_at")
        .eq("job_id", generation.job_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("approvals")
        .select("*")
        .eq("generation_id", generationId)
        .order("approved_at", { ascending: false })
    ]);
    if (assetsResult.error) throw assetsResult.error;
    if (generationsResult.error) throw generationsResult.error;
    if (approvalsResult.error) throw approvalsResult.error;

    const assets = assetsResult.data || [];
    const generations = generationsResult.data || [];
    const reviewGeneration = generations.find((item) => item.id === generationId) || generation;
    const generationByAssetId = new Map(generations
      .filter((item) => item.image_asset_id)
      .map((item) => [item.image_asset_id, item]));
    const heroAsset = assets.find((asset) => asset.id === reviewGeneration.image_asset_id) ||
      assets.find((asset) => String(asset.type || "").toLowerCase() === "hero_generated") ||
      null;
    const batchKey = cleanOptionalString(req.query.batch_id || req.query.batchId);
    const reviewSku = cleanOptionalString(req.query.sku) || job?.sku || "";
    let referenceAssets = assets.filter((asset) => isReferenceReviewAsset(asset));
    const batchItemMetadata = await readHeroReviewBatchItemMetadata({
      batchKey,
      sku: reviewSku
    });
    const batchReferenceAssets = await readHeroReviewReferenceAssetsFromBatch({
      batchKey,
      sku: reviewSku,
      metadata: batchItemMetadata
    });
    referenceAssets = mergeReviewReferenceAssets(referenceAssets, batchReferenceAssets);
    const supportAssets = buildHeroReviewSupportAssets({
      assets,
      generations,
      batchMetadata: batchItemMetadata
    });
    const supportReviewReady = supportAssets.length > 0 ||
      batchItemMetadata.review_set_status === "awaiting_support_review" ||
      batchItemMetadata.support_generation?.status === "support_ready_for_review";

    res.json({
      ok: true,
      review: {
        batch_id: batchKey,
        sku: reviewSku,
        generation_id: generationId,
        job: sanitizeWorkflowJobDetail(job || {}),
        hero_asset: heroAsset,
        support_assets: supportAssets,
        support_review_ready: supportReviewReady,
        review_stage: supportReviewReady ? "support_review" : "hero_review",
        support_review_decision_state: batchItemMetadata.support_review_decision_state || null,
        support_review_decisions: Array.isArray(batchItemMetadata.support_review_decisions)
          ? batchItemMetadata.support_review_decisions
          : [],
        support_candidate_manifest: batchItemMetadata.support_candidate_manifest || batchItemMetadata.candidate_manifest || null,
        media_export_preflight_gate: batchItemMetadata.media_export_preflight_gate || null,
        media_assets: Array.isArray(batchItemMetadata.media_assets) ? batchItemMetadata.media_assets : [],
        reference_assets: referenceAssets,
        approved: Boolean(approvalsResult.data?.length),
        approvals: approvalsResult.data || []
      }
    });
  } catch (error) {
    console.warn(error?.message || readableError(error));
    res.status(500).json({ ok: false, code: "hero_review_failed", error: "โหลด Hero Review ไม่สำเร็จ" });
  }
});

app.post("/api/review/hero/regenerate", requireUser, async (req, res) => {
  const generationId = String(req.body.generation_id || req.body.generationId || "").trim();
  if (!generationId) return sendApiError(res, 400, "generation_required", "Missing generation_id.");

  try {
    const generation = await getOwnedGeneration(generationId, req.user.id);
    if (!generation) return sendApiError(res, 404, "generation_not_found", "Generation not found.");
    const batchId = cleanOptionalString(req.body.batch_id || req.body.batchId);
    const sku = sanitizeSku(req.body.sku || "");

    await recordAuditEvent({
      actorId: req.user.id,
      jobId: generation.job_id,
      generationId,
      eventType: "hero_regeneration_requested",
      eventJson: { source: "web_review_page", batch_id: batchId, sku }
    });

    const task = await maybeEnqueueHeroReviewAutomationTask({
      action: "regenerate_hero",
      batchId,
      sku,
      jobId: generation.job_id,
      generationId,
      actorId: req.user.id
    });

    res.json({ ok: true, task });
  } catch (error) {
    console.warn(error?.message || readableError(error));
    res.status(500).json({ ok: false, code: "hero_regenerate_failed", error: "บันทึกคำขอ regenerate ไม่สำเร็จ" });
  }
});

app.post("/api/review/support-decisions", requireUser, async (req, res) => {
  const batchId = cleanOptionalString(req.body.batch_id || req.body.batchId);
  const sku = sanitizeSku(req.body.sku || "");
  const generationId = cleanOptionalString(req.body.generation_id || req.body.generationId);
  const decisions = Array.isArray(req.body.decisions) ? req.body.decisions : [];
  if (!batchId || !sku) return sendApiError(res, 400, "batch_sku_required", "Missing batch_id or sku.");

  try {
    const resolvedBatchId = await resolveAutomationBatchIdForReview(batchId);
    if (!resolvedBatchId) return sendApiError(res, 404, "batch_not_found", "Batch not found.");
    const { data: item, error: itemError } = await supabaseAdmin
      .from("automation_batch_items")
      .select("id, metadata")
      .eq("batch_id", resolvedBatchId)
      .eq("sku", sku)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item?.id) return sendApiError(res, 404, "batch_item_not_found", "Batch item not found.");

    const metadata = isPlainObject(item.metadata) ? item.metadata : {};
    const supportAssets = buildHeroReviewSupportAssets({
      assets: [],
      generations: [],
      batchMetadata: metadata
    });
    const decisionState = buildSupportReviewDecisionState({
      sku,
      supportAssets,
      decisions,
      reviewer: req.user.email || req.user.id || ""
    });
    const manifestContext = decisionState.candidate_manifest_ready
      ? await readSupportCandidateManifestContext({ generationId, userId: req.user.id })
      : {};
    const candidateManifest = decisionState.candidate_manifest_ready
      ? buildLiveSupportCandidateManifest({
        batchId: resolvedBatchId,
        sku,
        job: manifestContext.job || {},
        heroAsset: manifestContext.heroAsset || {},
        supportAssets,
        decisionState
      })
      : null;
    const mediaExportPreflightGate = candidateManifest
      ? buildMediaExportPreflightGate({ candidateManifest })
      : null;
    const { error: updateError } = await supabaseAdmin
      .from("automation_batch_items")
      .update({
        status: decisionState.review_status,
        metadata: {
          ...metadata,
          review_set_status: decisionState.review_status,
          support_review_decision_state: decisionState,
          support_review_decisions: decisionState.assets,
          support_candidate_manifest: candidateManifest,
          candidate_manifest: candidateManifest,
          candidate_manifest_status: candidateManifest?.manifest_status || null,
          media_export_preflight_gate: mediaExportPreflightGate,
          media_export_preflight_status: mediaExportPreflightGate?.gate_status || null,
          media_assets: mediaExportPreflightGate?.media_assets || []
        }
      })
      .eq("id", item.id);
    if (updateError) throw updateError;

    await recordAuditEvent({
      actorId: req.user.id,
      eventType: "support_review_decisions_recorded",
      eventJson: {
        batch_id: resolvedBatchId,
        sku,
        review_status: decisionState.review_status,
        summary: decisionState.summary,
        candidate_manifest_ready: decisionState.candidate_manifest_ready,
        candidate_manifest_status: candidateManifest?.manifest_status || null,
        media_export_preflight_status: mediaExportPreflightGate?.gate_status || null
      }
    });

    if (candidateManifest) {
      await recordAuditEvent({
        actorId: req.user.id,
        eventType: "support_candidate_manifest_built",
        eventJson: {
          batch_id: resolvedBatchId,
          sku,
          generation_id: generationId || null,
          manifest_status: candidateManifest.manifest_status,
          summary: candidateManifest.summary
        }
      });
    }

    if (mediaExportPreflightGate) {
      await recordAuditEvent({
        actorId: req.user.id,
        eventType: "media_export_preflight_gate_built",
        eventJson: {
          batch_id: resolvedBatchId,
          sku,
          generation_id: generationId || null,
          gate_status: mediaExportPreflightGate.gate_status,
          summary: mediaExportPreflightGate.summary
        }
      });
    }

    res.json({
      ok: true,
      decision_state: decisionState,
      candidate_manifest: candidateManifest,
      media_export_preflight_gate: mediaExportPreflightGate
    });
  } catch (error) {
    console.warn(error?.message || readableError(error));
    res.status(500).json({ ok: false, code: "support_review_decisions_failed", error: "บันทึก Support Review decisions ไม่สำเร็จ" });
  }
});

async function readSupportCandidateManifestContext({ generationId, userId }) {
  if (!generationId) return {};
  const generation = await getOwnedGeneration(generationId, userId);
  if (!generation) return {};
  const [jobResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", generation.job_id)
      .maybeSingle(),
    supabaseAdmin
      .from("assets")
      .select("*")
      .eq("job_id", generation.job_id)
  ]);
  if (jobResult.error) throw jobResult.error;
  if (assetsResult.error) throw assetsResult.error;
  const assets = assetsResult.data || [];
  const heroAsset = assets.find((asset) => asset.id === generation.image_asset_id) ||
    assets.find((asset) => String(asset.type || "").toLowerCase() === "hero_generated") ||
    {};
  return { generation, job: jobResult.data || {}, heroAsset };
}

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

    const heroAsset = await readHeroAssetForGeneration(generation);
    const approvalResult = await ensureHeroApprovalRecord({
      generation,
      actorId: req.user.id,
      exportPath,
      note
    });

    if (approvalResult.error) {
      console.warn(readableError(approvalResult.error));
      await recordAuditEvent({
        actorId: req.user.id,
        jobId: generation.job_id,
        generationId,
        eventType: "approval_record_failed",
        eventJson: { error: readableError(approvalResult.error), export_path: exportPath }
      });
      return res.json({ ok: false, error: "Approval was not recorded." });
    }

    if (!approvalResult.duplicate) {
      await recordAuditEvent({
        actorId: req.user.id,
        jobId: generation.job_id,
        generationId,
        eventType: "approval_recorded",
        eventJson: {
          approval_id: approvalResult.approval?.id || null,
          export_path: exportPath
        }
      });
    }

    const task = await maybeEnqueueHeroReviewAutomationTask({
      action: "approve_hero",
      batchId: cleanOptionalString(req.body.batch_id || req.body.batchId),
      sku: sanitizeSku(req.body.sku || ""),
      jobId: generation.job_id,
      generationId,
      actorId: req.user.id,
      approval: approvalResult.approval,
      heroAsset,
      source: "web_review_page"
    });

    res.status(approvalResult.duplicate ? 200 : 201).json({
      ok: true,
      approval: approvalResult.approval,
      duplicate: approvalResult.duplicate,
      task
    });
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
  rateLimit({ keyPrefix: "generate-start", windowMs: 60_000, max: 12, userScoped: true }),
  handleImageUploadFields([
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

      await resolveCatalogReferencesForGenerateRequest(req);
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
      const status = error.status || 500;
      console.error("Generate start failed:", readableError(error));
      logGenerateDiagnostic("error", {
        userId: req.user?.id || "",
        email: req.user?.email || "",
        reason: readableError(error)
      });
      res.status(status).json({
        ok: false,
        code: error.code || "generate_start_failed",
        error: error.publicMessage || "เริ่มงาน Generate ไม่สำเร็จ"
      });
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
  rateLimit({ keyPrefix: "generate-legacy", windowMs: 60_000, max: 8, userScoped: true }),
  handleImageUploadFields([
    { name: "productImages", maxCount: 10 },
    { name: "modelImages", maxCount: 5 }
  ]),
  async (req, res) => {
  try {
    const profileCheck = await getWorkflowProfileForUser(req.user.id);
    if (!profileCheck.ok) {
      return res.status(profileCheck.status).json({ ok: false, code: profileCheck.code, error: profileCheck.error });
    }
    await resolveCatalogReferencesForGenerateRequest(req);
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
    const status = error.status || 500;
    console.error("Legacy generate failed:", readableError(error));
    res.status(status).json({
      ok: false,
      code: error.code || "generate_failed",
      error: error.publicMessage || "Generate ไม่สำเร็จ"
    });
  }
  }
);

app.get("/api/ops", requireUser, requireAdminUser, (_req, res) => {
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
    const urlValidation = validateRemoteImageUrl(imageUrl);
    if (!urlValidation.ok) return sendApiError(res, 400, urlValidation.code, urlValidation.error);

    const extension = extensionFromUrl(urlValidation.url) || "png";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${stamp}_${jobName}.${extension}`;
    const approvedPath = path.join(approvedDir, fileName);

    await downloadFile(urlValidation.url, approvedPath);
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
    res.status(500).json({ ok: false, code: "approve_failed", error: "Approve/export ไม่สำเร็จ" });
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
  const uploadValidation = validateUploadedImageFiles(req.files || {});
  if (!uploadValidation.ok) {
    return { status: 415, code: uploadValidation.code, error: uploadValidation.error };
  }
  const productFiles = req.files?.productImages || [];
  const resolvedCatalogReferenceCount = Number(req.body?.catalogReferenceResolvedCount || 0);
  const hasServerResolvedCatalogReferences = req.body?.catalogReferenceResolved === "true" &&
    resolvedCatalogReferenceCount > 0 &&
    parseExtraImageUrls(req.body?.extraImageUrls).length > 0;
  if (!productFiles.length && !hasServerResolvedCatalogReferences) {
    return { status: 400, code: "missing_product_image", error: "กรุณาอัปโหลดภาพสินค้าอย่างน้อย 1 รูป" };
  }
  const unsafeExtraUrls = collectUnsafeImageUrls(req.body?.extraImageUrls);
  if (unsafeExtraUrls.length) {
    return { status: 400, code: "invalid_reference_url", error: "URL รูปภาพอ้างอิงบางรายการไม่ปลอดภัยหรือไม่รองรับ" };
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

  const { data: existingExportAssets, error: existingExportError } = await supabaseAdmin
    .from("assets")
    .select("id, type, bucket, public_url, storage_key, file_name, created_at")
    .eq("job_id", jobId)
    .eq("type", "approved_export")
    .order("created_at", { ascending: false })
    .limit(10);
  if (existingExportError) throw existingExportError;
  const existingExport = shouldSkipRetryExport(existingExportAssets || []);
  if (existingExport.skip) {
    await recordAuditEvent({
      actorId: adminUserId,
      jobId,
      eventType: "export_retry_skipped",
      eventJson: {
        reason: "existing_export_link_available",
        asset_id: existingExport.existing?.assetId || null
      }
    });
    return {
      jobId,
      generationId: null,
      status: existingExport.existing?.status || "exported",
      skipped: true,
      message: "มี export link อยู่แล้ว จึงไม่สร้างไฟล์ซ้ำ",
      exportUrl: existingExport.existing?.exportUrl || "",
      googleDriveFile: existingExport.existing?.status === "google_drive"
        ? {
          id: existingExport.existing.asset?.storage_key || existingExport.existing.assetId || null,
          name: existingExport.existing.asset?.file_name || null,
          webViewLink: existingExport.existing.exportUrl
        }
        : null
    };
  }

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

async function resolveGenerationIdFromOwnedAsset(assetId, userId) {
  if (!assetId || !userId) return "";
  if (!isValidUuid(assetId)) return "";
  const { data: asset, error: assetError } = await supabaseAdmin
    .from("assets")
    .select("id, job_id, generation_id")
    .eq("id", assetId)
    .maybeSingle();
  if (assetError || !asset?.job_id) return "";

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id, created_by")
    .eq("id", asset.job_id)
    .eq("created_by", userId)
    .maybeSingle();
  if (jobError || !job?.id) return "";

  if (asset.generation_id) return asset.generation_id;
  return findGenerationIdForAsset(asset.job_id, asset.id);
}

function isReferenceReviewAsset(asset = {}) {
  const type = String(asset.type || "").toLowerCase();
  if (!type) return false;
  if (type.includes("generated") || type === "approved_export") return false;
  return type.includes("reference") || type.includes("upload") || type.includes("source") || type.includes("product");
}

async function readHeroReviewBatchItemMetadata({ batchKey = "", sku = "" } = {}) {
  const normalizedBatchKey = cleanOptionalString(batchKey);
  const normalizedSku = sanitizeSku(sku);
  if (!normalizedBatchKey || !normalizedSku) return {};

  let batchQuery = supabaseAdmin
    .from("automation_batches")
    .select("id")
    .limit(1);
  batchQuery = isValidUuid(normalizedBatchKey)
    ? batchQuery.eq("id", normalizedBatchKey)
    : batchQuery.eq("batch_key", normalizedBatchKey);

  const { data: batches, error: batchError } = await batchQuery;
  if (batchError) throw batchError;
  const batch = (batches || [])[0];
  if (!batch?.id) return {};

  const { data: item, error: itemError } = await supabaseAdmin
    .from("automation_batch_items")
    .select("metadata")
    .eq("batch_id", batch.id)
    .eq("sku", normalizedSku)
    .maybeSingle();
  if (itemError) throw itemError;

  return isPlainObject(item?.metadata) ? item.metadata : {};
}

async function readProductionBatchItemsBySku(skus = []) {
  const normalizedSkus = [...new Set(
    skus
      .map((sku) => sanitizeSku(sku))
      .filter(Boolean)
  )];
  if (!normalizedSkus.length) return new Map();

  const { data: items, error } = await supabaseAdmin
    .from("automation_batch_items")
    .select("id, batch_id, sku, status, metadata, created_at, updated_at")
    .in("sku", normalizedSkus)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const batchIds = [...new Set((items || []).map((item) => item.batch_id).filter(Boolean))];
  const batchById = new Map();
  if (batchIds.length) {
    const { data: batches, error: batchError } = await supabaseAdmin
      .from("automation_batches")
      .select("id, batch_key, status, created_at")
      .in("id", batchIds)
      .limit(1000);
    if (batchError) throw batchError;
    (batches || []).forEach((batch) => batchById.set(batch.id, batch));
  }

  const itemBySku = new Map();
  (items || []).forEach((item) => {
    const sku = sanitizeSku(item.sku);
    if (!sku || itemBySku.has(sku)) return;
    const batch = batchById.get(item.batch_id) || {};
    itemBySku.set(sku, {
      id: item.id,
      batchId: item.batch_id || "",
      batchKey: batch.batch_key || item.batch_id || "",
      batchStatus: batch.status || "",
      status: item.status || "",
      metadata: isPlainObject(item.metadata) ? item.metadata : {},
      updatedAt: item.updated_at || item.created_at || batch.created_at || null
    });
  });
  return itemBySku;
}

async function readHeroReviewReferenceAssetsFromBatch({ batchKey = "", sku = "", metadata = null } = {}) {
  const resolvedMetadata = isPlainObject(metadata)
    ? metadata
    : await readHeroReviewBatchItemMetadata({ batchKey, sku });
  const referenceAssets = firstArray(
    resolvedMetadata.hero_review_reference_assets,
    resolvedMetadata.selected_reference_assets,
    resolvedMetadata.reference_assets,
    resolvedMetadata.reference_images,
    resolvedMetadata.reference_resolution?.selected_reference_assets
  );
  if (referenceAssets.length) {
    return referenceAssets.map(normalizeHeroReviewReferenceAsset).filter(Boolean);
  }

  return readHeroReviewReferenceAssetsFromDriveFolder({ metadata: resolvedMetadata, sku });
}

async function readHeroReviewReferenceAssetsFromDriveFolder({ metadata = {}, sku = "" } = {}) {
  if (!isPlainObject(metadata)) return [];
  const folderId = cleanOptionalString(
    metadata.reference_drive_id ||
    metadata.metadata?.reference_drive_id ||
    metadata.reference_manifest?.drive_file_id ||
    extractDriveIdFromUrl(metadata.reference_url || metadata.metadata?.reference_url || metadata.reference_manifest?.source_url || "")
  );
  if (!folderId) return [];

  const drive = await getGoogleDriveClient();
  if (!drive) return [];

  let files = [];
  try {
    files = await listGoogleDriveReferenceFiles(drive, folderId);
  } catch (error) {
    console.warn(`Hero review reference folder read failed: ${readableError(error)}`);
    return [];
  }

  const normalizedSku = sanitizeSku(sku || metadata.sku || "");
  const resolution = buildReferenceAssetResolution({
    batchItems: [{
      sku: normalizedSku,
      reference_drive_id: folderId,
      reference_url: metadata.reference_url || metadata.reference_manifest?.source_url || ""
    }],
    filesByFolderId: { [folderId]: files }
  });
  const selectedAssets = resolution.items?.[0]?.selected_reference_assets || [];
  return selectedAssets
    .map((asset, index) => normalizeHeroReviewReferenceAsset({
      ...asset,
      file_name: `${String(index + 1).padStart(2, "0")}-${asset.name || asset.drive_file_id || asset.id}`,
      source_role: "product_reference",
      type: "product_reference"
    }))
    .filter(Boolean);
}

function normalizeHeroReviewReferenceAsset(asset = {}) {
  if (!isPlainObject(asset)) return null;
  const driveFileId = cleanOptionalString(asset.drive_file_id || asset.driveFileId || asset.id);
  const signedDriveUrl = driveFileId && isValidDriveFileId(driveFileId)
    ? buildSignedLineImageProxyUrl({
      driveFileId,
      fileName: asset.name || asset.file_name || asset.source_name || ""
    })
    : "";
  const fallbackUrl = safeHttpsUrl(
    asset.public_url ||
    asset.url ||
    asset.source_url ||
    asset.thumbnailLink ||
    asset.webContentLink ||
    asset.webViewLink
  );
  const url = signedDriveUrl || fallbackUrl;
  return {
    ...asset,
    type: asset.type || "product_reference",
    file_name: asset.file_name || asset.name || asset.source_name || "reference image",
    name: asset.name || asset.file_name || asset.source_name || "reference image",
    public_url: url,
    url
  };
}

function mergeReviewReferenceAssets(primary = [], fallback = []) {
  const seen = new Set();
  const merged = [];
  for (const asset of [...primary, ...fallback]) {
    const normalized = normalizeHeroReviewReferenceAsset(asset);
    if (!normalized) continue;
    const key = normalized.drive_file_id || normalized.id || normalized.public_url || normalized.url || normalized.file_name || normalized.name || "";
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}

function extractSupportSlot({ asset = {}, generation = {} } = {}) {
  const haystack = [
    asset.file_name,
    asset.storage_key,
    asset.public_url,
    generation.request_id
  ].join(" ");
  const knownSlots = [
    "side_fit_on_model",
    "back_fit_on_model",
    "material_or_lining_closeup",
    "side_thickness_length",
    "back_hood_closure",
    "lining_warmth",
    "texture_closeup"
  ];
  return knownSlots.find((slot) => haystack.includes(slot)) || "";
}

function buildSignedLineImageProxyUrl({ driveFileId = "", fileName = "" } = {}) {
  const base = cleanOptionalString(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, "");
  const signingSecret = cleanOptionalString(lineImageProxySecret);
  return buildLineImageProxyUrl({
    baseUrl: base,
    secret: signingSecret,
    driveFileId,
    fileName
  });
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length) || [];
}

function safeHttpsUrl(value = "") {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

function getPublicBaseUrl() {
  return cleanOptionalString(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, "");
}

async function readAutomationBatchReviewContext(batchIdOrKey) {
  const batchId = cleanOptionalString(batchIdOrKey);
  if (!batchId) return { batch: null, items: [], tasks: [] };
  const batchQuery = supabaseAdmin
    .from("automation_batches")
    .select("*");
  const { data: batch, error: batchError } = await (isValidUuid(batchId)
    ? batchQuery.eq("id", batchId)
    : batchQuery.eq("batch_key", batchId)
  ).maybeSingle();
  if (batchError) throw batchError;
  if (!batch?.id) return { batch: null, items: [], tasks: [] };

  const [itemsResult, tasksResult] = await Promise.all([
    supabaseAdmin
      .from("automation_batch_items")
      .select("*")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("automation_tasks")
      .select("id, task_type, status, priority, batch_id, batch_item_id, job_id, generation_id, dedupe_key, payload, attempts, max_attempts, available_at, locked_at, last_error, completed_at, created_at, updated_at")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  return {
    batch,
    items: itemsResult.data || [],
    tasks: tasksResult.data || []
  };
}

async function readAutomationBatchItemActionContext(itemId) {
  const normalizedItemId = cleanOptionalString(itemId);
  if (!isValidUuid(normalizedItemId)) return { batch: null, item: null, items: [], tasks: [] };
  const { data: item, error: itemError } = await supabaseAdmin
    .from("automation_batch_items")
    .select("*")
    .eq("id", normalizedItemId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item?.id) return { batch: null, item: null, items: [], tasks: [] };
  const context = await readAutomationBatchReviewContext(item.batch_id);
  return {
    ...context,
    item: (context.items || []).find((entry) => entry.id === item.id) || item
  };
}

function normalizeAutomationBatchItemForWorkflow(item = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  return {
    id: item.id || "",
    batch_id: item.batch_id || "",
    sku: item.sku || metadata.sku || "",
    status: item.status || "",
    product_name: item.product_name || metadata.product_name || "",
    product_type: item.product_type || metadata.product_type || "",
    target_site: item.target_site || metadata.target_site || "",
    reference_url: metadata.reference_url || metadata.reference_manifest?.source_url || "",
    reference_drive_id: metadata.reference_drive_id || metadata.reference_manifest?.drive_file_id || "",
    metadata
  };
}

async function confirmAutomationBatchFromReview({ batch = {}, actorId = "" } = {}) {
  if (!batch?.id) return null;
  const approvedAt = batch.approved_at || new Date().toISOString();
  const existingMetadata = isPlainObject(batch.metadata) ? batch.metadata : {};
  const { error: batchError } = await supabaseAdmin
    .from("automation_batches")
    .update({
      status: "approved",
      approved_at: approvedAt,
      metadata: {
        ...existingMetadata,
        review_action: {
          source: "batch_review_api",
          last_action: "confirm_batch",
          actor_id: actorId || null,
          recorded_at: new Date().toISOString()
        }
      }
    })
    .eq("id", batch.id);
  if (batchError) throw batchError;

  const action = { action: "approve_batch", batchId: batch.batch_key || batch.id };
  const liveBlockers = [];
  if (!isBooleanEnvEnabled("AI_GENERATION_LIVE_ENABLED")) liveBlockers.push("AI_GENERATION_LIVE_ENABLED_not_true");
  if (isDryRun("AI_GENERATION_DRY_RUN", true)) liveBlockers.push("AI_GENERATION_DRY_RUN_true");
  if (!cleanOptionalString(process.env.FAL_KEY)) liveBlockers.push("missing_FAL_KEY");
  const liveHeroRequested = !liveBlockers.length;
  const taskRequests = buildLineBatchApprovalTaskRequests({
    action,
    automationBatchId: batch.id,
    lineUserId: batch.requested_by_line_user_id || null,
    actorId,
    liveGenerationRequested: liveHeroRequested,
    liveGenerationConfirmed: liveHeroRequested,
    dryRun: isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true)
  });
  for (const taskRequest of taskRequests) await enqueueAutomationTask(taskRequest);
  await recordAuditEvent({
    actorId,
    eventType: "automation_batch_confirmed",
    eventJson: {
      source: "batch_review_api",
      automation_batch_id: batch.id,
      batch_id: batch.batch_key || batch.id,
      live_generation_requested: liveHeroRequested,
      live_blockers: liveBlockers
    }
  });
  return { ok: true, liveHeroRequested, liveBlockers };
}

async function cancelAutomationBatchFromReview({ batch = {}, actorId = "" } = {}) {
  if (!batch?.id) return null;
  const existingMetadata = isPlainObject(batch.metadata) ? batch.metadata : {};
  const recordedAt = new Date().toISOString();
  const { error: batchError } = await supabaseAdmin
    .from("automation_batches")
    .update({
      status: "cancelled",
      rejected_at: batch.rejected_at || recordedAt,
      metadata: {
        ...existingMetadata,
        review_action: {
          source: "batch_review_api",
          last_action: "cancel_batch",
          actor_id: actorId || null,
          recorded_at: recordedAt
        }
      }
    })
    .eq("id", batch.id);
  if (batchError) throw batchError;

  const { error: itemsError } = await supabaseAdmin
    .from("automation_batch_items")
    .update({ status: "skipped" })
    .eq("batch_id", batch.id)
    .in("status", ["draft", "received", "awaiting_approval", "selected", "missing_reference"]);
  if (itemsError) throw itemsError;

  await enqueueAutomationTask({
    taskType: "cancel_batch",
    batchId: batch.id,
    dedupeKey: `batch-review:cancel:${batch.id}`,
    status: "completed",
    payload: {
      source: "batch_review_api",
      action: "cancel_batch",
      batch_id: batch.batch_key || batch.id,
      actor_id: actorId || null,
      completed_reason: "Batch cancelled from Batch Review API before generation"
    }
  });
  await recordAuditEvent({
    actorId,
    eventType: "automation_batch_cancelled",
    eventJson: {
      source: "batch_review_api",
      automation_batch_id: batch.id,
      batch_id: batch.batch_key || batch.id
    }
  });
  return { ok: true };
}

async function skipAutomationBatchItemFromReview({ item = {}, actorId = "" } = {}) {
  if (!item?.id) return null;
  const existingMetadata = isPlainObject(item.metadata) ? item.metadata : {};
  const recordedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("automation_batch_items")
    .update({
      status: "skipped",
      metadata: {
        ...existingMetadata,
        review_action: {
          source: "batch_review_api",
          last_action: "skip_item",
          actor_id: actorId || null,
          recorded_at: recordedAt
        }
      }
    })
    .eq("id", item.id)
    .select("id, sku, status")
    .single();
  if (error) throw error;
  await enqueueAutomationTask({
    taskType: "skip_batch_item",
    batchId: item.batch_id || null,
    batchItemId: item.id,
    dedupeKey: `batch-review:skip:${item.id}`,
    status: "completed",
    payload: {
      source: "batch_review_api",
      action: "skip_item",
      sku: item.sku || "",
      actor_id: actorId || null,
      completed_reason: "SKU skipped from Batch Review before generation"
    }
  });
  return data;
}

function hasBatchReviewRetryTaskForItem(tasks = [], itemId = "") {
  const targetItemId = cleanOptionalString(itemId);
  if (!targetItemId) return false;
  return (tasks || []).some((task) => {
    if (cleanOptionalString(task.batch_item_id) !== targetItemId) return false;
    const payload = isPlainObject(task.payload) ? task.payload : {};
    if (payload.source !== "batch_review_api") return false;
    if (!["approve_hero", "regenerate_hero"].includes(cleanOptionalString(payload.action))) return false;
    return ["queued", "running", "completed", "done"].includes(String(task.status || "").trim().toLowerCase());
  });
}

async function retryAutomationBatchItemFromReview({ batch = {}, item = {}, itemState = "", actorId = "" } = {}) {
  if (!batch?.id || !item?.id) return null;
  const supportRetry = itemState === "support_failed";
  const action = supportRetry ? "approve_hero" : "regenerate_hero";
  const nextStatus = supportRetry ? "hero_approved" : "needs_hero_regeneration";
  const existingMetadata = isPlainObject(item.metadata) ? item.metadata : {};
  const recordedAt = new Date().toISOString();
  const { error: itemError } = await supabaseAdmin
    .from("automation_batch_items")
    .update({
      status: nextStatus,
      metadata: {
        ...existingMetadata,
        review_action: {
          source: "batch_review_api",
          last_action: "retry_item",
          retry_action: action,
          actor_id: actorId || null,
          recorded_at: recordedAt
        }
      }
    })
    .eq("id", item.id);
  if (itemError) throw itemError;

  const generationId = cleanOptionalString(
    existingMetadata.web_review_action?.generation_id ||
    existingMetadata.line_action?.generation_id ||
    existingMetadata.hero_review_hero_asset?.generation_id
  );
  const task = await enqueueAutomationTask({
    taskType: GENERATE_BATCH_TASK,
    batchId: batch.id,
    batchItemId: item.id,
    generationId: isValidUuid(generationId) ? generationId : null,
    dedupeKey: `batch-review:retry:${item.id}:${itemState}`,
    priority: supportRetry ? 125 : 130,
    payload: {
      source: "batch_review_api",
      action,
      batch_id: batch.batch_key || batch.id,
      sku: item.sku || "",
      actor_id: actorId || null,
      generation_id: generationId || null,
      generation_phase: supportRetry ? "support_after_failed_retry" : "hero_regeneration_after_failed_retry",
      request_mode: supportRetry ? "support-only-after-approved-hero" : "hero-regeneration-only",
      requires_approved_hero_anchor: supportRetry,
      auto_enqueue_live_support: supportRetry,
      auto_enqueue_live_hero: !supportRetry,
      live_generation_requested: false,
      live_generation_confirmed: false,
      dry_run: true,
      completed_reason: "Retry requested from Batch Review API; no live generation runs inside the request handler"
    }
  });
  await recordAuditEvent({
    actorId,
    eventType: "automation_batch_item_retry_requested",
    eventJson: {
      source: "batch_review_api",
      automation_batch_id: batch.id,
      batch_item_id: item.id,
      sku: item.sku || "",
      item_state: itemState,
      task_id: task?.id || null
    }
  });
  return task;
}

async function readGenerationForAutomationAction(generationId) {
  if (!generationId) return null;
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, job_id, kind, request_id, status, image_asset_id, created_by, completed_at, created_at")
    .eq("id", generationId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function readHeroAssetForGeneration(generation = {}) {
  if (!generation?.job_id && !generation?.image_asset_id) return null;
  if (generation.image_asset_id) {
    const { data, error } = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("id", generation.image_asset_id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (!generation.job_id) return null;
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("*")
    .eq("job_id", generation.job_id)
    .eq("type", "hero_generated")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function ensureHeroApprovalRecord({ generation = {}, actorId = "", exportPath = null, note = null } = {}) {
  const generationId = generation?.id || "";
  if (!generationId) return { approval: null, duplicate: false, error: new Error("generation_required") };

  const existingApprovalResult = await supabaseAdmin
    .from("approvals")
    .select("*")
    .eq("generation_id", generationId)
    .order("approved_at", { ascending: false })
    .limit(1);
  if (existingApprovalResult.error) return { approval: null, duplicate: false, error: existingApprovalResult.error };
  if (existingApprovalResult.data?.length) {
    return { approval: existingApprovalResult.data[0], duplicate: true, error: null };
  }

  const payload = {
    generation_id: generationId,
    approved_by: actorId || generation.created_by || null,
    approved_at: new Date().toISOString(),
    export_path: exportPath,
    note
  };

  const { data, error } = await supabaseAdmin
    .from("approvals")
    .insert(payload)
    .select("*")
    .single();
  return { approval: data || null, duplicate: false, error: error || null };
}

async function maybeEnqueueHeroReviewAutomationTask({
  action,
  batchId,
  sku,
  jobId,
  generationId,
  actorId,
  approval = null,
  heroAsset = null,
  source = "web_review_page"
} = {}) {
  if (!batchId || !sku) return null;
  const resolvedBatchId = await resolveAutomationBatchIdForReview(batchId);
  if (!resolvedBatchId) return null;
  const taskType = GENERATE_BATCH_TASK;
  const approve = action === "approve_hero";
  const regenerate = action === "regenerate_hero";
  const liveSupportRequested = approve &&
    isBooleanEnvEnabled("AI_GENERATION_LIVE_ENABLED") &&
    !isDryRun("AI_GENERATION_DRY_RUN", true);
  const liveSupportConfirmed = approve &&
    isBooleanEnvEnabled("AI_GENERATION_CONFIRM_SUPPORT_AFTER_HERO_APPROVAL");
  const liveHeroRequested = regenerate &&
    isBooleanEnvEnabled("AI_GENERATION_LIVE_ENABLED") &&
    !isDryRun("AI_GENERATION_DRY_RUN", true);
  const liveHeroConfirmed = liveHeroRequested;
  const task = await enqueueAutomationTask({
    taskType,
    batchId: resolvedBatchId,
    jobId,
    generationId,
    dedupeKey: `${source || "hero-review"}:${action}:${resolvedBatchId}:${sku}:${generationId}`,
    priority: approve ? 125 : 130,
    payload: {
      source,
      action,
      batch_id: resolvedBatchId,
      batch_key: batchId === resolvedBatchId ? null : batchId,
      sku,
      generation_id: generationId,
      actor_id: actorId || null,
      generation_phase: approve ? "support_after_hero_approval" : "hero_regeneration_after_review",
      request_mode: approve ? "support-only-after-approved-hero" : "hero-regeneration-only",
      requires_approved_hero_anchor: approve,
      auto_enqueue_live_support: approve,
      auto_enqueue_live_hero: regenerate,
      live_generation_requested: liveSupportRequested || liveHeroRequested,
      live_generation_confirmed: liveSupportConfirmed || liveHeroConfirmed,
      dry_run: true,
      completed_reason: approve
        ? "Hero approved from review action; support generation plan can now attach reference plus approved hero anchor"
        : "Hero regeneration requested from review action"
    }
  });

  if (approve || regenerate) {
    await updateAutomationBatchItemFromReviewAction({
      action,
      batchId: resolvedBatchId,
      sku,
      actorId,
      generationId,
      approval,
      heroAsset,
      jobId,
      source
    });
  }
  return task;
}

async function resolveAutomationBatchIdForReview(batchId) {
  const value = cleanOptionalString(batchId);
  if (!value) return "";
  if (isValidUuid(value)) return value;
  const { data, error } = await supabaseAdmin
    .from("automation_batches")
    .select("id")
    .eq("batch_key", value)
    .maybeSingle();
  if (error) throw error;
  return data?.id || "";
}

async function updateAutomationBatchItemFromReviewAction({
  action,
  batchId,
  sku,
  actorId,
  generationId,
  approval = null,
  heroAsset = null,
  jobId = null,
  source = "web_review_page"
}) {
  if (!batchId || !sku) return null;
  const existingResult = await supabaseAdmin
    .from("automation_batch_items")
    .select("id, metadata")
    .eq("batch_id", batchId)
    .eq("sku", sku)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  if (!existingResult.data?.id) return null;

  const existingMetadata = isPlainObject(existingResult.data.metadata) ? existingResult.data.metadata : {};
  const recordedAt = new Date().toISOString();
  const anchor = action === "approve_hero"
    ? buildApprovedHeroAnchor({
      generation: { id: generationId, job_id: jobId, image_asset_id: heroAsset?.id || heroAsset?.asset_id || null },
      asset: heroAsset || {},
      approval: approval || {},
      sku,
      source,
      actorId,
      approvedAt: recordedAt
    })
    : null;
  const metadata = mergeApprovedHeroAnchorMetadata(existingMetadata, anchor, {
    actionSource: source,
    actorId,
    generationId,
    action,
    recordedAt
  });

  const { data, error } = await supabaseAdmin
    .from("automation_batch_items")
    .update({ status: batchItemStatusForLineAction(action), metadata })
    .eq("id", existingResult.data.id)
    .select("id, sku, status")
    .single();
  if (error) throw error;
  return data;
}

async function getOwnedGeneration(generationId, userId) {
  if (!generationId || !userId) return null;
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, job_id, kind, request_id, status, image_asset_id, created_by, completed_at, created_at")
    .eq("id", generationId)
    .eq("created_by", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const profile = await getWorkflowProfileForUser(userId);
  if (!profile.ok || profile.profile?.role !== "admin") return null;
  const adminResult = await supabaseAdmin
    .from("generations")
    .select("id, job_id, kind, request_id, status, image_asset_id, created_by, completed_at, created_at")
    .eq("id", generationId)
    .maybeSingle();
  if (adminResult.error) throw adminResult.error;
  return adminResult.data || null;
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

function isLineWebhookConfigured() {
  return Boolean(lineChannelSecret && lineChannelAccessToken);
}

function verifyLineSignature(rawBody, signature) {
  return verifyHmacSha256Base64(rawBody, signature, lineChannelSecret);
}

function verifyLineImageProxySignature({ fileId, exp, sig } = {}) {
  if (!lineImageProxySecret || !fileId || !exp || !sig) return false;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", lineImageProxySecret)
    .update(`${fileId}.${exp}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(String(sig));
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function isValidDriveFileId(value = "") {
  return /^[A-Za-z0-9_-]{10,200}$/.test(String(value || ""));
}

async function handleLineWebhookPayload(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  await Promise.all(events.map((event) => handleLineWebhookEvent(event, payload)));
}

function dedupeLineWebhookPayload(payload = {}) {
  pruneSeenLineWebhookEventIds();
  const events = Array.isArray(payload.events) ? payload.events : [];
  const freshEvents = [];
  for (const event of events) {
    const eventId = cleanOptionalString(event?.webhookEventId);
    if (!eventId) {
      freshEvents.push(event);
      continue;
    }
    if (seenLineWebhookEventIds.has(eventId)) continue;
    seenLineWebhookEventIds.set(eventId, Date.now());
    freshEvents.push(event);
  }
  return { ...payload, events: freshEvents };
}

function pruneSeenLineWebhookEventIds() {
  const ttlMs = 60 * 60 * 1000;
  const now = Date.now();
  for (const [eventId, seenAt] of seenLineWebhookEventIds.entries()) {
    if (now - seenAt > ttlMs) seenLineWebhookEventIds.delete(eventId);
  }
}

async function handleLineWebhookEvent(event, payload) {
  const source = event?.source || {};
  const lineUserId = cleanOptionalString(source.userId);
  const baseEventJson = {
    source: "line",
    destination: cleanOptionalString(payload?.destination),
    line_user_id: lineUserId,
    line_source_type: cleanOptionalString(source.type),
    webhook_event_id: cleanOptionalString(event?.webhookEventId),
    mode: cleanOptionalString(event?.mode),
    is_redelivery: event?.deliveryContext?.isRedelivery === true,
    event_timestamp: event?.timestamp || null
  };

  if (event?.type === "postback") {
    const action = parseLinePostbackAction(event.postback?.data);
    const eventType = lineAuditEventTypeForAction(action.action);
    const eventJson = {
      ...baseEventJson,
      action: action.action,
      batch_id: action.batchId,
      job_id: action.jobId,
      generation_id: action.generationId,
      sku: action.sku,
      raw_postback_data: cleanOptionalString(event.postback?.data)
    };

    await recordAuditEvent({
      actorId: null,
      jobId: isValidUuid(action.jobId) ? action.jobId : null,
      generationId: isValidUuid(action.generationId) ? action.generationId : null,
      eventType,
      eventJson
    });

    if (!isAuthorizedLinePostbackUser(lineUserId)) {
      await recordAuditEvent({
        actorId: null,
        eventType: "line_postback_unauthorized",
        eventJson: {
          ...eventJson,
          expected_line_user_id_configured: Boolean(lineTargetUserId)
        }
      });
      return;
    }

    const actionResult = await recordLineAutomationAction({ action, baseEventJson, eventType });
    await replyLinePostbackAcknowledgement(event.replyToken, action, actionResult);
    return;
  }

  if (event?.type === "message") {
    const messageType = cleanOptionalString(event.message?.type);
    const messageText = cleanOptionalString(event.message?.text);
    await recordAuditEvent({
      actorId: null,
      eventType: "line_message_received",
      eventJson: {
        ...baseEventJson,
        message_type: messageType,
        message_text: messageText
      }
    });
    if (messageType === "text") {
      await handleLineKeywordBatchMessage({ baseEventJson, messageText });
    }
  }
}

async function handleLineKeywordBatchMessage({ baseEventJson, messageText }) {
  const command = parseLineKeywordBatchCommand(messageText);
  if (!command.recognized) return { handled: false };

  await recordAuditEvent({
    actorId: null,
    eventType: "line_keyword_batch_command_received",
    eventJson: {
      ...baseEventJson,
      command
    }
  });

  if (!isAuthorizedLinePostbackUser(baseEventJson.line_user_id)) {
    await recordAuditEvent({
      actorId: null,
      eventType: "line_keyword_batch_unauthorized",
      eventJson: {
        ...baseEventJson,
        expected_line_user_id_configured: Boolean(lineTargetUserId)
      }
    });
    return { handled: true, ok: false, reason: "unauthorized_line_user" };
  }

  let result;
  let registryResult = null;
  try {
    const snapshot = await loadLineKeywordBatchCatalogSnapshot({ outputsDir });
    result = buildLineKeywordBatchIntakeResult({
      text: messageText,
      generationRows: snapshot.generationRows,
      auditRows: snapshot.auditRows,
      lineUserId: baseEventJson.line_user_id,
      now: new Date(),
      snapshotSource: snapshot.source
    });

    if (result.ok) {
      registryResult = await registerAutomationBatch(result.batch, {
        source: "line_keyword_batch_intake",
        lineUserId: baseEventJson.line_user_id
      });
      if (!registryResult?.ok) {
        result = {
          ...result,
          ok: false,
          blockers: [
            ...(result.blockers || []),
            {
              code: "automation_registry_unavailable",
              message: registryResult?.reason || "Supabase automation registry is unavailable."
            }
          ],
          replyText: [
            "ยังสร้าง batch จาก LINE keyword ไม่ได้",
            `- ${registryResult?.reason || "Supabase automation registry is unavailable."}`,
            "ตัวอย่าง: BATCH รองเท้า=5 เสื้อ=5"
          ].join("\n")
        };
      }
    }

    await pushLineKeywordBatchIntakeMessages({ result, targetLineUserId: baseEventJson.line_user_id || lineTargetUserId });
    await recordAuditEvent({
      actorId: null,
      eventType: result.ok ? "line_keyword_batch_intake_completed" : "line_keyword_batch_intake_blocked",
      eventJson: {
        ...baseEventJson,
        batch_id: result.batch?.batch_id || "",
        item_count: result.batch?.items?.length || 0,
        registry: registryResult || null,
        blockers: result.blockers || [],
        outputs_dir: outputsDir,
        snapshot_source: result.batch?.selection?.snapshot_source || snapshot.source,
        fallback_generation_path: snapshot.fallbackGenerationPath || ""
      }
    });
    return { handled: true, ok: result.ok, batchId: result.batch?.batch_id || "" };
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "line_keyword_batch_intake_failed",
      eventJson: {
        ...baseEventJson,
        error: readableError(error),
        outputs_dir: outputsDir
      }
    });
    await pushLineKeywordBatchIntakeMessages({
      result: {
        recognized: true,
        ok: false,
        command,
        batch: null,
        blockers: [{ code: "intake_failed", message: readableError(error) }],
        replyText: [
          "ยังสร้าง batch จาก LINE keyword ไม่ได้",
          `- ${readableError(error)}`,
          "ตัวอย่าง: BATCH รองเท้า=5 เสื้อ=5"
        ].join("\n")
      },
      targetLineUserId: baseEventJson.line_user_id || lineTargetUserId
    });
    return { handled: true, ok: false, error: readableError(error) };
  }
}

async function pushLineKeywordBatchIntakeMessages({ result, targetLineUserId }) {
  const to = cleanOptionalString(targetLineUserId);
  if (!to || !lineChannelAccessToken) return;
  const messages = result?.ok
    ? [buildLineKeywordBatchReviewFlex({ result, reviewBaseUrl: getPublicBaseUrl() })]
    : buildLineKeywordBatchTextMessages({ result });
  if (!messages.length) return;
  await pushLineMessage({ to, messages });
}

function parseLinePostbackAction(data) {
  const params = new URLSearchParams(String(data || ""));
  return {
    action: normalizeLineAction(params.get("action")),
    batchId: cleanOptionalString(params.get("batch_id") || params.get("batchId")),
    jobId: cleanOptionalString(params.get("job_id") || params.get("jobId")),
    generationId: cleanOptionalString(params.get("generation_id") || params.get("generationId")),
    sku: sanitizeSku(params.get("sku") || "")
  };
}

function normalizeLineAction(action) {
  const normalized = cleanOptionalString(action).toLowerCase().replace(/[^a-z0-9_:-]/g, "_");
  return normalized || "unknown";
}

function lineAuditEventTypeForAction(action) {
  const allowed = new Set([
    "approve_batch",
    "cancel_batch",
    "needs_review",
    "reject_batch",
    "approve_sku",
    "reject_sku",
    "approve_hero",
    "regenerate_hero"
  ]);
  return allowed.has(action) ? `line_${action}` : "line_postback_received";
}

function isAuthorizedLinePostbackUser(lineUserId) {
  return !lineTargetUserId || lineUserId === lineTargetUserId;
}

async function recordLineAutomationAction({ action, baseEventJson, eventType }) {
  if (!action.batchId && !action.sku) return;
  let actionResult = { recorded: false, ignored: false };

  try {
    if (action.action === "approve_hero" || action.action === "regenerate_hero") {
      const resolvedBatchId = await resolveAutomationBatchIdForReview(action.batchId);
      const generation = action.generationId
        ? await readGenerationForAutomationAction(action.generationId)
        : null;
      const actorId = resolveLineAutomationActorId() || generation?.created_by || "";
      let approvalResult = { approval: null, duplicate: false, error: null };
      let heroAsset = null;
      const blockers = [];

      if (!resolvedBatchId) blockers.push("automation_batch_not_found");
      if (!action.sku) blockers.push("missing_sku");
      if (!generation) blockers.push("generation_not_found");

      if (generation) {
        heroAsset = await readHeroAssetForGeneration(generation);
        if (action.action === "approve_hero") {
          approvalResult = await ensureHeroApprovalRecord({ generation, actorId });
          if (approvalResult.error) blockers.push("approval_record_failed");
        }
      }

      let task = null;
      if (!blockers.length) {
        task = await maybeEnqueueHeroReviewAutomationTask({
          action: action.action,
          batchId: resolvedBatchId,
          sku: action.sku,
          jobId: generation.job_id,
          generationId: generation.id,
          actorId,
          approval: approvalResult.approval,
          heroAsset,
          source: "line"
        });
      }

      actionResult = blockers.length
        ? {
          recorded: false,
          ignored: false,
          blockers: Array.from(new Set(blockers)),
          error: approvalResult.error ? readableError(approvalResult.error) : ""
        }
        : {
          recorded: true,
          ignored: false,
          status: batchItemStatusForLineAction(action.action),
          duplicate: Boolean(approvalResult.duplicate),
          approvalId: approvalResult.approval?.id || null,
          taskId: task?.id || null,
          nextStage: action.action === "approve_hero" ? "support_generation" : "hero_regeneration"
        };
      await recordAuditEvent({
        actorId: null,
        jobId: generation?.job_id || null,
        generationId: generation?.id || null,
        eventType: "line_automation_action_recorded",
        eventJson: {
          ...baseEventJson,
          action: action.action,
          batch_id: action.batchId,
          sku: action.sku,
          audit_event_type: eventType,
          automation_batch_id: resolvedBatchId || null,
          action_result: actionResult
        }
      });
      return actionResult;
    }

    if (action.action === "cancel_batch") {
      const context = await readAutomationBatchReviewContext(action.batchId);
      const review = buildBatchReviewPayload({
        ...context,
        profile: { role: "staff" },
        hrefBase: getPublicBaseUrl()
      });
      const hasActiveGeneration = context.tasks.some((task) => ["queued", "running"].includes(String(task.status || "").toLowerCase()));
      const alreadyCancelled = ["cancelled"].includes(review.state) || ["cancelled", "rejected"].includes(String(context.batch?.status || "").trim().toLowerCase());
      if (!context.batch?.id) {
        actionResult = { recorded: false, ignored: false, blockers: ["automation_batch_not_found"] };
      } else if (alreadyCancelled) {
        actionResult = { recorded: true, ignored: true, reason: "batch_already_cancelled" };
      } else if (!isBatchCancelable({
        batchState: review.state,
        batchStatus: context.batch.status,
        hasActiveGeneration
      })) {
        actionResult = { recorded: false, ignored: false, blockers: ["batch_cancel_not_allowed"] };
      } else {
        await cancelAutomationBatchFromReview({ batch: context.batch, actorId: null });
        await enqueueAutomationTask({
          taskType: "cancel_batch",
          batchId: context.batch.id,
          dedupeKey: `line:cancel_batch:${action.batchId}`,
          status: "completed",
          payload: {
            source: "line",
            action: action.action,
            batch_id: action.batchId,
            line_user_id: baseEventJson.line_user_id,
            completed_reason: "Recorded cancellation from LINE"
          }
        });
        actionResult = { recorded: true, ignored: false };
      }
      await recordAuditEvent({
        actorId: null,
        eventType: "line_automation_action_recorded",
        eventJson: {
          ...baseEventJson,
          action: action.action,
          batch_id: action.batchId,
          sku: action.sku,
          audit_event_type: eventType,
          automation_batch_id: context.batch?.id || null,
          action_result: actionResult
        }
      });
      return actionResult;
    }

    const batch = await upsertAutomationBatchFromLineAction({ action, baseEventJson });
    if (action.action === "approve_batch") {
      const lineAutomationActorId = resolveLineAutomationActorId();
      const liveBlockers = [];
      if (!lineAutomationActorId) liveBlockers.push("missing_automation_actor_id");
      if (!isBooleanEnvEnabled("AI_GENERATION_LIVE_ENABLED")) liveBlockers.push("AI_GENERATION_LIVE_ENABLED_not_true");
      if (isDryRun("AI_GENERATION_DRY_RUN", true)) liveBlockers.push("AI_GENERATION_DRY_RUN_true");
      if (!cleanOptionalString(process.env.FAL_KEY)) liveBlockers.push("missing_FAL_KEY");
      const liveHeroRequested = Boolean(lineAutomationActorId) &&
        isBooleanEnvEnabled("AI_GENERATION_LIVE_ENABLED") &&
        !isDryRun("AI_GENERATION_DRY_RUN", true) &&
        Boolean(cleanOptionalString(process.env.FAL_KEY));
      const taskRequests = buildLineBatchApprovalTaskRequests({
        action,
        automationBatchId: batch?.id || null,
        lineUserId: baseEventJson.line_user_id,
        actorId: lineAutomationActorId,
        liveGenerationRequested: liveHeroRequested,
        liveGenerationConfirmed: liveHeroRequested,
        dryRun: isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true)
      });
      for (const taskRequest of taskRequests) await enqueueAutomationTask(taskRequest);
      actionResult = {
        recorded: true,
        ignored: false,
        nextStage: "hero_generation",
        liveGenerationRequested: liveHeroRequested,
        liveGenerationConfirmed: liveHeroRequested,
        liveBlockers: Array.from(new Set(liveBlockers)),
        wordpressDryRun: isDryRun("WORDPRESS_DRY_RUN", true)
      };
    }

    if (action.action === "needs_review") {
      await enqueueAutomationTask({
        taskType: "review_batch",
        batchId: batch?.id || null,
        dedupeKey: `line:needs_review:${action.batchId}`,
        status: "completed",
        payload: {
          source: "line",
          action: action.action,
          batch_id: action.batchId,
          line_user_id: baseEventJson.line_user_id,
          completed_reason: "Recorded review request from LINE"
        }
      });
      actionResult = { recorded: true, ignored: false };
    }

    if (action.action === "reject_batch" || action.action === "cancel_batch") {
      await enqueueAutomationTask({
        taskType: action.action === "cancel_batch" ? "cancel_batch" : "reject_batch",
        batchId: batch?.id || null,
        dedupeKey: `line:${action.action}:${action.batchId}`,
        status: "completed",
        payload: {
          source: "line",
          action: action.action,
          batch_id: action.batchId,
          line_user_id: baseEventJson.line_user_id,
          completed_reason: action.action === "cancel_batch"
            ? "Recorded cancellation from LINE"
            : "Recorded rejection from LINE"
        }
      });
      actionResult = { recorded: true, ignored: false };
    }

    if (action.action === "approve_sku" || action.action === "reject_sku") {
      const batchItem = await updateAutomationBatchItemFromLineAction({
        action,
        batchId: batch?.id || null,
        baseEventJson
      });

      if (batchItem) {
        await enqueueAutomationTask({
          taskType: action.action === "approve_sku" ? "approve_sku" : "reject_sku",
          batchId: batch?.id || null,
          batchItemId: batchItem.id,
          dedupeKey: `line:${action.action}:${action.batchId}:${action.sku}`,
          status: "completed",
          payload: {
            source: "line",
            action: action.action,
            batch_id: action.batchId,
            sku: action.sku,
            line_user_id: baseEventJson.line_user_id,
            completed_reason:
              action.action === "approve_sku"
                ? "Recorded SKU approval from LINE"
                : "Recorded SKU rejection from LINE"
          }
        });
        actionResult = { recorded: true, ignored: false, status: batchItem.status };
      }
    }

    await recordAuditEvent({
      actorId: null,
      eventType: "line_automation_action_recorded",
      eventJson: {
        ...baseEventJson,
        action: action.action,
        batch_id: action.batchId,
        sku: action.sku,
        audit_event_type: eventType,
        automation_batch_id: batch?.id || null,
        action_result: actionResult
      }
    });
    return actionResult;
  } catch (error) {
    console.warn("[line] automation action record failed:", readableError(error));
    await recordAuditEvent({
      actorId: null,
      eventType: "line_automation_action_failed",
      eventJson: {
        ...baseEventJson,
        action: action.action,
        batch_id: action.batchId,
        sku: action.sku,
        error: readableError(error)
      }
    });
    return { recorded: false, ignored: false, error: readableError(error) };
  }
}

async function upsertAutomationBatchFromLineAction({ action, baseEventJson }) {
  const batchKey = action.batchId || `line-sku-${action.sku}`;
  const existingResult = await supabaseAdmin
    .from("automation_batches")
    .select("id, metadata, status")
    .eq("batch_key", batchKey)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;

  const existingMetadata = isPlainObject(existingResult.data?.metadata)
    ? existingResult.data.metadata
    : {};
  const isSkuAction = ["approve_sku", "reject_sku", "approve_hero", "regenerate_hero"].includes(action.action);
  const patch = {
    source: "line",
    status: isSkuAction
      ? existingResult.data?.status || automationBatchStatusForAction(action.action)
      : automationBatchStatusForAction(action.action),
    requested_by_line_user_id: baseEventJson.line_user_id || null,
    metadata: {
      ...existingMetadata,
      line_action: {
        source: "line",
        last_action: action.action,
        last_sku: action.sku || null,
        last_webhook_event_id: baseEventJson.webhook_event_id || null,
        dry_run: isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true),
        recorded_at: new Date().toISOString()
      }
    }
  };

  if (action.action === "approve_batch") patch.approved_at = new Date().toISOString();
  if (action.action === "reject_batch" || action.action === "cancel_batch") patch.rejected_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("automation_batches")
    .upsert(
      {
        batch_key: batchKey,
        dry_run: isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true),
        ...patch
      },
      { onConflict: "batch_key" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function updateAutomationBatchItemFromLineAction({ action, batchId, baseEventJson }) {
  if (!batchId || !action.sku) return null;

  const status = batchItemStatusForLineAction(action.action);
  const existingResult = await supabaseAdmin
    .from("automation_batch_items")
    .select("id, status, metadata")
    .eq("batch_id", batchId)
    .eq("sku", action.sku)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  if (!existingResult.data?.id) return null;

  const existingMetadata = isPlainObject(existingResult.data.metadata) ? existingResult.data.metadata : {};
  const currentDecision = heroReviewDecisionActionForBatchItem({
    status: existingResult.data.status,
    metadata: existingMetadata
  });
  if (currentDecision) {
    return {
      id: existingResult.data.id,
      sku: action.sku,
      status: existingResult.data.status,
      ignored: true,
      ignored_reason: currentDecision === action.action ? "duplicate_hero_review_action" : "hero_review_already_decided",
      current_action: currentDecision
    };
  }

  const expectedGenerationId = cleanOptionalString(existingMetadata.hero_review_hero_asset?.generation_id);
  if (expectedGenerationId && action.generationId && expectedGenerationId !== action.generationId) {
    return {
      id: existingResult.data.id,
      sku: action.sku,
      status: existingResult.data.status,
      ignored: true,
      ignored_reason: "stale_hero_review_action",
      current_action: ""
    };
  }

  const metadata = {
    ...existingMetadata,
    line_action: {
      source: "line",
      last_action: action.action,
      generation_id: action.generationId || null,
      last_webhook_event_id: baseEventJson.webhook_event_id || null,
      line_user_id: baseEventJson.line_user_id || null,
      recorded_at: new Date().toISOString()
    }
  };

  const { data, error } = await supabaseAdmin
    .from("automation_batch_items")
    .update({ status, metadata })
    .eq("id", existingResult.data.id)
    .select("id, sku, status")
    .single();
  if (error) throw error;
  return data;
}

function heroReviewDecisionActionForBatchItem({ status, metadata = {} } = {}) {
  const statusAction = heroReviewDecisionActionForStatus(status);
  if (statusAction) return statusAction;
  const lineAction = cleanOptionalString(metadata?.line_action?.last_action);
  if (lineAction === "approve_hero" || lineAction === "regenerate_hero") return lineAction;
  const webAction = cleanOptionalString(metadata?.web_review_action?.last_action);
  if (webAction === "approve_hero" || webAction === "regenerate_hero") return webAction;
  return "";
}

function heroReviewDecisionActionForStatus(status) {
  const normalized = cleanOptionalString(status);
  if (normalized === "hero_approved") return "approve_hero";
  if (normalized === "needs_hero_regeneration") return "regenerate_hero";
  return "";
}

function automationBatchStatusForAction(action) {
  if (action === "approve_batch") return "approved";
  if (action === "cancel_batch") return "cancelled";
  if (action === "needs_review") return "needs_review";
  if (action === "reject_batch") return "rejected";
  if (action === "approve_hero") return "hero_reviewed";
  if (action === "regenerate_hero") return "needs_hero_regeneration";
  return "received";
}

function batchItemStatusForLineAction(action) {
  if (action === "approve_sku") return "approved";
  if (action === "reject_sku") return "rejected";
  if (action === "approve_hero") return "hero_approved";
  if (action === "regenerate_hero") return "needs_hero_regeneration";
  return "received";
}

async function enqueueAutomationTask({
  taskType,
  batchId = null,
  batchItemId = null,
  jobId = null,
  generationId = null,
  dedupeKey,
  payload = {},
  status = "queued",
  priority = 100
}) {
  const taskPayload = {
    task_type: taskType,
    status,
    priority,
    batch_id: batchId,
    batch_item_id: batchItemId,
    job_id: jobId,
    generation_id: generationId,
    dedupe_key: dedupeKey,
    payload,
    completed_at: status === "completed" ? new Date().toISOString() : null
  };

  const { data, error } = await supabaseAdmin
    .from("automation_tasks")
    .upsert(taskPayload, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("*");

  if (error) throw error;
  return data?.[0] || null;
}

async function replyLinePostbackAcknowledgement(replyToken, action, actionResult = {}) {
  if (!replyToken || !lineChannelAccessToken) return;
  const labelByAction = {
    approve_batch: "Approve batch",
    cancel_batch: "Cancel batch",
    needs_review: "Needs review",
    reject_batch: "Reject batch",
    approve_hero: "Approve hero",
    regenerate_hero: "Regenerate hero",
    approve_sku: "Approve SKU",
    reject_sku: "Reject SKU"
  };
  const actionLabel = labelByAction[action.action] || action.action || "-";
  const currentActionLabel = labelByAction[actionResult.currentAction] || actionResult.currentAction || "";
  const batchLine = action.batchId ? `Batch: ${action.batchId}` : "";
  const skuLine = action.sku ? `SKU: ${action.sku}` : "";
  const text = actionResult.ignored
    ? [
      `ไม่เปลี่ยนสถานะ: ${actionLabel}`,
      batchLine,
      skuLine,
      currentActionLabel ? `มีผลตัดสินใจแล้ว: ${currentActionLabel}` : "",
      actionResult.reason === "batch_already_cancelled" ? "Batch นี้ถูกยกเลิกแล้ว" : "",
      actionResult.reason === "line_hero_decisions_disabled" ? "ปุ่มตัดสินใจใน LINE ถูกปิดแล้วเพื่อกัน action เก่า/ผิดลำดับ" : "",
      actionResult.reason === "stale_hero_review_action" ? "ปุ่มนี้มาจาก hero version เก่า" : "",
      "ให้ใช้หน้า Review เป็นจุดตัดสินใจหลัก"
    ]
    : buildLinePostbackAcknowledgementLines({ action, actionLabel, batchLine, skuLine, actionResult });
  const finalText = text
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lineChannelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: finalText }]
    })
  });

  if (!response.ok) {
    console.warn(`[line] reply failed ${response.status}: ${await response.text()}`);
  }
}

function buildLinePostbackAcknowledgementLines({ action, actionLabel, batchLine, skuLine, actionResult = {} }) {
  const lines = [
    `รับ action แล้ว: ${actionLabel}`,
    batchLine,
    skuLine
  ];

  if (action.action === "approve_batch") {
    if (actionResult.liveGenerationRequested) {
      lines.push("เริ่มสร้าง Hero จริงแล้ว");
      lines.push("ถ้าสร้างสำเร็จ ระบบจะส่ง Hero Review กลับมาให้ตรวจ");
    } else {
      const blockers = Array.isArray(actionResult.liveBlockers) ? actionResult.liveBlockers.filter(Boolean) : [];
      lines.push(blockers.length
        ? `ยังไม่ยิงภาพจริง: ${blockers.join(", ")}`
        : "ยังไม่ยิงภาพจริง: live generation ยังไม่พร้อม");
    }
    lines.push(actionResult.wordpressDryRun === false
      ? "WordPress live write เปิดอยู่"
      : "WordPress ยัง dry-run: ยังไม่ publish");
    return lines;
  }

  if (Array.isArray(actionResult.blockers) && actionResult.blockers.length) {
    lines.push(`ยังไปต่อไม่ได้: ${actionResult.blockers.join(", ")}`);
    return lines;
  }

  if (action.action === "approve_hero") {
    lines.push(actionResult.duplicate ? "Hero นี้ approve แล้ว ระบบใช้ approval เดิม" : "บันทึก Hero approval แล้ว");
    lines.push("ขั้นถัดไปคือ Support generation ตาม gate rules");
    return lines;
  }

  if (action.action === "regenerate_hero") {
    lines.push("บันทึกคำขอ Regenerate Hero แล้ว");
    lines.push("ขั้นถัดไปคือ Hero generation ใหม่ตาม gate rules");
    return lines;
  }

  if (action.action === "cancel_batch") {
    lines.push("ยกเลิก Batch แล้ว");
    lines.push("กดซ้ำได้ ระบบจะไม่สร้างงานซ้ำ");
    return lines;
  }

  lines.push("บันทึก action แล้ว");
  return lines;
}

function startEmbeddedAutomationWorker() {
  if (!automationEmbeddedWorkerEnabled) return;
  const workerRuntime = resolveWorkerRuntimeConfig(process.env);
  for (const warning of buildWorkerModeStartupWarnings(workerRuntime)) {
    console.warn(`[automation-worker] ${warning.code}: ${warning.message}`);
  }
  if (!isSupabaseAutomationConfigured()) {
    automationEmbeddedWorkerLastError = "Supabase automation env is incomplete.";
    console.warn("[automation-worker] embedded worker disabled: Supabase automation env is incomplete.");
    return;
  }

  automationEmbeddedWorkerRunning = true;
  console.log(`[automation-worker] embedded worker started ${automationWorkerId}`);

  const loop = async () => {
    if (!automationEmbeddedWorkerRunning) return;
    try {
      automationEmbeddedWorkerLastRunAt = new Date().toISOString();
      const task = await claimNextAutomationTask();
      if (task) {
        await processAutomationTask(task);
        automationEmbeddedWorkerProcessedTasks += 1;
      }
      automationEmbeddedWorkerLastError = null;
    } catch (error) {
      automationEmbeddedWorkerLastError = readableError(error);
      console.warn("[automation-worker] embedded loop failed:", automationEmbeddedWorkerLastError);
    } finally {
      if (automationEmbeddedWorkerRunning) {
        setTimeout(loop, automationWorkerPollIntervalMs).unref?.();
      }
    }
  };

  setTimeout(loop, 1000).unref?.();
}

function isSupabaseAutomationConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

async function claimNextAutomationTask() {
  const { data: candidates, error } = await supabaseAdmin
    .from("automation_tasks")
    .select("*")
    .eq("status", "queued")
    .lte("available_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) throw error;

  for (const candidate of candidates || []) {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("automation_tasks")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: automationWorkerId,
        attempts: Number(candidate.attempts || 0) + 1,
        last_error: null
      })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (claimError) throw claimError;
    if (claimed) return claimed;
  }

  return null;
}

async function processAutomationTask(task) {
  console.log(`[automation-worker] processing ${task.id} ${task.task_type}`);
  try {
    const batchItems = task.batch_id ? await readAutomationBatchItems(task.batch_id) : [];
    await processAutomationTaskCore({
      task,
      batchItems,
      workerId: automationWorkerId,
      embeddedWorker: true,
      recordAuditEvent: ({ eventType, eventJson }) => recordAuditEvent({ actorId: null, eventType, eventJson }),
      completeTask: completeAutomationTask,
      onPreflightCompleted: handleWordPressProductPreflightCompleted,
      onMediaPreflightCompleted: handleWordPressMediaPreflightCompleted,
      onMediaAttachConfirmationCompleted: handleWordPressMediaAttachConfirmationCompleted,
      onMediaAttachExecutionPlanCompleted: handleWordPressMediaAttachExecutionPlanCompleted,
      onMediaRemoteRefetchPreflightCompleted: handleWordPressMediaRemoteRefetchPreflightCompleted,
      readMediaManifest: readLiveGenerationMediaManifest,
      readReferenceResolutionManifest: readLiveGenerationReferenceResolutionManifest,
      readModelInputStagingManifest: readLiveGenerationModelInputStagingManifest,
      enqueueTask: enqueueAutomationTask,
      providerGenerate: async (request) => {
        const provider = await getFalImageProvider();
        return provider(request);
      },
      persistLiveExecution: ({ execution, generationPlan, batch, actorId, dryRun }) => persistLiveGenerationExecution({
        supabaseAdmin,
        execution,
        generationPlan,
        batch,
        actorId: actorId || resolveLineAutomationActorId(),
        dryRun
      }),
      updateBatchItemsAfterSupportGeneration,
      onHeroGenerationCompleted: handleHeroGenerationCompleted,
      onSupportGenerationCompleted: handleSupportGenerationCompleted
    });
  } catch (error) {
    await failOrRetryAutomationTask(task, error);
  }
}

async function readLiveGenerationMediaManifest({ task, batchItems }) {
  const mediaManifest = await buildSupabaseMediaAssetManifestForBatch({
    supabaseAdmin,
    batch: {
      batch_id: task.batch_id || null,
      items: batchItems
    },
    batchItems
  });
  return stageMediaManifestAssetsForLiveGeneration({
    mediaManifest,
    stagingDir: liveInputStagingDir
  });
}

async function readLiveGenerationReferenceResolutionManifest({ task, batchItems }) {
  const folderIds = Array.from(new Set((batchItems || [])
    .map((item) => cleanOptionalString(item.reference_drive_id || item.metadata?.reference_drive_id || extractDriveIdFromUrl(item.reference_url || item.metadata?.reference_url || "")))
    .filter(Boolean)));
  if (!folderIds.length) return null;

  const filesByFolderId = {};
  const drive = await getGoogleDriveClient();
  if (!drive) {
    return buildReferenceAssetResolution({
      batch: { batch_id: task.batch_id || null },
      batchItems,
      filesByFolderId
    });
  }

  for (const folderId of folderIds) {
    filesByFolderId[folderId] = await listGoogleDriveReferenceFiles(drive, folderId);
  }

  return buildReferenceAssetResolution({
    batch: { batch_id: task.batch_id || null },
    batchItems,
    filesByFolderId
  });
}

async function readLiveGenerationModelInputStagingManifest({ batchItems, referenceResolutionManifest }) {
  if (Array.isArray(referenceResolutionManifest?.items) && referenceResolutionManifest.items.length) {
    return stageGoogleDriveReferenceResolutionForLiveGeneration(referenceResolutionManifest);
  }
  return buildReferenceStagingManifestFromBatchItems({
    batchItems,
    stagingDir: liveInputStagingDir
  });
}

async function listGoogleDriveReferenceFiles(drive, folderId) {
  return listGoogleDriveReferenceImageFiles(drive, folderId, {
    maxDepth: 1,
    pageSize: 100,
    maxFiles: 120,
    requestTimeoutMs: googleDriveReferenceFilesTimeoutMs
  });
}

async function listGoogleDriveReferenceFilesCached(drive, folderId) {
  const cacheKey = cleanOptionalString(folderId);
  if (!cacheKey) return [];
  const cached = googleDriveReferenceFilesCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.files;
  }

  const files = await listGoogleDriveReferenceFiles(drive, cacheKey);
  googleDriveReferenceFilesCache.set(cacheKey, {
    files,
    expiresAt: now + googleDriveReferenceFilesCacheTtlMs
  });
  return files;
}

async function stageWebSkuReferenceAssetsForGeneration({ drive, item = {}, assets = [] } = {}) {
  const stagedAssets = [];
  for (const asset of (assets || []).slice(0, 8)) {
    const driveFileId = cleanOptionalString(asset.drive_file_id || asset.id);
    if (!drive || !driveFileId || !isValidDriveFileId(driveFileId)) {
      stagedAssets.push({
        ...asset,
        staging_status: "staging_failed",
        staging_error_code: "invalid_drive_file_id",
        staging_error_message_th: "Drive file id ของ reference ไม่ถูกต้อง"
      });
      continue;
    }

    try {
      const staged = await uploadGoogleDriveReferenceFileToSupabaseStorage({
        drive,
        driveFileId,
        sku: item.sku || asset.sku || "",
        fileName: asset.name || asset.file_name || driveFileId,
        mimeType: asset.mimeType || asset.mime_type || ""
      });
      stagedAssets.push({
        ...asset,
        staged_public_url: staged.publicUrl,
        generation_url: staged.publicUrl,
        storage_bucket: staged.bucket,
        storage_key: staged.storageKey,
        staging_status: "staged_to_supabase",
        staged_file_size: staged.fileSize,
        staged_mime_type: staged.contentType
      });
    } catch (error) {
      stagedAssets.push({
        ...asset,
        staging_status: "staging_failed",
        staging_error_code: error.code || classifyStorageError(error) || "reference_staging_failed",
        staging_error_message_th: error.publicMessage || "stage รูปจาก Drive เข้า Supabase Storage ไม่สำเร็จ"
      });
    }
  }
  return stagedAssets;
}

async function uploadGoogleDriveReferenceFileToSupabaseStorage({
  drive,
  driveFileId,
  sku = "",
  fileName = "",
  mimeType = ""
} = {}) {
  const metadataResult = await drive.files.get({
    fileId: driveFileId,
    fields: "id,name,mimeType,size",
    supportsAllDrives: true
  }, { timeout: googleDriveReferenceStageTimeoutMs });
  const metadata = metadataResult.data || {};
  const resolvedFileName = cleanOptionalString(metadata.name || fileName || driveFileId) || driveFileId;
  const resolvedMimeType = cleanOptionalString(metadata.mimeType || mimeType || mimeTypeFromFileName(resolvedFileName)) || "image/jpeg";
  if (!isSupportedReferenceImageMimeType(resolvedMimeType)) {
    throw publicError(415, "unsupported_reference_image_type", "ชนิดไฟล์ reference ยังไม่รองรับสำหรับ Generate Hero");
  }
  const fileSize = Number(metadata.size || 0);
  if (Number.isFinite(fileSize) && fileSize > googleDriveReferenceStageMaxBytes) {
    throw publicError(413, "reference_image_too_large", "ไฟล์ reference จาก Google Drive ใหญ่เกินกว่าที่ระบบกำหนด");
  }

  const storageKey = buildGoogleDriveReferenceStorageKey({
    sku,
    driveFileId,
    fileName: resolvedFileName,
    mimeType: resolvedMimeType
  });
  const cacheKey = `${driveFileId}:${storageKey}`;
  const now = Date.now();
  const cached = googleDriveReferenceStagingCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const mediaResult = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream", timeout: googleDriveReferenceStageTimeoutMs }
  );
  const meter = createByteLimitTransform(googleDriveReferenceStageMaxBytes);
  const uploadStream = mediaResult.data.pipe(meter.stream);
  const bucket = "product-references";
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storageKey, uploadStream, {
      contentType: resolvedMimeType,
      cacheControl: "3600",
      upsert: true,
      metadata: {
        source: "google_drive",
        drive_file_id: driveFileId,
        sku: sanitizeSku(sku || ""),
        original_name: resolvedFileName
      }
    });
  if (error) throw error;
  const publicUrl = await getSignedUrlOrPublicUrl({ bucket, storageKey });
  if (!publicUrl) {
    throw publicError(500, "reference_storage_url_unavailable", "อัปโหลด reference สำเร็จแต่ยังสร้าง URL สำหรับ Generate Hero ไม่ได้");
  }
  const payload = {
    bucket,
    storageKey,
    publicUrl,
    contentType: resolvedMimeType,
    fileSize: fileSize || meter.bytes || null
  };
  googleDriveReferenceStagingCache.set(cacheKey, {
    payload,
    expiresAt: now + googleDriveReferenceStagingCacheTtlMs
  });
  return payload;
}

function buildGoogleDriveReferenceStorageKey({ sku = "", driveFileId = "", fileName = "", mimeType = "" } = {}) {
  const safeSku = sanitizeSku(sku || "unknown-sku") || "unknown-sku";
  const extension = safeFileExtension(path.extname(fileName)) || extensionFromMimeType(mimeType) || "jpg";
  const baseName = sanitizeFileName(path.basename(fileName || "reference", path.extname(fileName || "")) || "reference");
  const digest = createHash("sha256")
    .update(`${driveFileId}:${fileName}:${mimeType}`)
    .digest("hex")
    .slice(0, 12);
  return `catalog/${safeSku}/${driveFileId}-${digest}-${baseName}.${extension}`;
}

function isSupportedReferenceImageMimeType(mimeType = "") {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(String(mimeType || ""));
}

function mimeTypeFromFileName(name = "") {
  const normalized = String(name || "").toLowerCase();
  if (/\.(jpe?g)$/.test(normalized)) return "image/jpeg";
  if (/\.png$/.test(normalized)) return "image/png";
  if (/\.webp$/.test(normalized)) return "image/webp";
  return "";
}

function createByteLimitTransform(maxBytes) {
  let bytes = 0;
  const stream = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length || 0;
      if (bytes > maxBytes) {
        callback(publicError(413, "reference_image_too_large", "ไฟล์ reference จาก Google Drive ใหญ่เกินกว่าที่ระบบกำหนด"));
        return;
      }
      callback(null, chunk);
    }
  });
  return {
    stream,
    get bytes() {
      return bytes;
    }
  };
}

async function stageGoogleDriveReferenceResolutionForLiveGeneration(referenceResolution) {
  const stagedFilesByDriveId = {};
  const drive = await getGoogleDriveClient();
  if (!drive) return buildModelInputStagingManifest({ referenceResolution, stagedFilesByDriveId });

  for (const item of referenceResolution.items || []) {
    const skuDir = path.join(liveInputStagingDir, safeLivePathSegment(item.sku || "unknown-sku"), "reference");
    await fs.mkdir(skuDir, { recursive: true });
    const selectedAssets = (item.selected_reference_assets || []).slice(0, 6);
    for (let index = 0; index < selectedAssets.length; index += 1) {
      const asset = selectedAssets[index];
      const driveFileId = asset.drive_file_id || asset.id || "";
      if (!driveFileId) continue;
      const fileName = `${String(index + 1).padStart(2, "0")}-${safeLivePathSegment(asset.name || driveFileId)}${extensionForDriveAsset(asset)}`;
      const localPath = path.join(skuDir, fileName);
      const response = await drive.files.get(
        {
          fileId: driveFileId,
          alt: "media",
          supportsAllDrives: true
        },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(response.data);
      await fs.writeFile(localPath, buffer);
      stagedFilesByDriveId[driveFileId] = {
        local_path: localPath,
        file_name: path.basename(localPath),
        file_size: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        staged_at: new Date().toISOString()
      };
    }
  }

  return buildModelInputStagingManifest({ referenceResolution, stagedFilesByDriveId });
}

function extensionForDriveAsset(asset = {}) {
  const existing = path.extname(String(asset.name || ""));
  if (existing) return "";
  if (asset.mimeType === "image/png") return ".png";
  if (asset.mimeType === "image/webp") return ".webp";
  if (asset.mimeType === "image/gif") return ".gif";
  return ".jpg";
}

function safeLivePathSegment(value = "") {
  return String(value || "file").normalize("NFKC").trim().replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "file";
}

async function getFalImageProvider() {
  if (!falImageProviderPromise) {
    falImageProviderPromise = createFalImageProvider({
      generatedDir: liveGeneratedDir,
      timeoutMs: Number(process.env.FAL_TIMEOUT_MS || 180000),
      verbose: isBooleanEnvEnabled("AI_GENERATION_VERBOSE")
    });
  }
  return falImageProviderPromise;
}

function resolveLineAutomationActorId() {
  return cleanOptionalString(process.env.AUTOMATION_ACTOR_ID || process.env.SUPABASE_AUTOMATION_ACTOR_ID);
}

async function updateBatchItemsAfterSupportGeneration({ task, persistence, batchItems = [] }) {
  const supportSkus = new Set((persistence?.items || [])
    .filter((item) => item.kind === "support" || item.type === "support_generated")
    .map((item) => item.sku)
    .filter(Boolean));
  if (!supportSkus.size) return;
  for (const item of batchItems) {
    if (!supportSkus.has(item.sku)) continue;
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const supportAssets = buildPersistedSupportAssetsForSku({ persistence, sku: item.sku });
    const { error } = await supabaseAdmin
      .from("automation_batch_items")
      .update({
        status: "support_ready_for_review",
        metadata: {
          ...metadata,
          review_set_status: "awaiting_support_review",
          support_assets: mergeSupportAssets(metadata.support_assets, supportAssets),
          support_generation: {
            status: "support_ready_for_review",
            task_id: task.id,
            generated_at: new Date().toISOString(),
            persistence_summary: persistence.summary || {},
            support_assets: supportAssets
          }
        }
      })
      .eq("id", item.id);
    if (error) throw error;
  }
}

async function handleHeroGenerationCompleted({ task, persistence, batchItems = [] }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;
  const heroItems = (persistence?.items || [])
    .filter((entry) => entry.kind === "hero" || entry.type === "hero_generated")
    .filter((entry) => entry.persistence_status === "persisted");
  if (!heroItems.length) return;

  const batchId = task?.payload?.batch_id || task?.batch_id || "";
  const lines = ["Hero Review พร้อมตรวจ"];
  for (const item of heroItems.slice(0, 5)) {
    const matchingBatchItem = batchItems.find((batchItem) => batchItem.sku === item.sku) || {};
    const reviewUrl = buildWorkflowReviewUrl({
      batchId,
      sku: item.sku || matchingBatchItem.sku || "",
      generationId: item.generation_id || ""
    });
    lines.push([item.sku || "-", reviewUrl || "เปิดจาก Automation Inbox ได้"].filter(Boolean).join(" | "));
  }
  lines.push("ขั้นตอนถัดไป: ตรวจ Hero แล้ว Approve เพื่อเริ่ม support");

  try {
    await pushLineMessage({
      to: target,
      messages: [{ type: "text", text: lines.join("\n") }]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "hero_generation_review_handoff_sent",
      eventJson: {
        task_id: task.id,
        batch_id: batchId,
        hero_count: heroItems.length
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "hero_generation_review_handoff_failed",
      eventJson: {
        task_id: task.id,
        batch_id: batchId,
        error: readableError(error)
      }
    });
  }
}

async function handleSupportGenerationCompleted({ task, persistence, batchItems = [] }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;
  const supportSkus = Array.from(new Set((persistence?.items || [])
    .filter((entry) => entry.kind === "support" || entry.type === "support_generated")
    .map((entry) => entry.sku)
    .filter(Boolean)));
  const sku = task?.payload?.sku || supportSkus[0] || batchItems[0]?.sku || "";
  const batchId = task?.payload?.batch_id || task?.batch_id || "";
  const generationId = task?.payload?.generation_id || task?.generation_id || "";
  const reviewUrl = buildWorkflowReviewUrl({ batchId, sku, generationId });
  const supportCount = (persistence?.items || []).filter((entry) => entry.sku === sku).length || persistence?.summary?.persisted || 0;
  try {
    await pushLineMessage({
      to: target,
      messages: [{
        type: "text",
        text: [
          `Support Review พร้อมตรวจ | SKU ${sku || "-"}`,
          supportCount ? `${supportCount} support shots generated` : "",
          reviewUrl || "เปิดจาก Automation Inbox ได้",
          "ขั้นตอนถัดไป: ตรวจ support candidates ก่อน export / WordPress"
        ].filter(Boolean).join("\n")
      }]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "support_generation_review_handoff_sent",
      eventJson: {
        task_id: task.id,
        batch_id: batchId,
        sku,
        support_count: supportCount,
        review_url: reviewUrl
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "support_generation_review_handoff_failed",
      eventJson: {
        task_id: task.id,
        batch_id: batchId,
        sku,
        error: readableError(error)
      }
    });
  }
}

function buildWorkflowReviewUrl({ batchId = "", sku = "", generationId = "" } = {}) {
  const base = cleanOptionalString(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, "");
  if (!safeHttpsUrl(base) || !generationId) return "";
  const params = new URLSearchParams();
  if (batchId) params.set("batch_id", batchId);
  if (sku) params.set("sku", sku);
  params.set("generation_id", generationId);
  return `${base}/#review?${params.toString()}`;
}

function buildPersistedSupportAssetsForSku({ persistence, sku }) {
  return (persistence?.items || [])
    .filter((entry) => entry.sku === sku)
    .filter((entry) => entry.kind === "support" || entry.type === "support_generated")
    .filter((entry) => entry.public_url || entry.source_url)
    .map((entry) => ({
      asset_id: entry.asset_id || null,
      generation_id: entry.generation_id || null,
      request_id: entry.request_id || null,
      kind: "support",
      slot: entry.slot || "",
      type: entry.type || "support_generated",
      public_url: entry.public_url || entry.source_url || "",
      source_url: entry.public_url || entry.source_url || "",
      file_name: entry.file_name || "",
      mime_type: entry.mime_type || "",
      file_size: entry.file_size || 0,
      prompt: entry.prompt || ""
    }));
}

function mergeSupportAssets(existing = [], next = []) {
  const seen = new Set();
  return [...(Array.isArray(existing) ? existing : []), ...next].filter((asset) => {
    const key = asset.asset_id || asset.generation_id || asset.public_url || asset.source_url || asset.request_id || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function handleWordPressProductPreflightCompleted({ task, preflight }) {
  await sendWordPressPreflightLineSummary({ task, preflight });
  await enqueueWordPressMediaMappingPreflight({ task, preflight });
}

async function handleWordPressMediaPreflightCompleted({ task, preflight }) {
  await sendWordPressMediaPreflightLineSummary({ task, preflight });
}

async function handleWordPressMediaAttachConfirmationCompleted({ task, confirmationGate }) {
  await sendWordPressMediaAttachConfirmationLineSummary({ task, confirmationGate });
}

async function handleWordPressMediaAttachExecutionPlanCompleted({ task, executionPlan }) {
  await sendWordPressMediaAttachExecutionPlanLineSummary({ task, executionPlan });
}

async function handleWordPressMediaRemoteRefetchPreflightCompleted({ task, remoteRefetchPreflight }) {
  await sendWordPressMediaRemoteRefetchPreflightLineSummary({ task, remoteRefetchPreflight });
}

async function sendWordPressPreflightLineSummary({ task, preflight }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;

  try {
    await pushLineMessage({
      to: target,
      messages: [buildWordPressPreflightFlex(preflight)]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_product_publish_preflight_line_summary_sent",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        line_target_configured: Boolean(lineTargetUserId),
        summary: preflight.summary || {}
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_product_publish_preflight_line_summary_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function sendWordPressMediaPreflightLineSummary({ task, preflight }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;

  try {
    await pushLineMessage({
      to: target,
      messages: [buildWordPressMediaPreflightFlex(preflight)]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_mapping_preflight_line_summary_sent",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        line_target_configured: Boolean(lineTargetUserId),
        summary: preflight.summary || {}
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_mapping_preflight_line_summary_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function sendWordPressMediaAttachConfirmationLineSummary({ task, confirmationGate }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;

  try {
    await pushLineMessage({
      to: target,
      messages: [buildWordPressMediaAttachConfirmationFlex(confirmationGate)]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_attach_confirmation_gate_line_summary_sent",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        line_target_configured: Boolean(lineTargetUserId),
        summary: confirmationGate.summary || {}
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_attach_confirmation_gate_line_summary_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function sendWordPressMediaAttachExecutionPlanLineSummary({ task, executionPlan }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;

  try {
    await pushLineMessage({
      to: target,
      messages: [buildWordPressMediaAttachExecutionPlanFlex(executionPlan)]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_attach_execution_plan_line_summary_sent",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        line_target_configured: Boolean(lineTargetUserId),
        summary: executionPlan.summary || {}
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_attach_execution_plan_line_summary_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function sendWordPressMediaRemoteRefetchPreflightLineSummary({ task, remoteRefetchPreflight }) {
  const target = cleanOptionalString(task?.payload?.line_user_id) || lineTargetUserId;
  if (!target || !lineChannelAccessToken) return;

  try {
    await pushLineMessage({
      to: target,
      messages: [buildWordPressMediaRemoteRefetchPreflightFlex(remoteRefetchPreflight)]
    });
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_remote_refetch_preflight_line_summary_sent",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        line_target_configured: Boolean(lineTargetUserId),
        summary: remoteRefetchPreflight.summary || {}
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_remote_refetch_preflight_line_summary_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function enqueueWordPressMediaMappingPreflight({ task, preflight }) {
  if (!task?.batch_id) return;
  try {
    await enqueueAutomationTask({
      taskType: WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK,
      batchId: task.batch_id,
      dedupeKey: `line:${WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK}:${preflight.batch_id || task.payload?.batch_id || task.batch_id}`,
      priority: 140,
      payload: {
        source: task.payload?.source || "automation_worker",
        action: "media_mapping_preflight",
        batch_id: task.payload?.batch_id || preflight.batch_id || null,
        line_user_id: task.payload?.line_user_id || null,
        dry_run: true,
        requires_final_confirmation: true,
        auto_enqueue_final_confirmation_gate: true,
        product_preflight: preflight
      }
    });
  } catch (error) {
    await recordAuditEvent({
      actorId: null,
      eventType: "wordpress_media_mapping_preflight_enqueue_failed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        error: readableError(error)
      }
    });
  }
}

async function readAutomationBatchItems(batchId) {
  const { data, error } = await supabaseAdmin
    .from("automation_batch_items")
    .select("id, sku, product_type, target_site, product_name, status, woo_status, metadata")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function completeAutomationTask(taskId, result = {}) {
  const { error } = await supabaseAdmin
    .from("automation_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      payload: result
    })
    .eq("id", taskId);
  if (error) throw error;
}

async function failOrRetryAutomationTask(task, error) {
  const attempts = Number(task.attempts || 1);
  const maxAttempts = Number(task.max_attempts || 3);
  const finalFailure = attempts >= maxAttempts;
  const backoffSeconds = Math.min(300, Math.max(15, attempts * attempts * 15));
  const nextAvailableAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
  const message = readableError(error);

  await recordAuditEvent({
    actorId: null,
    eventType: finalFailure ? "automation_task_failed" : "automation_task_retry_scheduled",
    eventJson: {
      task_id: task.id,
      task_type: task.task_type,
      batch_id: task.batch_id,
      dedupe_key: task.dedupe_key,
      worker_id: automationWorkerId,
      embedded_worker: true,
      attempts,
      max_attempts: maxAttempts,
      next_available_at: finalFailure ? null : nextAvailableAt,
      error: message
    }
  });

  const { error: updateError } = await supabaseAdmin
    .from("automation_tasks")
    .update({
      status: finalFailure ? "failed" : "queued",
      locked_at: null,
      locked_by: null,
      last_error: message,
      available_at: finalFailure ? task.available_at : nextAvailableAt
    })
    .eq("id", task.id);
  if (updateError) throw updateError;
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
      eventJson: buildStorageFailureEventJson({ bucket, storageKey, error, fallbackPayload })
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
      eventJson: buildStorageFailureEventJson({ bucket, storageKey, error, fallbackPayload })
    });
    return fallbackPayload;
  }
}

function buildStorageFailureEventJson({ bucket, storageKey, error, fallbackPayload = {} }) {
  const fallbackBucket = String(fallbackPayload.bucket || "");
  const resolvedByDrive = fallbackBucket === "google_drive" && Boolean(fallbackPayload.public_url || fallbackPayload.storage_key);
  return {
    bucket,
    storageKey,
    errorMessage: readableError(error),
    storage_error_kind: classifyStorageError(error),
    fallback_bucket: fallbackBucket || null,
    fallback_type: fallbackPayload.type || null,
    fallback_has_public_url: Boolean(fallbackPayload.public_url),
    fallback_has_storage_key: Boolean(fallbackPayload.storage_key),
    resolved_by_drive: resolvedByDrive,
    severity: resolvedByDrive ? "warning" : "critical"
  };
}

function classifyStorageError(error) {
  const message = readableError(error).toLowerCase();
  if (/bucket.*not.*found|not found.*bucket|storage bucket/i.test(message)) return "bucket_missing";
  if (/row-level security|rls|policy|permission|forbidden|unauthorized|not authorized/i.test(message)) return "permission_or_policy";
  if (/mime|content.?type/i.test(message)) return "content_type";
  if (/network|fetch|timeout|econn|socket/i.test(message)) return "network";
  return "unknown";
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
  const urlValidation = validateRemoteImageUrl(imageUrl);
  if (!urlValidation.ok) throw publicError(400, urlValidation.code, urlValidation.error);
  const response = await fetch(urlValidation.url);
  if (!response.ok) {
    throw new Error(`Failed to download image for Supabase Storage: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(contentType)) {
    throw publicError(415, "unsupported_remote_image_type", "Remote file is not a supported image.");
  }
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  return parseSafeImageUrls(value, { limit: 6 });
}

function collectUnsafeImageUrls(value) {
  if (!value) return [];
  const urls = Array.isArray(value) ? value : parseJsonArray(value);
  return urls
    .map((url) => validateRemoteImageUrl(url))
    .filter((result) => !result.ok);
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rateLimit({ keyPrefix, windowMs, max, userScoped = false }) {
  return (req, res, next) => {
    const now = Date.now();
    pruneRateLimitBuckets(now);
    const identity = userScoped
      ? req.user?.id || req.ip || "anonymous"
      : req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `${keyPrefix}:${identity}`;
    const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return sendApiError(res, 429, "rate_limited", "มี request มากเกินไป กรุณารอสักครู่แล้วลองใหม่");
    }
    return next();
  };
}

function pruneRateLimitBuckets(now = Date.now()) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now > bucket.resetAt + 60_000) rateLimitBuckets.delete(key);
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
  const urlValidation = validateRemoteImageUrl(url);
  if (!urlValidation.ok) throw publicError(400, urlValidation.code, urlValidation.error);
  const response = await fetch(urlValidation.url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/^image\/(jpeg|jpg|png|webp)$/i.test(contentType)) {
    throw publicError(415, "unsupported_remote_image_type", "Remote file is not a supported image.");
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 20 * 1024 * 1024) {
    throw publicError(413, "remote_image_too_large", "Remote image is too large.");
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
    auditEventsResult,
    automationTasksResult
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
    }),
    readMonitoringRows("automation_tasks", [
      "id, task_type, batch_id, dedupe_key, status, payload, completed_at, created_at",
      "id, task_type, batch_id, dedupe_key, status, completed_at, created_at"
    ], {
      since: rangeMeta.since,
      limit: 250,
      optional: true
    })
  ]);

  [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult, automationTasksResult].forEach((result) => {
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
  const automationTasks = automationTasksResult.data;
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
  const resolvedStorageFailureEvents = storageFailureEvents.filter((event) => isStorageFailureResolvedByDrive(event, assets));
  const criticalStorageFailureEvents = storageFailureEvents.filter((event) => !isStorageFailureResolvedByDrive(event, assets));
  const approvalFailureEvents = auditEvents.filter((event) => isApprovalFailureEvent(event.event_type));
  const systemFailureEvents = auditEvents.filter((event) => {
    if (!isMonitoringFailureEvent(event.event_type)) return false;
    if (isStorageFailureEvent(event.event_type) && isStorageFailureResolvedByDrive(event, assets)) return false;
    return true;
  });
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
  const wordpressPreflights = buildMonitoringWordPressPreflights(automationTasks);
  const pagination = buildMonitoringPaginationMeta(paginationInput, {
    stuckJobs: stuckJobs.length,
    failedItems: failedItems.length,
    recentSystemEvents: recentSystemEvents.length,
    wordpressPreflights: wordpressPreflights.length
  });

  const warnings = [
    ...readWarnings,
    ...buildMonitoringWarnings({
      googleDriveStatus,
      failedJobs,
      failedGenerations,
      exportFailureEvents,
      storageFailureEvents: criticalStorageFailureEvents,
      resolvedStorageFailureEvents,
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
      wordpressPreflights: wordpressPreflights.length,
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
      totalErrors: failedJobs.length + failedGenerations.length + exportFailureEvents.length + criticalStorageFailureEvents.length + approvalFailureEvents.length,
      failedJobs: failedJobs.length,
      failedGenerations: failedGenerations.length,
      failedExports: exportFailureEvents.length,
      stuckJobs: stuckJobs.length,
      storageFailures: criticalStorageFailureEvents.length,
      storageWarnings: resolvedStorageFailureEvents.length,
      approvalFailures: approvalFailureEvents.length,
      pendingApprovals: pendingApprovals.length,
      wordpressPreflights: wordpressPreflights.length,
      warningsCount: dedupedWarnings.length,
      latestErrorTime
    },
    warnings: dedupedWarnings,
    stuckJobs: paginateMonitoringItems(stuckJobs, pagination),
    failedItems: paginateMonitoringItems(failedItems, pagination),
    recentErrors,
    recentSystemEvents: paginateMonitoringItems(recentSystemEvents, pagination),
    wordpressPreflights: paginateMonitoringItems(wordpressPreflights, pagination)
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
  const contextSince = null;

  const [jobsResult, generationsResult, approvalsResult, assetsResult, auditEventsResult] = await Promise.all([
    readMonitoringRows("jobs", [
      "id, sku, product_name, brand, category, image_type, status, created_by, created_at, updated_at, form_json",
      "id, sku, product_name, brand, category, image_type, status, created_by, created_at, form_json"
    ], {
      since: contextSince,
      limit: readLimit
    }),
    readMonitoringRows("generations", [
      "id, job_id, kind, request_id, status, image_asset_id, created_by, created_at, updated_at, completed_at, error_message",
      "id, job_id, kind, request_id, status, created_by, created_at, completed_at, error_message"
    ], {
      since: contextSince,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("approvals", [
      "id, generation_id, approved_by, approved_at, export_path",
      "id, generation_id, approved_by, approved_at"
    ], {
      since: contextSince,
      dateColumn: "approved_at",
      orderColumn: "approved_at",
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("assets", [
      "id, job_id, type, bucket, public_url, storage_key, created_by, created_at",
      "id, job_id, type, bucket, created_by, created_at"
    ], {
      since: contextSince,
      limit: readLimit,
      optional: true
    }),
    readMonitoringRows("audit_events", [
      "id, actor_id, job_id, generation_id, event_type, event_json, created_at",
      "id, actor_id, job_id, generation_id, event_type, created_at"
    ], {
      since: contextSince,
      limit: readLimit,
      optional: true
    })
  ]);

  const jobs = jobsResult.data;
  const generations = generationsResult.data;
  const approvals = approvalsResult.data;
  const assets = assetsResult.data;
  const auditEvents = auditEventsResult.data;
  const batchItemBySku = await readProductionBatchItemsBySku(
    jobs.map((job) => job.sku || job.form_json?.sku || "")
  );
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
      batchItem: batchItemBySku.get(sanitizeSku(job.sku || job.form_json?.sku || "")),
      profile: profileById.get(job.created_by)
    }))
    .filter((job) => {
      if (!productionJobMatchesRange(job, rangeMeta)) return false;
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
    })
    .sort((a, b) => new Date(b.latestActivityAt || b.createdAt || 0) - new Date(a.latestActivityAt || a.createdAt || 0));

  const pagination = buildProductionPaginationMeta(paginationInput, rows.length);
  return {
    range,
    rangeLabel: rangeMeta.label,
    jobs: paginateProductionItems(rows, pagination),
    pagination
  };
}

function productionJobMatchesRange(job = {}, rangeMeta = {}) {
  if (!rangeMeta?.since) return true;
  const activityAt = job.latestActivityAt || job.updatedAt || job.createdAt || "";
  const activityMs = new Date(activityAt).getTime();
  const sinceMs = new Date(rangeMeta.since).getTime();
  return Number.isFinite(activityMs) && Number.isFinite(sinceMs) && activityMs >= sinceMs;
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

function summarizeProductionSupportReview(batchItem = {}, supportCount = 0) {
  const metadata = isPlainObject(batchItem?.metadata) ? batchItem.metadata : {};
  const decisionState = isPlainObject(metadata.support_review_decision_state)
    ? metadata.support_review_decision_state
    : {};
  const candidateManifest = isPlainObject(metadata.support_candidate_manifest)
    ? metadata.support_candidate_manifest
    : isPlainObject(metadata.candidate_manifest)
      ? metadata.candidate_manifest
      : {};
  const mediaGate = isPlainObject(metadata.media_export_preflight_gate)
    ? metadata.media_export_preflight_gate
    : {};
  const rawStatus = cleanOptionalString(
    decisionState.review_status ||
    metadata.review_set_status ||
    batchItem.status ||
    metadata.support_generation?.status
  );
  const candidateManifestStatus = cleanOptionalString(
    candidateManifest.manifest_status ||
    metadata.candidate_manifest_status
  );
  const mediaPreflightStatus = cleanOptionalString(
    mediaGate.gate_status ||
    metadata.media_export_preflight_status
  );
  let supportReviewStatus = "not_started";
  if (candidateManifestStatus || decisionState.candidate_manifest_ready === true) {
    supportReviewStatus = "candidate_manifest_ready";
  } else if (/regeneration/i.test(rawStatus)) {
    supportReviewStatus = "regenerate_requested";
  } else if (supportCount > 0 || /support_ready|awaiting_support_review|pending_support/i.test(rawStatus)) {
    supportReviewStatus = "pending";
  }
  return {
    supportReviewStatus,
    candidateManifestStatus,
    mediaPreflightStatus
  };
}

function buildProductionWorkflowContracts({
  job,
  generations,
  assets,
  heroGeneration,
  supportGenerations,
  reviewGeneration,
  approval,
  exportUrl,
  exportStatus,
  supportReview,
  batchItem
} = {}) {
  const hrefs = {
    jobs: "#jobs",
    batch: batchItem?.batchKey ? `#batch?batch_id=${encodeURIComponent(batchItem.batchKey)}` : "#jobs",
    review: buildProductionReviewHref({ batchItem, reviewGeneration, job }),
    export: buildProductionReviewHref({ batchItem, reviewGeneration, job }),
    reference: buildProductionReviewHref({ batchItem, reviewGeneration, job })
  };
  const item = buildProductionWorkflowItemSnapshot({
    job,
    generations,
    assets,
    heroGeneration,
    supportGenerations,
    reviewGeneration,
    approval,
    exportUrl,
    exportStatus,
    supportReview,
    batchItem,
    reviewHref: hrefs.review
  });
  const itemContract = resolveItemWorkflowState({
    item,
    tasks: [],
    hrefs
  });
  const batchContract = resolveBatchWorkflowState({
    batch: {
      id: batchItem?.batchId || "",
      batch_id: batchItem?.batchId || "",
      batch_key: batchItem?.batchKey || "",
      status: deriveProductionWorkflowBatchStatus({ batchItem, itemContract, exportStatus })
    },
    items: [item],
    tasks: [],
    hrefs
  });
  return {
    item: itemContract,
    batch: batchContract
  };
}

function buildProductionReviewHref({ batchItem = {}, reviewGeneration = {}, job = {} } = {}) {
  const generationId = cleanOptionalString(reviewGeneration?.id);
  if (!generationId) return "";
  const params = new URLSearchParams();
  params.set("generation_id", generationId);
  if (batchItem.batchKey || batchItem.batchId) params.set("batch_id", batchItem.batchKey || batchItem.batchId);
  const sku = cleanOptionalString(job?.sku || job?.form_json?.sku);
  if (sku) params.set("sku", sku);
  return `#review?${params.toString()}`;
}

function buildProductionWorkflowItemSnapshot({
  job,
  generations,
  assets,
  heroGeneration,
  supportGenerations,
  reviewGeneration,
  approval,
  exportUrl,
  exportStatus,
  supportReview,
  batchItem,
  reviewHref
} = {}) {
  const metadata = isPlainObject(batchItem?.metadata) ? batchItem.metadata : {};
  const referenceAssets = buildProductionWorkflowReferenceAssets({ metadata, assets });
  const heroAsset = buildProductionWorkflowHeroAsset({
    metadata,
    assets,
    heroGeneration,
    reviewGeneration,
    approval
  });
  const supportAssets = buildProductionWorkflowSupportAssets({
    metadata,
    assets,
    supportGenerations
  });

  return {
    id: batchItem?.id || job?.id || "",
    sku: safeProductionText(job?.sku || job?.form_json?.sku || ""),
    status: deriveProductionWorkflowItemStatus({
      job,
      latestGeneration: generations?.[0],
      heroGeneration,
      supportGenerations,
      approval,
      exportUrl,
      exportStatus,
      supportReview,
      batchItem
    }),
    reference_url: cleanOptionalString(
      metadata.reference_url ||
      metadata.reference_manifest?.source_url ||
      job?.form_json?.referenceUrl ||
      job?.form_json?.reference_url
    ),
    reference_drive_id: cleanOptionalString(
      metadata.reference_drive_id ||
      metadata.reference_manifest?.drive_file_id ||
      extractDriveIdFromUrl(metadata.reference_url || metadata.reference_manifest?.source_url || "")
    ),
    export_url: exportUrl || "",
    review_href: reviewHref || "",
    metadata: {
      reference_assets: referenceAssets,
      selected_reference_assets: firstArray(
        metadata.selected_reference_assets,
        metadata.reference_resolution?.selected_reference_assets
      ),
      hero_review_hero_asset: heroAsset || metadata.hero_review_hero_asset || null,
      hero_generation: heroGeneration
        ? { id: heroGeneration.id, status: heroGeneration.status, kind: heroGeneration.kind }
        : metadata.hero_generation || null,
      support_assets: supportAssets,
      support_generation: supportAssets.length
        ? { ...(isPlainObject(metadata.support_generation) ? metadata.support_generation : {}), status: "support_ready_for_review" }
        : metadata.support_generation || null,
      review_set_status: metadata.review_set_status || "",
      support_review_decision_state: metadata.support_review_decision_state || null,
      support_candidate_manifest: metadata.support_candidate_manifest || metadata.candidate_manifest || null,
      candidate_manifest_status: supportReview?.candidateManifestStatus || metadata.candidate_manifest_status || "",
      media_export_preflight_gate: metadata.media_export_preflight_gate || null,
      media_export_preflight_status: supportReview?.mediaPreflightStatus || metadata.media_export_preflight_status || "",
      blockers: firstArray(metadata.blockers, metadata.generation_blockers)
    }
  };
}

function deriveProductionWorkflowBatchStatus({ batchItem = {}, itemContract = {}, exportStatus = "" } = {}) {
  if (exportStatus === "exported" || exportStatus === "google_drive") return "exported";
  if (batchItem?.batchStatus) return batchItem.batchStatus;
  if (["support_approved", "exported"].includes(itemContract.state)) return "ready_for_media_manifest_preflight";
  if (["support_waiting_review", "support_ready", "hero_approved"].includes(itemContract.state)) return "approved";
  return batchItem?.status || "";
}

function deriveProductionWorkflowItemStatus({
  job = {},
  latestGeneration = {},
  heroGeneration = {},
  supportGenerations = [],
  approval = null,
  exportUrl = "",
  exportStatus = "",
  supportReview = {},
  batchItem = {}
} = {}) {
  if (exportUrl || exportStatus === "exported" || exportStatus === "google_drive") return "exported";
  if (supportReview?.supportReviewStatus === "candidate_manifest_ready") return "support_approved_for_candidate_manifest";
  if (supportReview?.supportReviewStatus === "pending") return "support_ready_for_review";
  if ((supportGenerations || []).some((generation) => isFailedStatus(generation.status))) return "support_failed";
  if (isFailedStatus(heroGeneration?.status || latestGeneration?.status || job?.status)) return "hero_failed";
  if (approval) return "hero_approved";
  const batchItemStatus = cleanOptionalString(batchItem?.status).toLowerCase();
  if (["needs_hero_regeneration", "missing_reference", "hero_failed", "support_failed"].includes(batchItemStatus)) {
    return batchItemStatus;
  }
  if (isSuccessfulGenerationStatus(heroGeneration?.status || latestGeneration?.status)) return "selected";
  return batchItemStatus || job?.status || "selected";
}

function buildProductionWorkflowReferenceAssets({ metadata = {}, assets = [] } = {}) {
  const metadataReferences = firstArray(
    metadata.hero_review_reference_assets,
    metadata.selected_reference_assets,
    metadata.reference_assets,
    metadata.reference_images,
    metadata.reference_resolution?.selected_reference_assets
  );
  const assetReferences = (assets || [])
    .filter((asset) => isReferenceReviewAsset(asset))
    .map((asset) => normalizeProductionWorkflowAsset(asset, { source_role: "product_reference" }))
    .filter(Boolean);
  return mergeReviewReferenceAssets(metadataReferences, assetReferences);
}

function buildProductionWorkflowHeroAsset({ metadata = {}, assets = [], heroGeneration = {}, reviewGeneration = {}, approval = null } = {}) {
  if (metadata.hero_review_hero_asset) {
    return {
      ...metadata.hero_review_hero_asset,
      approved: Boolean(approval || metadata.hero_review_hero_asset.approved),
      generation_id: metadata.hero_review_hero_asset.generation_id || heroGeneration?.id || reviewGeneration?.id || ""
    };
  }
  const generation = heroGeneration || reviewGeneration || {};
  const asset = assets.find((candidate) => candidate.id && candidate.id === generation?.image_asset_id) ||
    assets.find((candidate) => String(candidate.type || "").toLowerCase() === "hero_generated") ||
    null;
  if (!generation?.id && !asset?.id) return null;
  return {
    asset_id: asset?.id || generation?.image_asset_id || "",
    generation_id: generation?.id || "",
    request_id: generation?.request_id || "",
    type: asset?.type || "hero_generated",
    public_url: safeUrl(asset?.public_url || asset?.storage_key || ""),
    source_url: safeUrl(asset?.public_url || asset?.storage_key || ""),
    approved: Boolean(approval)
  };
}

function buildProductionWorkflowSupportAssets({ metadata = {}, assets = [], supportGenerations = [] } = {}) {
  const metadataSupportAssets = firstArray(
    metadata.support_assets,
    metadata.support_generation?.support_assets
  );
  const supportGenerationByAssetId = new Map(
    (supportGenerations || [])
      .filter((generation) => generation.image_asset_id)
      .map((generation) => [generation.image_asset_id, generation])
  );
  const generatedSupportAssets = (assets || [])
    .filter((asset) => {
      const type = String(asset.type || "").toLowerCase();
      return type.includes("support") || supportGenerationByAssetId.has(asset.id);
    })
    .map((asset) => {
      const generation = supportGenerationByAssetId.get(asset.id) || {};
      return normalizeProductionWorkflowAsset(asset, {
        kind: "support",
        slot: extractSupportSlot({ asset, generation }),
        generation_id: generation.id || "",
        request_id: generation.request_id || ""
      });
    })
    .filter(Boolean);
  return mergeSupportAssets(metadataSupportAssets, generatedSupportAssets);
}

function normalizeProductionWorkflowAsset(asset = {}, extra = {}) {
  if (!isPlainObject(asset)) return null;
  return {
    ...asset,
    ...extra,
    asset_id: asset.asset_id || asset.id || extra.asset_id || "",
    generation_id: asset.generation_id || extra.generation_id || "",
    request_id: asset.request_id || extra.request_id || "",
    type: asset.type || extra.type || "",
    public_url: safeUrl(asset.public_url || asset.url || asset.source_url || asset.storage_key || ""),
    source_url: safeUrl(asset.source_url || asset.public_url || asset.url || asset.storage_key || ""),
    file_name: asset.file_name || asset.name || asset.source_name || ""
  };
}

function serializeProductionJob({ job, generations, assets, auditEvents, approvalGenerationIds, approvalByGenerationId, batchItem, profile }) {
  const sortedGenerations = [...generations].sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0));
  const latestGeneration = sortedGenerations[0] || null;
  const heroGeneration = sortedGenerations.find((generation) => String(generation.kind || "").toLowerCase() === "hero") || sortedGenerations[0] || null;
  const supportGenerations = sortedGenerations.filter((generation) => String(generation.kind || "").toLowerCase() !== "hero");
  const reviewGeneration = heroGeneration || latestGeneration;
  const approvedGeneration = sortedGenerations.find((generation) => approvalGenerationIds.has(generation.id));
  const approval = approvedGeneration ? approvalByGenerationId.get(approvedGeneration.id) : null;
  const visibleSupportGenerations = approval ? supportGenerations : [];
  const supportReview = summarizeProductionSupportReview(batchItem, visibleSupportGenerations.length);
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
    batchItem?.updatedAt,
    ...auditEvents.map((event) => event.created_at)
  ]);
  const workflow = buildProductionWorkflowContracts({
    job,
    generations: sortedGenerations,
    assets,
    heroGeneration,
    supportGenerations: visibleSupportGenerations,
    reviewGeneration,
    approval,
    exportUrl,
    exportStatus,
    supportReview,
    batchItem
  });

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
    latestGenerationId: reviewGeneration?.id || null,
    latestOutputGenerationId: latestGeneration?.id || null,
    heroStatus: heroGeneration?.status || "",
    supportStatus: visibleSupportGenerations.length
      ? summarizeProductionStatuses(visibleSupportGenerations.map((generation) => generation.status))
      : "",
    supportCount: visibleSupportGenerations.length,
    approvalStatus: approval ? "approved" : "pending",
    approvedAt: approval?.approved_at || null,
    batchId: batchItem?.batchId || "",
    batchKey: batchItem?.batchKey || "",
    batchItemStatus: batchItem?.status || "",
    supportReviewStatus: supportReview.supportReviewStatus,
    candidateManifestStatus: supportReview.candidateManifestStatus,
    mediaPreflightStatus: supportReview.mediaPreflightStatus,
    workflow,
    workflowState: workflow.item.state,
    workflowStateLabelTh: workflow.item.label_th,
    workflowNextAction: workflow.item.next_action,
    batchWorkflowState: workflow.batch.state,
    batchWorkflowStateLabelTh: workflow.batch.label_th,
    batchWorkflowNextAction: workflow.batch.next_action,
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
  const previewWarning = !previewUrl && googleDriveLink
    ? "Supabase preview unavailable; Google Drive export is available"
    : "";
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
    previewWarning,
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
  if (!next.previewWarning && asset.previewWarning) next.previewWarning = asset.previewWarning;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      recentSystemEvents: Number(totalsByList.recentSystemEvents || 0),
      wordpressPreflights: Number(totalsByList.wordpressPreflights || 0)
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
  resolvedStorageFailureEvents = [],
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
  if (resolvedStorageFailureEvents.length) warnings.push(createWarning("storage_resolved_by_drive", `Supabase Storage failed แต่ Google Drive export สำเร็จแล้ว ${formatThaiNumber(resolvedStorageFailureEvents.length)} รายการ`));
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
        canRetryExport: ["export", "storage"].includes(monitoringFailureType(event.event_type))
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
        status: monitoringEventStatus(event),
        user: formatProfileName(profileById.get(event.actor_id)),
        jobId: event.job_id || generation?.job_id || null,
        generationId: event.generation_id || null,
        detail: safeMonitoringEventDetail(event) || safeMonitoringText(job?.product_name || job?.sku || "")
      };
    })
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function monitoringEventStatus(event) {
  const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
  if (isStorageFailureEvent(event.event_type) && (eventJson.resolved_by_drive === true || eventJson.severity === "warning")) {
    return "resolved_by_drive";
  }
  return statusFromEventType(event.event_type) || "recorded";
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

function isStorageFailureResolvedByDrive(event, assets = []) {
  const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
  if (eventJson.resolved_by_drive === true || eventJson.severity === "warning") return true;
  const jobId = event.job_id || eventJson.jobId || eventJson.job_id || null;
  if (!jobId) return false;
  const eventTime = new Date(event.created_at || 0).getTime() || 0;
  return assets.some((asset) => {
    if (asset.job_id !== jobId) return false;
    if (String(asset.type || "").toLowerCase() !== "approved_export") return false;
    if (String(asset.bucket || "").toLowerCase() !== "google_drive") return false;
    if (!safeUrl(asset.public_url || asset.storage_key || "")) return false;
    const assetTime = new Date(asset.created_at || 0).getTime() || 0;
    return !eventTime || !assetTime || assetTime >= eventTime - 5 * 60 * 1000;
  });
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
  if (type.includes("storage")) return "ตรวจสอบ Supabase Storage bucket/policy แต่ถ้ามี Google Drive export แล้วถือเป็น warning ไม่ใช่งาน fail";
  if (type.includes("approval") || type.includes("approve")) return "ตรวจสอบ approval record และ export path จากนั้น approve/save ใหม่ถ้าจำเป็น";
  if (type.includes("generation")) return "ตรวจสอบ FAL error และ reference image ก่อน retry generation";
  return job?.id ? "เปิดงานที่เกี่ยวข้องแล้วตรวจสอบ log ล่าสุด" : "ตรวจสอบ system log และ audit event ล่าสุด";
}

function safeMonitoringEventDetail(event) {
  const eventJson = event?.event_json && typeof event.event_json === "object" ? event.event_json : {};
  if (isStorageFailureEvent(event.event_type) && (eventJson.resolved_by_drive === true || eventJson.severity === "warning")) {
    return "Supabase Storage failed แต่ Google Drive export สำเร็จแล้ว";
  }
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

function isBooleanEnvEnabled(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").trim().toLowerCase());
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
  startEmbeddedAutomationWorker();
});
