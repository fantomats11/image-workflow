export const AI_HUB_IMAGE_REVIEW_ACTION_PLAN_MANIFEST = "ai_hub_product_image_review_action_plan";
export const AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST = "ai_hub_product_image_review_decisions";

const DECISION_ACTIONS = new Set([
  "approve_asset",
  "regenerate_slot",
  "reject_asset",
  "needs_manual_review"
]);

export function buildAiHubImageReviewActionPlan({
  reviewBundle = {},
  decisions = {},
  reviewer = "",
  now = new Date()
} = {}) {
  const normalizedDecisions = normalizeDecisions(decisions, reviewer);
  const decisionByAssetId = new Map(
    normalizedDecisions.map((decision) => [decision.review_asset_id || decision.request_id, decision])
  );
  const reviewItems = Array.isArray(reviewBundle.review_items) ? reviewBundle.review_items : [];
  const items = reviewItems.map((item) => buildActionPlanItem({ item, decisionByAssetId }));
  const actions = items.flatMap((item) => item.actions);

  return {
    manifest_type: AI_HUB_IMAGE_REVIEW_ACTION_PLAN_MANIFEST,
    version: "ai-hub-review-action-plan-v1.0",
    created_at: now.toISOString(),
    source_bundle: {
      manifest_type: reviewBundle.manifest_type || null,
      version: reviewBundle.version || null,
      created_at: reviewBundle.created_at || null,
      batch_id: reviewBundle.source_plan?.batch_id || null
    },
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    guardrails: [
      "local_action_plan_only_no_wordpress_or_db_write",
      "human_decision_required_before_approval",
      "approved_candidates_are_not_published_media",
      "regeneration_requests_require_live_generation_gate",
      "technical_marking_failures_should_regenerate_or_hold"
    ],
    summary: summarizeActions(items, actions),
    items
  };
}

export function buildAiHubImageReviewDecisionTemplate({
  reviewBundle = {},
  reviewer = "",
  now = new Date()
} = {}) {
  const reviewItems = Array.isArray(reviewBundle.review_items) ? reviewBundle.review_items : [];
  const reviewAssets = reviewItems.flatMap((item) => item.review_assets || []);

  return {
    manifest_type: AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST,
    version: "ai-hub-review-decisions-v1.0",
    created_at: now.toISOString(),
    reviewer,
    decision_mode: "human_review_required",
    decisions: reviewAssets.map((asset) => ({
      review_asset_id: asset.review_asset_id || asset.request_id || "",
      request_id: asset.request_id || "",
      sku: asset.sku || "",
      slot: asset.slot || "",
      action: "needs_manual_review",
      flags: [],
      passed_checks: [],
      notes: ""
    }))
  };
}

function buildActionPlanItem({ item, decisionByAssetId }) {
  const reviewAssets = Array.isArray(item.review_assets) ? item.review_assets : [];
  const actions = reviewAssets.map((asset) => buildAssetAction({
    asset,
    decision: decisionByAssetId.get(asset.review_asset_id || asset.request_id) || null
  }));

  return {
    sku: item.sku || "",
    brand_id: item.brand_id || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    category: item.category || "",
    action_status: resolveItemActionStatus(actions),
    approved_media_candidates: actions.filter((action) => action.action === "approve_asset" && action.action_status === "ready_for_media_manifest").map((action) => action.media_candidate),
    regeneration_requests: actions.filter((action) => action.action === "regenerate_slot" && action.action_status === "ready_for_regeneration").map((action) => action.regeneration_request),
    rejected_assets: actions.filter((action) => action.action === "reject_asset"),
    manual_review_assets: actions.filter((action) => action.action === "needs_manual_review"),
    pending_assets: actions.filter((action) => action.action_status === "pending_human_decision"),
    blocked_actions: actions.filter((action) => action.action_status === "blocked"),
    actions
  };
}

function buildAssetAction({ asset, decision }) {
  const action = normalizeAction(decision?.action);
  const blockers = buildActionBlockers({ asset, decision, action });
  const base = {
    review_asset_id: asset.review_asset_id || asset.request_id || "",
    request_id: asset.request_id || "",
    sku: asset.sku || "",
    kind: asset.kind || "",
    slot: asset.slot || "",
    action,
    action_status: resolveActionStatus({ action, blockers, hasDecision: Boolean(decision) }),
    reviewer: decision?.reviewer || "",
    flags: Array.isArray(decision?.flags) ? decision.flags : [],
    passed_checks: Array.isArray(decision?.passed_checks) ? decision.passed_checks : [],
    notes: decision?.notes || "",
    blockers
  };

  if (action === "approve_asset") {
    return {
      ...base,
      media_candidate: buildMediaCandidate(asset, decision)
    };
  }
  if (action === "regenerate_slot") {
    return {
      ...base,
      regeneration_request: buildRegenerationRequest(asset, decision)
    };
  }
  return base;
}

