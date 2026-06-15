export const AI_HUB_REGENERATION_GATE_MANIFEST = "ai_hub_product_image_regeneration_gate";
export const AI_HUB_LOCAL_CANDIDATE_MANIFEST = "ai_hub_product_image_local_candidate_manifest";

const DEFAULT_MAX_REGEN_REQUESTS = 12;

export function buildAiHubRegenerationGate({
  actionPlan = {},
  mode = "all",
  maxRequests = DEFAULT_MAX_REGEN_REQUESTS,
  liveRequested = false,
  liveConfirmed = false,
  env = process.env,
  now = new Date()
} = {}) {
  const allRequests = collectRegenerationRequests(actionPlan);
  const selectedRequests = selectRegenerationRequests(allRequests, { mode, maxRequests });
  const requests = selectedRequests.map(checkRegenerationRequest);
  const planBlockers = buildPlanBlockers(actionPlan);
  const gateBlockers = buildLiveGateBlockers({ liveRequested, liveConfirmed, env });
  const requestBlockers = requests.flatMap((request) => request.blockers);
  const liveGenerationAllowed = Boolean(
    liveRequested &&
    liveConfirmed &&
    !planBlockers.length &&
    !gateBlockers.length &&
    !requestBlockers.length &&
    requests.length
  );

  return {
    manifest_type: AI_HUB_REGENERATION_GATE_MANIFEST,
    version: "ai-hub-regeneration-gate-v1.0",
    created_at: now.toISOString(),
    source_action_plan: sourceActionPlan(actionPlan),
    dry_run: !liveGenerationAllowed,
    live_generation_requested: Boolean(liveRequested),
    live_generation_confirmed: Boolean(liveConfirmed),
    live_generation_allowed: liveGenerationAllowed,
    live_write_allowed: false,
    live_writes_enabled: false,
    proposed_execution_scope: "image_regeneration_only",
    mode,
    max_requests: Number(maxRequests || DEFAULT_MAX_REGEN_REQUESTS),
    gate_status: resolveRegenerationGateStatus({
      liveGenerationAllowed,
      planBlockers,
      gateBlockers,
      requestBlockers,
      requests
    }),
    guardrails: [
      "regen_gate_only_no_wordpress_db_media_attach_or_publish",
      "regeneration_requires_human_action_plan",
      "support_regeneration_requires_approved_hero_anchor",
      "model_inputs_must_be_staged_before_live_generation",
      "requires_AI_GENERATION_LIVE_ENABLED_true",
      "requires_explicit_live_confirmation_flag",
      "requires_FAL_KEY_for_current_generation_provider",
      "record_outputs_in_later_review_bundle_not_publish"
    ],
    plan_blockers: planBlockers,
    gate_blockers: gateBlockers,
    summary: summarizeRegenerationGate(requests, { planBlockers, gateBlockers }),
    requests
  };
}

export function buildAiHubLocalCandidateManifest({
  actionPlan = {},
  reviewBundle = {},
  now = new Date()
} = {}) {
  const approvedSupportCandidates = collectApprovedMediaCandidates(actionPlan).map(normalizeApprovedSupportCandidate);
  const approvedHeroCandidates = collectApprovedHeroCandidates(reviewBundle, actionPlan).map(normalizeApprovedHeroCandidate);
  const candidates = dedupeCandidates([...approvedHeroCandidates, ...approvedSupportCandidates]).map(checkCandidate);
  const planBlockers = buildCandidatePlanBlockers(actionPlan);
  const candidateBlockers = candidates.flatMap((candidate) => candidate.blockers);
  const unresolvedCounts = countUnresolvedReviewActions(actionPlan);

  return {
    manifest_type: AI_HUB_LOCAL_CANDIDATE_MANIFEST,
    version: "ai-hub-local-candidate-manifest-v1.0",
    created_at: now.toISOString(),
    source_action_plan: sourceActionPlan(actionPlan),
    source_review_bundle: sourceReviewBundle(reviewBundle),
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    publish_allowed: false,
    media_attach_allowed: false,
    manifest_status: resolveCandidateManifestStatus({
      candidates,
      planBlockers,
      candidateBlockers,
      unresolvedCounts
    }),
    guardrails: [
      "local_candidates_only_no_wordpress_db_media_attach_or_publish",
      "human_approved_candidates_are_not_published_assets",
      "hero_anchor_can_seed_local_manifest_but_does_not_replace_product_reference",
      "support_candidates_must_keep_review_asset_traceability",
      "candidate_manifest_requires_later_wordpress_media_preflight",
      "unresolved_regen_or_manual_review_keeps_manifest_partial"
    ],
    plan_blockers: planBlockers,
    unresolved_review_actions: unresolvedCounts,
    summary: summarizeCandidateManifest(candidates, { planBlockers, candidateBlockers, unresolvedCounts }),
    items: groupCandidatesBySku(candidates, actionPlan, reviewBundle),
    candidates
  };
}

