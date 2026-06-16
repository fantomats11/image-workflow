export function buildHeroReviewSupportAssets({
  assets = [],
  generations = [],
  batchMetadata = {}
} = {}) {
  const assetById = new Map(
    (assets || [])
      .filter((asset) => asset?.id)
      .map((asset) => [String(asset.id), asset])
  );
  const fromGenerations = (generations || [])
    .filter((generation) => isSupportGeneration(generation))
    .map((generation) => normalizeSupportAssetFromGeneration({
      generation,
      asset: assetById.get(String(generation.image_asset_id || "")) || {}
    }))
    .filter((asset) => asset.public_url || asset.source_url || asset.url);
  const fromMetadata = collectMetadataSupportAssets(batchMetadata)
    .map(normalizeSupportAssetFromMetadata)
    .filter((asset) => asset.public_url || asset.source_url || asset.url);

  const seen = new Set();
  return [...fromGenerations, ...fromMetadata].filter((asset) => {
    const key = asset.asset_id || asset.id || asset.public_url || asset.source_url || asset.request_id || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSupportGeneration(generation = {}) {
  const kind = String(generation.kind || "").toLowerCase();
  const requestId = String(generation.request_id || "").toLowerCase();
  return kind === "support" || requestId.includes(":support:") || requestId.split(":").length >= 2 && kind !== "hero";
}

function normalizeSupportAssetFromGeneration({ generation = {}, asset = {} } = {}) {
  const sourceUrl = asset.public_url || asset.url || asset.source_url || "";
  return {
    id: asset.id || null,
    asset_id: asset.id || null,
    generation_id: generation.id || null,
    request_id: generation.request_id || null,
    kind: "support",
    slot: inferSlot(generation),
    type: asset.type || "support_generated",
    public_url: sourceUrl,
    url: sourceUrl,
    source_url: sourceUrl,
    file_name: asset.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: asset.mime_type || "",
    file_size: asset.file_size || 0,
    prompt: generation.prompt || "",
    completed_at: generation.completed_at || generation.created_at || null
  };
}

function normalizeSupportAssetFromMetadata(asset = {}) {
  const sourceUrl = asset.public_url || asset.source_url || asset.url || "";
  return {
    id: asset.id || asset.asset_id || null,
    asset_id: asset.asset_id || asset.id || null,
    generation_id: asset.generation_id || null,
    request_id: asset.request_id || null,
    kind: "support",
    slot: asset.slot || asset.shot_key || inferSlot(asset),
    type: asset.type || "support_generated",
    public_url: sourceUrl,
    url: sourceUrl,
    source_url: sourceUrl,
    file_name: asset.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: asset.mime_type || "",
    file_size: asset.file_size || 0,
    prompt: asset.prompt || "",
    completed_at: asset.completed_at || asset.created_at || null
  };
}

function collectMetadataSupportAssets(metadata = {}) {
  return [
    ...(Array.isArray(metadata.support_assets) ? metadata.support_assets : []),
    ...(Array.isArray(metadata.support_generation?.support_assets) ? metadata.support_generation.support_assets : [])
  ];
}

function inferSlot(value = {}) {
  const direct = value.slot || value.shot_key || "";
  if (direct) return direct;
  const requestId = String(value.request_id || "");
  if (!requestId) return "";
  const parts = requestId.split(":").filter(Boolean);
  if (parts.length >= 3 && parts[1] === "support") return parts[2];
  if (parts.length >= 2) return parts[1];
  return "";
}

function fileNameFromUrl(url = "") {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}
