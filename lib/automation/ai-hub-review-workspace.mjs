export const AI_HUB_REVIEW_WORKSPACE_MANIFEST = "ai_hub_product_image_review_workspace";

export function buildAiHubReviewWorkspace({
  artifacts = [],
  now = new Date()
} = {}) {
  const normalizedArtifacts = artifacts
    .map(normalizeArtifact)
    .filter((artifact) => artifact.manifest_type);
  const skuMap = new Map();

  normalizedArtifacts.forEach((artifact) => {
    extractSkuRecords(artifact).forEach((record) => {
      if (!record.sku) return;
      const sku = normalizeSku(record.sku);
      if (!skuMap.has(sku)) skuMap.set(sku, emptySkuWorkspace(record.sku));
      mergeSkuRecord(skuMap.get(sku), record, artifact);
    });
  });

  const items = Array.from(skuMap.values())
    .map(finalizeSkuWorkspace)
    .sort(compareWorkspaceItems);

  return {
    manifest_type: AI_HUB_REVIEW_WORKSPACE_MANIFEST,
    version: "ai-hub-review-workspace-v1.0",
    created_at: now.toISOString(),
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    guardrails: [
      "workspace_is_local_review_index_only",
      "no_wordpress_db_media_attach_or_publish_in_workspace_phase",
      "human_qc_required_before_media_candidate_use",
      "regeneration_requests_require_separate_live_generation_gate",
      "approved_candidates_are_local_candidates_not_published_assets"
    ],
    summary: summarizeWorkspace(items, normalizedArtifacts),
    items
  };
}

function normalizeArtifact(input = {}) {
  const content = input.content || input;
  return {
    file_name: input.file_name || input.fileName || "",
    file_path: input.file_path || input.filePath || "",
    mtime_ms: Number(input.mtime_ms || input.mtimeMs || 0),
    manifest_type: content.manifest_type || "",
    version: content.version || "",
    created_at: content.created_at || null,
    content
  };
}

function extractSkuRecords(artifact) {
  if (artifact.manifest_type === "ai_hub_product_image_review_bundle") {
    return (artifact.content.review_items || []).map((item) => ({
      source_type: "review_bundle",
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      category: item.category || "",
      review_status: item.review_status || "",
      review_asset_count: (item.review_assets || []).length,
      generated_asset_count: (item.review_assets || []).filter((asset) => asset.generated?.source_url || asset.generated?.local_path).length,
      pending_human_qc: (item.review_assets || []).filter((asset) => asset.qc?.review_status === "pending_human_qc").length
    }));
  }

  if (artifact.manifest_type === "ai_hub_product_image_review_decisions") {
    return groupDecisionRecordsBySku(artifact.content.decisions || []).map((record) => ({
      source_type: "review_decisions",
      ...record
    }));
  }

  if (artifact.manifest_type === "ai_hub_product_image_review_action_plan") {
    return (artifact.content.items || []).map((item) => ({
      source_type: "review_action_plan",
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      category: item.category || "",
      action_status: item.action_status || "",
      review_action_count: (item.actions || []).length,
      pending_human_decision: (item.pending_assets || []).length,
      approved_media_candidates: (item.approved_media_candidates || []).length,
      regeneration_requests: (item.regeneration_requests || []).length,
      rejected_assets: (item.rejected_assets || []).length,
      manual_review_assets: (item.manual_review_assets || []).length,
      blocked_actions: (item.blocked_actions || []).length
    }));
  }

  if (artifact.manifest_type === "ai_hub_product_image_regeneration_gate") {
    return groupRegenerationGateRecordsBySku(artifact.content.requests || []).map((record) => ({
      source_type: "regeneration_gate",
      gate_status: artifact.content.gate_status || "",
      source_action_plan_created_at: artifact.content.source_action_plan?.created_at || null,
      ...record
    }));
  }

  if (artifact.manifest_type === "ai_hub_product_image_local_candidate_manifest") {
    return (artifact.content.items || []).map((item) => ({
      source_type: "local_candidate_manifest",
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      category: item.category || "",
      manifest_status: artifact.content.manifest_status || item.status || "",
      source_action_plan_created_at: artifact.content.source_action_plan?.created_at || null,
      candidate_count: item.candidate_count || 0,
      hero_count: item.hero_count || 0,
      support_count: item.support_count || 0,
      ready_candidates: (item.candidates || []).filter((candidate) => !candidate.blockers?.length).length,
      blocked_candidates: (item.candidates || []).filter((candidate) => candidate.blockers?.length).length
    }));
  }

  return [];
}

