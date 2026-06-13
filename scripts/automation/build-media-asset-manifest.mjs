#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCsvObjects } from "../../lib/automation/csv.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildMediaAssetManifest } from "../../lib/automation/media-asset-manifest.mjs";
import { readSupabaseMediaRowsForSkus } from "../../lib/automation/supabase-media-asset-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Media asset manifest failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "generation-approval-media-manifest.json"));
  if (!fs.existsSync(batchJsonPath)) throw new Error(`Batch JSON not found: ${batchJsonPath}`);

  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  const sourceRows = options.fromSupabase
    ? await readSupabaseMediaRows(batch)
    : readLocalRows(options);
  const manifest = buildMediaAssetManifest({
    batch,
    assets: sourceRows.assets,
    jobs: sourceRows.jobs,
    generations: sourceRows.generations,
    approvals: sourceRows.approvals
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.info(`Media asset manifest wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(manifest.summary)}`);
}

function readLocalRows(options) {
  return {
    assets: options.assets ? readRowsFile(path.resolve(options.assets)) : [],
    jobs: options.jobs ? readRowsFile(path.resolve(options.jobs)) : [],
    generations: options.generations ? readRowsFile(path.resolve(options.generations)) : [],
    approvals: options.approvals ? readRowsFile(path.resolve(options.approvals)) : []
  };
}

async function readSupabaseMediaRows(batch) {
  const { supabaseAdmin } = await import("../../lib/supabase-admin.mjs");
  const skus = (batch.items || []).map((item) => String(item.sku || "").trim()).filter(Boolean);
  return readSupabaseMediaRowsForSkus({ supabaseAdmin, skus });
}

function readRowsFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);
  if (filePath.toLowerCase().endsWith(".csv")) return readCsvObjects(filePath);
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.assets)) return value.assets;
  throw new Error(`Unsupported row file shape: ${filePath}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--from-supabase") parsed.fromSupabase = true;
    else if (arg === "--assets") parsed.assets = args[++index];
    else if (arg === "--jobs") parsed.jobs = args[++index];
    else if (arg === "--generations") parsed.generations = args[++index];
    else if (arg === "--approvals") parsed.approvals = args[++index];
    else if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-media-asset-manifest.mjs [options]",
    "",
    "Options:",
    "  --from-supabase          Read jobs/assets/generations/approvals from Supabase using SELECT-only queries.",
    "  --assets <path>          JSON/CSV assets rows.",
    "  --jobs <path>            JSON/CSV jobs rows.",
    "  --generations <path>     JSON/CSV generations rows.",
    "  --approvals <path>       JSON/CSV approvals rows.",
    "  --batch-json <path>      Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --output <path>          Output JSON path. Defaults to outputs/generation-approval-media-manifest.json.",
    "  --outputs-dir <path>     Outputs directory."
  ].join("\n"));
  process.exit(0);
}
