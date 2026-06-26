export const LIVE_SUPPORT_CANDIDATE_MANIFEST = "ai_hub_product_image_local_candidate_manifest";

export function buildLiveSupportCandidateManifest({
  batchId = "",
  sku = "",
  job = {},
  heroAsset = {},
  studioMasterAsset = {},
  supportAssets = [],
  decisionState = {},
  now = new Date()
} = {}) {
  const normalizedSku = sku || job.sku || heroAsset.sku || studioMasterAsset.sku || "";
  const metadata = buildSkuMetadata({ sku: normalizedSku, job });
  const manifestBlockers = buildManifestBlockers({ heroAsset, studioMasterAsset, supportAssets, decisionState });
  const approvedDecisionByKey = buildApprovedDecisionMap(decisionState);
  const candidates = [
    buildHeroCandidate({ sku: normalizedSku, metadata, heroAsset }),
    buildStudioMasterCandidate({ sku: normalizedSku, metadata, studioMasterAsset }),
    ...supportAssets.map((asset) => buildSupportCandidate({
      sku: normalizedSku,
      metadata,
      asset,
      decision: approvedDecisionByKey.get(assetKey(asset)) || null
    }))
  ].map(checkCandidate);

  return {
    manifest_type: LIVE_SUPPORT_CANDIDATE_MANIFEST,
    version: "live-support-candidate-manifest-v1.0",
    created_at: now.toISOString(),
    batch_id: batchId || null,
    source_review_state: {
      review_status: decisionState.review_status || "",
      candidate_manifest_ready: Boolean(decisionState.candidate_manifest_ready),
      decided_at: decisionState.created_at || null,
      reviewer: decisionState.reviewer || ""
    },
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    publish_allowed: false,
    media_attach_allowed: false,
    manifest_status: resolveManifestStatus({ manifestBlockers, candidates }),
    manifest_blockers: manifestBlockers,
    guardrails: [
      "live_support_candidates_only_no_wordpress_db_media_attach_or_publish",
      "candidate_manifest_requires_all_support_assets_approved",
      "hero_anchor_can_seed_manifest_but_reference_images_remain_source_of_truth",
      "support_candidates_keep_review_asset_traceability",
      "candidate_manifest_requires_later_media_manifest_or_wordpress_preflight"
    ],
    summary: summarizeCandidates(candidates, manifestBlockers),
    items: [{
      ...metadata,
      status: manifestBlockers.length || candidates.some((candidate) => candidate.blockers.length)
        ? "blocked_before_media_manifest_preflight"
        : "local_candidates_ready_for_media_manifest_preflight",
      candidate_count: candidates.length,
      hero_count: candidates.filter((candidate) => candidate.kind === "hero").length,
      studio_master_count: candidates.filter((candidate) => candidate.kind === "studio_master").length,
      support_count: candidates.filter((candidate) => candidate.kind === "support").length,
      candidates
    }],
    candidates
  };
}

function buildSkuMetadata({ sku, job }) {
  return {
    sku: sku || "",
    brand_id: job.reference_brand_id || job.brand_id || "",
    target_site: job.reference_target_site || job.target_site || "",
    product_name: job.product_name || job.name || sku || "",
    category: job.category || job.product_type || ""
  };
}

function buildManifestBlockers({ heroAsset, studioMasterAsset, supportAssets, decisionState }) {
  const blockers = [];
  if (!heroAssetSource(heroAsset)) blockers.push("missing_approved_hero_anchor");
  if (!heroAssetSource(studioMasterAsset)) blockers.push("missing_approved_studio_master_anchor");
  if (!supportAssets.length) blockers.push("missing_support_assets");
  if (!decisionState.candidate_manifest_ready) blockers.push("support_review_not_fully_approved");
  return Array.from(new Set(blockers));
}

function buildApprovedDecisionMap(decisionState) {
  const map = new Map();
  for (const decision of Array.isArray(decisionState.assets) ? decisionState.assets : []) {
    if (decision.decision !== "approve_support") continue;
    map.set(assetKey(decision), decision);
  }
  return map;
}

function buildHeroCandidate({ sku, metadata, heroAsset }) {
  const sourceUrl = heroAssetSource(heroAsset);
  return {
    ...metadata,
    sku,
    kind: "hero",
    slot: "hero",
    type: heroAsset.type || "hero_generated",
    candidate_role: "approved_hero_anchor",
    candidate_status: "local_candidate_pending_media_preflight",
    source_url: sourceUrl,
    public_url: sourceUrl,
    local_path: heroAsset.local_path || "",
    file_name: heroAsset.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: heroAsset.mime_type || "",
    file_size: Number(heroAsset.file_size || 0),
    provider_request_id: heroAsset.provider_request_id || heroAsset.request_id || null,
    review_asset_id: heroAsset.review_asset_id || heroAsset.asset_id || heroAsset.id || "",
    publish_status: "not_published_requires_later_media_preflight"
  };
}

