import test from "node:test";
import assert from "node:assert/strict";
import { buildLineBatchApprovalTaskRequests } from "../../lib/automation/line-batch-approval-plan.mjs";
import { GENERATE_BATCH_TASK } from "../../lib/automation/pilot-generation-execution-plan.mjs";
import { WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK } from "../../lib/automation/wordpress-publish-preflight.mjs";
import { WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK } from "../../lib/automation/wordpress-media-preflight.mjs";

test("LINE approve batch queues hero generation only before WordPress/media gates", () => {
  const requests = buildLineBatchApprovalTaskRequests({
    action: {
      action: "approve_batch",
      batchId: "line-keyword-20260617T073516Z"
    },
    automationBatchId: "batch-uuid",
    lineUserId: "line-user",
    actorId: "actor-1",
    liveGenerationRequested: true,
    liveGenerationConfirmed: true,
    dryRun: true
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].taskType, GENERATE_BATCH_TASK);
  assert.equal(requests[0].batchId, "batch-uuid");
  assert.equal(requests[0].dedupeKey, "line:approve_batch:line-keyword-20260617T073516Z");
  assert.equal(requests[0].payload.next_gate, "hero_generation_before_support_and_wordpress");
  assert.equal(requests[0].payload.generation_phase, "hero_after_batch_approval");
  assert.equal(requests[0].payload.request_mode, "hero-only-after-batch-approval");
  assert.equal(requests[0].payload.auto_enqueue_live_hero, true);
  assert.equal(requests[0].payload.live_generation_requested, true);
  assert.equal(requests[0].payload.live_generation_confirmed, true);
  assert.equal(requests[0].payload.actor_id, "actor-1");

  const serialized = JSON.stringify(requests);
  assert.equal(serialized.includes(WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK), false);
  assert.equal(serialized.includes(WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK), false);
});

test("LINE batch approval plan ignores non-approval actions", () => {
  assert.deepEqual(buildLineBatchApprovalTaskRequests({
    action: { action: "needs_review", batchId: "line-keyword" }
  }), []);
});
