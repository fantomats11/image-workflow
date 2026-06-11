const GENERATED_HINT = /\b(generated|output|hero|support|edited|ai|render)\b/i;
const LABEL_HINT = /\b(label|tag|barcode|sku|scan|ป้าย|บาร์โค้ด)\b/i;
const NOISE_HINT = /\b(floor|blur|hand|shelf|bag|noise|พื้น|มือ|ถุง|เบลอ)\b/i;

export function classifyReferenceAsset(asset = {}, { sku = "" } = {}) {
  const text = [asset.path, asset.name, asset.ocrText].filter(Boolean).join(" ");
  const detectedSku = detectSku(text, sku);
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const lowResolution = Boolean(width && height && (width < 600 || height < 600));

  if (GENERATED_HINT.test(text)) {
    return buildClassification(asset, "generated_candidate", detectedSku, 0.9, false, "Generated/output filename or path hint.");
  }

  if (LABEL_HINT.test(text) || looksLikeSkuLabelOnly(asset.ocrText || "")) {
    return buildClassification(asset, "label_or_tag", detectedSku, detectedSku ? 0.95 : 0.8, false, "Label, tag, barcode, or SKU scan evidence.");
  }

  if (NOISE_HINT.test(text) || lowResolution) {
    return buildClassification(asset, "staff_noise", detectedSku, 0.85, false, "Likely staff noise, blurry/small image, or unrelated environment.");
  }

  if (detectedSku) {
    return buildClassification(asset, "product_reference", detectedSku, 0.9, true, "Likely real product photo suitable for product truth.");
  }

  return buildClassification(asset, "ambiguous", detectedSku, 0.5, false, "Insufficient evidence for automatic reference use.");
}

export function classifyReferenceAssets(assets = [], context = {}) {
  const assetsWithClassification = assets.map((asset) => ({
    ...asset,
    classification: classifyReferenceAsset(asset, context)
  }));
  const summary = assetsWithClassification.reduce((counts, asset) => {
    const type = asset.classification.asset_type;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {
    product_reference: 0,
    label_or_tag: 0,
    generated_candidate: 0,
    staff_noise: 0,
    ambiguous: 0
  });
  return { assets: assetsWithClassification, summary };
}

export function detectSku(text = "", expectedSku = "") {
  const normalizedText = String(text || "");
  if (expectedSku && normalizedText.toLowerCase().includes(String(expectedSku).toLowerCase())) return expectedSku;
  const hyphenatedMatch = [...normalizedText.matchAll(/\b[A-Z0-9]{1,8}(?:-[A-Z0-9]{2,})+\b/gi)]
    .find((match) => /\d/.test(match[0]));
  const match = hyphenatedMatch || normalizedText.match(/\b[A-Z]{1,4}[0-9][A-Z0-9-]{3,}\b/i);
  return match ? match[0].toUpperCase() : "";
}

function looksLikeSkuLabelOnly(ocrText = "") {
  const normalized = String(ocrText || "").toLowerCase();
  return Boolean(normalized.match(/\bsku\b|barcode|ราคา|size|ไซซ์|รหัส/));
}

function buildClassification(asset, assetType, skuDetected, confidence, useAsReference, reason) {
  return {
    asset_id: asset.id || "",
    asset_type: assetType,
    sku_detected: skuDetected || "",
    confidence,
    use_as_reference: useAsReference,
    reason,
    needs_review: assetType === "ambiguous" || confidence < 0.7
  };
}
