export const LIVE_GENERATION_PERSISTENCE_MANIFEST = "live_generation_persistence";

export async function persistLiveGenerationExecution({
  supabaseAdmin,
  execution = {},
  generationPlan = {},
  batch = {},
  actorId = "",
  dryRun = true,
  now = new Date()
} = {}) {
  const plan = buildLiveGenerationPersistencePlan({
    execution,
    generationPlan,
    batch,
    actorId,
    dryRun,
    now
  });

  if (dryRun) return plan;
  if (!supabaseAdmin?.from) throw new Error("supabaseAdmin client is required for persistence.");
  if (!actorId) throw new Error("actorId is required for live generation persistence.");
  if (plan.blockers.length) return { ...plan, persistence_status: "blocked" };

  const persistedItems = [];
  for (const item of plan.items) {
    if (item.persistence_status !== "ready_to_persist") {
      persistedItems.push(item);
      continue;
    }
    const persisted = await persistGeneratedAssetItem({ supabaseAdmin, item, actorId, now });
    persistedItems.push(persisted);
  }

  return finalizePersistenceResult({
    ...plan,
    dry_run: false,
    persistence_status: persistedItems.some((item) => item.persistence_status === "failed")
      ? "completed_with_failures"
      : "completed",
    items: persistedItems
  });
}

export function buildLiveGenerationPersistencePlan({
  execution = {},
  generationPlan = {},
  batch = {},
  actorId = "",
  dryRun = true,
  now = new Date()
} = {}) {
  const requestContextById = buildRequestContextById(generationPlan);
  const batchContextBySku = buildBatchContextBySku(batch);
  const items = [];
  const results = Array.isArray(execution.results) ? execution.results : [];

  for (const result of results) {
    const generatedAssets = Array.isArray(result.generated_assets) ? result.generated_assets : [];
    generatedAssets.forEach((asset, index) => {
      const requestId = result.request_id || asset.request_id || "";
      const sku = asset.sku || result.sku || "";
      const context = requestContextById.get(requestId) || batchContextBySku.get(normalizeSku(sku)) || {};
      const blockers = buildItemBlockers({ asset, result, context, actorId, dryRun });
      const resolvedSku = sku || context.sku || "";
      items.push({
        request_id: requestId,
        provider_request_id: result.provider_request_id || null,
        batch_id: execution.batch_id || generationPlan.batch_id || null,
        sku: resolvedSku,
        kind: asset.kind || result.kind || context.kind || "",
        slot: asset.slot || result.slot || context.slot || "",
        type: asset.type || (result.kind === "hero" ? "hero_generated" : "support_generated"),
        image_index: asset.image_index || index + 1,
        source_url: asset.source_url || asset.url || "",
        local_path: asset.local_path || "",
        file_name: asset.file_name || fileNameFromUrl(asset.source_url || asset.url) || `${requestId || "generated"}-${index + 1}.png`,
        mime_type: asset.mime_type || asset.contentType || "image/png",
        file_size: Number.isFinite(Number(asset.file_size)) ? Number(asset.file_size) : null,
        prompt: context.prompt || "",
        model: context.model || "openai/gpt-image-2/edit",
        product_name: context.product_name || resolvedSku,
        brand_id: context.brand_id || "",
        target_site: context.target_site || "",
        category: context.category || "",
        prompt_framework_version: context.prompt_framework_version || "",
        blockers,
        persistence_status: blockers.length ? "blocked" : dryRun ? "ready_dry_run" : "ready_to_persist"
      });
    });
  }

  const blockers = [];
  if (!items.length) blockers.push("no_generated_assets_to_persist");
  if (!dryRun && !actorId) blockers.push("missing_actor_id");

  return finalizePersistenceResult({
    manifest_type: LIVE_GENERATION_PERSISTENCE_MANIFEST,
    batch_id: execution.batch_id || generationPlan.batch_id || null,
    created_at: now.toISOString(),
    dry_run: Boolean(dryRun),
    live_write_allowed: !dryRun,
    live_writes_enabled: !dryRun,
    source_execution_status: execution.execution_status || "",
    guardrails: [
      "dry_run_by_default",
      "persist_only_generated_assets_from_execution_artifact",
      "idempotent_by_provider_request_id_and_generation_asset",
      "no_wordpress_writes"
    ],
    blockers,
    items
  });
}

