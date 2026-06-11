#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv, isDryRun } from "../../lib/automation/env.mjs";
import { readCsvObjects, writeCsvObjects } from "../../lib/automation/csv.mjs";
import {
  PROMPT_FRAMEWORK_VERSION,
  buildHeroPromptV2,
  buildSupportPromptV2,
  getSupportShots
} from "../../lib/automation/prompt-framework-v2.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(repoRoot, "../..");
const outputsDir = path.join(workspaceRoot, "outputs");

loadLocalEnv(path.join(repoRoot, ".env"));

const batchSize = Number(process.env.PILOT_BATCH_SIZE || 10);
const dryRun = isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true);
const auditRows = readCsvObjects(path.join(outputsDir, "catalog-vs-woo-sku-audit.csv"));
const generationRows = readCsvObjects(path.join(outputsDir, "generation-input-catalog.csv"));
const generationBySku = new Map(generationRows.map((row) => [row.sku, row]));

function isActionable(row) {
  if (!row.sku) return false;
  if (row.automation_action !== "generate_then_publish_or_attach_after_review") return false;
  const generation = generationBySku.get(row.sku);
  if (!generation) return false;
  if (generation.generation_status === "ready_via_drive_folder_lookup") return Boolean(generation.reference_parent_folder_id && generation.reference_lookup_key);
  if (generation.generation_status === "ready_for_generation") return isHttpUrl(generation.reference_url);
  if (generation.generation_status === "ready_if_reference_available") return isHttpUrl(generation.reference_url);
  return false;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function buildItem(row) {
  const generation = generationBySku.get(row.sku) || {};
  const shouldCreateDraft = row.woo_status === "not_found";
  const item = {
    sku: row.sku,
    product_type: row.product_type,
    target_site: row.target_site,
    product_name: row.wp_product_name || generation.product_name || "",
    category: row.wp_category || generation.category || "",
    subcategory: row.wp_subcategory || generation.subcategory || "",
    reference_strategy: generation.reference_lookup_strategy || "",
    reference_url: generation.reference_url || "",
    reference_parent_folder_id: generation.reference_parent_folder_id || "",
    reference_lookup_key: generation.reference_lookup_key || "",
    generation_status: generation.generation_status || "",
    woo_status: row.woo_status,
    woo_product_ids: row.woo_product_ids || "",
    dry_run_action: shouldCreateDraft
      ? "dry-run: generate hero/support, LINE QC, then create product draft after approval"
      : "dry-run: skip generation/publish and mark completed because SKU exists",
    prompt_quality: process.env.AI_GENERATION_DEFAULT_QUALITY || "low",
    model: process.env.AI_IMAGE_MODEL || "openai/gpt-image-2/edit",
    prompt_framework_version: PROMPT_FRAMEWORK_VERSION
  };
  const supportShots = getSupportShots(item);
  return {
    ...item,
    support_shots: supportShots.join("|"),
    hero_prompt: buildHeroPromptV2(item),
    support_prompt_preview: buildSupportPromptV2(item, supportShots[0], 1, supportShots.length)
  };
}

const saleCandidates = auditRows.filter((row) => row.product_type === "sale" && isActionable(row));
const rentalCandidates = auditRows.filter((row) => row.product_type === "rental" && isActionable(row));

const items = [];
let saleIndex = 0;
let rentalIndex = 0;
while (items.length < batchSize && (saleIndex < saleCandidates.length || rentalIndex < rentalCandidates.length)) {
  if (rentalIndex < rentalCandidates.length) items.push(buildItem(rentalCandidates[rentalIndex++]));
  if (items.length >= batchSize) break;
  if (saleIndex < saleCandidates.length) items.push(buildItem(saleCandidates[saleIndex++]));
}

const batch = {
  batch_id: `dry-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
  dry_run: dryRun,
  created_at: new Date().toISOString(),
  batch_size: items.length,
  selection: {
    requested_size: batchSize,
    sale_candidates: saleCandidates.length,
    rental_candidates: rentalCandidates.length,
    note: "Alternates rental/sale when both are actionable. Sale rows without reference images are excluded until a sale reference source is added."
  },
  items
};

fs.mkdirSync(outputsDir, { recursive: true });
fs.writeFileSync(path.join(outputsDir, "pilot-batch-dry-run.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
writeCsvObjects(path.join(outputsDir, "pilot-batch-dry-run.csv"), items);

console.log(`Created ${batch.batch_id}`);
console.log(`Items: ${items.length}`);
console.log(`Rental candidates: ${rentalCandidates.length}`);
console.log(`Sale candidates: ${saleCandidates.length}`);
console.log(path.join(outputsDir, "pilot-batch-dry-run.json"));
