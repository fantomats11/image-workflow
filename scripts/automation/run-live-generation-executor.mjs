#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { executeLivePilotGenerationGate } from "../../lib/automation/live-pilot-generation-executor.mjs";
import { createFalImageProvider } from "../../lib/automation/fal-image-provider.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Live pilot generation execution failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const gatePath = path.resolve(options.gate || path.join(outputsDir, "live-pilot-generation-gate.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "live-pilot-generation-execution.json"));
  const generatedDir = path.resolve(options.generatedDir || path.join(outputsDir, "generated-pilot"));

  if (!fs.existsSync(gatePath)) throw new Error(`Live generation gate JSON not found: ${gatePath}`);
  const gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));
  const providerGenerate = options.live
    ? await createFalProvider({ generatedDir, timeoutMs: Number(options.timeoutMs || 30000), verbose: Boolean(options.verbose) })
    : undefined;

  const execution = await executeLivePilotGenerationGate({
    gate,
    liveRequested: Boolean(options.live),
    liveConfirmed: Boolean(options.confirmLiveGeneration),
    env: process.env,
    maxRequests: options.maxRequests === undefined ? null : Number(options.maxRequests),
    providerGenerate
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(execution, null, 2)}\n`, "utf8");
  console.info(`Live pilot generation execution wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(execution.summary)}`);
  console.info(`Execution status: ${execution.execution_status}`);
  if (execution.execution_blockers.length) {
    console.info(`Execution blockers: ${execution.execution_blockers.join(", ")}`);
  }
}

async function createFalProvider({ generatedDir, timeoutMs, verbose = false }) {
  return createFalImageProvider({ generatedDir, timeoutMs, verbose });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--gate") parsed.gate = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++index];
    else if (arg === "--max-requests") parsed.maxRequests = args[++index];
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--confirm-live-generation") parsed.confirmLiveGeneration = true;
    else if (arg === "--verbose") parsed.verbose = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/run-live-generation-executor.mjs [options]",
    "",
    "Options:",
    "  --gate <path>                  Live generation gate JSON.",
    "  --max-requests <n>             Limit execution to first n ready requests.",
    "  --live                         Request live provider execution.",
    "  --confirm-live-generation      Required with --live to execute provider calls.",
    "  --output <path>                Output JSON path. Defaults to outputs/live-pilot-generation-execution.json.",
    "  --outputs-dir <path>           Outputs directory.",
    "  --generated-dir <path>         Directory for downloaded generated images.",
    "  --timeout-ms <ms>              Provider generation and image download timeout. Default: 30000.",
    "  --verbose                      Print progress diagnostics without secrets."
  ].join("\n"));
  process.exit(0);
}
