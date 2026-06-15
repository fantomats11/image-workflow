export const AI_HUB_PRODUCTION_REVIEW_REGISTRATION_MANIFEST = "ai_hub_production_review_registration";

export function buildAiHubProductionReviewRegistrationPlan({
  reviewBundle = {},
  batchKey = "",
  actorId = "",
  actorEmail = "",
  reviewBaseUrl = "",
  dryRun = true,
  now = new Date()
} = {}) {
  const reviewItems = Array.isArray(reviewBundle.review_items) ? reviewBundle.review_items : [];
  const items = reviewItems.map((item) => buildRegistrationItem(item));
  const blockers = [];
  if (!items.length) blockers.push("missing_review_items");
  items.forEach((item) => {
    if (!item.sku) item.blockers.push("missing_sku");
    if (!item.hero_asset?.source_url) item.blockers.push("missing_today_hero_asset");
  });
  if (!dryRun && !actorId && !actorEmail) blockers.push("missing_actor_id_or_email");

  const resolvedBatchKey = batchKey || buildDefaultBatchKey({ items, now });
  return {
    manifest_type: AI_HUB_PRODUCTION_REVIEW_REGISTRATION_MANIFEST,
    version: "ai-hub-production-review-registration-v1.0",
    created_at: now.toISOString(),
    dry_run: Boolean(dryRun),
    live_write_allowed: !dryRun,
    source_bundle: {
      manifest_type: reviewBundle.manifest_type || "",
      version: reviewBundle.version || "",
      created_at: reviewBundle.created_at || ""
    },
    batch_key: resolvedBatchKey,
    actor: {
      actor_id: actorId || "",
      actor_email: actorEmail || ""
    },
    review_base_url: reviewBaseUrl || "",
    guardrails: [
      "register_review_state_only",
      "hero_review_gate_before_support_generation",
      "support_candidates_remain_pending_until_hero_approval",
      "no_wordpress_or_media_attach_writes",
      "human_approval_required_before_export_or_publish"
    ],
    blockers,
    items,
    summary: summarizeItems(items, blockers)
  };
}

export async function registerAiHubProductionReviewSet({
  supabaseAdmin,
  reviewBundle = {},
  batchKey = "",
  actorId = "",
  actorEmail = "",
  reviewBaseUrl = "",
  dryRun = true,
  now = new Date()
} = {}) {
  const plan = buildAiHubProductionReviewRegistrationPlan({
    reviewBundle,
    batchKey,
    actorId,
    actorEmail,
    reviewBaseUrl,
    dryRun,
    now
  });

  if (dryRun) return { ...plan, registration_status: "dry_run" };
  if (!supabaseAdmin?.from) throw new Error("supabaseAdmin client is required for AI HUB review registration.");
  if (plan.blockers.length) return { ...plan, registration_status: "blocked" };

  const actor = await resolveRegistrationActor({ supabaseAdmin, actorId, actorEmail });
  if (!actor?.id) {
    return {
      ...plan,
      registration_status: "blocked",
      blockers: [...plan.blockers, "actor_not_found"],
      summary: summarizeItems(plan.items, [...plan.blockers, "actor_not_found"])
    };
  }

  const batch = await upsertReviewBatch({ supabaseAdmin, plan, actor });
  const persistedItems = [];
  for (const item of plan.items) {
    persistedItems.push(await persistReviewItem({ supabaseAdmin, item, plan, batch, actor, now }));
  }

  return {
    ...plan,
    dry_run: false,
    live_write_allowed: true,
    registration_status: persistedItems.some((item) => item.registration_status === "failed")
      ? "completed_with_failures"
      : "completed",
    actor: {
      actor_id: actor.id,
      actor_email: actor.email || actorEmail || ""
    },
    automation_batch_id: batch.id,
    items: persistedItems,
    summary: summarizeItems(persistedItems, plan.blockers)
  };
}

function buildRegistrationItem(item = {}) {
  const heroAsset = normalizeHeroAsset(item.approved_hero_anchor, item);
  const supportAssets = (Array.isArray(item.review_assets) ? item.review_assets : [])
    .map((asset) => normalizeSupportAsset(asset, item))
    .filter((asset) => asset.source_url);
  const referenceAssets = collectHeroReferenceAssets(item);

  return {
    sku: normalizeText(item.sku),
    product_name: normalizeText(item.product_name),
    brand_id: normalizeText(item.brand_id),
    brand_label: normalizeText(item.brand_label),
    target_site: normalizeText(item.target_site),
    product_type: normalizeText(item.product_type),
    category: normalizeText(item.category || item.product_type),
    prompt_framework_version: collectPromptFrameworkVersion(item),
    hero_asset: heroAsset,
    support_assets: supportAssets,
    reference_assets: referenceAssets,
    review_url: "",
    blockers: []
  };
}

