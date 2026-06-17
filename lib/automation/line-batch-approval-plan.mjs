import { GENERATE_BATCH_TASK } from "./pilot-generation-execution-plan.mjs";

export function buildLineBatchApprovalTaskRequests({
  action = {},
  automationBatchId = null,
  lineUserId = null,
  actorId = null,
  dryRun = true,
  liveGenerationRequested = false,
  liveGenerationConfirmed = false
} = {}) {
  if (action.action !== "approve_batch" || !action.batchId) return [];

  return [{
    taskType: GENERATE_BATCH_TASK,
    batchId: automationBatchId,
    dedupeKey: `line:approve_batch:${action.batchId}`,
    priority: 100,
    payload: {
      source: "line",
      action: action.action,
      batch_id: action.batchId,
      line_user_id: lineUserId,
      actor_id: actorId || null,
      dry_run: Boolean(dryRun),
      generation_phase: "hero_after_batch_approval",
      request_mode: "hero-only-after-batch-approval",
      auto_enqueue_live_hero: true,
      live_generation_requested: Boolean(liveGenerationRequested),
      live_generation_confirmed: Boolean(liveGenerationConfirmed),
      next_gate: "hero_generation_before_support_and_wordpress"
    }
  }];
}
