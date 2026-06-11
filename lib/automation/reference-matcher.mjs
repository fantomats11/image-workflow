export const MATCH_THRESHOLDS = {
  auto: 0.9,
  review: 0.7
};

export function matchReferenceFolderToSku({
  sku,
  productName = "",
  folderId = "",
  folderPath = "",
  classifiedAssets = []
} = {}) {
  const normalizedSku = String(sku || "").trim();
  const normalizedSkuLower = normalizedSku.toLowerCase();
  const evidenceText = [
    folderPath,
    ...classifiedAssets.map((asset) => [asset.path, asset.name, asset.classification?.sku_detected].filter(Boolean).join(" "))
  ].join(" ").toLowerCase();

  let matchMethod = "weak_folder_grouping";
  let confidence = 0.5;

  if (normalizedSku && evidenceText.includes(normalizedSkuLower)) {
    matchMethod = "exact_sku_path_or_filename";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.95 : 0.82;
  } else if (classifiedAssets.some((asset) => asset.classification?.asset_type === "label_or_tag" && asset.classification?.sku_detected === normalizedSku)) {
    matchMethod = "ocr_sku_label";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.88 : 0.82;
  } else if (productName && evidenceText.includes(String(productName).toLowerCase())) {
    matchMethod = "product_name_path";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.76 : 0.65;
  }

  const needsReview = confidence < MATCH_THRESHOLDS.auto;
  return {
    brand: "",
    sku: normalizedSku,
    source_folder_id: folderId,
    source_path: folderPath,
    file_ids: classifiedAssets.map((asset) => asset.id || "").filter(Boolean),
    match_method: matchMethod,
    confidence,
    needs_review: needsReview,
    approved_by: "",
    approved_at: "",
    asset_manifest: classifiedAssets.map((asset) => asset.classification)
  };
}

function hasUsableProductReference(classifiedAssets = []) {
  return classifiedAssets.some((asset) => asset.classification?.asset_type === "product_reference" && asset.classification?.use_as_reference === true);
}
