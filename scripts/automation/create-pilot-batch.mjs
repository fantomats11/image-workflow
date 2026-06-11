#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { readCsvObjects, writeCsvObjects } from "../../lib/automation/csv.mjs";
import { selectPilotItemsV3 } from "../../lib/automation/pilot-selector-v3.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(repoRoot, "../..");
const defaultOutputsDir = path.join(workspaceRoot, "outputs");

export function createPilotBatch({
  auditRows = [],
  generationRows = [],
  env = process.env,
  now = new Date()
} = {}) {
  const rawSkuPerBrand = String(env.PILOT_SKU_PER_BRAND ?? "").trim();
  const skuPerBrand = rawSkuPerBrand === "" ? 2 : Number(rawSkuPerBrand);
  if (!Number.isInteger(skuPerBrand) || skuPerBrand < 1) {
    throw new Error("PILOT_SKU_PER_BRAND must be a positive integer.");
  }
  return selectPilotItemsV3({
    auditRows,
    generationRows,
    skuPerBrand,
    includeExistingSku: env.PILOT_INCLUDE_EXISTING_SKU === "true",
    now
  });
}

export function runCreatePilotBatch({
  outputsDir = defaultOutputsDir,
  env = process.env,
  now = new Date()
} = {}) {
  loadLocalEnv(path.join(repoRoot, ".env"));

  const auditRows = readCsvObjects(path.join(outputsDir, "catalog-vs-woo-sku-audit.csv"));
  const generationRows = readCsvObjects(path.join(outputsDir, "generation-input-catalog.csv"));
  const batch = createPilotBatch({ auditRows, generationRows, env, now });

  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(path.join(outputsDir, "pilot-batch-dry-run.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  writeCsvObjects(path.join(outputsDir, "pilot-batch-dry-run.csv"), batch.items);

  console.log(`Created ${batch.batch_id}`);
  console.log(`Items: ${batch.items.length}`);
  console.log(`Rent A Coat candidates: ${batch.selection.rent_a_coat_candidates}`);
  console.log(`GO Mall candidates: ${batch.selection.go_mall_candidates}`);
  console.log(path.join(outputsDir, "pilot-batch-dry-run.json"));

  return batch;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCreatePilotBatch();
}
