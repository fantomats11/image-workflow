import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildSupportPromptV3,
  getSupportShotsV3,
  resolveModelPolicyV3,
  resolveVisualVariationV3
} from "./prompt-framework-v3.mjs";

export const PILOT_GENERATION_EXECUTION_PLAN_TASK = "pilot_generation_execution_plan";
export const GENERATE_BATCH_TASK = "generate_batch";

const DEFAULT_PRIORITY_SUPPORT_COUNT = 2;

export function buildPilotGenerationExecutionPlan({
  task = {},
  batchItems = [],
  mediaManifest = null,
  referenceResolutionManifest = null,
  modelInputStagingManifest = null,
  mediaAssets = [],
  prioritySupportCount = DEFAULT_PRIORITY_SUPPORT_COUNT,
  liveGenerationEnabled = false,
  now = new Date()
} = {}) {
  const assets = collectMediaAssets(mediaManifest, mediaAssets);
  const assetsBySku = groupBy(assets.map(normalizeMediaAsset), (asset) => normalizeSku(asset.sku));
  const referenceResolutionBySku = buildReferenceResolutionIndex(referenceResolutionManifest);
  const modelInputStagingBySku = buildModelInputStagingIndex(modelInputStagingManifest);
  const actionContext = buildGenerationActionContext(task);
  const items = batchItems.map((item, index) => buildPlanItem({
    item,
    index,
    assets: assetsBySku.get(normalizeSku(readField(item, "sku"))) || [],
    referenceResolution: referenceResolutionBySku.get(normalizeSku(readField(item, "sku"))) || null,
    modelInputStaging: modelInputStagingBySku.get(normalizeSku(readField(item, "sku"))) || null,
    prioritySupportCount,
    actionContext
  }));
  const requests = items.flatMap((item) => item.generation_requests);
  const blockedItems = items.filter((item) => item.generation_status === "needs_review_before_live_generation");
  const readyItems = items.filter((item) => item.generation_status === "ready_for_live_generation");

  return {
    task_type: PILOT_GENERATION_EXECUTION_PLAN_TASK,
    source_task_type: task.task_type || null,
    task_id: task.id || null,
    batch_id: task.batch_id || mediaManifest?.batch_id || null,
    review_action: actionContext.action || null,
    review_action_target_sku: actionContext.targetSku || null,
    dry_run: true,
    created_at: now.toISOString(),
    live_generation_enabled: Boolean(liveGenerationEnabled),
    live_write_allowed: false,
    live_writes_enabled: false,
    requires_final_confirmation: true,
    proposed_execution_scope: "pilot_image_generation_requests",
    guardrails: [
      "no_model_call_in_plan_phase",
      "no_fal_or_openai_image_generation_until_live_generation_enabled",
      "resolve_drive_folder_references_to_image_files_before_generation",
      "skip_slots_with_existing_generated_or_approved_assets",
      "generate_hero_first_then_wait_for_line_hero_approval_before_support",
      "attach_reference_assets_and_approved_hero_anchor_to_support_generation",
      "audit_every_live_generation_request"
    ],
    summary: {
      sku_count: items.length,
      ready_for_live_generation: readyItems.length,
      needs_reference_asset_resolution: items.filter((item) => item.blockers.includes("reference_assets_need_resolution")).length,
      needs_model_input_staging: items.filter((item) => item.blockers.includes("reference_assets_need_model_input_staging")).length,
      model_inputs_staged: items.filter((item) => item.reference_source_type === "local_staged_reference_files").length,
      blocked: blockedItems.length,
      planned_generation_requests: requests.length,
      hero_requests: requests.filter((request) => request.kind === "hero").length,
      support_requests: requests.filter((request) => request.kind === "support").length,
      priority_generation_requests: requests.filter((request) => request.priority_required).length,
      priority_support_requests: requests.filter((request) => request.kind === "support" && request.priority_required).length,
      blocked_generation_requests: requests.filter((request) => request.request_status !== "ready_for_live_generation").length,
      pending_hero_approval_for_support: requests.filter((request) => request.blockers?.includes("support_requires_approved_hero_anchor")).length,
      existing_assets_matched: items.reduce((total, item) => total + item.existing_assets.length, 0),
      skipped_existing_slots: items.reduce((total, item) => total + item.skipped_existing_slots.length, 0)
    },
    items
  };
}

