export const WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK = "wordpress_media_mapping_preflight";

const DEFAULT_REQUIRED_SUPPORT_COUNT = 2;

export function buildWordPressMediaMappingPreflight({
  task = {},
  batchItems = [],
  productPreflight = null,
  mediaAssets = [],
  dryRun = true,
  now = new Date()
} = {}) {
  const productItemsBySku = buildProductPreflightIndex(productPreflight);
  const mediaAssetsBySku = buildMediaAssetIndex(mediaAssets);
  const items = batchItems.map((item) => buildMediaPreflightItem({
    item,
    productItem: productItemsBySku.get(normalizeSku(item.sku)),
    mediaAssets: mediaAssetsBySku.get(normalizeSku(item.sku)) || []
  }));
  const readyItems = items.filter((item) => item.media_status === "ready_for_media_proposal");
  const waitingItems = items.filter((item) => item.media_status === "awaiting_media_assets");
  const blockedItems = items.filter((item) => item.media_status === "blocked");
  const missingHeroItems = items.filter((item) => item.blockers.includes("missing_hero_media"));
  const missingSupportItems = items.filter((item) => item.blockers.includes("missing_support_media"));
  const productBlockedItems = items.filter((item) => item.blockers.includes("product_preflight_blocked"));

  return {
    task_type: WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK,
    task_id: task.id || null,
    batch_id: task.batch_id || productPreflight?.batch_id || null,
    dry_run: dryRun !== false,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    requires_final_confirmation: true,
    proposed_write_scope: "wordpress_media_upload_or_attach",
    guardrails: [
      "no_media_upload_or_attach_in_preflight",
      "map_hero_before_gallery",
      "do_not_replace_existing_gallery_without_explicit_approval",
      "reuse_existing_remote_media_when_confirmed",
      "log_every_remote_media_write"
    ],
    summary: {
      item_count: items.length,
      ready_for_media_proposal: readyItems.length,
      awaiting_media_assets: waitingItems.length,
      blocked: blockedItems.length,
      missing_hero_media: missingHeroItems.length,
      missing_support_media: missingSupportItems.length,
      product_preflight_blocked: productBlockedItems.length,
      media_assets_matched: items.reduce((total, item) => total + item.media_assets.length, 0),
      proposed_main_images: items.filter((item) => item.proposed_main_image).length,
      proposed_gallery_images: items.reduce((total, item) => total + item.proposed_gallery_images.length, 0)
    },
    items
  };
}

function buildMediaPreflightItem({ item = {}, productItem = null, mediaAssets = [] } = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const sku = String(item.sku || "").trim();
  const supportSlots = splitSupportShots(item.support_shots || item.prompt_json?.support_shots || metadata.support_shots || metadata.prompt_json?.support_shots);
  const expectedSlots = [
    { slot: "hero", required: true, role: "main_image" },
    ...supportSlots.map((shotKey, index) => ({
      slot: shotKey,
      required: index < DEFAULT_REQUIRED_SUPPORT_COUNT,
      role: "gallery_image",
      index: index + 1
    }))
  ];
  const normalizedAssets = mediaAssets.map(normalizeMediaAsset).filter((asset) => asset.url || asset.storage_key || asset.local_path);
  const heroAsset = chooseHeroAsset(normalizedAssets);
  const supportAssets = chooseSupportAssets(normalizedAssets, supportSlots);
  const blockers = [];

  if (!sku) blockers.push("missing_sku");
  if (!productItem) blockers.push("missing_product_preflight");
  if (productItem && productItem.preflight_status !== "ready_for_proposal") blockers.push("product_preflight_blocked");
  if (!heroAsset) blockers.push("missing_hero_media");
  if (supportSlots.length && supportAssets.length < Math.min(DEFAULT_REQUIRED_SUPPORT_COUNT, supportSlots.length)) {
    blockers.push("missing_support_media");
  }

  const mediaStatus = blockers.includes("missing_sku") || blockers.includes("missing_product_preflight") || blockers.includes("product_preflight_blocked")
    ? "blocked"
    : blockers.length
      ? "awaiting_media_assets"
      : "ready_for_media_proposal";

  return {
    batch_item_id: item.id || null,
    sku,
    brand_id: metadata.brand_id || item.brand_id || productItem?.brand_id || "",
    target_site: item.target_site || metadata.target_site || productItem?.target_site || "",
    product_name: item.product_name || metadata.product_name || productItem?.product_name || "",
    product_preflight_status: productItem?.preflight_status || "",
    product_proposed_action: productItem?.proposed_action || "",
    media_status: mediaStatus,
    proposed_action: mediaStatus === "ready_for_media_proposal" ? "propose_media_attach_after_final_confirmation" : "wait_for_generated_or_approved_media",
    blockers,
    expected_slots: expectedSlots,
    media_assets: normalizedAssets.map(compactMediaAsset),
    proposed_main_image: heroAsset ? compactMediaAsset(heroAsset) : null,
    proposed_gallery_images: supportAssets.map(compactMediaAsset),
    write_policy: "no_upload_or_attach_without_final_confirmation"
  };
}