function collectRegenerationRequests(actionPlan) {
  const items = Array.isArray(actionPlan?.items) ? actionPlan.items : [];
  return items.flatMap((item) => (item.regeneration_requests || []).map((request) => ({
    ...request,
    sku: request.sku || item.sku || "",
    brand_id: item.brand_id || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    category: item.category || "",
    item_action_status: item.action_status || "",
    source_action_status: "ready_for_regeneration"
  })));
}

function selectRegenerationRequests(requests, { mode, maxRequests }) {
  const limit = Math.max(0, Number(maxRequests || DEFAULT_MAX_REGEN_REQUESTS));
  const filtered = requests.filter((request) => {
    if (mode === "support-only") return request.kind === "support";
    if (mode === "hero-only") return request.kind === "hero";
    return true;
  });
  return filtered.sort(compareRegenerationPriority).slice(0, limit);
}

function checkRegenerationRequest(request) {
  const blockers = [];
  const modelInputFiles = Array.isArray(request.model_input_files) ? request.model_input_files : [];
  const missingFiles = modelInputFiles.filter((file) => !file.local_path || file.staging_status !== "staged_local_file");

  if (!request.sku) blockers.push("missing_sku");
  if (!request.request_id) blockers.push("missing_request_id");
  if (!request.slot) blockers.push("missing_slot");
  if (!request.model) blockers.push("missing_model");
  if (!request.prompt) blockers.push("missing_prompt");
  if (request.kind === "support" && !request.approved_hero_anchor) blockers.push("support_regeneration_missing_approved_hero_anchor");
  if (!modelInputFiles.length) blockers.push("missing_model_input_files");
  if (missingFiles.length) blockers.push("missing_staged_model_input_file");

  return {
    ...request,
    gate_status: blockers.length ? "blocked" : "ready_for_manual_live_confirmation",
    blockers: Array.from(new Set(blockers)),
    estimated_units: 1,
    execution_policy: "do_not_execute_without_ai_hub_regen_gate"
  };
}

function buildPlanBlockers(actionPlan) {
  const blockers = [];
  if (actionPlan?.manifest_type !== "ai_hub_product_image_review_action_plan") blockers.push("invalid_or_missing_action_plan");
  const summary = actionPlan?.summary || {};
  if (Number(summary.pending_human_decision || 0) > 0) blockers.push("pending_human_decisions_must_be_resolved_first");
  if (Number(summary.blocked_actions || 0) > 0) blockers.push("blocked_review_actions_must_be_fixed_first");
  return blockers;
}

function buildLiveGateBlockers({ liveRequested, liveConfirmed, env }) {
  const blockers = [];
  if (liveRequested && !liveConfirmed) blockers.push("missing_explicit_live_confirmation");
  if (liveRequested && String(env.AI_GENERATION_LIVE_ENABLED || "").trim().toLowerCase() !== "true") {
    blockers.push("AI_GENERATION_LIVE_ENABLED_not_true");
  }
  if (liveRequested && !String(env.FAL_KEY || "").trim()) blockers.push("missing_FAL_KEY");
  return blockers;
}

function resolveRegenerationGateStatus({ liveGenerationAllowed, planBlockers, gateBlockers, requestBlockers, requests }) {
  if (!requests.length) return planBlockers.length ? "blocked_by_review_action_plan" : "no_regeneration_requests";
  if (liveGenerationAllowed) return "live_regeneration_armed";
  if (planBlockers.length || gateBlockers.length || requestBlockers.length) return "blocked_before_live_regeneration";
  return "ready_for_manual_live_confirmation";
}

function summarizeRegenerationGate(requests, { planBlockers, gateBlockers }) {
  const ready = requests.filter((request) => request.gate_status === "ready_for_manual_live_confirmation");
  const blocked = requests.filter((request) => request.gate_status === "blocked");
  return {
    selected_skus: new Set(requests.map((request) => request.sku).filter(Boolean)).size,
    selected_requests: requests.length,
    ready_requests: ready.length,
    blocked_requests: blocked.length,
    support_requests: requests.filter((request) => request.kind === "support").length,
    hero_requests: requests.filter((request) => request.kind === "hero").length,
    estimated_units: requests.reduce((total, request) => total + Number(request.estimated_units || 0), 0),
    plan_blockers: planBlockers.length,
    gate_blockers: gateBlockers.length
  };
}