function groupRegenerationGateRecordsBySku(requests) {
  const map = new Map();
  requests.forEach((request) => {
    const sku = normalizeSku(request.sku);
    if (!sku) return;
    if (!map.has(sku)) {
      map.set(sku, {
        sku,
        brand_id: request.brand_id || "",
        target_site: request.target_site || "",
        product_name: request.product_name || "",
        category: request.category || "",
        regeneration_gate_requests: 0,
        ready_regeneration_requests: 0,
        blocked_regeneration_requests: 0
      });
    }
    const record = map.get(sku);
    record.regeneration_gate_requests += 1;
    if (request.gate_status === "ready_for_manual_live_confirmation") record.ready_regeneration_requests += 1;
    if (request.gate_status === "blocked") record.blocked_regeneration_requests += 1;
  });
  return Array.from(map.values());
}

function groupDecisionRecordsBySku(decisions) {
  const map = new Map();
  decisions.forEach((decision) => {
    const sku = normalizeSku(decision.sku || String(decision.review_asset_id || "").split(":")[0]);
    if (!sku) return;
    if (!map.has(sku)) {
      map.set(sku, {
        sku,
        decision_count: 0,
        approve_asset: 0,
        regenerate_slot: 0,
        reject_asset: 0,
        needs_manual_review: 0,
        invalid_decisions: 0
      });
    }
    const record = map.get(sku);
    record.decision_count += 1;
    const action = decision.action || "needs_manual_review";
    if (Object.prototype.hasOwnProperty.call(record, action)) record[action] += 1;
    if (decision.validation_status === "invalid") record.invalid_decisions += 1;
  });
  return Array.from(map.values());
}

function emptySkuWorkspace(sku) {
  return {
    sku,
    brand_id: "",
    target_site: "",
    product_name: "",
    category: "",
    latest_review_bundle: null,
    latest_decisions: null,
    latest_action_plan: null,
    latest_regeneration_gate: null,
    latest_candidate_manifest: null,
    artifacts: []
  };
}

function mergeSkuRecord(item, record, artifact) {
  for (const key of ["brand_id", "target_site", "product_name", "category"]) {
    if (!item[key] && record[key]) item[key] = record[key];
  }
  item.artifacts.push(compactArtifactRecord(artifact, record));

  if (record.source_type === "review_bundle" && isNewerArtifact(artifact, item.latest_review_bundle)) {
    item.latest_review_bundle = {
      ...compactArtifactRecord(artifact, record),
      review_status: record.review_status,
      review_asset_count: record.review_asset_count,
      generated_asset_count: record.generated_asset_count,
      pending_human_qc: record.pending_human_qc
    };
  }
  if (record.source_type === "review_decisions" && isNewerArtifact(artifact, item.latest_decisions)) {
    item.latest_decisions = {
      ...compactArtifactRecord(artifact, record),
      decision_count: record.decision_count,
      approve_asset: record.approve_asset,
      regenerate_slot: record.regenerate_slot,
      reject_asset: record.reject_asset,
      needs_manual_review: record.needs_manual_review,
      invalid_decisions: record.invalid_decisions
    };
  }
  if (record.source_type === "review_action_plan" && isNewerArtifact(artifact, item.latest_action_plan)) {
    item.latest_action_plan = {
      ...compactArtifactRecord(artifact, record),
      action_status: record.action_status,
      review_action_count: record.review_action_count,
      pending_human_decision: record.pending_human_decision,
      approved_media_candidates: record.approved_media_candidates,
      regeneration_requests: record.regeneration_requests,
      rejected_assets: record.rejected_assets,
      manual_review_assets: record.manual_review_assets,
      blocked_actions: record.blocked_actions
    };
  }
  if (record.source_type === "regeneration_gate" && isNewerArtifact(artifact, item.latest_regeneration_gate)) {
    item.latest_regeneration_gate = {
      ...compactArtifactRecord(artifact, record),
      gate_status: record.gate_status,
      source_action_plan_created_at: record.source_action_plan_created_at,
      regeneration_gate_requests: record.regeneration_gate_requests,
      ready_regeneration_requests: record.ready_regeneration_requests,
      blocked_regeneration_requests: record.blocked_regeneration_requests
    };
  }
  if (record.source_type === "local_candidate_manifest" && isNewerArtifact(artifact, item.latest_candidate_manifest)) {
    item.latest_candidate_manifest = {
      ...compactArtifactRecord(artifact, record),
      manifest_status: record.manifest_status,
      source_action_plan_created_at: record.source_action_plan_created_at,
      candidate_count: record.candidate_count,
      hero_count: record.hero_count,
      support_count: record.support_count,
      ready_candidates: record.ready_candidates,
      blocked_candidates: record.blocked_candidates
    };
  }
}

