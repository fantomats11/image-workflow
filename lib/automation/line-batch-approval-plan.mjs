import { GENERATE_BATCH_TASK } from "./pilot-generation-execution-plan.mjs";

export function buildLineBatchApprovalTaskRequests({
  action = {},
  automationBatchId = null,
  lineUserId = null,
  dryRun = true
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
      dry_run: Boolean(dryRun),
      next_gate: "hero_generation_before_support_and_wordpress"
    }
  }];
}