async function persistGeneratedAssetItem({ supabaseAdmin, item, actorId, now }) {
  try {
    const job = await findOrCreateJob({ supabaseAdmin, item, actorId });
    const generation = await findOrCreateGeneration({ supabaseAdmin, item, job, actorId, now });
    const asset = await findOrCreateAsset({ supabaseAdmin, item, job, generation, actorId });
    await updateJobStatus({ supabaseAdmin, jobId: job.id, status: "hero_ready" });
    await recordPersistenceAudit({ supabaseAdmin, item, job, generation, asset, actorId });
    return {
      ...item,
      persistence_status: "persisted",
      job_id: job.id,
      generation_id: generation.id,
      asset_id: asset?.id || null,
      public_url: asset?.public_url || item.source_url || ""
    };
  } catch (error) {
    return {
      ...item,
      persistence_status: "failed",
      error: error?.message || String(error)
    };
  }
}

async function findOrCreateJob({ supabaseAdmin, item, actorId }) {
  const existing = await selectFirst(
    supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("sku", item.sku)
      .order("created_at", { ascending: false })
      .limit(1)
  );
  if (existing) return existing;

  const payload = {
    sku: item.sku,
    product_name: item.product_name || item.sku || "Untitled product",
    brand: item.brand_id || "",
    brand_profile: item.brand_id || "",
    category: item.category || "",
    image_type: item.kind || "hero",
    status: "hero_ready",
    form_json: buildJobFormJson(item),
    created_by: actorId
  };
  return insertSingle(supabaseAdmin.from("jobs").insert(payload).select("*").single());
}

async function findOrCreateGeneration({ supabaseAdmin, item, job, actorId, now }) {
  if (item.provider_request_id) {
    const existing = await maybeSingle(
      supabaseAdmin
        .from("generations")
        .select("*")
        .eq("request_id", item.provider_request_id)
    );
    if (existing) return existing;
  }

  const payload = {
    job_id: job.id,
    kind: item.kind || "hero",
    prompt: item.prompt || "",
    model: item.model || "openai/gpt-image-2/edit",
    request_id: item.provider_request_id || null,
    status: "done",
    completed_at: now.toISOString(),
    created_by: actorId,
    error_message: null
  };
  return insertSingle(supabaseAdmin.from("generations").insert(payload).select("*").single());
}

async function findOrCreateAsset({ supabaseAdmin, item, job, generation, actorId }) {
  if (generation.image_asset_id) {
    const existingByGeneration = await maybeSingle(
      supabaseAdmin
        .from("assets")
        .select("*")
        .eq("id", generation.image_asset_id)
    );
    if (existingByGeneration) return existingByGeneration;
  }

  const existing = await selectFirst(
    supabaseAdmin
      .from("assets")
      .select("*")
      .eq("job_id", job.id)
      .eq("type", item.type)
      .eq("storage_key", item.source_url || item.local_path || "")
      .order("created_at", { ascending: false })
      .limit(1)
  );
  if (existing) {
    await updateGenerationAssetId({ supabaseAdmin, generationId: generation.id, assetId: existing.id });
    return existing;
  }

  const payload = {
    job_id: job.id,
    type: item.type,
    bucket: "remote_url",
    storage_key: item.source_url || item.local_path || "",
    public_url: item.source_url || "",
    file_name: item.file_name || "",
    mime_type: item.mime_type || null,
    file_size: item.file_size,
    created_by: actorId
  };
  const asset = await insertSingle(supabaseAdmin.from("assets").insert(payload).select("*").single());
  await updateGenerationAssetId({ supabaseAdmin, generationId: generation.id, assetId: asset.id });
  return asset;
}

async function updateJobStatus({ supabaseAdmin, jobId, status }) {
  const { error } = await supabaseAdmin
    .from("jobs")
    .update({ status })
    .eq("id", jobId);
  if (error) throw error;
}

