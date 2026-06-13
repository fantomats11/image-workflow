export const LIVE_PILOT_GENERATION_GATE_TASK = "live_pilot_generation_gate";

const DEFAULT_MAX_REQUESTS = 12;

export function buildLivePilotGenerationGate({
  generationPlan = {},
  mode = "hero-only",
  maxRequests = DEFAULT_MAX_REQUESTS,
  requestFilter = {},
  liveRequested = false,
  liveConfirmed = false,
  env = process.env,
  now = new Date()
} = {}) {
  const allRequests = collectRequests(generationPlan);
  const selectedRequests = selectRequests(allRequests, { mode, maxRequests, requestFilter });
  const checkedRequests = selectedRequests.map((request) => checkRequest(request));
  const gateBlockers = buildGateBlockers({ liveRequested, liveConfirmed, env });
  const requestBlockers = checkedRequests.flatMap((request) => request.blockers);
  const liveExecutionAllowed = Boolean(liveRequested && liveConfirmed && !gateBlockers.length && !requestBlockers.length);

  return {
    manifest_type: LIVE_PILOT_GENERATION_GATE_TASK,
    batch_id: generationPlan.batch_id || null,
    dry_run: !liveExecutionAllowed,
    created_at: now.toISOString(),
    mode,
    max_requests: maxRequests,
    live_generation_requested: Boolean(liveRequested),
    live_generation_confirmed: Boolean(liveConfirmed),
    live_generation_allowed: liveExecutionAllowed,
    live_write_allowed: false,
    live_writes_enabled: false,
    proposed_execution_scope: "image_model_generation_only",
    gate_status: liveExecutionAllowed
      ? "live_generation_armed"
      : gateBlockers.length || requestBlockers.length
        ? "blocked_before_live_generation"
        : "ready_for_manual_live_confirmation",
    guardrails: [
      "hero_only_wave_before_support_batch",
      "support_generation_requires_approved_hero_anchor",
      "requires_AI_GENERATION_LIVE_ENABLED_true",
      "requires_explicit_live_confirmation_flag",
      "requires_FAL_KEY_for_current_generation_provider",
      "no_wordpress_or_supabase_write_in_gate_phase",
      "record_generation_results_in_later_execution_phase"
    ],
    gate_blockers: gateBlockers,
    summary: summarizeRequests(checkedRequests, gateBlockers),
    requests: checkedRequests
  };
}

function collectRequests(generationPlan) {
  const items = Array.isArray(generationPlan?.items) ? generationPlan.items : [];
  return items.flatMap((item) => {
    const itemBlockers = Array.isArray(item.blockers) ? item.blockers : [];
    return (item.generation_requests || []).map((request) => ({
      ...request,
      sku: request.sku || item.sku || "",
      brand_id: item.brand_id || "",
      target_site: item.target_site || "",
      product_name: item.product_name || "",
      item_generation_status: item.generation_status || "",
      item_blockers: itemBlockers
    }));
  });
}

function selectRequests(requests, { mode, maxRequests, requestFilter = {} }) {
  const filtered = requests.filter((request) => {
    if (!matchesRequestFilter(request, requestFilter)) return false;
    if (mode === "all") return true;
    if (mode === "hero-only") return request.kind === "hero";
    return request.priority_required === true;
  });
  return filtered.sort(compareRequestPriority).slice(0, Math.max(0, Number(maxRequests || DEFAULT_MAX_REQUESTS)));
}

function matchesRequestFilter(request, filter = {}) {
  if (filter.requestId && request.request_id !== filter.requestId) return false;
  if (filter.sku && normalizeFilterValue(request.sku) !== normalizeFilterValue(filter.sku)) return false;
  if (filter.brandId && normalizeFilterValue(request.brand_id) !== normalizeFilterValue(filter.brandId)) return false;
  if (filter.slot && normalizeFilterValue(request.slot) !== normalizeFilterValue(filter.slot)) return false;
  if (filter.kind && normalizeFilterValue(request.kind) !== normalizeFilterValue(filter.kind)) return false;
  return true;
}

function checkRequest(request) {
  const blockers = [];
  const modelInputFiles = Array.isArray(request.model_input_files) ? request.model_input_files : [];
  const missingFiles = modelInputFiles.filter((file) => !file.local_path || file.staging_status !== "staged_local_file");

  if (!request.sku) blockers.push("missing_sku");
  if (request.request_status !== "ready_for_live_generation") blockers.push("request_not_ready_for_live_generation");
  if (request.item_blockers?.length) blockers.push("item_has_blockers");
  if (!request.prompt) blockers.push("missing_prompt");
  if (!modelInputFiles.length) blockers.push("missing_model_input_files");
  if (missingFiles.length) blockers.push("missing_staged_model_input_file");

  return {
    ...request,
    gate_status: blockers.length ? "blocked" : "ready",
    blockers: Array.from(new Set(blockers)),
    estimated_units: 1,
    execution_policy: "do_not_execute_without_live_gate"
  };
}

function buildGateBlockers({ liveRequested, liveConfirmed, env }) {
  const blockers = [];
  if (liveRequested && !liveConfirmed) blockers.push("missing_explicit_live_confirmation");
  if (liveRequested && String(env.AI_GENERATION_LIVE_ENABLED || "").trim().toLowerCase() !== "true") {
    blockers.push("AI_GENERATION_LIVE_ENABLED_not_true");
  }
  if (liveRequested && !String(env.FAL_KEY || "").trim()) blockers.push("missing_FAL_KEY");
  return blockers;
}

function summarizeRequests(requests, gateBlockers) {
  const ready = requests.filter((request) => request.gate_status === "ready");
  const blocked = requests.filter((request) => request.gate_status !== "ready");
  const skuSet = new Set(requests.map((request) => request.sku).filter(Boolean));
  return {
    selected_skus: skuSet.size,
    selected_requests: requests.length,
    ready_requests: ready.length,
    blocked_requests: blocked.length,
    hero_requests: requests.filter((request) => request.kind === "hero").length,
    support_requests: requests.filter((request) => request.kind === "support").length,
    estimated_units: requests.reduce((total, request) => total + Number(request.estimated_units || 0), 0),
    gate_blockers: gateBlockers.length
  };
}

function compareRequestPriority(a, b) {
  return requestScore(b) - requestScore(a);
}

function requestScore(request) {
  let score = 0;
  if (request.priority_required) score += 100;
  if (request.kind === "hero") score += 20;
  score -= Number(request.sequence || 99);
  return score;
}

function normalizeFilterValue(value = "") {
  return String(value || "").trim().toLowerCase();
}
