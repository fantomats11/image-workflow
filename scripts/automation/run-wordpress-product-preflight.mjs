#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAutomationBatchItemPayload } from "../../lib/automation/batch-registry.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildWordPressProductPublishPreflightWithRemoteChecks } from "../../lib/automation/wordpress-publish-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`WordPress/WooCommerce preflight failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "wordpress-product-publish-preflight.json"));

  if (!fs.existsSync(batchJsonPath)) throw new Error(`Batch JSON not found: ${batchJsonPath}`);
  if (options.remoteChecks) process.env.WORDPRESS_REMOTE_READS_ENABLED = "true";

  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  const batchItems = (batch.items || []).map((item, index) => ({
    id: `local-${index + 1}`,
    ...buildAutomationBatchItemPayload(batch.batch_id || "local-batch", item),
    status: options.keepStatus ? item.status || "awaiting_approval" : "approved"
  }));
  const preflight = await buildWordPressProductPublishPreflightWithRemoteChecks({
    task: {
      id: "local-wordpress-preflight",
      task_type: "wordpress_product_publish_preflight",
      batch_id: batch.batch_id || "local-batch",
      payload: {
        dry_run: true,
        source: "local_cli",
        remote_checks: Boolean(options.remoteChecks)
      }
    },
    batchItems,
    env: process.env
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
  console.info(`WordPress/WooCommerce preflight wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(preflight.summary)}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--remote-checks") {
      parsed.remoteChecks = true;
    } else if (arg === "--keep-status") {
      parsed.keepStatus = true;
    } else if (arg === "--batch-json") {
      parsed.batchJson = args[++index];
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
    "Usage: node scripts/automation/run-wordpress-product-preflight.mjs [options]",
    "",
    "Options:",
    "  --remote-checks        Enable read-only WooCommerce remote checks.",
    "  --keep-status          Use batch item statuses instead of assuming approved.",
    "  --batch-json <path>    Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --output <path>        Output JSON path. Defaults to outputs/wordpress-product-publish-preflight.json.",
    "  --outputs-dir <path>   Outputs directory."
  ].join("\n"));
  process.exit(0);
}
