import { buildLivePilotGenerationGate } from "./live-pilot-generation-gate.mjs";
import { executeLivePilotGenerationGate } from "./live-pilot-generation-executor.mjs";

export const LIVE_PILOT_GENERATION_SMOKE_TEST_TASK = "live_pilot_generation_smoke_test";

export async function runLivePilotGenerationSmokeTest({
  generationPlan = {},
  mode = "hero-only",
  requestFilter = {},
  liveRequested = false,
  liveConfirmed = false,
  readinessOnly = false,
  env = process.env,
  providerGenerate,
  now = new Date()
} = {}) {
  const gate = buildLivePilotGenerationGate({
    generationPlan,
    mode,
    maxRequests: 1,
    requestFilter,
    liveRequested,
    liveConfirmed,
    env,
    now
  });
  const execution = await executeLivePilotGenerationGate({
    gate,
    liveRequested,
    liveConfirmed,
    env,
    maxRequests: 1,
    providerGenerate: readinessOnly ? undefined : providerGenerate,
    now
  });

  return {
    manifest_type: LIVE_PILOT_GENERATION_SMOKE_TEST_TASK,
    batch_id: generationPlan.batch_id || gate.batch_id || null,
    created_at: now.toISOString(),
    dry_run: execution.dry_run,
    readiness_only: Boolean(readinessOnly),
    live_generation_requested: Boolean(liveRequested),
    live_generation_confirmed: Boolean(liveConfirmed),
    live_generation_allowed: execution.live_generation_allowed,
    smoke_status: resolveSmokeStatus({ gate, execution, readinessOnly }),
    guardrails: [
      "single_request_hero_smoke_test_before_support_wave",
      "readiness_only_mode_must_not_call_provider",
      "no_wordpress_or_supabase_write_in_smoke_phase",
      "record_generated_assets_before_later_qc_or_publish"
    ],
    summary: {
      selected_requests: gate.summary.selected_requests,
      ready_requests: gate.summary.ready_requests,
      blocked_requests: gate.summary.blocked_requests,
      executed_requests: execution.summary.executed_requests,
      skipped_requests: execution.summary.skipped_requests,
      failed_requests: execution.summary.failed_requests,
      generated_images: execution.summary.generated_images,
      generated_assets: execution.summary.generated_assets,
      gate_blockers: gate.gate_blockers.length,
      execution_blockers: execution.execution_blockers.length
    },
    gate,
    execution
  };
}

function resolveSmokeStatus({ gate, execution, readinessOnly }) {
  if (execution.summary.failed_requests > 0) return "smoke_execution_failed";
  if (execution.summary.executed_requests > 0 && execution.summary.generated_images > 0) return "smoke_generated_asset_ready_for_qc";
  if (execution.summary.executed_requests > 0) return "smoke_executed_without_generated_images";
  if (readinessOnly && gate.summary.ready_requests > 0 && gate.gate_blockers.length === 0) return "ready_for_live_smoke_execution";
  if (gate.summary.ready_requests > 0) return "blocked_before_live_smoke_execution";
  return "not_ready_for_live_smoke_execution";
}