function buildProductPreflightIndex(productPreflight) {
  const map = new Map();
  const items = Array.isArray(productPreflight?.items) ? productPreflight.items : [];
  items.forEach((item) => {
    const sku = normalizeSku(item.sku);
    if (sku) map.set(sku, item);
  });
  return map;
}

function buildMediaAssetIndex(mediaAssets = []) {
  const map = new Map();
  mediaAssets.forEach((asset) => {
    const normalized = normalizeMediaAsset(asset);
    const sku = normalizeSku(normalized.sku);
    if (!sku) return;
    if (!map.has(sku)) map.set(sku, []);
    map.get(sku).push(normalized);
  });
  return map;
}

function normalizeMediaAsset(asset = {}) {
  const type = String(asset.type || asset.kind || asset.asset_type || "").trim();
  const shotKey = String(asset.shot_key || asset.shotType || asset.shot_type || asset.kind || "").trim();
  return {
    id: asset.id || asset.asset_id || null,
    sku: String(asset.sku || asset.SKU || "").trim(),
    type,
    shot_key: shotKey,
    status: String(asset.status || asset.approval_status || "").trim(),
    url: asset.url || asset.public_url || asset.image_url || asset.approved_url || "",
    storage_key: asset.storage_key || "",
    local_path: asset.local_path || asset.path || "",
    source: asset.source || ""
  };
}

function chooseHeroAsset(assets) {
  return assets
    .filter((asset) => isHeroAsset(asset))
    .sort(compareMediaPriority)[0] || null;
}

function chooseSupportAssets(assets, supportSlots) {
  const used = new Set();
  const chosen = [];
  for (const slot of supportSlots) {
    const match = assets
      .filter((asset) => !used.has(asset))
      .filter((asset) => isSupportAsset(asset))
      .filter((asset) => !slot || normalizeMediaKey(asset.shot_key) === normalizeMediaKey(slot))
      .sort(compareMediaPriority)[0];
    if (match) {
      used.add(match);
      chosen.push(match);
    }
  }
  const extras = assets
    .filter((asset) => !used.has(asset))
    .filter((asset) => isSupportAsset(asset))
    .sort(compareMediaPriority);
  return [...chosen, ...extras].slice(0, Math.max(DEFAULT_REQUIRED_SUPPORT_COUNT, supportSlots.length || DEFAULT_REQUIRED_SUPPORT_COUNT));
}

function compareMediaPriority(a, b) {
  return mediaPriority(b) - mediaPriority(a);
}

function mediaPriority(asset) {
  let score = 0;
  if (["approved", "approved_export", "ready"].includes(asset.status)) score += 20;
  if (asset.url) score += 10;
  if (asset.storage_key) score += 5;
  if (/approved/i.test(asset.type)) score += 4;
  if (/generated/i.test(asset.type)) score += 2;
  return score;
}

function isHeroAsset(asset) {
  return /hero|main/i.test(`${asset.type} ${asset.shot_key}`);
}

function isSupportAsset(asset) {
  return !isHeroAsset(asset) && /support|gallery|detail|front|back|side|texture|lining|closure|sole|scale|interior|pair/i.test(`${asset.type} ${asset.shot_key}`);
}

function splitSupportShots(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactMediaAsset(asset) {
  return {
    id: asset.id,
    sku: asset.sku,
    type: asset.type,
    shot_key: asset.shot_key,
    status: asset.status,
    url: asset.url,
    storage_key: asset.storage_key,
    local_path: asset.local_path,
    source: asset.source
  };
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function normalizeMediaKey(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
