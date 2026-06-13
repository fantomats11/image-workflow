#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { runLivePilotGenerationSmokeTest } from "../../lib/automation/live-pilot-smoke-test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Live pilot generation smoke test failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const generationPlanPath = path.resolve(options.generationPlan || path.join(outputsDir, "pilot-generation-execution-plan.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "live-pilot-generation-smoke-test.json"));

  if (!fs.existsSync(generationPlanPath)) throw new Error(`Generation plan JSON not found: ${generationPlanPath}`);
  const generationPlan = JSON.parse(fs.readFileSync(generationPlanPath, "utf8"));
  const providerGenerate = shouldCreateProvider({ options, env: process.env })
    ? await createFalProvider({
      generatedDir: path.resolve(options.generatedDir || path.join(outputsDir, "generated-pilot-smoke")),
      timeoutMs: Number(options.timeoutMs || 30000),
      verbose: Boolean(options.verbose)
    })
    : undefined;
  const smoke = await runLivePilotGenerationSmokeTest({
    generationPlan,
    mode: options.mode || "hero-only",
    requestFilter: buildRequestFilter(options),
    liveRequested: Boolean(options.live),
    liveConfirmed: Boolean(options.confirmLiveGeneration),
    readinessOnly: Boolean(options.readinessOnly),
    env: process.env,
    providerGenerate
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
  console.info(`Live pilot generation smoke test wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(smoke.summary)}`);
  console.info(`Smoke status: ${smoke.smoke_status}`);
  if (smoke.gate.gate_blockers.length) console.info(`Gate blockers: ${smoke.gate.gate_blockers.join(", ")}`);
  if (smoke.execution.execution_blockers.length) console.info(`Execution blockers: ${smoke.execution.execution_blockers.join(", ")}`);
}

async function createFalProvider(options) {
  const { createFalImageProvider } = await import("../../lib/automation/fal-image-provider.mjs");
  return createFalImageProvider(options);
}

function shouldCreateProvider({ options, env }) {
  if (!options.live || !options.confirmLiveGeneration || options.readinessOnly) return false;
  if (String(env.AI_GENERATION_LIVE_ENABLED || "").trim().toLowerCase() !== "true") return false;
  if (!String(env.FAL_KEY || "").trim()) return false;
  return true;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--generation-plan") parsed.generationPlan = args[++index];
    else if (arg === "--mode") parsed.mode = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++index];
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
    else if (arg === "--sku") parsed.sku = args[++index];
    else if (arg === "--brand-id") parsed.brandId = args[++index];
    else if (arg === "--slot") parsed.slot = args[++index];
    else if (arg === "--kind") parsed.kind = args[++index];
    else if (arg === "--request-id") parsed.requestId = args[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--confirm-live-generation") parsed.confirmLiveGeneration = true;
    else if (arg === "--readiness-only") parsed.readinessOnly = true;
    else if (arg === "--verbose") parsed.verbose = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.mode && !["priority", "hero-only", "all"].includes(parsed.mode)) {
    throw new Error("--mode must be one of: priority, hero-only, all.");
  }
  return parsed;
}

function buildRequestFilter(options = {}) {
  return {
    sku: options.sku || "",
    brandId: options.brandId || "",
    slot: options.slot || "",
    kind: options.kind || "",
    requestId: options.requestId || ""
  };
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/run-live-generation-smoke-test.mjs [options]",
    "",
    "Options:",
    "  --generation-plan <path>       Pilot generation execution plan JSON.",
    "  --mode <priority|hero-only|all> Request selection mode. Default: hero-only.",
    "  --live                         Request live smoke execution.",
    "  --confirm-live-generation      Required with --live to execute provider calls.",
    "  --readiness-only               Never create/call the provider; write readiness artifact only.",
    "  --output <path>                Output JSON path. Defaults to outputs/live-pilot-generation-smoke-test.json.",
    "  --outputs-dir <path>           Outputs directory.",
    "  --generated-dir <path>         Directory for downloaded generated smoke image.",
    "  --timeout-ms <ms>              Provider generation and image download timeout. Default: 30000.",
    "  --sku <sku>                    Smoke only this SKU.",
    "  --brand-id <brand_id>          Smoke only this brand id.",
    "  --slot <slot>                  Smoke only this slot, such as hero.",
    "  --kind <hero|support>          Smoke only this request kind.",
    "  --request-id <id>              Smoke one exact request id.",
    "  --verbose                      Print progress diagnostics without secrets."
  ].join("\n"));
  process.exit(0);
}
