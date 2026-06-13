#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { persistLiveGenerationExecution } from "../../lib/automation/live-generation-persistence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Live generation persistence failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const executionPath = path.resolve(options.execution || path.join(outputsDir, "live-pilot-generation-execution.json"));
  const generationPlanPath = path.resolve(options.generationPlan || path.join(outputsDir, "pilot-generation-execution-plan.json"));
  const batchPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "live-generation-persistence.json"));

  if (!fs.existsSync(executionPath)) throw new Error(`Execution JSON not found: ${executionPath}`);
  if (!fs.existsSync(generationPlanPath)) throw new Error(`Generation plan JSON not found: ${generationPlanPath}`);

  const execution = JSON.parse(fs.readFileSync(executionPath, "utf8"));
  const generationPlan = JSON.parse(fs.readFileSync(generationPlanPath, "utf8"));
  const batch = fs.existsSync(batchPath) ? JSON.parse(fs.readFileSync(batchPath, "utf8")) : {};
  const dryRun = !options.persist;
  const actorId = options.actorId || process.env.AUTOMATION_ACTOR_ID || process.env.SUPABASE_AUTOMATION_ACTOR_ID || "";
  const supabaseAdmin = dryRun ? null : await loadSupabaseAdmin();
  const result = await persistLiveGenerationExecution({
    supabaseAdmin,
    execution,
    generationPlan,
    batch,
    actorId,
    dryRun
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.info(`Live generation persistence wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(result.summary)}`);
  console.info(`Persistence status: ${result.persistence_status || (dryRun ? "dry_run" : "unknown")}`);
  if (result.blockers?.length) console.info(`Blockers: ${result.blockers.join(", ")}`);
}

async function loadSupabaseAdmin() {
  const { supabaseAdmin } = await import("../../lib/supabase-admin.mjs");
  return supabaseAdmin;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--execution") parsed.execution = args[++index];
    else if (arg === "--generation-plan") parsed.generationPlan = args[++index];
    else if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--actor-id") parsed.actorId = args[++index];
    else if (arg === "--persist") parsed.persist = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/persist-live-generation-execution.mjs [options]",
    "",
    "Options:",
    "  --execution <path>             Live execution JSON. Defaults to outputs/live-pilot-generation-execution.json.",
    "  --generation-plan <path>       Generation plan JSON. Defaults to outputs/pilot-generation-execution-plan.json.",
    "  --batch-json <path>            Batch JSON for SKU metadata fallback. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --output <path>                Output JSON path. Defaults to outputs/live-generation-persistence.json.",
    "  --outputs-dir <path>           Outputs directory.",
    "  --persist                      Write jobs/generations/assets to Supabase. Omit for dry-run.",
    "  --actor-id <uuid>              Required with --persist unless AUTOMATION_ACTOR_ID is set."
  ].join("\n"));
  process.exit(0);
}