function finalizeSkuWorkspace(item) {
  const latestActionPlan = item.latest_action_plan;
  const latestBundle = item.latest_review_bundle;
  const latestDecisions = item.latest_decisions;
  const currentRegenerationGate = isForLatestActionPlan(item.latest_regeneration_gate, latestActionPlan) ? item.latest_regeneration_gate : null;
  const currentCandidateManifest = isForLatestActionPlan(item.latest_candidate_manifest, latestActionPlan) ? item.latest_candidate_manifest : null;
  const workspaceStatus = resolveWorkspaceStatus({ latestActionPlan, latestBundle, latestDecisions });
  return {
    ...item,
    latest_regeneration_gate: item.latest_regeneration_gate
      ? {
        ...item.latest_regeneration_gate,
        stale_for_latest_action_plan: !currentRegenerationGate
      }
      : null,
    latest_candidate_manifest: item.latest_candidate_manifest
      ? {
        ...item.latest_candidate_manifest,
        stale_for_latest_action_plan: !currentCandidateManifest
      }
      : null,
    workspace_status: workspaceStatus,
    next_action: resolveNextAction(workspaceStatus),
    counts: {
      review_assets: latestBundle?.review_asset_count || 0,
      generated_assets: latestBundle?.generated_asset_count || 0,
      pending_human_qc: latestBundle?.pending_human_qc || 0,
      pending_human_decision: latestActionPlan?.pending_human_decision || 0,
      approved_media_candidates: latestActionPlan?.approved_media_candidates || 0,
      regeneration_requests: latestActionPlan?.regeneration_requests || 0,
      regeneration_gate_requests: currentRegenerationGate?.regeneration_gate_requests || 0,
      ready_regeneration_requests: currentRegenerationGate?.ready_regeneration_requests || 0,
      local_candidates: currentCandidateManifest?.candidate_count || 0,
      ready_local_candidates: currentCandidateManifest?.ready_candidates || 0,
      blocked_actions: latestActionPlan?.blocked_actions || 0,
      invalid_decisions: latestDecisions?.invalid_decisions || 0
    },
    artifacts: item.artifacts.sort(compareArtifactRecords)
  };
}

function isForLatestActionPlan(artifact, latestActionPlan) {
  if (!artifact) return false;
  if (!latestActionPlan?.created_at) return true;
  return artifact.source_action_plan_created_at === latestActionPlan.created_at;
}

