#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { runLivePilotGenerationSmokeTest } from "../../lib/automation/live-pilot-smoke-test.mjs";
import {
  E2E_PILOT_SMOKE_TASK,
  buildPilotSmokeGuardChecks,
  formatSmokeSummaryLines,
  summarizeSmokeChecks
} from "../../lib/automation/e2e-production-smoke.mjs";
import {
  buildGenerationPlanFromArtifacts,
  runReadinessCheck
} from "./run-e2e-readiness-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`E2E pilot smoke failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const result = await runPilotSmoke(options);
  console.info(`E2E pilot smoke wrote: ${result.output_path}`);
  console.info(formatPilotSmokeSummaryLines(result).join("\n"));
  process.exitCode = result.summary.exitCode;
}

export async function runPilotSmoke(options = {}) {
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const sku = options.sku || process.env.E2E_PILOT_SKU || "";
  const outputPath = path.resolve(options.output || path.join(outputsDir, "e2e-pilot-smoke.json"));
  const readinessOutputPath = path.resolve(options.readinessOutput || path.join(outputsDir, "e2e-readiness-check.json"));
  const readinessResult = await runReadinessCheck({
    ...options,
    output: readinessOutputPath,
    mode: options.mode || "all"
  });
  const guardChecks = buildPilotSmokeGuardChecks({
    env: process.env,
    sku,
    readinessResult
  });
  const guardSummary = summarizeSmokeChecks(guardChecks);
  let smoke = null;

  if (guardSummary.fail === 0) {
    const { generationPlan, planChecks } = buildGenerationPlanFromArtifacts({ options, outputsDir });
    const planSummary = summarizeSmokeChecks(planChecks);
    if (planSummary.fail > 0 || !generationPlan) {
      guardChecks.push(...planChecks);
    } else {
      const providerGenerate = shouldCreateProvider({ options, env: process.env })
        ? await createFalProvider({
          generatedDir: path.resolve(options.generatedDir || path.join(outputsDir, "generated-e2e-pilot-smoke")),
          timeoutMs: Number(options.timeoutMs || 30000),
          verbose: Boolean(options.verbose)
        })
        : undefined;
      const liveRequested = Boolean(options.live);
      const liveConfirmed = Boolean(options.confirmLiveGeneration && isTruthyEnv(process.env.E2E_PILOT_CONFIRM));
      smoke = await runLivePilotGenerationSmokeTest({
        generationPlan,
        mode: options.mode || "hero-only",
        requestFilter: {
          sku,
          brandId: options.brandId || "",
          slot: options.slot || "",
          kind: options.kind || "",
          requestId: options.requestId || ""
        },
        liveRequested,
        liveConfirmed,
        readinessOnly: !liveRequested || Boolean(options.readinessOnly),
        env: process.env,
        providerGenerate
      });
    }
  }

  const allChecks = [
    ...readinessResult.checks,
    ...guardChecks,
    ...(smoke ? buildSmokeExecutionChecks(smoke) : [])
  ];
  const summary = summarizeSmokeChecks(allChecks);
  const result = {
    manifest_type: E2E_PILOT_SMOKE_TASK,
    created_at: new Date().toISOString(),
    output_path: outputPath,
    readiness_output_path: readinessOutputPath,
    dry_run: smoke ? smoke.dry_run : true,
    readiness_only: smoke ? smoke.readiness_only : true,
    sku,
    status: summary.status,
    summary,
    checks: allChecks,
    smoke
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function buildSmokeExecutionChecks(smoke = {}) {
  return [
    {
      id: "pilot_smoke_selected_one_request",
      level: smoke.summary?.selected_requests === 1 ? "pass" : "fail",
      label: smoke.summary?.selected_requests === 1
        ? "Pilot smoke จำกัดไว้ที่ request เดียว"
        : "Pilot smoke ไม่ได้จำกัดไว้ที่ request เดียว",
      details: { selected_requests: smoke.summary?.selected_requests || 0 }
    },
    {
      id: "pilot_smoke_status",
      level: smoke.summary?.failed_requests > 0 ? "fail" : smoke.summary?.ready_requests > 0 ? "pass" : "warn",
      label: `Pilot smoke status: ${smoke.smoke_status || "unknown"}`,
      details: {
        smoke_status: smoke.smoke_status || "",
        ready_requests: smoke.summary?.ready_requests || 0,
        blocked_requests: smoke.summary?.blocked_requests || 0,
        executed_requests: smoke.summary?.executed_requests || 0,
        generated_images: smoke.summary?.generated_images || 0
      }
    }
  ];
}

async function createFalProvider(options) {
  const { createFalImageProvider } = await import("../../lib/automation/fal-image-provider.mjs");
  return createFalImageProvider(options);
}

function shouldCreateProvider({ options = {}, env = process.env } = {}) {
  if (!options.live || options.readinessOnly) return false;
  if (!options.confirmLiveGeneration) return false;
  if (!isTruthyEnv(env.E2E_PILOT_CONFIRM)) return false;
  if (!isTruthyEnv(env.AI_GENERATION_LIVE_ENABLED)) return false;
  if (!String(env.FAL_KEY || "").trim()) return false;
  return true;
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
    else if (arg === "--sku") parsed.sku = args[++index];
    else if (arg === "--brand-id") parsed.brandId = args[++index];
    else if (arg === "--slot") parsed.slot = args[++index];
    else if (arg === "--kind") parsed.kind = args[++index];
    else if (arg === "--request-id") parsed.requestId = args[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--confirm-live-generation") parsed.confirmLiveGeneration = true;
    else if (arg === "--readiness-only") parsed.readinessOnly = true;
    else if (arg === "--generated-dir") parsed.generatedDir = args[++index];
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--readiness-output") parsed.readinessOutput = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--verbose") parsed.verbose = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.mode && !["priority", "hero-only", "all"].includes(parsed.mode)) {
    throw new Error("--mode must be one of: priority, hero-only, all.");
  }
  return parsed;
}

function formatPilotSmokeSummaryLines(result = {}) {
  const lines = formatSmokeSummaryLines(result);
  if (result.smoke?.summary) {
    lines.push(`Smoke: ready=${result.smoke.summary.ready_requests} executed=${result.smoke.summary.executed_requests} generated=${result.smoke.summary.generated_images}`);
  }
  return lines;
}

function isTruthyEnv(value = "") {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function safeErrorMessage(error) {
  return String(error?.message || error || "unknown_error")
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token)=([^&\s]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .slice(0, 240);
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/run-e2e-pilot-smoke.mjs --sku <sku> [options]",
    "",
    "Gated pilot smoke. Requires E2E_PILOT_CONFIRM=true and a SKU. Live image generation additionally requires --live --confirm-live-generation, AI_GENERATION_LIVE_ENABLED=true, and FAL_KEY.",
    "",
    "Options:",
    "  --sku <sku>                     Required pilot SKU, or use E2E_PILOT_SKU.",
    "  --batch-json <path>             Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --media-manifest <path>         Optional generation approval media manifest JSON.",
    "  --reference-resolution <path>   Optional reference asset resolution JSON.",
    "  --model-input-staging <path>    Optional model input staging JSON.",
    "  --mode <priority|hero-only|all> Smoke selection mode. Default: hero-only.",
    "  --kind <hero|support>           Smoke only this request kind.",
    "  --request-id <id>               Smoke one exact request id.",
    "  --live                          Request live provider execution.",
    "  --confirm-live-generation       Required with --live.",
    "  --readiness-only                Force provider-free readiness smoke.",
    "  --output <path>                 Output JSON path. Defaults to outputs/e2e-pilot-smoke.json.",
    "  --outputs-dir <path>            Outputs directory."
  ].join("\n"));
  process.exit(0);
}