async function updateGenerationAssetId({ supabaseAdmin, generationId, assetId }) {
  if (!generationId || !assetId) return;
  const { error } = await supabaseAdmin
    .from("generations")
    .update({ image_asset_id: assetId })
    .eq("id", generationId);
  if (error) throw error;
}

async function recordPersistenceAudit({ supabaseAdmin, item, job, generation, asset, actorId }) {
  const payload = {
    actor_id: actorId,
    job_id: job.id,
    generation_id: generation.id,
    event_type: "live_generation_asset_persisted",
    event_json: {
      batch_id: item.batch_id || null,
      request_id: item.request_id || null,
      provider_request_id: item.provider_request_id || null,
      sku: item.sku || null,
      kind: item.kind || null,
      slot: item.slot || null,
      assetId: asset?.id || null,
      asset_id: asset?.id || null,
      source_url: item.source_url || null
    }
  };
  const { error } = await supabaseAdmin.from("audit_events").insert(payload);
  if (error) throw error;
}

function buildRequestContextById(generationPlan = {}) {
  const map = new Map();
  const items = Array.isArray(generationPlan.items) ? generationPlan.items : [];
  items.forEach((item) => {
    const requests = Array.isArray(item.generation_requests) ? item.generation_requests : [];
    requests.forEach((request) => {
      const requestId = request.request_id || "";
      if (!requestId) return;
      map.set(requestId, {
        ...request,
        sku: request.sku || item.sku || "",
        product_name: item.product_name || request.product_name || "",
        brand_id: item.brand_id || request.brand_id || "",
        target_site: item.target_site || request.target_site || "",
        category: item.category || item.subcategory || "",
        prompt_framework_version: request.prompt_framework_version || item.prompt_framework_version || ""
      });
    });
  });
  return map;
}

function buildBatchContextBySku(batch = {}) {
  const map = new Map();
  const items = Array.isArray(batch.items) ? batch.items : [];
  items.forEach((item) => {
    const sku = normalizeSku(item.sku);
    if (!sku) return;
    map.set(sku, {
      sku: item.sku || "",
      product_name: item.product_name || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      category: item.category || item.subcategory || "",
      prompt_framework_version: item.prompt_framework_version || "",
      prompt: item.hero_prompt || item.support_prompt_preview || ""
    });
  });
  return map;
}

function buildItemBlockers({ asset, result, context, actorId, dryRun }) {
  const blockers = [];
  if (result.execution_status !== "done") blockers.push("source_result_not_done");
  if (!asset.source_url && !asset.url) blockers.push("missing_source_url");
  if (!(asset.sku || result.sku || context.sku)) blockers.push("missing_sku");
  if (!dryRun && !actorId) blockers.push("missing_actor_id");
  return blockers;
}

function buildJobFormJson(item) {
  return {
    sku: item.sku || "",
    productName: item.product_name || "",
    brand: item.brand_id || "",
    brandProfile: item.brand_id || "",
    targetSite: item.target_site || "",
    category: item.category || "",
    imageType: item.kind || "",
    jobKind: item.kind || "",
    shot: item.slot || "",
    prompt: item.prompt || "",
    promptFrameworkVersion: item.prompt_framework_version || "",
    source: "live_generation_persistence"
  };
}

function finalizePersistenceResult(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  return {
    ...result,
    summary: {
      generated_assets_seen: items.length,
      ready_to_persist: items.filter((item) => item.persistence_status === "ready_to_persist" || item.persistence_status === "ready_dry_run").length,
      persisted: items.filter((item) => item.persistence_status === "persisted").length,
      blocked: items.filter((item) => item.persistence_status === "blocked").length,
      failed: items.filter((item) => item.persistence_status === "failed").length,
      blockers: Array.isArray(result.blockers) ? result.blockers.length : 0
    }
  };
}

async function selectFirst(query) {
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insertSingle(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function fileNameFromUrl(value = "") {
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "";
  } catch {
    return "";
  }
}

function normalizeSku(value = "") {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