function buildPlanItem({
  item = {},
  index = 0,
  assets = [],
  referenceResolution = null,
  modelInputStaging = null,
  prioritySupportCount,
  actionContext = buildGenerationActionContext()
}) {
  const normalized = normalizeBatchItem(item);
  const promptItem = { ...normalized, item_index: index };
  const targetedByReviewAction = isTargetedByReviewAction(actionContext, normalized.sku);
  const explicitSupportShots = splitSupportShots(normalized.support_shots);
  const supportShots = resolveSupportShotsForPlan({
    normalized,
    explicitSupportShots,
    actionContext,
    targetedByReviewAction
  });
  const metadataApprovedHeroAnchor = normalized.approved_hero_anchor
    ? normalizeMediaAsset(normalized.approved_hero_anchor)
    : null;
  const heroAsset = chooseHeroAsset(assets) ||
    (isHeroApprovedByItem(item) ? metadataApprovedHeroAnchor : null);
  const shouldRegenerateHero = actionContext.forceHeroRegeneration && targetedByReviewAction;
  const approvedHeroAnchor = chooseApprovedHeroAnchor(assets) ||
    chooseApprovedHeroAnchor(metadataApprovedHeroAnchor ? [metadataApprovedHeroAnchor] : []) ||
    (isHeroApprovedByItem(item)
      ? chooseGeneratedHeroAnchor(assets) || metadataApprovedHeroAnchor
      : null);
  const supportAssetBySlot = new Map(
    assets
      .filter((asset) => asset.type === "support_generated" || asset.kind === "support")
      .map((asset) => [String(asset.shot_key || asset.kind || "").trim(), asset])
      .filter(([slot]) => slot)
  );
  const resolvedReferenceAssets = Array.isArray(referenceResolution?.selected_reference_assets)
    ? referenceResolution.selected_reference_assets
    : [];
  const stagedReferenceAssets = Array.isArray(modelInputStaging?.staged_reference_assets)
    ? modelInputStaging.staged_reference_assets.filter((asset) => asset.staging_status === "staged_local_file")
    : [];
  const reference = stagedReferenceAssets.length
    ? { type: "local_staged_reference_files", requires_resolution: false, requires_staging: false }
    : resolvedReferenceAssets.length
    ? { type: "google_drive_resolved_files", requires_resolution: false, requires_staging: true }
    : classifyReferenceSource(normalized.reference_url);
  const blockers = [];

  if (!normalized.sku) blockers.push("missing_sku");
  if (!normalized.reference_url) blockers.push("missing_reference_url");
  if (reference.requires_resolution) blockers.push("reference_assets_need_resolution");
  if (reference.requires_staging) blockers.push("reference_assets_need_model_input_staging");

  const skippedExistingSlots = [];
  const requests = [];

  if (actionContext.reviewScoped && !targetedByReviewAction) {
    return buildSkippedReviewActionItem({
      item,
      normalized,
      assets,
      reference,
      resolvedReferenceAssets,
      stagedReferenceAssets,
      approvedHeroAnchor,
      supportShots,
      actionContext
    });
  }

  if (heroAsset && !shouldRegenerateHero) {
    skippedExistingSlots.push({ slot: "hero", reason: "existing_hero_asset", asset_id: heroAsset.id });
  } else {
    const prompt = normalized.prompt_framework_version === PROMPT_FRAMEWORK_V3_VERSION && normalized.hero_prompt
      ? normalized.hero_prompt
      : buildHeroPromptV3(promptItem);
    if (!prompt) blockers.push("missing_hero_prompt");
    requests.push(buildRequest({
      item: promptItem,
      index,
      slot: "hero",
      kind: "hero",
      prompt,
      reference,
      resolvedReferenceAssets,
      stagedReferenceAssets,
      requestId: shouldRegenerateHero ? buildRegenerateHeroRequestId(promptItem, actionContext) : null,
      priorityRequired: true,
      sequence: 1
    }));
  }

  supportShots.forEach((shotKey, shotIndex) => {
    const existingAsset = supportAssetBySlot.get(shotKey);
    if (existingAsset && isReusableSupportAsset(existingAsset, approvedHeroAnchor)) {
      skippedExistingSlots.push({ slot: shotKey, reason: "existing_support_asset", asset_id: existingAsset.id });
      return;
    }
    const supportBlockers = [];
    if (!approvedHeroAnchor) supportBlockers.push("support_requires_approved_hero_anchor");
    else if (!approvedHeroAnchor.local_path) supportBlockers.push("approved_hero_anchor_requires_local_file");
    const supportPromptItem = approvedHeroAnchor
      ? { ...promptItem, approved_hero_anchor: compactHeroAnchor(approvedHeroAnchor) }
      : promptItem;
    const prompt = buildSupportPromptV3(supportPromptItem, shotKey, shotIndex + 1, supportShots.length);
    if (!prompt) supportBlockers.push(`missing_support_prompt:${shotKey}`);
    requests.push(buildRequest({
      item: promptItem,
      index,
      slot: shotKey,
      kind: "support",
      prompt,
      reference,
      resolvedReferenceAssets,
      stagedReferenceAssets,
      heroAnchorAsset: approvedHeroAnchor,
      requestBlockers: supportBlockers,
      priorityRequired: shotIndex < prioritySupportCount,
      sequence: shotIndex + 2
    }));
  });

  const uniqueBlockers = Array.from(new Set(blockers));
  requests.forEach((request) => {
    const requestBlockers = Array.from(new Set([...(request.blockers || []), ...uniqueBlockers]));
    request.request_status = requestBlockers.length ? "blocked_before_live_generation" : "ready_for_live_generation";
    request.blockers = requestBlockers;
  });
  const readyRequestCount = requests.filter((request) => request.request_status === "ready_for_live_generation").length;
  const generationStatus = uniqueBlockers.length || readyRequestCount === 0
    ? "needs_review_before_live_generation"
    : readyRequestCount === requests.length
      ? "ready_for_live_generation"
      : "partially_ready_for_live_generation";

  return {
    batch_item_id: item.id || null,
    sku: normalized.sku,
    brand_id: normalized.brand_id,
    brand_label: normalized.brand_label,
    target_site: normalized.target_site,
    product_name: normalized.product_name,
    product_type: normalized.product_type,
    category: normalized.category,
    subcategory: normalized.subcategory,
    reference_url: normalized.reference_url,
    reference_source_type: reference.type,
    reference_requires_resolution: reference.requires_resolution,
    reference_requires_model_input_staging: Boolean(reference.requires_staging),
    resolved_reference_assets: resolvedReferenceAssets.map(compactResolvedReferenceAsset),
    staged_reference_assets: stagedReferenceAssets.map(compactStagedReferenceAsset),
    approved_hero_anchor: approvedHeroAnchor ? compactHeroAnchor(approvedHeroAnchor) : null,
    support_requires_hero_approval: supportShots.length > 0 && !approvedHeroAnchor,
    generation_status: generationStatus,
    proposed_action: uniqueBlockers.includes("reference_assets_need_model_input_staging")
      ? "stage_reference_files_then_generate"
      : uniqueBlockers.length
        ? "resolve_reference_assets_then_generate"
        : "queue_live_generation_after_final_confirmation",
    blockers: uniqueBlockers,
    support_shots: supportShots,
    priority_support_count: Math.min(prioritySupportCount, supportShots.length),
    existing_assets: assets.map(compactAsset),
    skipped_existing_slots: skippedExistingSlots,
    generation_requests: requests
  };
}