function collectApprovedMediaCandidates(actionPlan) {
  return (actionPlan?.items || []).flatMap((item) => (item.approved_media_candidates || []).map((candidate) => ({
    ...candidate,
    brand_id: item.brand_id || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    category: item.category || ""
  })));
}

function collectApprovedHeroCandidates(reviewBundle, actionPlan) {
  const bundleItems = Array.isArray(reviewBundle?.review_items) ? reviewBundle.review_items : [];
  const actionItems = Array.isArray(actionPlan?.items) ? actionPlan.items : [];
  const actionItemBySku = new Map(actionItems.map((item) => [normalizeSku(item.sku), item]));
  return bundleItems.map((item) => {
    const hero = item.approved_hero_anchor || {};
    const actionItem = actionItemBySku.get(normalizeSku(item.sku)) || {};
    return {
      ...hero,
      sku: hero.sku || item.sku || "",
      brand_id: item.brand_id || actionItem.brand_id || "",
      target_site: item.target_site || actionItem.target_site || "",
      product_name: item.product_name || actionItem.product_name || "",
      category: item.category || actionItem.category || ""
    };
  }).filter((hero) => hero.sku && (hero.url || hero.public_url || hero.local_path));
}

function normalizeApprovedSupportCandidate(candidate) {
  return {
    sku: candidate.sku || "",
    brand_id: candidate.brand_id || "",
    target_site: candidate.target_site || "",
    product_name: candidate.product_name || "",
    category: candidate.category || "",
    kind: candidate.kind || "support",
    slot: candidate.slot || "",
    type: candidate.type || "support_generated",
    candidate_role: "approved_support_candidate",
    candidate_status: "local_candidate_pending_media_preflight",
    source_url: candidate.source_url || candidate.public_url || candidate.url || "",
    public_url: candidate.source_url || candidate.public_url || candidate.url || "",
    local_path: candidate.local_path || "",
    file_name: candidate.file_name || "",
    mime_type: candidate.mime_type || "",
    file_size: Number(candidate.file_size || 0),
    provider_request_id: candidate.provider_request_id || null,
    review_asset_id: candidate.review_asset_id || "",
    approved_by: candidate.approved_by || "",
    approved_note: candidate.approved_note || "",
    publish_status: "not_published_requires_later_media_preflight"
  };
}