function normalizeHeroAsset(asset = {}, item = {}) {
  const sourceUrl = normalizeUrl(asset.public_url || asset.url || asset.source_url);
  return {
    request_id: `ai-hub:${normalizeText(item.sku)}:hero:${normalizeText(asset.approval_id || asset.id || "today")}`,
    provider_request_id: normalizeText(asset.provider_request_id || asset.request_id),
    kind: "hero",
    slot: "hero",
    type: "hero_generated",
    source_url: sourceUrl,
    local_path: normalizeText(asset.local_path),
    file_name: normalizeText(asset.file_name) || fileNameFromUrl(sourceUrl) || "hero.png",
    mime_type: normalizeText(asset.mime_type) || "image/png",
    file_size: finiteNumberOrNull(asset.file_size),
    prompt: normalizeText(asset.prompt),
    review_role: "today_hero_candidate"
  };
}

function normalizeSupportAsset(asset = {}, item = {}) {
  const generated = asset.generated || {};
  const sourceUrl = normalizeUrl(generated.source_url || asset.source_url || asset.public_url || asset.url);
  const slot = normalizeText(asset.slot || asset.shot_key);
  return {
    request_id: normalizeText(asset.request_id) || `ai-hub:${normalizeText(item.sku)}:${slot || "support"}`,
    provider_request_id: normalizeText(generated.provider_request_id || asset.provider_request_id),
    kind: "support",
    slot,
    type: "support_generated",
    source_url: sourceUrl,
    local_path: normalizeText(generated.local_path || asset.local_path),
    file_name: normalizeText(generated.file_name || asset.file_name) || fileNameFromUrl(sourceUrl) || `${slot || "support"}.png`,
    mime_type: normalizeText(generated.mime_type || asset.mime_type) || "image/png",
    file_size: finiteNumberOrNull(generated.file_size || asset.file_size),
    prompt: normalizeText(asset.prompt),
    review_role: "support_candidate"
  };
}