function buildRequest({
  item,
  index,
  slot,
  kind,
  prompt,
  reference,
  resolvedReferenceAssets,
  stagedReferenceAssets,
  heroAnchorAsset = null,
  requestBlockers = [],
  requestId = null,
  priorityRequired,
  sequence
}) {
  const stagedReferenceInputs = stagedReferenceAssets.map(compactStagedReferenceAsset);
  const modelInputFiles = kind === "support" && heroAnchorAsset
    ? [compactHeroAnchorAsModelInput(heroAnchorAsset), ...stagedReferenceInputs]
    : stagedReferenceInputs;
  return {
    request_id: requestId || `${item.sku || `item-${index + 1}`}:${slot}`,
    sku: item.sku,
    kind,
    slot,
    sequence,
    priority_required: Boolean(priorityRequired),
    model: item.model || "openai/gpt-image-2/edit",
    prompt_framework_version: item.prompt_framework_version === PROMPT_FRAMEWORK_V3_VERSION
      ? item.prompt_framework_version
      : PROMPT_FRAMEWORK_V3_VERSION,
    model_policy: resolveModelPolicyV3(item, { slotType: kind, shotKey: slot }),
    visual_variation: resolveVisualVariationV3(item, {
      slotType: kind,
      shotKey: slot,
      itemIndex: index,
      sequence
    }),
    prompt,
    reference_url: item.reference_url,
    reference_source_type: reference.type,
    reference_requires_resolution: reference.requires_resolution,
    reference_requires_model_input_staging: Boolean(reference.requires_staging),
    reference_assets: resolvedReferenceAssets.map(compactResolvedReferenceAsset),
    approved_hero_anchor: kind === "support" && heroAnchorAsset ? compactHeroAnchor(heroAnchorAsset) : null,
    model_input_files: modelInputFiles,
    blockers: Array.from(new Set(requestBlockers)),
    write_policy: "no_model_call_without_final_confirmation"
  };
}

