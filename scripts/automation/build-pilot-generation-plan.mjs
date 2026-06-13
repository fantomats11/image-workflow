#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildPilotGenerationExecutionPlan } from "../../lib/automation/pilot-generation-execution-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Pilot generation plan failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const defaultMediaManifestPath = path.join(outputsDir, "generation-approval-media-manifest.json");
  const defaultReferenceResolutionPath = path.join(outputsDir, "reference-asset-resolution.json");
  const defaultModelInputStagingPath = path.join(outputsDir, "model-input-staging.json");
  const mediaManifestPath = options.mediaManifest
    ? path.resolve(options.mediaManifest)
    : fs.existsSync(defaultMediaManifestPath)
      ? defaultMediaManifestPath
      : "";
  const referenceResolutionPath = options.referenceResolution
    ? path.resolve(options.referenceResolution)
    : fs.existsSync(defaultReferenceResolutionPath)
      ? defaultReferenceResolutionPath
      : "";
  const modelInputStagingPath = options.modelInputStaging
    ? path.resolve(options.modelInputStaging)
    : fs.existsSync(defaultModelInputStagingPath)
      ? defaultModelInputStagingPath
      : "";
  const outputPath = path.resolve(options.output || path.join(outputsDir, "pilot-generation-execution-plan.json"));

  if (!fs.existsSync(batchJsonPath)) throw new Error(`Batch JSON not found: ${batchJsonPath}`);

  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  const mediaManifest = mediaManifestPath ? JSON.parse(fs.readFileSync(mediaManifestPath, "utf8")) : null;
  const referenceResolutionManifest = referenceResolutionPath ? JSON.parse(fs.readFileSync(referenceResolutionPath, "utf8")) : null;
  const modelInputStagingManifest = modelInputStagingPath ? JSON.parse(fs.readFileSync(modelInputStagingPath, "utf8")) : null;
  const plan = buildPilotGenerationExecutionPlan({
    task: {
      id: "local-pilot-generation-plan",
      task_type: "generate_batch",
      batch_id: batch.batch_id || "local-batch",
      payload: {
        dry_run: true,
        source: "local_cli",
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

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  console.info(`Pilot generation plan wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(plan.summary)}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--media-manifest") parsed.mediaManifest = args[++index];
    else if (arg === "--reference-resolution") parsed.referenceResolution = args[++index];
    else if (arg === "--model-input-staging") parsed.modelInputStaging = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--priority-support-count") parsed.prioritySupportCount = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-pilot-generation-plan.mjs [options]",
    "",
    "Options:",
    "  --batch-json <path>              Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --media-manifest <path>          Optional generation approval media manifest JSON.",
    "  --reference-resolution <path>    Optional reference asset resolution JSON.",
    "  --model-input-staging <path>     Optional model input staging JSON.",
    "  --priority-support-count <n>     Number of support shots treated as required priority per SKU. Default: 2.",
    "  --output <path>                  Output JSON path. Defaults to outputs/pilot-generation-execution-plan.json.",
    "  --outputs-dir <path>             Outputs directory."
  ].join("\n"));
  process.exit(0);
}
