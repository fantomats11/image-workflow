const MEDIA_TYPES = new Set(["hero_generated", "support_generated", "approved_export"]);

export function buildMediaAssetManifest({
  batch = {},
  assets = [],
  jobs = [],
  generations = [],
  approvals = [],
  now = new Date()
} = {}) {
  const batchItems = Array.isArray(batch.items) ? batch.items : [];
  const batchSkuSet = new Set(batchItems.map((item) => normalizeSku(item.sku)).filter(Boolean));
  const jobById = new Map(jobs.map((job) => [String(job.id || ""), job]).filter(([id]) => id));
  const generationById = new Map(generations.map((generation) => [String(generation.id || ""), generation]).filter(([id]) => id));
  const latestApprovalByGenerationId = latestByKey(approvals, (approval) => approval.generation_id, (approval) => approval.approved_at);
  const normalizedAssets = assets
    .map((asset) => normalizeAssetForManifest({
      asset,
      job: jobById.get(String(asset.job_id || "")),
      generation: generationById.get(String(asset.generation_id || "")),
      approval: latestApprovalByGenerationId.get(String(asset.generation_id || ""))
    }))
    .filter((asset) => asset.sku && (!batchSkuSet.size || batchSkuSet.has(normalizeSku(asset.sku))))
    .filter((asset) => MEDIA_TYPES.has(asset.type));
  const assetsBySku = groupBy(normalizedAssets, (asset) => normalizeSku(asset.sku));
  const items = batchItems.map((item) => {
    const sku = normalizeSku(item.sku);
    const itemAssets = (assetsBySku.get(sku) || []).sort(compareManifestAssetPriority);
    return {
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      expected_support_shots: splitSupportShots(item.support_shots),
      asset_count: itemAssets.length,
      hero_count: itemAssets.filter((asset) => asset.type === "hero_generated").length,
      support_count: itemAssets.filter((asset) => asset.type === "support_generated").length,
      approved_export_count: itemAssets.filter((asset) => asset.type === "approved_export").length,
      status: itemAssets.length ? "assets_found" : "no_assets_found",
      assets: itemAssets
    };
  });
  const orphanAssets = normalizedAssets.filter((asset) => !batchSkuSet.has(normalizeSku(asset.sku)));

  return {
    manifest_type: "generation_approval_asset_manifest",
    batch_id: batch.batch_id || null,
    dry_run: true,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    summary: {
      sku_count: items.length,
      sku_with_assets: items.filter((item) => item.asset_count > 0).length,
      sku_without_assets: items.filter((item) => item.asset_count === 0).length,
      asset_count: normalizedAssets.length,
      hero_generated: normalizedAssets.filter((asset) => asset.type === "hero_generated").length,
      support_generated: normalizedAssets.filter((asset) => asset.type === "support_generated").length,
      approved_export: normalizedAssets.filter((asset) => asset.type === "approved_export").length,
      orphan_assets: orphanAssets.length
    },
    items,
    assets: normalizedAssets.sort(compareManifestAssetPriority),
    orphan_assets: orphanAssets
  };
}

export function normalizeAssetForManifest({ asset = {}, job = {}, generation = {}, approval = {} } = {}) {
  const formJson = parseMaybeJson(job.form_json);
  const type = String(asset.type || "").trim();
  const generationKind = String(generation.kind || formJson.jobKind || formJson.kind || "").trim();
  const sku = asset.sku || job.sku || formJson.sku || "";
  return {
    id: asset.id || null,
    asset_id: asset.id || null,
    job_id: asset.job_id || job.id || null,
    generation_id: asset.generation_id || generation.id || approval.generation_id || null,
    approval_id: approval.id || null,
    sku: String(sku || "").trim(),
    type,
    kind: generationKind || inferKindFromAssetType(type),
    shot_key: inferShotKey({ asset, generation, formJson }),
    status: inferAssetStatus({ asset, approval }),
    url: asset.public_url || "",
    public_url: asset.public_url || "",
    storage_key: asset.storage_key || "",
    local_path: asset.bucket === "local" ? asset.storage_key || "" : "",
    file_name: asset.file_name || "",
    bucket: asset.bucket || "",
    source: inferAssetSource(asset),
    created_at: asset.created_at || null,
    approved_at: approval.approved_at || null
  };
}

function inferShotKey({ asset, generation, formJson }) {
  const direct = asset.shot_key || asset.shotType || asset.shot_type || generation.shot_key || formJson.shotType || formJson.shot || formJson.jobKind || generation.kind || "";
  const normalized = String(direct || "").trim();
  if (normalized) return normalized;
  return inferKindFromAssetType(asset.type);
}

function inferAssetStatus({ asset, approval }) {
  if (approval?.id || asset.type === "approved_export") return "approved";
  if (String(asset.type || "").includes("generated")) return "generated";
  return asset.status || "recorded";
}

function inferKindFromAssetType(type) {
  if (String(type || "").includes("hero")) return "hero";
  if (String(type || "").includes("support")) return "support";
  if (String(type || "").includes("approved")) return "approved";
  return "";
}

function inferAssetSource(asset) {
  if (asset.bucket === "google_drive") return "google_drive";
  if (asset.bucket === "remote_url") return "remote_url";
  if (asset.bucket === "local") return "local";
  if (asset.bucket) return "supabase_storage";
  return "";
}

function compareManifestAssetPriority(a, b) {
  return manifestAssetPriority(b) - manifestAssetPriority(a);
}

function manifestAssetPriority(asset) {
  let score = 0;
  if (asset.status === "approved") score += 50;
  if (asset.type === "hero_generated") score += 20;
  if (asset.type === "support_generated") score += 10;
  if (asset.url) score += 5;
  if (asset.created_at) score += Math.min(4, new Date(asset.created_at).getTime() / 10 ** 13);
  return score;
}

function latestByKey(rows, getKey, getTime) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(getKey(row) || "");
    if (!key) return;
    const current = map.get(key);
    if (!current || new Date(getTime(row) || 0) > new Date(getTime(current) || 0)) map.set(key, row);
  });
  return map;
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function splitSupportShots(value) {
  return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
