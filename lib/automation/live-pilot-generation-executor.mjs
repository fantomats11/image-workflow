export const LIVE_PILOT_GENERATION_EXECUTION_TASK = "live_pilot_generation_execution";

export async function executeLivePilotGenerationGate({
  gate = {},
  liveRequested = false,
  liveConfirmed = false,
  env = process.env,
  maxRequests = null,
  providerGenerate,
  now = new Date()
} = {}) {
  const requests = (gate.requests || []).filter((request) => request.gate_status === "ready");
  const hasRequestLimit = maxRequests !== null && maxRequests !== undefined && maxRequests !== "";
  const selectedRequests = hasRequestLimit && Number.isFinite(Number(maxRequests))
    ? requests.slice(0, Math.max(0, Number(maxRequests)))
    : requests;
  const executionBlockers = buildExecutionBlockers({ gate, liveRequested, liveConfirmed, env, providerGenerate });
  const liveExecutionAllowed = executionBlockers.length === 0;
  const results = [];

  for (const request of selectedRequests) {
    if (!liveExecutionAllowed) {
      results.push(buildSkippedResult(request, executionBlockers));
      continue;
    }
    try {
      const result = await providerGenerate(request);
      results.push(buildDoneResult(request, result));
    } catch (error) {
      results.push(buildFailedResult(request, error));
    }
  }

  return {
    manifest_type: LIVE_PILOT_GENERATION_EXECUTION_TASK,
    batch_id: gate.batch_id || null,
    created_at: now.toISOString(),
    dry_run: !liveExecutionAllowed,
    live_generation_requested: Boolean(liveRequested),
    live_generation_confirmed: Boolean(liveConfirmed),
    live_generation_allowed: liveExecutionAllowed,
    source_gate_status: gate.gate_status || "",
    execution_status: liveExecutionAllowed
      ? results.some((result) => result.execution_status === "failed")
        ? "completed_with_failures"
        : "completed"
      : "blocked_or_dry_run",
    guardrails: [
      "execute_only_ready_gate_requests",
      "requires_gate_live_generation_allowed",
      "requires_cli_live_confirmation",
      "write_local_execution_artifact_before_asset_recording",
      "do_not_write_wordpress_or_supabase_in_executor_phase"
    ],
    execution_blockers: executionBlockers,
    summary: summarizeResults(results, executionBlockers),
    results
  };
}

function buildExecutionBlockers({ gate, liveRequested, liveConfirmed, env, providerGenerate }) {
  const blockers = [];
  if (gate.gate_status !== "live_generation_armed" || gate.live_generation_allowed !== true) {
    blockers.push("gate_not_armed_for_live_generation");
  }
  if (!liveRequested) blockers.push("missing_cli_live_flag");
  if (!liveConfirmed) blockers.push("missing_cli_live_confirmation");
  if (String(env.AI_GENERATION_LIVE_ENABLED || "").trim().toLowerCase() !== "true") {
    blockers.push("AI_GENERATION_LIVE_ENABLED_not_true");
  }
  if (!String(env.FAL_KEY || "").trim()) blockers.push("missing_FAL_KEY");
  if (
    liveRequested &&
    liveConfirmed &&
    String(env.AI_GENERATION_LIVE_ENABLED || "").trim().toLowerCase() === "true" &&
    gate.gate_status === "live_generation_armed" &&
    gate.live_generation_allowed === true &&
    typeof providerGenerate !== "function"
  ) {
    blockers.push("missing_provider_generate_callback");
  }
  return Array.from(new Set(blockers));
}

function buildSkippedResult(request, executionBlockers) {
  return {
    request_id: request.request_id || null,
    sku: request.sku || "",
    kind: request.kind || "",
    slot: request.slot || "",
    execution_status: "skipped",
    blockers: executionBlockers,
    provider_request_id: null,
    generated_images: [],
    generated_assets: []
  };
}

function buildDoneResult(request, result = {}) {
  const images = Array.isArray(result.images) ? result.images : [];
  return {
    request_id: request.request_id || null,
    sku: request.sku || "",
    kind: request.kind || "",
    slot: request.slot || "",
    execution_status: "done",
    blockers: [],
    provider_request_id: result.provider_request_id || result.requestId || null,
    generated_images: images,
    generated_assets: images.map((image, index) => ({
      sku: request.sku || "",
      kind: request.kind || "",
      slot: request.slot || "",
      type: request.kind === "hero" ? "hero_generated" : "support_generated",
      source_url: image.url || "",
      local_path: image.local_path || "",
      file_name: image.file_name || "",
      mime_type: image.contentType || image.content_type || "",
      file_size: image.file_size || 0,
      image_index: index + 1
    }))
  };
}

function buildFailedResult(request, error) {
  return {
    request_id: request.request_id || null,
    sku: request.sku || "",
    kind: request.kind || "",
    slot: request.slot || "",
    execution_status: "failed",
    blockers: [],
    provider_request_id: null,
    generated_images: [],
    generated_assets: [],
    error: error?.message || String(error)
  };
}

function summarizeResults(results, executionBlockers) {
  return {
    selected_requests: results.length,
    executed_requests: results.filter((result) => result.execution_status === "done").length,
    skipped_requests: results.filter((result) => result.execution_status === "skipped").length,
    failed_requests: results.filter((result) => result.execution_status === "failed").length,
    generated_images: results.reduce((total, result) => total + result.generated_images.length, 0),
    generated_assets: results.reduce((total, result) => total + result.generated_assets.length, 0),
    execution_blockers: executionBlockers.length
  };
}
