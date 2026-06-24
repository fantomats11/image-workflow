export function buildSupportReviewDecisionState({
  sku = "",
  approvedHeroAnchor = null,
  supportAssets = [],
  decisions = [],
  reviewer = "",
  now = new Date()
} = {}) {
  const hasApprovedHeroAnchor = Boolean(heroAnchorSource(approvedHeroAnchor));
  const decisionByAssetKey = new Map(
    (decisions || []).map(normalizeDecision).map((decision) => [decision.asset_key, decision])
  );
  const assets = (supportAssets || []).map((asset) => {
    const key = assetKey(asset);
    const decision = decisionByAssetKey.get(key) || null;
    const decisionValue = decision?.decision || "pending_support_qc";
    const reasonRequired = ["regenerate_support", "reject_support"].includes(decisionValue) && !decision?.reason;
    return {
      asset_key: key,
      asset_id: asset.asset_id || asset.id || null,
      generation_id: asset.generation_id || null,
      request_id: asset.request_id || null,
      sku: asset.sku || sku || "",
      slot: asset.slot || asset.shot_key || "",
      public_url: asset.public_url || asset.source_url || asset.url || "",
      file_name: asset.file_name || "",
      decision: decisionValue,
      reason: decision?.reason || "",
      reason_required: reasonRequired,
      note: decision?.note || "",
      reviewer: decision?.reviewer || reviewer || "",
      decided_at: decision ? now.toISOString() : null
    };
  });
  const summary = summarizeAssets(assets);
  const blockers = buildBlockers(summary, { hasApprovedHeroAnchor });

  return {
    manifest_type: "support_review_decision_state",
    version: "support-review-decision-state-v1.0",
    created_at: now.toISOString(),
    sku: sku || assets[0]?.sku || "",
    reviewer: reviewer || "",
    approved_hero_anchor: approvedHeroAnchor || null,
    review_status: resolveReviewStatus(summary, { hasApprovedHeroAnchor }),
    candidate_manifest_ready: summary.total > 0 && summary.approved === summary.total && !blockers.length,
    blockers,
    summary,
    assets
  };
}

function normalizeDecision(decision = {}) {
  const normalizedDecision = normalizeDecisionValue(decision.decision || decision.action || "");
  const key = decision.asset_key ||
    decision.asset_id ||
    decision.id ||
    decision.generation_id ||
    decision.request_id ||
    decision.public_url ||
    decision.source_url ||
    "";
  return {
    asset_key: String(key || "").trim(),
    decision: normalizedDecision,
    reason: String(decision.reason || "").trim(),
    note: String(decision.note || "").trim(),
    reviewer: String(decision.reviewer || "").trim()
  };
}

function normalizeDecisionValue(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approve" || normalized === "approved" || normalized === "approve_support") return "approve_support";
  if (normalized === "regenerate" || normalized === "regen" || normalized === "regenerate_support") return "regenerate_support";
  if (normalized === "reject" || normalized === "rejected" || normalized === "reject_support") return "reject_support";
  if (normalized === "needs_review" || normalized === "manual_review") return "needs_manual_review";
  return "pending_support_qc";
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

function summarizeAssets(assets) {
  return {
    total: assets.length,
    approved: assets.filter((asset) => asset.decision === "approve_support").length,
    regenerate: assets.filter((asset) => asset.decision === "regenerate_support").length,
    rejected: assets.filter((asset) => asset.decision === "reject_support").length,
    manual_review: assets.filter((asset) => asset.decision === "needs_manual_review").length,
    pending: assets.filter((asset) => asset.decision === "pending_support_qc").length,
    missing_required_reasons: assets.filter((asset) => asset.reason_required).length
  };
}

function buildBlockers(summary, { hasApprovedHeroAnchor = false } = {}) {
  const blockers = [];
  if (!summary.total) blockers.push("missing_support_assets");
  if (summary.approved && !hasApprovedHeroAnchor) blockers.push("support_review_requires_approved_hero_anchor");
  if (summary.missing_required_reasons) blockers.push("support_decision_reason_required");
  if (summary.regenerate) blockers.push("support_regeneration_requested");
  if (summary.rejected) blockers.push("support_rejected");
  if (summary.manual_review) blockers.push("support_needs_manual_review");
  if (summary.pending) blockers.push("support_decisions_pending");
  return blockers;
}

function resolveReviewStatus(summary, { hasApprovedHeroAnchor = false } = {}) {
  if (!summary.total) return "missing_support_assets";
  if (summary.approved && !hasApprovedHeroAnchor) return "support_review_requires_approved_hero_anchor";
  if (summary.missing_required_reasons) return "support_decision_reason_required";
  if (summary.regenerate) return "support_regeneration_requested";
  if (summary.rejected) return "support_rejected";
  if (summary.manual_review) return "support_needs_manual_review";
  if (summary.pending) return "support_ready_for_review";
  if (summary.approved === summary.total) return "support_approved_for_candidate_manifest";
  return "support_ready_for_review";
}

function heroAnchorSource(anchor = {}) {
  if (!anchor || typeof anchor !== "object") return "";
  return anchor.public_url || anchor.url || anchor.source_url || anchor.local_path || anchor.storage_key || anchor.asset_id || anchor.id || "";
}