function resolveWorkspaceStatus({ latestActionPlan, latestBundle, latestDecisions }) {
  if (!latestBundle) return "missing_review_bundle";
  if (!latestActionPlan) return "needs_action_plan";
  if (latestActionPlan.blocked_actions > 0 || latestDecisions?.invalid_decisions > 0) return "blocked_review_actions";
  if (latestActionPlan.pending_human_decision > 0) return "awaiting_human_decisions";
  if (latestActionPlan.regeneration_requests > 0) return "ready_for_regeneration_gate";
  if (latestActionPlan.manual_review_assets > 0) return "held_for_manual_review";
  if (latestActionPlan.approved_media_candidates > 0) return "approved_candidates_ready_for_local_manifest";
  if (latestBundle.pending_human_qc > 0) return "awaiting_human_qc";
  return "review_index_ready";
}

function resolveNextAction(status) {
  const actions = {
    missing_review_bundle: "build_review_bundle",
    needs_action_plan: "collect_decisions_or_build_pending_action_plan",
    blocked_review_actions: "fix_decision_flags_or_hold_assets",
    awaiting_human_decisions: "open_review_console_and_submit_decisions",
    ready_for_regeneration_gate: "build_regeneration_gate_from_action_plan",
    held_for_manual_review: "manual_review_or_reject_remaining_assets",
    approved_candidates_ready_for_local_manifest: "build_local_media_candidate_manifest_after_qc",
    awaiting_human_qc: "open_review_console_and_complete_qc",
    review_index_ready: "continue_ai_hub_review"
  };
  return actions[status] || "continue_ai_hub_review";
}

function summarizeWorkspace(items, artifacts) {
  return {
    sku_count: items.length,
    artifact_count: artifacts.length,
    review_bundle_count: artifacts.filter((artifact) => artifact.manifest_type === "ai_hub_product_image_review_bundle").length,
    decision_artifact_count: artifacts.filter((artifact) => artifact.manifest_type === "ai_hub_product_image_review_decisions").length,
    action_plan_count: artifacts.filter((artifact) => artifact.manifest_type === "ai_hub_product_image_review_action_plan").length,
    regeneration_gate_count: artifacts.filter((artifact) => artifact.manifest_type === "ai_hub_product_image_regeneration_gate").length,
    local_candidate_manifest_count: artifacts.filter((artifact) => artifact.manifest_type === "ai_hub_product_image_local_candidate_manifest").length,
    awaiting_human_decisions: items.filter((item) => item.workspace_status === "awaiting_human_decisions").length,
    ready_for_regeneration_gate: items.filter((item) => item.workspace_status === "ready_for_regeneration_gate").length,
    approved_candidates_ready: items.filter((item) => item.workspace_status === "approved_candidates_ready_for_local_manifest").length,
    blocked_review_actions: items.filter((item) => item.workspace_status === "blocked_review_actions").length
  };
}

function compactArtifactRecord(artifact, record) {
  return {
    source_type: record.source_type,
    manifest_type: artifact.manifest_type,
    version: artifact.version,
    file_name: artifact.file_name,
    file_path: artifact.file_path,
    created_at: artifact.created_at,
    mtime_ms: artifact.mtime_ms
  };
}

function isNewerArtifact(artifact, current) {
  if (!current) return true;
  return artifactTime(artifact) >= artifactTime(current);
}

function compareWorkspaceItems(left, right) {
  return statusPriority(left.workspace_status) - statusPriority(right.workspace_status) ||
    left.sku.localeCompare(right.sku, "en");
}

function compareArtifactRecords(left, right) {
  return artifactTime(right) - artifactTime(left);
}

function statusPriority(status) {
  const priorities = {
    blocked_review_actions: 0,
    awaiting_human_decisions: 1,
    ready_for_regeneration_gate: 2,
    held_for_manual_review: 3,
    awaiting_human_qc: 4,
    needs_action_plan: 5,
    approved_candidates_ready_for_local_manifest: 6,
    review_index_ready: 7,
    missing_review_bundle: 8
  };
  return priorities[status] ?? 99;
}

function artifactTime(artifact) {
  const created = new Date(artifact?.created_at || 0).getTime() || 0;
  return created || Number(artifact?.mtime_ms || 0);
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
