export const DUAL_EXPORT_GATEWAY = "dual_export_gateway";

export function buildDualExportGatewayPlan({
  sku = "",
  productName = "",
  brandId = "",
  targetSite = "",
  approvedAssets = [],
  existingDriveExports = [],
  now = new Date()
} = {}) {
  const normalizedSku = normalizeSku(sku);
  const approved = approvedAssets.map(normalizeApprovedAsset).filter((asset) => asset.approved);
  const excludedUnapproved = approvedAssets.length - approved.length;
  const slots = buildMediaSlots({ sku: normalizedSku, assets: approved });
  const existingByKey = new Map(existingDriveExports.map((item) => [String(item.idempotency_key || ""), item]));
  const files = slots.map((slot) => {
    const idempotencyKey = buildDriveIdempotencyKey({ sku: normalizedSku, position: slot.position, shotKey: slot.shot_key, assetId: slot.source_asset_id });
    const existing = existingByKey.get(idempotencyKey);
    return {
      sku: normalizedSku,
      role: slot.role,
      position: slot.position,
      shot_key: slot.shot_key,
      source_asset_id: slot.source_asset_id,
      source_url: slot.public_url,
      storage_key: slot.storage_key,
      file_name: buildDriveArchiveFileName({ sku: normalizedSku, position: slot.position, shotKey: slot.shot_key, extension: slot.extension }),
      idempotency_key: idempotencyKey,
      export_status: existing ? "already_exported" : "ready_for_upload",
      drive_file_id: existing?.drive_file_id || existing?.id || null,
      web_view_link: existing?.web_view_link || existing?.webViewLink || ""
    };
  });

  return {
    gateway_type: DUAL_EXPORT_GATEWAY,
    version: "dual-export-gateway-v1.0",
    created_at: now.toISOString(),
    sku: normalizedSku,
    brand_id: brandId || "",
    target_site: targetSite || "",
    dry_run: true,
    live_write_allowed: false,
    wordpress_live_write_allowed: false,
    wordpress_media_attach_allowed: false,
    requires_final_confirmation: true,
    drive_archive: {
      folder_name: buildDriveArchiveFolderName({ sku: normalizedSku, productName }),
      upload_method: "google_drive_api_files_create",
      files
    },
    media_manifest: {
      sku: normalizedSku,
      slots
    },
    summary: {
      approved_asset_count: approved.length,
      excluded_unapproved_assets: excludedUnapproved,
      slot_count: slots.length,
      drive_upload_ready: files.filter((file) => file.export_status === "ready_for_upload").length,
      drive_already_exported: files.filter((file) => file.export_status === "already_exported").length,
      hero_slots: slots.filter((slot) => slot.role === "main_image").length,
      support_slots: slots.filter((slot) => slot.role === "gallery_image").length
    },
    guardrails: [
      "approved_assets_only",
      "hero_position_0_support_gallery_positions_after",
      "drive_archive_idempotency_key_required",
      "woocommerce_preflight_only_no_live_write_without_final_confirmation"
    ]
  };
}

export function buildMediaSlots({ sku = "", assets = [] } = {}) {
  const normalizedSku = normalizeSku(sku);
  const normalizedAssets = assets.map(normalizeApprovedAsset).filter((asset) => asset.approved);
  const hero = normalizedAssets.filter(isHeroAsset).sort(compareApprovedAssetOrder)[0] || null;
  const supports = normalizedAssets.filter((asset) => !isHeroAsset(asset)).sort(compareApprovedAssetOrder);
  return [
    hero ? toMediaSlot({ sku: normalizedSku, asset: hero, role: "main_image", position: 0, shotKey: "hero" }) : null,
    ...supports.map((asset, index) => toMediaSlot({
      sku: normalizedSku,
      asset,
      role: "gallery_image",
      position: index + 1,
      shotKey: asset.shot_key || `support_${index + 1}`
    }))
  ].filter(Boolean);
}

export function buildDriveArchiveFileName({ sku = "", position = 0, shotKey = "", extension = "png" } = {}) {
  const label = position === 0 ? "Hero" : sanitizeSegment(shotKey || `Support_${position}`);
  return `${normalizeSku(sku)}_${String(position).padStart(2, "0")}_${label}.${sanitizeExtension(extension)}`;
}

export function buildDriveArchiveFolderName({ sku = "", productName = "" } = {}) {
  return [normalizeSku(sku), sanitizeSegment(productName)].filter(Boolean).join("_");
}

function toMediaSlot({ sku, asset, role, position, shotKey }) {
  return {
    sku,
    role,
    position,
    shot_key: role === "main_image" ? "hero" : shotKey,
    asset_id: asset.id,
    source_asset_id: asset.id,
    source_generation_id: asset.generation_id || null,
    approval_id: asset.approval_id || null,
    public_url: asset.public_url,
    storage_key: asset.storage_key,
    drive_export_id: asset.drive_export_id || null,
    file_name: asset.file_name,
    extension: fileExtension(asset.file_name || asset.public_url || asset.storage_key) || "png",
    approved_at: asset.approved_at || null
  };
}

function normalizeApprovedAsset(asset = {}) {
  const status = String(asset.status || asset.approval_status || "").toLowerCase();
  const type = String(asset.type || asset.kind || "").trim();
  return {
    id: asset.id || asset.asset_id || null,
    generation_id: asset.generation_id || null,
    approval_id: asset.approval_id || null,
    type,
    shot_key: String(asset.shot_key || asset.slot || asset.shotType || asset.shot_type || "").trim(),
    status,
    approved: status === "approved" || type === "approved_export" || Boolean(asset.approval_id || asset.approved_at),
    public_url: asset.public_url || asset.url || asset.image_url || "",
    storage_key: asset.storage_key || "",
    drive_export_id: asset.drive_export_id || asset.google_drive_file_id || null,
    file_name: asset.file_name || fileNameFromUrl(asset.public_url || asset.url || asset.storage_key || ""),
    approved_at: asset.approved_at || ""
  };
}

function compareApprovedAssetOrder(left, right) {
  return Number(isHeroAsset(right)) - Number(isHeroAsset(left)) ||
    new Date(left.approved_at || 0) - new Date(right.approved_at || 0) ||
    String(left.shot_key || "").localeCompare(String(right.shot_key || ""), "en");
}

function isHeroAsset(asset = {}) {
  return /hero|main/i.test(`${asset.type || ""} ${asset.shot_key || ""}`);
}

function buildDriveIdempotencyKey({ sku, position, shotKey, assetId }) {
  return `drive_archive:${normalizeSku(sku)}:${position}:${normalizeKey(position === 0 ? "hero" : shotKey)}:${assetId || "asset"}`;
}

function normalizeSku(value = "") {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function normalizeKey(value = "") {
  return sanitizeSegment(value).toLowerCase() || "asset";
}

function sanitizeSegment(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeExtension(value = "") {
  return /^[a-z0-9]{2,5}$/i.test(value) ? value.toLowerCase() : "png";
}

function fileExtension(value = "") {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const extension = clean.includes(".") ? clean.split(".").pop() : "";
  return sanitizeExtension(extension);
}

function fileNameFromUrl(url = "") {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}