function normalizeApprovedHeroCandidate(hero) {
  return {
    sku: hero.sku || "",
    brand_id: hero.brand_id || "",
    target_site: hero.target_site || "",
    product_name: hero.product_name || "",
    category: hero.category || "",
    kind: "hero",
    slot: "hero",
    type: hero.type || "hero_generated",
    candidate_role: "approved_hero_anchor",
    candidate_status: "local_candidate_pending_media_preflight",
    source_url: hero.public_url || hero.url || hero.source_url || "",
    public_url: hero.public_url || hero.url || hero.source_url || "",
    local_path: hero.local_path || "",
    file_name: hero.file_name || "",
    mime_type: hero.mime_type || "",
    file_size: Number(hero.file_size || 0),
    provider_request_id: hero.provider_request_id || null,
    review_asset_id: hero.review_asset_id || hero.id || "",
    approval_id: hero.approval_id || null,
    approved_at: hero.approved_at || null,
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
  return {
    ...candidate,
    candidate_status: blockers.length ? "blocked_candidate" : candidate.candidate_status,
    blockers: Array.from(new Set(blockers))
  };
}

function buildCandidatePlanBlockers(actionPlan) {
  const blockers = [];
  if (actionPlan?.manifest_type !== "ai_hub_product_image_review_action_plan") blockers.push("invalid_or_missing_action_plan");
  const summary = actionPlan?.summary || {};
  if (Number(summary.pending_human_decision || 0) > 0) blockers.push("pending_human_decisions_must_be_resolved_first");
  if (Number(summary.blocked_actions || 0) > 0) blockers.push("blocked_review_actions_must_be_fixed_first");
  return blockers;
}

function countUnresolvedReviewActions(actionPlan) {
  const summary = actionPlan?.summary || {};
  return {
    pending_human_decision: Number(summary.pending_human_decision || 0),
    regeneration_requests: Number(summary.regeneration_requests || 0),
    manual_review_assets: Number(summary.manual_review_assets || 0),
    blocked_actions: Number(summary.blocked_actions || 0),
    rejected_assets: Number(summary.rejected_assets || 0)
  };
}

function resolveCandidateManifestStatus({ candidates, planBlockers, candidateBlockers, unresolvedCounts }) {
  if (planBlockers.length || candidateBlockers.length) return "blocked_before_local_candidate_manifest";
  if (!candidates.length) return "no_local_candidates";
  if (unresolvedCounts.regeneration_requests > 0 || unresolvedCounts.manual_review_assets > 0) {
    return "partial_candidates_waiting_regen_or_manual_review";
  }
  return "ready_for_media_manifest_preflight";
}

function summarizeCandidateManifest(candidates, { planBlockers, candidateBlockers, unresolvedCounts }) {
  const ready = candidates.filter((candidate) => !candidate.blockers.length);
  return {
    sku_count: new Set(candidates.map((candidate) => candidate.sku).filter(Boolean)).size,
    candidate_count: candidates.length,
    ready_candidates: ready.length,
    blocked_candidates: candidates.length - ready.length,
    hero_candidates: candidates.filter((candidate) => candidate.kind === "hero").length,
    support_candidates: candidates.filter((candidate) => candidate.kind === "support").length,
    approved_support_candidates: candidates.filter((candidate) => candidate.candidate_role === "approved_support_candidate").length,
    approved_hero_anchors: candidates.filter((candidate) => candidate.candidate_role === "approved_hero_anchor").length,
    plan_blockers: planBlockers.length,
    candidate_blockers: candidateBlockers.length,
    unresolved_regeneration_requests: unresolvedCounts.regeneration_requests,
    unresolved_manual_review_assets: unresolvedCounts.manual_review_assets,
    pending_human_decision: unresolvedCounts.pending_human_decision
  };
}

function groupCandidatesBySku(candidates, actionPlan, reviewBundle) {
  const metadataBySku = new Map();
  for (const item of [...(reviewBundle?.review_items || []), ...(actionPlan?.items || [])]) {
    const sku = normalizeSku(item.sku);
    if (!sku || metadataBySku.has(sku)) continue;
    metadataBySku.set(sku, {
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      category: item.category || ""
    });
  }
  const skuSet = new Set([
    ...Array.from(metadataBySku.keys()),
    ...candidates.map((candidate) => normalizeSku(candidate.sku)).filter(Boolean)
  ]);
  return Array.from(skuSet).sort().map((sku) => {
    const itemCandidates = candidates.filter((candidate) => normalizeSku(candidate.sku) === sku);
    const metadata = metadataBySku.get(sku) || { sku };
    return {
      ...metadata,
      status: itemCandidates.some((candidate) => candidate.blockers.length)
        ? "has_blocked_candidates"
        : itemCandidates.length
          ? "local_candidates_ready_for_preflight_or_partial_review"
          : "no_local_candidates",
      candidate_count: itemCandidates.length,
      hero_count: itemCandidates.filter((candidate) => candidate.kind === "hero").length,
      support_count: itemCandidates.filter((candidate) => candidate.kind === "support").length,
      candidates: itemCandidates
    };
  });
}

function sourceActionPlan(actionPlan) {
  return {
    manifest_type: actionPlan?.manifest_type || null,
    version: actionPlan?.version || null,
    created_at: actionPlan?.created_at || null,
    summary: actionPlan?.summary || null
  };
}

function sourceReviewBundle(reviewBundle) {
  return {
    manifest_type: reviewBundle?.manifest_type || null,
    version: reviewBundle?.version || null,
    created_at: reviewBundle?.created_at || null,
    summary: reviewBundle?.summary || null
  };
}

function dedupeCandidates(candidates) {
  const map = new Map();
  for (const candidate of candidates) {
    const key = [
      normalizeSku(candidate.sku),
      candidate.kind,
      candidate.slot,
      candidate.review_asset_id || candidate.local_path || candidate.source_url
    ].join(":");
    if (!map.has(key)) map.set(key, candidate);
  }
  return Array.from(map.values()).sort(compareCandidatePriority);
}

function compareCandidatePriority(a, b) {
  return candidateScore(b) - candidateScore(a) || String(a.slot || "").localeCompare(String(b.slot || ""), "en");
}

function candidateScore(candidate) {
  let score = 0;
  if (candidate.kind === "hero") score += 100;
  if (candidate.candidate_role === "approved_support_candidate") score += 50;
  if (candidate.source_url) score += 5;
  if (candidate.local_path) score += 5;
  return score;
}

function compareRegenerationPriority(a, b) {
  return regenerationScore(b) - regenerationScore(a) || String(a.request_id || "").localeCompare(String(b.request_id || ""), "en");
}

function regenerationScore(request) {
  let score = 0;
  if (request.kind === "hero") score += 20;
  if (request.kind === "support") score += 10;
  if (request.approved_hero_anchor) score += 5;
  return score;
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
