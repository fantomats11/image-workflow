#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildLivePilotGenerationGate } from "../../lib/automation/live-pilot-generation-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Live pilot generation gate failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const generationPlanPath = path.resolve(options.generationPlan || path.join(outputsDir, "pilot-generation-execution-plan.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "live-pilot-generation-gate.json"));

  if (!fs.existsSync(generationPlanPath)) throw new Error(`Generation plan JSON not found: ${generationPlanPath}`);
  const generationPlan = JSON.parse(fs.readFileSync(generationPlanPath, "utf8"));
  const gate = buildLivePilotGenerationGate({
    generationPlan,
    mode: options.mode || "hero-only",
    maxRequests: Number(options.maxRequests || 12),
    liveRequested: Boolean(options.live),
    liveConfirmed: Boolean(options.confirmLiveGeneration),
    env: process.env
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
  console.info(`Live pilot generation gate wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(gate.summary)}`);
  console.info(`Gate status: ${gate.gate_status}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--generation-plan") parsed.generationPlan = args[++index];
    else if (arg === "--mode") parsed.mode = args[++index];
    else if (arg === "--max-requests") parsed.maxRequests = args[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--confirm-live-generation") parsed.confirmLiveGeneration = true;
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

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-live-generation-gate.mjs [options]",
    "",
    "Options:",
    "  --generation-plan <path>       Pilot generation execution plan JSON.",
    "  --mode <priority|hero-only|all> Request selection mode. Default: hero-only.",
    "  --max-requests <n>             Max requests in this wave. Default: 12.",
    "  --live                         Request live generation gate arming.",
    "  --confirm-live-generation      Required with --live to arm execution.",
    "  --output <path>                Output JSON path. Defaults to outputs/live-pilot-generation-gate.json.",
    "  --outputs-dir <path>           Outputs directory."
  ].join("\n"));
  process.exit(0);
}
