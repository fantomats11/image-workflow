import {
  AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST,
  buildAiHubImageReviewActionPlan
} from "./ai-hub-review-action-plan.mjs";

export const AI_HUB_REVIEW_DECISION_WORKFLOW_VERSION = "ai-hub-review-decision-workflow-v1.0";

const ALLOWED_ACTIONS = new Set([
  "approve_asset",
  "regenerate_slot",
  "reject_asset",
  "needs_manual_review"
]);

export function buildAiHubReviewDecisionSubmission({
  reviewBundle = {},
  decisions = [],
  reviewer = "",
  source = "ai_hub_review_console",
  now = new Date()
} = {}) {
  const reviewAssetById = buildReviewAssetIndex(reviewBundle);
  const normalizedDecisions = normalizeSubmittedDecisions({
    decisions,
    reviewAssetById,
    reviewer
  });
  const decisionManifest = {
    manifest_type: AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST,
    version: "ai-hub-review-decisions-v1.0",
    workflow_version: AI_HUB_REVIEW_DECISION_WORKFLOW_VERSION,
    created_at: now.toISOString(),
    reviewer: String(reviewer || "").trim(),
    source,
    dry_run: true,
    live_write_allowed: false,
    guardrails: [
      "local_decision_artifact_only",
      "decisions_do_not_publish_or_attach_media",
      "action_plan_required_before_any_downstream_work",
      "blocking_flags_prevent_auto_approval"
    ],
    decisions: normalizedDecisions
  };
  const actionPlan = buildAiHubImageReviewActionPlan({
    reviewBundle,
    decisions: decisionManifest,
    reviewer,
    now
  });

  return {
    workflow_version: AI_HUB_REVIEW_DECISION_WORKFLOW_VERSION,
    created_at: now.toISOString(),
    dry_run: true,
    live_write_allowed: false,
    summary: {
      submitted_decisions: normalizedDecisions.length,
      unknown_review_assets: normalizedDecisions.filter((decision) => decision.validation_status === "unknown_review_asset").length,
      valid_decisions: normalizedDecisions.filter((decision) => decision.validation_status === "valid").length,
      approved_media_candidates: actionPlan.summary.approved_media_candidates,
      regeneration_requests: actionPlan.summary.regeneration_requests,
      blocked_actions: actionPlan.summary.blocked_actions,
      pending_human_decision: actionPlan.summary.pending_human_decision
    },
    decisions: decisionManifest,
    action_plan: actionPlan
  };
}

export function normalizeSubmittedDecisions({
  decisions = [],
  reviewAssetById = new Map(),
  reviewer = ""
} = {}) {
  return (Array.isArray(decisions) ? decisions : [])
    .map((decision) => normalizeSubmittedDecision({ decision, reviewAssetById, reviewer }))
    .filter((decision) => decision.review_asset_id || decision.request_id);
}

function normalizeSubmittedDecision({ decision = {}, reviewAssetById, reviewer }) {
  const reviewAssetId = String(decision.review_asset_id || decision.request_id || "").trim();
  const asset = reviewAssetById.get(reviewAssetId) || null;
  const action = normalizeAction(decision.action);
  const flags = normalizeStringList(decision.flags);
  const passedChecks = normalizeStringList(decision.passed_checks);
  const notes = String(decision.notes || "").trim().slice(0, 2000);
  const validationBlockers = [];

  if (!asset) validationBlockers.push("unknown_review_asset");
  if (!ALLOWED_ACTIONS.has(action)) validationBlockers.push("unsupported_review_action");
  if (action === "approve_asset" && flags.length) validationBlockers.push("approve_requires_no_qc_flags");

  return {
    review_asset_id: reviewAssetId,
    request_id: asset?.request_id || String(decision.request_id || reviewAssetId),
    sku: asset?.sku || String(decision.sku || ""),
    slot: asset?.slot || String(decision.slot || ""),
    action,
    reviewer: String(decision.reviewer || reviewer || "").trim(),
    flags,
    passed_checks: passedChecks,
    notes,
    validation_status: validationBlockers.length ? "invalid" : "valid",
    validation_blockers: validationBlockers
  };
}

function buildReviewAssetIndex(reviewBundle) {
  const index = new Map();
  (reviewBundle.review_items || []).forEach((item) => {
    (item.review_assets || []).forEach((asset) => {
      const ids = [asset.review_asset_id, asset.request_id].map((id) => String(id || "").trim()).filter(Boolean);
      ids.forEach((id) => index.set(id, asset));
    });
  });
  return index;
}

function normalizeAction(value) {
  const action = String(value || "").trim();
  return action || "needs_manual_review";
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\n,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
