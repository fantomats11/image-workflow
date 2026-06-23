export function buildApprovedHeroAnchor({
  generation = {},
  asset = {},
  approval = {},
  sku = "",
  source = "",
  actorId = "",
  approvedAt = null
} = {}) {
  const assetId = asset.id || asset.asset_id || generation.image_asset_id || null;
  const publicUrl = asset.public_url || asset.url || asset.source_url || "";
  const storageKey = asset.storage_key || "";
  const localPath = asset.local_path || (asset.bucket === "local" ? storageKey : "");
  const resolvedApprovedAt = approval.approved_at || approvedAt || new Date().toISOString();

  return compactObject({
    source_role: "approved_hero_anchor",
    source,
    id: assetId,
    asset_id: assetId,
    generation_id: generation.id || approval.generation_id || null,
    job_id: generation.job_id || asset.job_id || null,
    sku: String(sku || asset.sku || generation.sku || "").trim(),
    type: asset.type || "hero_generated",
    kind: asset.kind || generation.kind || "hero",
    shot_key: asset.shot_key || "hero",
    status: "approved",
    approved: true,
    approval_id: approval.id || null,
    approved_by: approval.approved_by || actorId || null,
    approved_at: resolvedApprovedAt,
    public_url: publicUrl,
    url: publicUrl,
    source_url: publicUrl || storageKey,
    storage_key: storageKey,
    bucket: asset.bucket || "",
    local_path: localPath,
    file_name: asset.file_name || "",
    file_size: Number(asset.file_size || 0),
    sha256: asset.sha256 || "",
    staging_status: localPath ? "staged_local_file" : publicUrl || storageKey ? "remote_only" : "missing_source"
  });
}

export function mergeApprovedHeroAnchorMetadata(metadata = {}, anchor = null, {
  actionSource = "web_review_page",
  actorId = "",
  generationId = "",
  action = "approve_hero",
  recordedAt = new Date().toISOString()
} = {}) {
  const base = isPlainObject(metadata) ? metadata : {};
  const actionKey = actionSource === "line" ? "line_action" : "web_review_action";
  const next = {
    ...base,
    [actionKey]: {
      ...(isPlainObject(base[actionKey]) ? base[actionKey] : {}),
      source: actionSource,
      last_action: action,
      action,
      actor_id: actorId || null,
      generation_id: generationId || anchor?.generation_id || null,
      recorded_at: recordedAt
    }
  };

  if (!anchor) return next;

  return {
    ...next,
    approved_hero_anchor: anchor,
    hero_review_status: "approved",
    approved_hero_anchor_recorded_at: recordedAt,
    hero_review_hero_asset: {
      ...(isPlainObject(base.hero_review_hero_asset) ? base.hero_review_hero_asset : {}),
      id: anchor.asset_id || anchor.id || null,
      asset_id: anchor.asset_id || anchor.id || null,
      generation_id: anchor.generation_id || generationId || null,
      job_id: anchor.job_id || null,
      type: anchor.type || "hero_generated",
      kind: anchor.kind || "hero",
      shot_key: anchor.shot_key || "hero",
      status: "approved",
      approved: true,
      approval_id: anchor.approval_id || null,
      approved_at: anchor.approved_at || null,
      public_url: anchor.public_url || anchor.url || "",
      url: anchor.url || anchor.public_url || "",
      source_url: anchor.source_url || anchor.url || anchor.public_url || "",
      storage_key: anchor.storage_key || "",
      bucket: anchor.bucket || "",
      local_path: anchor.local_path || "",
      file_name: anchor.file_name || "",
      file_size: anchor.file_size || 0,
      sha256: anchor.sha256 || ""
    }
  };
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