function buildStudioMasterCandidate({ sku, metadata, studioMasterAsset }) {
  const sourceUrl = heroAssetSource(studioMasterAsset);
  return {
    ...metadata,
    sku,
    kind: "studio_master",
    slot: "studio_master",
    type: studioMasterAsset.type || "studio_master_generated",
    candidate_role: "approved_studio_master_anchor",
    candidate_status: "local_candidate_pending_media_preflight",
    source_url: sourceUrl,
    public_url: sourceUrl,
    local_path: studioMasterAsset.local_path || "",
    file_name: studioMasterAsset.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: studioMasterAsset.mime_type || "",
    file_size: Number(studioMasterAsset.file_size || 0),
    provider_request_id: studioMasterAsset.provider_request_id || studioMasterAsset.request_id || null,
    review_asset_id: studioMasterAsset.review_asset_id || studioMasterAsset.asset_id || studioMasterAsset.id || "",
    generation_id: studioMasterAsset.generation_id || null,
    publish_status: "not_published_requires_later_media_preflight"
  };
}

function buildSupportCandidate({ sku, metadata, asset, decision }) {
  const sourceUrl = asset.public_url || asset.source_url || asset.url || "";
  return {
    ...metadata,
    sku,
    kind: "support",
    slot: asset.slot || asset.shot_key || "",
    type: asset.type || "support_generated",
    candidate_role: "approved_support_candidate",
    candidate_status: "local_candidate_pending_media_preflight",
    source_url: sourceUrl,
    public_url: sourceUrl,
    local_path: asset.local_path || "",
    file_name: asset.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: asset.mime_type || "",
    file_size: Number(asset.file_size || 0),
    provider_request_id: asset.provider_request_id || asset.request_id || null,
    review_asset_id: asset.asset_id || asset.id || assetKey(asset),
    generation_id: asset.generation_id || null,
    approved_by: decision?.reviewer || "",
    approved_note: decision?.note || "",
    review_decision: decision?.decision || "not_approved_for_candidate_manifest",
    publish_status: "not_published_requires_later_media_preflight"
  };
}

function checkCandidate(candidate) {
  const blockers = [];
  if (!candidate.sku) blockers.push("missing_sku");
  if (!candidate.kind) blockers.push("missing_kind");
  if (!candidate.slot) blockers.push("missing_slot");
  if (!candidate.source_url && !candidate.local_path) blockers.push("missing_source_url_or_local_path");
  if (candidate.kind === "support" && !candidate.review_asset_id) blockers.push("missing_review_asset_traceability");
  if (candidate.kind === "support" && candidate.review_decision !== "approve_support") blockers.push("support_asset_not_approved");
  return {
    ...candidate,
    candidate_status: blockers.length ? "blocked_candidate" : candidate.candidate_status,
    blockers
  };
}

function resolveManifestStatus({ manifestBlockers, candidates }) {
  if (manifestBlockers.length || candidates.some((candidate) => candidate.blockers.length)) {
    return "blocked_before_local_candidate_manifest";
  }
  if (!candidates.length) return "no_local_candidates";
  return "ready_for_media_manifest_preflight";
}

function summarizeCandidates(candidates, manifestBlockers) {
  const ready = candidates.filter((candidate) => !candidate.blockers.length);
  return {
    sku_count: new Set(candidates.map((candidate) => candidate.sku).filter(Boolean)).size,
    candidate_count: candidates.length,
    ready_candidates: ready.length,
    blocked_candidates: candidates.length - ready.length,
    hero_candidates: candidates.filter((candidate) => candidate.kind === "hero").length,
    studio_master_candidates: candidates.filter((candidate) => candidate.kind === "studio_master").length,
    support_candidates: candidates.filter((candidate) => candidate.kind === "support").length,
    approved_support_candidates: candidates.filter((candidate) => candidate.candidate_role === "approved_support_candidate").length,
    approved_hero_anchors: candidates.filter((candidate) => candidate.candidate_role === "approved_hero_anchor").length,
    approved_studio_master_anchors: candidates.filter((candidate) => candidate.candidate_role === "approved_studio_master_anchor").length,
    manifest_blockers: manifestBlockers.length
  };
}

function heroAssetSource(asset = {}) {
  return asset.public_url || asset.source_url || asset.url || "";
}

function assetKey(asset = {}) {
  return String(
    asset.asset_key ||
    asset.asset_id ||
    asset.id ||
    asset.generation_id ||
    asset.request_id ||
    asset.public_url ||
    asset.source_url ||
    asset.url ||
    ""
  ).trim();
}

function fileNameFromUrl(url = "") {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}
