import { buildMediaAssetManifest } from "./media-asset-manifest.mjs";

export async function buildSupabaseMediaAssetManifestForBatch({
  supabaseAdmin,
  batch = {},
  batchItems = []
} = {}) {
  if (!supabaseAdmin?.from) throw new Error("supabaseAdmin client is required.");
  const items = Array.isArray(batchItems) && batchItems.length
    ? batchItems
    : Array.isArray(batch.items)
      ? batch.items
      : [];
  const skus = items.map((item) => String(item.sku || "").trim()).filter(Boolean);
  if (!skus.length) {
    return buildMediaAssetManifest({
      batch: { batch_id: batch.batch_id || null, items: [] }
    });
  }

  const sourceRows = await readSupabaseMediaRowsForSkus({ supabaseAdmin, skus });
  return buildMediaAssetManifest({
    batch: {
      batch_id: batch.batch_id || null,
      items: items.map(compactBatchItemForManifest)
    },
    assets: sourceRows.assets,
    jobs: sourceRows.jobs,
    generations: sourceRows.generations,
    approvals: sourceRows.approvals
  });
}

export async function readSupabaseMediaRowsForSkus({ supabaseAdmin, skus = [] } = {}) {
  if (!supabaseAdmin?.from) throw new Error("supabaseAdmin client is required.");
  const normalizedSkus = Array.from(new Set(skus.map((sku) => String(sku || "").trim()).filter(Boolean)));
  if (!normalizedSkus.length) return { assets: [], jobs: [], generations: [], approvals: [] };

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("jobs")
    .select("id, sku, product_name, status, form_json, created_at")
    .in("sku", normalizedSkus)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (jobsError) throw jobsError;

  const jobIds = (jobs || []).map((job) => job.id).filter(Boolean);
  if (!jobIds.length) return { assets: [], jobs: jobs || [], generations: [], approvals: [] };

  const [assetsResult, generationsResult] = await Promise.all([
    supabaseAdmin
      .from("assets")
      .select("id, job_id, type, bucket, storage_key, public_url, file_name, mime_type, file_size, created_at")
      .in("job_id", jobIds)
      .in("type", ["hero_generated", "studio_master_generated", "support_generated", "approved_export"])
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("generations")
      .select("id, job_id, kind, status, image_asset_id, completed_at, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false })
      .limit(2000)
  ]);
  if (assetsResult.error) throw assetsResult.error;
  if (generationsResult.error) throw generationsResult.error;

  const generationIds = (generationsResult.data || []).map((generation) => generation.id).filter(Boolean);
  const approvals = generationIds.length
    ? await readApprovalsForGenerations({ supabaseAdmin, generationIds })
    : [];

  return {
    assets: attachGenerationIdsToAssets({
      assets: assetsResult.data || [],
      generations: generationsResult.data || []
    }),
    jobs: jobs || [],
    generations: generationsResult.data || [],
    approvals
  };
}

function attachGenerationIdsToAssets({ assets = [], generations = [] } = {}) {
  const generationIdByAssetId = new Map(
    generations
      .filter((generation) => generation.image_asset_id)
      .map((generation) => [String(generation.image_asset_id), generation.id])
  );
  return assets.map((asset) => ({
    ...asset,
    generation_id: asset.generation_id || generationIdByAssetId.get(String(asset.id || "")) || null
  }));
}

async function readApprovalsForGenerations({ supabaseAdmin, generationIds }) {
  const { data, error } = await supabaseAdmin
    .from("approvals")
    .select("id, generation_id, approved_at, export_path, note")
    .in("generation_id", generationIds)
    .order("approved_at", { ascending: false })
    .limit(2000);
  if (error) {
    console.warn(`Approvals unavailable for media manifest: ${error.message}`);
    return [];
  }
  return data || [];
}

function compactBatchItemForManifest(item = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const promptJson = isPlainObject(item.prompt_json) ? item.prompt_json : {};
  const metadataPromptJson = isPlainObject(metadata.prompt_json) ? metadata.prompt_json : {};
  return {
    sku: item.sku || metadata.sku || "",
    brand_id: item.brand_id || metadata.brand_id || metadata.reference_brand_id || "",
    target_site: item.target_site || metadata.target_site || metadata.reference_target_site || "",
    product_name: item.product_name || metadata.product_name || "",
    support_shots: promptJson.support_shots || metadataPromptJson.support_shots || metadata.support_shots || ""
  };
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