function collectHeroReferenceAssets(item = {}) {
  const candidates = [];
  for (const reviewAsset of Array.isArray(item.review_assets) ? item.review_assets : []) {
    candidates.push(...(Array.isArray(reviewAsset.reference_assets) ? reviewAsset.reference_assets : []));
    for (const input of Array.isArray(reviewAsset.model_input_files) ? reviewAsset.model_input_files : []) {
      if (input.source_role === "approved_hero_anchor") continue;
      candidates.push(input);
    }
  }

  const seen = new Set();
  return candidates
    .map(normalizeReferenceAsset)
    .filter((asset) => {
      if (!asset) return false;
      const key = asset.drive_file_id || asset.source_url || asset.file_name || asset.name || "";
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeReferenceAsset(asset = {}) {
  if (!asset || typeof asset !== "object") return null;
  const driveFileId = normalizeText(asset.drive_file_id || asset.driveFileId || "");
  const sourceUrl = normalizeUrl(asset.source_url || asset.public_url || asset.url || asset.thumbnailLink || asset.webContentLink || asset.webViewLink || "");
  const fileName = normalizeText(asset.file_name || asset.name || asset.source_name);
  if (!driveFileId && !sourceUrl && !fileName) return null;
  return {
    drive_file_id: driveFileId,
    source_url: sourceUrl,
    public_url: sourceUrl,
    file_name: fileName || "reference image",
    name: fileName || "reference image",
    source_name: normalizeText(asset.source_name) || fileName || "reference image",
    source_role: normalizeText(asset.source_role || asset.type || "product_reference"),
    type: "product_reference"
  };
}

async function resolveRegistrationActor({ supabaseAdmin, actorId = "", actorEmail = "" } = {}) {
  if (actorId) {
    const existing = await maybeSingle(
      supabaseAdmin
        .from("profiles")
        .select("id, email, role, is_active")
        .eq("id", actorId)
    );
    if (existing?.id) return existing;
  }

  if (actorEmail) {
    const existing = await maybeSingle(
      supabaseAdmin
        .from("profiles")
        .select("id, email, role, is_active")
        .eq("email", actorEmail)
    );
    if (existing?.id) return existing;
  }

  const admins = await selectRows(
    supabaseAdmin
      .from("profiles")
      .select("id, email, role, is_active")
      .eq("role", "admin")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
  );
  return admins[0] || null;
}

async function upsertReviewBatch({ supabaseAdmin, plan, actor }) {
  const { data, error } = await supabaseAdmin
    .from("automation_batches")
    .upsert(
      {
        batch_key: plan.batch_key,
        source: "ai_hub",
        status: "review_ready",
        dry_run: false,
        requested_size: plan.items.length,
        item_count: plan.items.length,
        metadata: {
          source: "ai_hub_production_review_registration",
          review_bundle_created_at: plan.source_bundle.created_at,
          prompt_framework_version: plan.items[0]?.prompt_framework_version || "",
          registered_by: actor.id,
          registered_at: plan.created_at,
          no_wordpress_writes: true,
          review_gate: "hero_only_before_support_generation"
        }
      },
      { onConflict: "batch_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function persistReviewItem({ supabaseAdmin, item, plan, batch, actor, now }) {
  try {
    if (item.blockers.length) return { ...item, registration_status: "blocked" };
    const job = await findOrCreateReviewJob({ supabaseAdmin, item, actor, now });
    const hero = await persistGeneratedCandidate({ supabaseAdmin, item, asset: item.hero_asset, job, actor, now });
    const supports = [];

    await upsertReviewBatchItem({ supabaseAdmin, item, plan, batch, job, hero, supports });
    await updateJobReviewStatus({ supabaseAdmin, job, item, now });
    await recordRegistrationAudit({ supabaseAdmin, actor, job, hero, supports, item, plan });

    return {
      ...item,
      registration_status: "persisted",
      job_id: job.id,
      hero_generation_id: hero.generation.id,
      hero_asset_id: hero.asset.id,
      support_count: supports.length,
      support_generation_ids: supports.map((entry) => entry.generation.id),
      support_asset_ids: supports.map((entry) => entry.asset.id),
      review_url: buildReviewUrl({
        reviewBaseUrl: plan.review_base_url,
        batchKey: plan.batch_key,
        sku: item.sku,
        generationId: hero.generation.id,
        assetId: hero.asset.id
      })
    };
  } catch (error) {
    return {
      ...item,
      registration_status: "failed",
      error: error?.message || String(error)
    };
  }
}

async function findOrCreateReviewJob({ supabaseAdmin, item, actor, now }) {
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
    product_name: item.product_name || item.sku,
    brand: item.brand_id || item.brand_label || "",
    brand_profile: item.brand_id || "",
    category: item.category || item.product_type || "",
    image_type: "product_image_set",
    status: "hero_ready",
    form_json: buildJobFormJson(item, now),
    created_by: actor.id
  };
  return insertSingle(supabaseAdmin.from("jobs").insert(payload).select("*").single());
}

async function persistGeneratedCandidate({ supabaseAdmin, item, asset, job, actor, now }) {
  const requestId = asset.provider_request_id || asset.request_id;
  const existingGeneration = requestId
    ? await maybeSingle(
      supabaseAdmin
        .from("generations")
        .select("*")
        .eq("request_id", requestId)
    )
    : null;
  const generation = existingGeneration || await insertSingle(
    supabaseAdmin
      .from("generations")
      .insert({
        job_id: job.id,
        kind: asset.kind,
        prompt: asset.prompt || "",
        model: "openai/gpt-image-2/edit",
        request_id: requestId || null,
        status: "done",
        completed_at: now.toISOString(),
        created_by: actor.id,
        error_message: null
      })
      .select("*")
      .single()
  );

  const existingAsset = generation.image_asset_id
    ? await maybeSingle(
      supabaseAdmin
        .from("assets")
        .select("*")
        .eq("id", generation.image_asset_id)
    )
    : await selectFirst(
      supabaseAdmin
        .from("assets")
        .select("*")
        .eq("job_id", job.id)
        .eq("type", asset.type)
        .eq("storage_key", asset.source_url)
        .order("created_at", { ascending: false })
        .limit(1)
    );

  const persistedAsset = existingAsset || await insertSingle(
    supabaseAdmin
      .from("assets")
      .insert({
        job_id: job.id,
        type: asset.type,
        bucket: "remote_url",
        storage_key: asset.source_url,
        public_url: asset.source_url,
        file_name: asset.file_name,
        mime_type: asset.mime_type || null,
        file_size: asset.file_size,
        created_by: actor.id
      })
      .select("*")
      .single()
  );

  if (generation.image_asset_id !== persistedAsset.id) {
    const { error } = await supabaseAdmin
      .from("generations")
      .update({ image_asset_id: persistedAsset.id })
      .eq("id", generation.id);
    if (error) throw error;
    generation.image_asset_id = persistedAsset.id;
  }

  return { generation, asset: persistedAsset, slot: asset.slot, type: asset.type };
}

async function upsertReviewBatchItem({ supabaseAdmin, item, plan, batch, job, hero, supports }) {
  const { error } = await supabaseAdmin
    .from("automation_batch_items")
    .upsert(
      {
        batch_id: batch.id,
        sku: item.sku,
        product_type: item.product_type || item.category || "",
        target_site: item.target_site || "",
        product_name: item.product_name || item.sku,
        status: "awaiting_hero_review",
        prompt_framework_version: item.prompt_framework_version || "",
        prompt_json: {
          support_shots: item.support_assets.map((asset) => asset.slot).join("|")
        },
        metadata: {
          source: "ai_hub_production_review_registration",
          review_gate: "hero_only_before_support_generation",
          review_set_status: "awaiting_hero_approval",
          hero_review_hero_asset: {
            generation_id: hero.generation.id,
            asset_id: hero.asset.id,
            public_url: hero.asset.public_url
          },
          hero_review_reference_assets: item.reference_assets,
          pending_support_shots: item.support_assets.map((asset) => asset.slot).filter(Boolean),
          support_assets: [],
          review_url: buildReviewUrl({
            reviewBaseUrl: plan.review_base_url,
            batchKey: plan.batch_key,
            sku: item.sku,
            generationId: hero.generation.id,
            assetId: hero.asset.id
          }),
          job_id: job.id
        }
      },
      { onConflict: "batch_id,sku" }
    );
  if (error) throw error;
}

async function updateJobReviewStatus({ supabaseAdmin, job, item, now }) {
  const formJson = {
    ...(job.form_json && typeof job.form_json === "object" ? job.form_json : {}),
    ...buildJobFormJson(item, now)
  };
  const { error } = await supabaseAdmin
    .from("jobs")
    .update({
      product_name: item.product_name || job.product_name || item.sku,
      brand: item.brand_id || item.brand_label || job.brand || "",
      category: item.category || item.product_type || job.category || "",
      image_type: "product_image_set",
      status: "hero_ready",
      form_json: formJson
    })
    .eq("id", job.id);
  if (error) throw error;
}

async function recordRegistrationAudit({ supabaseAdmin, actor, job, hero, supports, item, plan }) {
  const { error } = await supabaseAdmin
    .from("audit_events")
    .insert({
      actor_id: actor.id,
      job_id: job.id,
      generation_id: hero.generation.id,
      event_type: "ai_hub_review_set_registered",
      event_json: {
        batch_key: plan.batch_key,
        sku: item.sku,
        hero_asset_id: hero.asset.id,
        hero_generation_id: hero.generation.id,
        support_count: supports.length,
        support_asset_ids: supports.map((entry) => entry.asset.id),
        support_generation_ids: supports.map((entry) => entry.generation.id),
        no_wordpress_writes: true
      }
    });
  if (error) throw error;
}

function buildJobFormJson(item, now) {
  return {
    sku: item.sku,
    productName: item.product_name,
    brand: item.brand_id || item.brand_label || "",
    brandProfile: item.brand_id || "",
    targetSite: item.target_site,
    category: item.category,
    imageType: "product_image_set",
    jobKind: "product_image_set",
    promptFrameworkVersion: item.prompt_framework_version,
    supportShots: item.support_assets.map((asset) => asset.slot).join("|"),
    supportCount: item.support_assets.length,
    source: "ai_hub_production_review_registration",
    registeredAt: now.toISOString()
  };
}

function buildReviewUrl({ reviewBaseUrl = "", batchKey = "", sku = "", generationId = "", assetId = "" } = {}) {
  if (!reviewBaseUrl || !generationId) return "";
  const base = reviewBaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  if (batchKey) params.set("batch_id", batchKey);
  if (sku) params.set("sku", sku);
  params.set("generation_id", generationId);
  if (assetId) params.set("asset_id", assetId);
  return `${base}/#review?${params.toString()}`;
}

function buildDefaultBatchKey({ items = [], now }) {
  const sku = items[0]?.sku || "unknown";
  return `ai-hub-review-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${sku}`;
}

function collectPromptFrameworkVersion(item = {}) {
  const versions = new Set();
  if (item.prompt_framework_version) versions.add(item.prompt_framework_version);
  (item.review_assets || []).forEach((asset) => {
    if (asset.prompt_framework_version) versions.add(asset.prompt_framework_version);
  });
  return Array.from(versions).filter(Boolean).join("|");
}

function summarizeItems(items, blockers = []) {
  return {
    sku_count: items.length,
    hero_candidates: items.filter((item) => item.hero_asset?.source_url).length,
    support_candidates: items.reduce((sum, item) => sum + item.support_assets.length, 0),
    ready_items: items.filter((item) => !item.blockers.length).length,
    blocked_items: items.filter((item) => item.blockers.length).length,
    persisted_items: items.filter((item) => item.registration_status === "persisted").length,
    failed_items: items.filter((item) => item.registration_status === "failed").length,
    blockers: blockers.length
  };
}

async function selectRows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function selectFirst(query) {
  const rows = await selectRows(query);
  return rows[0] || null;
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

function normalizeText(value = "") {
  return String(value || "").normalize("NFKC").trim();
}

function normalizeUrl(value = "") {
  const text = normalizeText(value);
  return /^https:\/\//i.test(text) ? text : "";
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function fileNameFromUrl(value = "") {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
}
