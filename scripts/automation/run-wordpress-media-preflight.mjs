#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAutomationBatchItemPayload } from "../../lib/automation/batch-registry.mjs";
import { readCsvObjects } from "../../lib/automation/csv.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildWordPressMediaMappingPreflight } from "../../lib/automation/wordpress-media-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`WordPress media mapping preflight failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const productPreflightPath = path.resolve(options.productPreflight || path.join(outputsDir, "wordpress-product-publish-preflight.json"));
  const defaultMediaManifestPath = path.join(outputsDir, "generation-approval-media-manifest.json");
  const mediaManifestPath = options.mediaManifest
    ? path.resolve(options.mediaManifest)
    : fs.existsSync(defaultMediaManifestPath)
      ? defaultMediaManifestPath
      : "";
  const outputPath = path.resolve(options.output || path.join(outputsDir, "wordpress-media-mapping-preflight.json"));

  if (!fs.existsSync(batchJsonPath)) throw new Error(`Batch JSON not found: ${batchJsonPath}`);
  if (!fs.existsSync(productPreflightPath)) throw new Error(`Product preflight JSON not found: ${productPreflightPath}`);

  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  const productPreflight = JSON.parse(fs.readFileSync(productPreflightPath, "utf8"));
  const mediaAssets = mediaManifestPath ? readMediaManifest(mediaManifestPath) : [];
  const batchItems = (batch.items || []).map((item, index) => ({
    id: `local-${index + 1}`,
    ...buildAutomationBatchItemPayload(batch.batch_id || "local-batch", item),
    status: options.keepStatus ? item.status || "awaiting_approval" : "approved"
  }));

  const preflight = buildWordPressMediaMappingPreflight({
    task: {
      id: "local-wordpress-media-preflight",
      task_type: "wordpress_media_mapping_preflight",
      batch_id: batch.batch_id || productPreflight.batch_id || "local-batch",
      payload: {
        dry_run: true,
        source: "local_cli",
        media_manifest: mediaManifestPath
      }
    },
    batchItems,
    productPreflight,
    mediaAssets
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
  console.info(`WordPress media mapping preflight wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(preflight.summary)}`);
}

function readMediaManifest(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Media manifest not found: ${filePath}`);
  if (filePath.toLowerCase().endsWith(".csv")) return readCsvObjects(filePath);
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.assets)) return value.assets;
  if (Array.isArray(value.media_assets)) return value.media_assets;
  throw new Error("Media manifest JSON must be an array or contain assets/media_assets.");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--keep-status") {
      parsed.keepStatus = true;
    } else if (arg === "--batch-json") {
      parsed.batchJson = args[++index];
    } else if (arg === "--product-preflight") {
      parsed.productPreflight = args[++index];
    } else if (arg === "--media-manifest") {
      parsed.mediaManifest = args[++index];
    } else if (arg === "--output") {
      parsed.output = args[++index];
    } else if (arg === "--outputs-dir") {
      parsed.outputsDir = args[++index];
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/run-wordpress-media-preflight.mjs [options]",
    "",
    "Options:",
    "  --media-manifest <path>      Optional JSON/CSV list of generated or approved media assets.",
    "  --product-preflight <path>   Product preflight JSON. Defaults to outputs/wordpress-product-publish-preflight.json.",
    "  --keep-status               Use batch item statuses instead of assuming approved.",
    "  --batch-json <path>         Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --output <path>             Output JSON path. Defaults to outputs/wordpress-media-mapping-preflight.json.",
    "  --outputs-dir <path>        Outputs directory."
  ].join("\n"));
  process.exit(0);
}
