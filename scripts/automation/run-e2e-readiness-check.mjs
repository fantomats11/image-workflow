#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildPilotGenerationExecutionPlan } from "../../lib/automation/pilot-generation-execution-plan.mjs";
import { buildLivePilotGenerationGate } from "../../lib/automation/live-pilot-generation-gate.mjs";
import {
  buildEnvPresenceChecks,
  buildGateChecks,
  buildReadinessResult,
  buildSupportGateChecks,
  buildWordPressGuardrailCheck,
  formatSmokeSummaryLines,
  maskEnvValue
} from "../../lib/automation/e2e-production-smoke.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`E2E readiness check failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const result = await runReadinessCheck(options);
  console.info(`E2E readiness wrote: ${result.manifest.output_path}`);
  console.info(formatSmokeSummaryLines(result).join("\n"));
  process.exitCode = result.summary.exitCode;
}

export async function runReadinessCheck(options = {}) {
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const outputPath = path.resolve(options.output || path.join(outputsDir, "e2e-readiness-check.json"));
  const checks = [];

  checks.push(...buildEnvPresenceChecks({
    env: process.env,
    optional: [
      "PUBLIC_BASE_URL",
      "FAL_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GOOGLE_DRIVE_ROOT_FOLDER_ID",
      "GOOGLE_DRIVE_AUTH_MODE",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "LINE_CHANNEL_ACCESS_TOKEN",
      "LINE_CHANNEL_SECRET",
      "LINE_TARGET_USER_ID"
    ]
  }));
  checks.push(buildWordPressGuardrailCheck({ env: process.env }));
  checks.push(await buildSupabaseReachabilityCheck({ env: process.env }));
  checks.push(buildGoogleDriveConfigCheck({ env: process.env }));

  const { generationPlan, planChecks } = buildGenerationPlanFromArtifacts({ options, outputsDir });
  checks.push(...planChecks);

  let gate = null;
  if (generationPlan) {
    gate = buildLivePilotGenerationGate({
      generationPlan,
      mode: options.mode || "all",
      maxRequests: Number(options.maxRequests || 12),
      liveRequested: false,
      liveConfirmed: false,
      env: process.env
    });
    checks.push(...buildGateChecks({ gate }));
    checks.push(...buildSupportGateChecks({ generationPlan }));
  }

  const result = buildReadinessResult({
    checks,
    manifest: {
      generation_plan_batch_id: generationPlan?.batch_id || null,
      gate_status: gate?.gate_status || null,
      output_path: outputPath
    }
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

export function buildGenerationPlanFromArtifacts({ options = {}, outputsDir = defaultOutputsDir } = {}) {
  const checks = [];
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const mediaManifestPath = resolveOptionalPath(options.mediaManifest, path.join(outputsDir, "generation-approval-media-manifest.json"));
  const referenceResolutionPath = resolveOptionalPath(options.referenceResolution, path.join(outputsDir, "reference-asset-resolution.json"));
  const modelInputStagingPath = resolveOptionalPath(options.modelInputStaging, path.join(outputsDir, "model-input-staging.json"));

  if (!fs.existsSync(batchJsonPath)) {
    checks.push(buildScriptCheck({
      id: "generation_plan_input_batch_exists",
      level: "fail",
      label: `ไม่พบ batch dry-run artifact: ${batchJsonPath}`,
      details: { batch_json: batchJsonPath }
    }));
    return { generationPlan: null, planChecks: checks };
  }

  try {
    const batch = readJson(batchJsonPath);
    const mediaManifest = mediaManifestPath ? readJson(mediaManifestPath) : null;
    const referenceResolutionManifest = referenceResolutionPath ? readJson(referenceResolutionPath) : null;
    const modelInputStagingManifest = modelInputStagingPath ? readJson(modelInputStagingPath) : null;
    const generationPlan = buildPilotGenerationExecutionPlan({
      task: {
        id: "local-e2e-readiness-plan",
        task_type: "generate_batch",
        batch_id: batch.batch_id || "local-e2e-readiness-batch",
        payload: {
          dry_run: true,
          source: "local_cli_e2e_readiness",
          media_manifest: mediaManifestPath || null
        }
      },
      batchItems: batch.items || [],
      mediaManifest,
      referenceResolutionManifest,
      modelInputStagingManifest,
      prioritySupportCount: Number(options.prioritySupportCount || 2),
      liveGenerationEnabled: false
    });
    checks.push(buildScriptCheck({
      id: "generation_plan_built",
      level: "pass",
      label: "สร้าง generation plan สำหรับ readiness แล้ว",
      details: {
        batch_id: generationPlan.batch_id || null,
        planned_generation_requests: generationPlan.summary?.planned_generation_requests || 0,
        blocked_generation_requests: generationPlan.summary?.blocked_generation_requests || 0
      }
    }));
    return { generationPlan, planChecks: checks };
  } catch (error) {
    checks.push(buildScriptCheck({
      id: "generation_plan_built",
      level: "fail",
      label: `สร้าง generation plan ไม่สำเร็จ: ${safeErrorMessage(error)}`,
      details: { batch_json: batchJsonPath }
    }));
    return { generationPlan: null, planChecks: checks };
  }
}

async function buildSupabaseReachabilityCheck({ env = process.env } = {}) {
  const hasUrl = Boolean(String(env.SUPABASE_URL || "").trim());
  const hasKey = Boolean(String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
  if (!hasUrl || !hasKey) {
    return buildScriptCheck({
      id: "supabase_reachable",
      level: "warn",
      label: "ไม่ได้ตรวจ Supabase เพราะ env ยังไม่ครบ",
      details: {
        SUPABASE_URL: maskEnvValue("SUPABASE_URL", env.SUPABASE_URL || ""),
        SUPABASE_SERVICE_ROLE_KEY: maskEnvValue("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY || "")
      }
    });
  }

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error } = await supabase.from("automation_batches").select("id").limit(1);
    if (error) throw error;
    return buildScriptCheck({
      id: "supabase_reachable",
      level: "pass",
      label: "Supabase reachable ด้วย read-only probe",
      details: { probe: "automation_batches limit 1" }
    });
  } catch (error) {
    return buildScriptCheck({
      id: "supabase_reachable",
      level: "fail",
      label: `Supabase probe ไม่สำเร็จ: ${safeErrorMessage(error)}`,
      details: { probe: "automation_batches limit 1" }
    });
  }
}

function buildGoogleDriveConfigCheck({ env = process.env } = {}) {
  const authMode = String(env.GOOGLE_DRIVE_AUTH_MODE || "").trim().toLowerCase();
  const hasRoot = Boolean(String(env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "").trim());
  const hasOAuthClient = Boolean(String(env.GOOGLE_OAUTH_CLIENT_ID || "").trim() && String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim());
  const hasTokenPath = Boolean(String(env.GOOGLE_DRIVE_TOKEN_PATH || "").trim());
  const configured = hasRoot && (authMode !== "oauth" || hasOAuthClient || hasTokenPath);
  return buildScriptCheck({
    id: "google_drive_config_status",
    level: configured ? "pass" : "warn",
    label: configured
      ? "Google Drive config พร้อมสำหรับ export/readiness"
      : "Google Drive config ยังไม่ครบหรือยังต้องเชื่อม OAuth",
    details: {
      GOOGLE_DRIVE_ROOT_FOLDER_ID: maskEnvValue("GOOGLE_DRIVE_ROOT_FOLDER_ID", env.GOOGLE_DRIVE_ROOT_FOLDER_ID || ""),
      GOOGLE_DRIVE_AUTH_MODE: maskEnvValue("GOOGLE_DRIVE_AUTH_MODE", env.GOOGLE_DRIVE_AUTH_MODE || ""),
      GOOGLE_OAUTH_CLIENT_ID: maskEnvValue("GOOGLE_OAUTH_CLIENT_ID", env.GOOGLE_OAUTH_CLIENT_ID || ""),
      GOOGLE_OAUTH_CLIENT_SECRET: maskEnvValue("GOOGLE_OAUTH_CLIENT_SECRET", env.GOOGLE_OAUTH_CLIENT_SECRET || ""),
      GOOGLE_DRIVE_TOKEN_PATH: maskEnvValue("GOOGLE_DRIVE_TOKEN_PATH", env.GOOGLE_DRIVE_TOKEN_PATH || "")
    }
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--media-manifest") parsed.mediaManifest = args[++index];
    else if (arg === "--reference-resolution") parsed.referenceResolution = args[++index];
    else if (arg === "--model-input-staging") parsed.modelInputStaging = args[++index];
    else if (arg === "--priority-support-count") parsed.prioritySupportCount = args[++index];
    else if (arg === "--mode") parsed.mode = args[++index];
    else if (arg === "--max-requests") parsed.maxRequests = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.mode && !["priority", "hero-only", "all"].includes(parsed.mode)) {
    throw new Error("--mode must be one of: priority, hero-only, all.");
  }
  return parsed;
}

function resolveOptionalPath(optionPath, defaultPath) {
  if (optionPath) return path.resolve(optionPath);
  return fs.existsSync(defaultPath) ? defaultPath : "";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildScriptCheck({ id, level, label, details = {} }) {
  return { id, level, label, details };
}

function safeErrorMessage(error) {
  return String(error?.message || error || "unknown_error")
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token)=([^&\s]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .slice(0, 240);
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/run-e2e-readiness-check.mjs [options]",
    "",
    "Safe readiness only. This command never generates live images and never writes to WordPress/WooCommerce.",
    "",
    "Options:",
    "  --batch-json <path>              Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --media-manifest <path>          Optional generation approval media manifest JSON.",
    "  --reference-resolution <path>    Optional reference asset resolution JSON.",
    "  --model-input-staging <path>     Optional model input staging JSON.",
    "  --priority-support-count <n>     Priority support count per SKU. Default: 2.",
    "  --mode <priority|hero-only|all>  Gate selection mode. Default: all.",
    "  --max-requests <n>               Max requests for gate summary. Default: 12.",
    "  --output <path>                  Output JSON path. Defaults to outputs/e2e-readiness-check.json.",
    "  --outputs-dir <path>             Outputs directory."
  ].join("\n"));
  process.exit(0);
}
