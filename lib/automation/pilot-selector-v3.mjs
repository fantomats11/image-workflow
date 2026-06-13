import { BRAND_IDS, getBrandProfile, inferBrandIdFromItem } from "./brand-profiles-v3.mjs";
import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildSupportPromptV3,
  getSupportShotsV3
} from "./prompt-framework-v3.mjs";

export function selectPilotItemsV3({
  auditRows = [],
  generationRows = [],
  skuPerBrand = 2,
  includeExistingSku = false,
  now = new Date()
} = {}) {
  const generationBySku = new Map(generationRows.map((row) => [row.sku, row]));
  const candidates = auditRows
    .filter((row) => isActionable(row, generationBySku, includeExistingSku))
    .map((row, index) => ({
      index,
      item: buildPilotItem(row, generationBySku.get(row.sku) || {})
    }))
    .sort(compareCandidateRecords)
    .map((record) => record.item);

  const brandOrder = [BRAND_IDS.RENT_A_COAT, BRAND_IDS.GO_MALL];
  const items = brandOrder.flatMap((brandId) => candidates.filter((item) => item.brand_id === brandId).slice(0, skuPerBrand));

  return {
    batch_id: `dry-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
    dry_run: true,
    created_at: now.toISOString(),
    batch_size: items.length,
    prompt_framework_version: PROMPT_FRAMEWORK_V3_VERSION,
    selection: {
      sku_per_brand: skuPerBrand,
      rent_a_coat_candidates: candidates.filter((item) => item.brand_id === BRAND_IDS.RENT_A_COAT).length,
      go_mall_candidates: candidates.filter((item) => item.brand_id === BRAND_IDS.GO_MALL).length,
      note: "Prompt Framework v3 pilot selects up to 2 SKU per brand for Rent A Coat and GO Mall only."
    },
    items
  };
}

function compareCandidateRecords(left, right) {
  return candidatePriority(right.item) - candidatePriority(left.item) || left.index - right.index;
}

function candidatePriority(item) {
  const fromProductCatalogSheet = item.reference_strategy === "product_catalog_sheet" ? 100 : 0;
  const hasBranch = item.reference_branch ? 20 : 0;
  const unprocessed = String(item.reference_sheet_process || "").toLowerCase() === "false" ? 5 : 0;
  return fromProductCatalogSheet + hasBranch + unprocessed;
}

function isActionable(row, generationBySku, includeExistingSku) {
  if (!row.sku) return false;
  if (row.automation_action !== "generate_then_publish_or_attach_after_review") return false;
  if (!includeExistingSku && row.woo_status === "found") return false;
  const generation = generationBySku.get(row.sku);
  const brandId = inferBrandIdFromItem({ ...row, ...generation });
  if (![BRAND_IDS.RENT_A_COAT, BRAND_IDS.GO_MALL].includes(brandId)) return false;
  if (!generation) return false;
  return generation.generation_status === "ready_via_drive_folder_lookup"
    ? Boolean(generation.reference_parent_folder_id && generation.reference_lookup_key)
    : generation.generation_status === "ready_via_product_catalog_sheet"
      ? /^https?:\/\//i.test(String(generation.reference_url || ""))
    : /^https?:\/\//i.test(String(generation.reference_url || ""));
}

function buildPilotItem(row, generation) {
  const merged = { ...row, ...generation };
  const brandId = inferBrandIdFromItem(merged);
  const profile = getBrandProfile(brandId);
  const shouldCreateDraft = row.woo_status === "not_found";
  const base = {
    sku: row.sku,
    brand_id: brandId,
    brand_label: profile.label,
    product_type: row.product_type,
    target_site: generation.reference_target_site || row.target_site,
    product_name: row.wp_product_name || generation.product_name || "",
    category: row.wp_category || generation.category || "",
    subcategory: row.wp_subcategory || generation.subcategory || "",
    reference_strategy: generation.reference_lookup_strategy || "",
    reference_url: generation.reference_url || "",
    reference_parent_folder_id: generation.reference_parent_folder_id || "",
    reference_lookup_key: generation.reference_lookup_key || "",
    reference_confidence: "medium",
    reference_branch: generation.reference_branch || "",
    reference_sheet_row: generation.reference_sheet_row || "",
    reference_sheet_process: generation.reference_sheet_process || "",
    generation_status: generation.generation_status || "",
    woo_status: row.woo_status,
    woo_product_ids: row.woo_product_ids || "",
    dry_run_action: shouldCreateDraft
      ? "dry-run: prepare brand-aware hero/support prompts and wait for LINE QC before any live action"
      : "dry-run: skip generation/publish and mark completed because SKU exists",
    prompt_quality: process.env.AI_GENERATION_DEFAULT_QUALITY || "low",
    model: process.env.AI_IMAGE_MODEL || "openai/gpt-image-2/edit",
    prompt_framework_version: PROMPT_FRAMEWORK_V3_VERSION
  };
  const supportShots = getSupportShotsV3(base);
  return {
    ...base,
    support_shots: supportShots.join("|"),
    hero_prompt: buildHeroPromptV3(base),
    support_prompt_preview: buildSupportPromptV3(base, supportShots[0], 1, supportShots.length)
  };
}