function buildActionBlockers({ asset, decision, action }) {
  const blockers = [];
  if (!decision) {
    blockers.push("missing_human_decision");
    return blockers;
  }
  if (!DECISION_ACTIONS.has(action)) blockers.push("unsupported_review_action");
  const allowedActions = Array.isArray(asset.review_actions) ? asset.review_actions : [];
  if (allowedActions.length && !allowedActions.includes(action)) blockers.push("action_not_allowed_for_asset");
  if (action === "approve_asset" && !hasGeneratedAsset(asset)) blockers.push("approve_requires_generated_asset");
  if (action === "approve_asset" && hasBlockingFlags(decision)) blockers.push("approve_has_blocking_qc_flags");
  if (action === "regenerate_slot" && !asset.prompt) blockers.push("regenerate_requires_original_prompt");
  return Array.from(new Set(blockers));
}

function buildMediaCandidate(asset, decision = {}) {
  const generated = asset.generated || {};
  return {
    sku: asset.sku || "",
    kind: asset.kind || "",
    slot: asset.slot || "",
    type: asset.kind === "hero" ? "hero_generated" : "support_generated",
    status: "ai_hub_review_approved_candidate",
    source_url: generated.source_url || "",
    local_path: generated.local_path || "",
    file_name: generated.file_name || "",
    mime_type: generated.mime_type || "",
    file_size: generated.file_size || 0,
    provider_request_id: generated.provider_request_id || null,
    review_asset_id: asset.review_asset_id || asset.request_id || "",
    approved_by: decision.reviewer || "",
    approved_note: decision.notes || "",
    publish_status: "not_published_requires_later_media_preflight"
  };
}

function buildRegenerationRequest(asset, decision = {}) {
  return {
    request_id: asset.request_id || "",
    sku: asset.sku || "",
    kind: asset.kind || "",
    slot: asset.slot || "",
    model: asset.model || null,
    prompt_framework_version: asset.prompt_framework_version || null,
    prompt: asset.prompt || "",
    approved_hero_anchor: asset.approved_hero_anchor || null,
    reference_assets: Array.isArray(asset.reference_assets) ? asset.reference_assets : [],
    model_input_files: Array.isArray(asset.model_input_files) ? asset.model_input_files : [],
    reason: decision.notes || "requested_from_ai_hub_review",
    flags: Array.isArray(decision.flags) ? decision.flags : [],
    write_policy: "requires_live_generation_gate_before_model_call"
  };
}

function normalizeDecisions(decisions, fallbackReviewer) {
  const decisionRows = Array.isArray(decisions?.decisions)
    ? decisions.decisions
    : Array.isArray(decisions)
      ? decisions
      : [];
  return decisionRows.map((decision) => ({
    ...decision,
    review_asset_id: decision.review_asset_id || decision.request_id || "",
    request_id: decision.request_id || decision.review_asset_id || "",
    action: normalizeAction(decision.action),
    reviewer: decision.reviewer || decisions.reviewer || fallbackReviewer || ""
  })).filter((decision) => decision.review_asset_id || decision.request_id);
}

function normalizeAction(value) {
  const action = String(value || "").trim();
  return action || "needs_manual_review";
}

function resolveActionStatus({ action, blockers, hasDecision }) {
  if (!hasDecision) return "pending_human_decision";
  if (blockers.length) return "blocked";
  if (action === "approve_asset") return "ready_for_media_manifest";
  if (action === "regenerate_slot") return "ready_for_regeneration";
  if (action === "reject_asset") return "rejected_no_further_action";
  return "held_for_manual_review";
}

function resolveItemActionStatus(actions) {
  if (!actions.length) return "no_review_assets";
  if (actions.every((action) => action.action_status === "ready_for_media_manifest")) return "approved_candidates_ready";
  if (actions.some((action) => action.action_status === "blocked")) return "has_blocked_actions";
  if (actions.some((action) => action.action_status === "pending_human_decision")) return "pending_human_decisions";
  if (actions.some((action) => action.action_status === "ready_for_regeneration")) return "has_regeneration_requests";
  return "review_actions_resolved";
}

function summarizeActions(items, actions) {
  return {
    sku_count: items.length,
    review_action_count: actions.length,
    pending_human_decision: actions.filter((action) => action.action_status === "pending_human_decision").length,
    approved_media_candidates: actions.filter((action) => action.action_status === "ready_for_media_manifest").length,
    regeneration_requests: actions.filter((action) => action.action_status === "ready_for_regeneration").length,
    rejected_assets: actions.filter((action) => action.action_status === "rejected_no_further_action").length,
    manual_review_assets: actions.filter((action) => action.action_status === "held_for_manual_review").length,
    blocked_actions: actions.filter((action) => action.action_status === "blocked").length
  };
}

function hasGeneratedAsset(asset) {
  return Boolean(asset?.generated?.source_url || asset?.generated?.local_path);
}

function hasBlockingFlags(decision) {
  return (decision.flags || []).some((flag) => /mismatch|wrong|invented|missing|required|blocked|occluded|hallucination/i.test(String(flag || "")));
}