function normalizeBatchItem(item = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const promptJson = isPlainObject(item.prompt_json) ? item.prompt_json : {};
  const merged = { ...metadata, ...item };
  return {
    ...merged,
    sku: String(readField(item, "sku") || "").trim(),
    brand_id: readField(item, "brand_id") || "",
    brand_label: readField(item, "brand_label") || "",
    target_site: readField(item, "target_site") || "",
    product_name: readField(item, "product_name") || "",
    product_type: readField(item, "product_type") || "",
    category: readField(item, "category") || "",
    subcategory: readField(item, "subcategory") || "",
    reference_url: readField(item, "reference_url") || inferReferenceUrl(item) || "",
    reference_confidence: readField(item, "reference_confidence") || readField(item, "referenceConfidence") || "medium",
    model: readField(item, "model") || "",
    audience: readField(item, "audience") || "",
    gender: readField(item, "gender") || "",
    prompt_framework_version: readField(item, "prompt_framework_version") || "",
    hero_prompt: promptJson.hero_prompt || readField(item, "hero_prompt") || "",
    support_shots: promptJson.support_shots || readField(item, "support_shots") || "",
    support_prompt_preview: promptJson.support_prompt_preview || readField(item, "support_prompt_preview") || "",
    approved_hero_anchor: isPlainObject(merged.approved_hero_anchor) ? merged.approved_hero_anchor : null
  };
}

function isHeroApprovedByItem(item = {}) {
  const status = String(item.status || item.approval_status || "").trim().toLowerCase();
  const action = String(
    item.metadata?.web_review_action?.last_action ||
    item.metadata?.web_review_action?.action ||
    item.metadata?.line_action?.last_action ||
    item.line_action?.last_action ||
    item.last_action ||
    ""
  ).trim().toLowerCase();
  return status === "hero_approved" || action === "approve_hero";
}

