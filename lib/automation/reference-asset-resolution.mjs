import { classifyReferenceAssets } from "./asset-classifier.mjs";
import { extractDriveIdFromUrl } from "./product-catalog-sheet-refresh.mjs";

export const REFERENCE_ASSET_RESOLUTION_TASK = "reference_asset_resolution";

const IMAGE_MIME_PREFIX = "image/";
const MAX_SELECTED_REFERENCES = 6;

export function buildReferenceAssetResolution({
  batch = {},
  batchItems = [],
  filesByFolderId = {},
  now = new Date()
} = {}) {
  const items = batchItems.map((item, index) => buildResolutionItem({
    item,
    index,
    files: filesByFolderId[extractReferenceFolderId(item)] || []
  }));

  return {
    manifest_type: REFERENCE_ASSET_RESOLUTION_TASK,
    batch_id: batch.batch_id || null,
    dry_run: true,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    proposed_execution_scope: "google_drive_reference_file_resolution",
    guardrails: [
      "read_only_google_drive_listing",
      "do_not_use_label_or_tag_as_visual_truth",
      "do_not_use_generated_candidate_as_product_truth",
      "review_ambiguous_or_noise_only_folders_before_generation",
      "model_input_staging_required_before_live_generation"
    ],
    summary: summarizeItems(items),
    items
  };
}

function buildResolutionItem({ item = {}, index = 0, files = [] }) {
  const sku = String(readField(item, "sku") || "").trim();
  const folderId = extractReferenceFolderId(item);
  const normalizedFiles = files.map((file) => normalizeDriveFile(file, { sku, folderId })).filter((file) => file.id);
  const imageFiles = normalizedFiles.filter((file) => String(file.mimeType || "").startsWith(IMAGE_MIME_PREFIX));
  const classified = classifyReferenceAssets(imageFiles, { sku });
  const selectedReferenceAssets = classified.assets
    .filter((asset) => asset.classification.use_as_reference)
    .sort(compareReferenceAssetPriority)
    .slice(0, MAX_SELECTED_REFERENCES)
    .map(toResolvedReferenceAsset);
  const blockers = [];

  if (!sku) blockers.push("missing_sku");
  if (!folderId) blockers.push("missing_reference_folder_id");
  if (!normalizedFiles.length && folderId) blockers.push("empty_or_unreadable_reference_folder");
  if (!imageFiles.length && normalizedFiles.length) blockers.push("no_image_files_in_reference_folder");
  if (!selectedReferenceAssets.length && imageFiles.length) blockers.push("no_auto_usable_product_reference");

  const resolutionStatus = blockers.length
    ? "needs_reference_review"
    : "resolved_reference_files";

  return {
    batch_item_id: item.id || `local-${index + 1}`,
    sku,
    brand_id: readField(item, "brand_id") || "",
    target_site: readField(item, "target_site") || "",
    product_name: readField(item, "product_name") || "",
    reference_url: readField(item, "reference_url") || "",
    reference_folder_id: folderId,
    resolution_status: resolutionStatus,
    proposed_action: resolutionStatus === "resolved_reference_files"
      ? "stage_selected_reference_files_before_live_generation"
      : "review_reference_folder_before_generation",
    blockers,
    file_count: normalizedFiles.length,
    image_file_count: imageFiles.length,
    selected_reference_count: selectedReferenceAssets.length,
    classification_summary: classified.summary,
    selected_reference_assets: selectedReferenceAssets,
    assets: classified.assets.map((asset) => ({
      ...toCompactDriveAsset(asset),
      classification: asset.classification
    }))
  };
}

function summarizeItems(items) {
  return {
    sku_count: items.length,
    resolved_reference_files: items.filter((item) => item.resolution_status === "resolved_reference_files").length,
    needs_reference_review: items.filter((item) => item.resolution_status === "needs_reference_review").length,
    folders_with_images: items.filter((item) => item.image_file_count > 0).length,
    selected_reference_assets: items.reduce((total, item) => total + item.selected_reference_count, 0),
    product_reference: sumClassification(items, "product_reference"),
    label_or_tag: sumClassification(items, "label_or_tag"),
    generated_candidate: sumClassification(items, "generated_candidate"),
    staff_noise: sumClassification(items, "staff_noise"),
    ambiguous: sumClassification(items, "ambiguous")
  };
}

function normalizeDriveFile(file = {}, { sku = "", folderId = "" } = {}) {
  const width = file.width || file.imageMediaMetadata?.width || 0;
  const height = file.height || file.imageMediaMetadata?.height || 0;
  return {
    id: String(file.id || "").trim(),
    drive_file_id: String(file.id || "").trim(),
    folder_id: folderId,
    sku,
    name: String(file.name || "").trim(),
    path: [sku, file.name].filter(Boolean).join("/"),
    mimeType: file.mimeType || "",
    width: Number(width || 0),
    height: Number(height || 0),
    size: file.size || "",
    webViewLink: file.webViewLink || "",
    webContentLink: file.webContentLink || "",
    thumbnailLink: file.thumbnailLink || "",
    createdTime: file.createdTime || "",
    modifiedTime: file.modifiedTime || ""
  };
}

function toResolvedReferenceAsset(asset) {
  return {
    id: asset.id,
    drive_file_id: asset.drive_file_id,
    sku: asset.sku,
    name: asset.name,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    webViewLink: asset.webViewLink,
    webContentLink: asset.webContentLink,
    thumbnailLink: asset.thumbnailLink,
    classification: asset.classification,
    model_input_status: "needs_download_or_signed_staging"
  };
}

function toCompactDriveAsset(asset) {
  return {
    id: asset.id,
    drive_file_id: asset.drive_file_id,
    sku: asset.sku,
    name: asset.name,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    webViewLink: asset.webViewLink,
    thumbnailLink: asset.thumbnailLink
  };
}

function compareReferenceAssetPriority(a, b) {
  return referenceAssetScore(b) - referenceAssetScore(a);
}

function referenceAssetScore(asset) {
  let score = 0;
  if (asset.classification.asset_type === "product_reference") score += 100;
  if (asset.classification.sku_detected) score += 20;
  if (asset.width && asset.height) score += Math.min(20, Math.round((asset.width * asset.height) / 250000));
  if (/front|หน้า/i.test(asset.name)) score += 8;
  if (/back|หลัง/i.test(asset.name)) score += 5;
  if (/side|ข้าง/i.test(asset.name)) score += 4;
  return score;
}

function sumClassification(items, type) {
  return items.reduce((total, item) => total + Number(item.classification_summary?.[type] || 0), 0);
}

function extractReferenceFolderId(item = {}) {
  return readField(item, "reference_drive_id") || extractDriveIdFromUrl(readField(item, "reference_url"));
}

function readField(item = {}, field) {
  if (item[field] !== undefined && item[field] !== null && item[field] !== "") return item[field];
  if (item.prompt_json?.[field] !== undefined && item.prompt_json[field] !== null && item.prompt_json[field] !== "") return item.prompt_json[field];
  if (item.metadata?.[field] !== undefined && item.metadata[field] !== null && item.metadata[field] !== "") return item.metadata[field];
  if (item.metadata?.prompt_json?.[field] !== undefined && item.metadata.prompt_json[field] !== null && item.metadata.prompt_json[field] !== "") {
    return item.metadata.prompt_json[field];
  }
  return "";
}