function buildGenerationActionContext(task = {}) {
  const payload = isPlainObject(task.payload) ? task.payload : {};
  const action = normalizeAction(payload.action || payload.source_action || task.action || "");
  const targetSku = String(payload.sku || task.sku || "").trim();
  const targetGenerationId = String(payload.generation_id || payload.generationId || task.generation_id || "").trim();
  const reviewScoped = action === "approve_hero" || action === "regenerate_hero";
  return {
    action,
    targetSku,
    targetGenerationId,
    reviewScoped,
    forceSupportAfterHeroApproval: action === "approve_hero",
    forceHeroRegeneration: action === "regenerate_hero"
  };
}

function normalizeAction(value = "") {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function isTargetedByReviewAction(actionContext = {}, sku = "") {
  if (!actionContext.reviewScoped) return true;
  if (!actionContext.targetSku) return true;
  return normalizeSku(actionContext.targetSku) === normalizeSku(sku);
}

function resolveSupportShotsForPlan({
  normalized,
  explicitSupportShots,
  actionContext,
  targetedByReviewAction
}) {
  if (actionContext.forceHeroRegeneration && targetedByReviewAction) return [];
  if (explicitSupportShots.length) return explicitSupportShots;
  if (actionContext.forceSupportAfterHeroApproval && targetedByReviewAction) {
    return getSupportShotsV3(normalized);
  }
  return [];
}

function buildRegenerateHeroRequestId(item = {}, actionContext = {}) {
  const generationSuffix = actionContext.targetGenerationId
    ? `:${shortId(actionContext.targetGenerationId)}`
    : "";
  return `${item.sku || "item"}:hero:regenerate${generationSuffix}`;
}

function shortId(value = "") {
  return String(value || "").trim().slice(0, 8);
}

function buildSkippedReviewActionItem({
  item,
  normalized,
  assets,
  reference,
  resolvedReferenceAssets,
  stagedReferenceAssets,
  approvedHeroAnchor,
  supportShots,
  actionContext
}) {
  return {
    batch_item_id: item.id || null,
    sku: normalized.sku,
    brand_id: normalized.brand_id,
    brand_label: normalized.brand_label,
    target_site: normalized.target_site,
    product_name: normalized.product_name,
    product_type: normalized.product_type,
    category: normalized.category,
    subcategory: normalized.subcategory,
    reference_url: normalized.reference_url,
    reference_source_type: reference.type,
    reference_requires_resolution: reference.requires_resolution,
    reference_requires_model_input_staging: Boolean(reference.requires_staging),
    resolved_reference_assets: resolvedReferenceAssets.map(compactResolvedReferenceAsset),
    staged_reference_assets: stagedReferenceAssets.map(compactStagedReferenceAsset),
    approved_hero_anchor: approvedHeroAnchor ? compactHeroAnchor(approvedHeroAnchor) : null,
    support_requires_hero_approval: false,
    generation_status: "not_selected_for_review_action",
    proposed_action: `skip_not_targeted_by_${actionContext.action}`,
    blockers: [],
    support_shots: supportShots,
    priority_support_count: 0,
    existing_assets: assets.map(compactAsset),
    skipped_existing_slots: [],
    generation_requests: []
  };
}

function readField(item = {}, field) {
  if (item[field] !== undefined && item[field] !== null && item[field] !== "") return item[field];
  if (item.prompt_json?.[field] !== undefined && item.prompt_json[field] !== null && item.prompt_json[field] !== "") return item.prompt_json[field];
  if (item.metadata?.[field] !== undefined && item.metadata[field] !== null && item.metadata[field] !== "") return item.metadata[field];
  if (item.metadata?.prompt_json?.[field] !== undefined && item.metadata.prompt_json[field] !== null && item.metadata.prompt_json[field] !== "") {
    return item.metadata.prompt_json[field];
  }
  return "";
}

function inferReferenceUrl(item = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const candidates = [
    ...(Array.isArray(item.reference_images) ? item.reference_images : []),
    ...(Array.isArray(metadata.reference_images) ? metadata.reference_images : []),
    ...(Array.isArray(metadata.selected_reference_assets) ? metadata.selected_reference_assets : []),
    ...(Array.isArray(metadata.reference_resolution?.selected_reference_assets)
      ? metadata.reference_resolution.selected_reference_assets
      : [])
  ];
  for (const candidate of candidates) {
    const url = candidate?.public_url ||
      candidate?.url ||
      candidate?.signed_url ||
      candidate?.proxy_url ||
      candidate?.webContentLink ||
      candidate?.webViewLink ||
      "";
    if (/^https?:\/\//i.test(String(url || "").trim())) return String(url).trim();
  }
  return "";
}

function classifyReferenceSource(value = "") {
  const url = String(value || "").trim();
  if (!url) return { type: "missing", requires_resolution: true };
  if (/drive\.google\.com\/drive\/folders\//i.test(url) || /drive\.google\.com\/.*[?&]folders=/i.test(url)) {
    return { type: "google_drive_folder", requires_resolution: true };
  }
  if (/drive\.google\.com\/file\/d\//i.test(url) || /drive\.google\.com\/open\?/i.test(url)) {
    return { type: "google_drive_file", requires_resolution: false };
  }
  if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url)) return { type: "direct_image_url", requires_resolution: false };
  if (/^https?:\/\//i.test(url)) return { type: "url", requires_resolution: false };
  return { type: "unknown", requires_resolution: true };
}

function collectMediaAssets(mediaManifest, mediaAssets) {
  const explicit = Array.isArray(mediaAssets) ? mediaAssets : [];
  if (explicit.length) return explicit;
  if (Array.isArray(mediaManifest)) return mediaManifest;
  if (Array.isArray(mediaManifest?.assets)) return mediaManifest.assets;
  if (Array.isArray(mediaManifest?.media_assets)) return mediaManifest.media_assets;
  if (Array.isArray(mediaManifest?.items)) return mediaManifest.items.flatMap((item) => item.assets || []);
  return [];
}

function buildReferenceResolutionIndex(referenceResolutionManifest) {
  const items = Array.isArray(referenceResolutionManifest?.items)
    ? referenceResolutionManifest.items
    : [];
  const map = new Map();
  items.forEach((item) => {
    const sku = normalizeSku(item.sku);
    if (sku) map.set(sku, item);
  });
  return map;
}

function buildModelInputStagingIndex(modelInputStagingManifest) {
  const items = Array.isArray(modelInputStagingManifest?.items)
    ? modelInputStagingManifest.items
    : [];
  const map = new Map();
  items.forEach((item) => {
    const sku = normalizeSku(item.sku);
    if (sku) map.set(sku, item);
  });
  return map;
}

function chooseHeroAsset(assets) {
  return assets.find((asset) => asset.type === "approved_export" && (asset.kind === "hero" || !asset.shot_key)) ||
    assets.find((asset) => asset.type === "hero_generated" || asset.kind === "hero") ||
    null;
}

function chooseApprovedHeroAnchor(assets) {
  return assets.find((asset) => isHeroAsset(asset) && isApprovedHeroAsset(asset)) || null;
}

function chooseGeneratedHeroAnchor(assets) {
  return assets.find((asset) => isHeroAsset(asset) && (asset.type === "hero_generated" || asset.kind === "hero")) || null;
}

function isHeroAsset(asset = {}) {
  return asset.kind === "hero" || asset.shot_key === "hero" || asset.type === "hero_generated" || asset.type === "approved_export";
}

function isApprovedHeroAsset(asset = {}) {
  return asset.type === "approved_export" || asset.status === "approved" || Boolean(asset.approval_id || asset.approved_at);
}

function isReusableSupportAsset(asset = {}, approvedHeroAnchor = null) {
  if (asset.type === "approved_export" || asset.status === "approved" || asset.approval_id) return true;
  if (!approvedHeroAnchor) return false;
  return Boolean(asset.approved_hero_anchor_id || asset.approved_hero_anchor_asset_id || asset.hero_anchor_asset_id);
}

function normalizeMediaAsset(asset = {}) {
  return {
    id: asset.id || asset.asset_id || null,
    sku: String(asset.sku || asset.SKU || "").trim(),
    type: String(asset.type || asset.asset_type || "").trim(),
    kind: String(asset.kind || "").trim(),
    shot_key: String(asset.shot_key || asset.shotType || asset.shot_type || "").trim(),
    url: asset.url || asset.public_url || "",
    public_url: asset.public_url || asset.url || "",
    storage_key: asset.storage_key || "",
    local_path: asset.local_path || (asset.bucket === "local" ? asset.storage_key || "" : ""),
    file_name: asset.file_name || "",
    file_size: asset.file_size || 0,
    sha256: asset.sha256 || "",
    bucket: asset.bucket || "",
    approval_id: asset.approval_id || null,
    approved_at: asset.approved_at || null,
    approved_hero_anchor_id: asset.approved_hero_anchor_id || asset.approved_hero_anchor_asset_id || asset.hero_anchor_asset_id || null,
    status: asset.status || ""
  };
}

function compactAsset(asset) {
  return {
    id: asset.id,
    sku: asset.sku,
    type: asset.type,
    kind: asset.kind,
    shot_key: asset.shot_key,
    status: asset.status,
    url: asset.url,
    storage_key: asset.storage_key,
    local_path: asset.local_path,
    approval_id: asset.approval_id,
    approved_at: asset.approved_at,
    approved_hero_anchor_id: asset.approved_hero_anchor_id
  };
}

function compactHeroAnchor(asset = {}) {
  return {
    id: asset.id || null,
    sku: asset.sku || "",
    type: asset.type || "",
    kind: asset.kind || "hero",
    shot_key: asset.shot_key || "hero",
    status: asset.status || "",
    url: asset.url || asset.public_url || "",
    public_url: asset.public_url || asset.url || "",
    local_path: asset.local_path || "",
    storage_key: asset.storage_key || "",
    file_name: asset.file_name || "",
    file_size: asset.file_size || 0,
    approval_id: asset.approval_id || null,
    approved_at: asset.approved_at || null
  };
}

function compactHeroAnchorAsModelInput(asset = {}) {
  return {
    source_name: "approved_hero_anchor",
    source_role: "approved_hero_anchor",
    local_path: asset.local_path || "",
    file_name: asset.file_name || "approved-hero.png",
    file_size: asset.file_size || 0,
    sha256: asset.sha256 || "",
    staging_status: asset.local_path ? "staged_local_file" : "missing_local_file",
    source_url: asset.url || asset.public_url || "",
    asset_id: asset.id || null
  };
}

function compactResolvedReferenceAsset(asset = {}) {
  return {
    id: asset.id || asset.drive_file_id || null,
    drive_file_id: asset.drive_file_id || asset.id || null,
    name: asset.name || "",
    mimeType: asset.mimeType || "",
    width: asset.width || 0,
    height: asset.height || 0,
    webViewLink: asset.webViewLink || "",
    thumbnailLink: asset.thumbnailLink || "",
    model_input_status: asset.model_input_status || "needs_download_or_signed_staging"
  };
}

function compactStagedReferenceAsset(asset = {}) {
  return {
    drive_file_id: asset.drive_file_id || null,
    source_name: asset.source_name || "",
    source_role: "product_reference",
    source_mime_type: asset.source_mime_type || "",
    local_path: asset.local_path || "",
    file_name: asset.file_name || "",
    file_size: asset.file_size || 0,
    sha256: asset.sha256 || "",
    staging_status: asset.staging_status || ""
  };
}

function splitSupportShots(value) {
  return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
