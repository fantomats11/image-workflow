import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK,
  buildWordPressMediaAttachExecutionPlan
} from "../../lib/automation/wordpress-media-attach-execution-plan.mjs";

function sampleConfirmationGate() {
  return {
    batch_id: "batch-1",
    gate_status: "awaiting_final_confirmation",
    live_write_allowed: false,
    media_attach_allowed: false,
    requires_final_confirmation: true,
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "The North Face White Cream Puffer Jacket",
      confirmation_status: "ready_for_final_confirmation",
      proposed_operations: [
        {
          operation_type: "set_product_main_image",
          role: "main_image",
          sku: "2DJ0493000",
          target_site: "gomall",
          idempotency_key: "media_attach:2DJ0493000:batch-1:main_image",
          source_asset: { id: "hero", url: "https://cdn.example.test/hero.png", type: "hero_generated", shot_key: "hero" }
        },
        {
          operation_type: "append_gallery_image",
          role: "gallery_image",
          sku: "2DJ0493000",
          target_site: "gomall",
          gallery_index: 1,
          slot: "front_view",
          idempotency_key: "media_attach:2DJ0493000:batch-1:gallery:front_view",
          source_asset: { id: "front", url: "https://cdn.example.test/front.png", type: "support_generated", shot_key: "front_view" }
        }
      ],
      blockers: []
    }]
  };
}

test("buildWordPressMediaAttachExecutionPlan creates an idempotent no-write plan while awaiting final confirmation", () => {
  const plan = buildWordPressMediaAttachExecutionPlan({
    task: { id: "task-plan", batch_id: "batch-1" },
    confirmationGate: sampleConfirmationGate(),
    now: new Date("2026-06-16T00:00:00.000Z")
  });

  assert.equal(plan.task_type, WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK);
  assert.equal(plan.plan_status, "awaiting_final_confirmation");
  assert.equal(plan.execution_allowed, false);
  assert.equal(plan.live_write_allowed, false);
  assert.equal(plan.media_attach_allowed, false);
  assert.equal(plan.requires_remote_refetch, true);
  assert.equal(plan.summary.proposed_operations, 2);
  assert.equal(plan.summary.awaiting_final_confirmation, 2);
  assert.equal(plan.summary.ready_for_live_write_phase, 0);
  assert.equal(plan.summary.duplicate_idempotency_keys, 0);
  assert.equal(plan.operations[0].operation_status, "awaiting_final_confirmation");
  assert.equal(plan.idempotency_ledger.length, 2);
  assert.equal(plan.idempotency_ledger[0].idempotency_key, "media_attach:2DJ0493000:batch-1:main_image");
  assert.match(JSON.stringify(plan), /remote_refetch_required_before_media_attach/);
  assert.doesNotMatch(JSON.stringify(plan), /execution_allowed":true|media_attach_allowed":true|live_write_allowed":true|POST|PUT|PATCH|DELETE|attach_now|publish_now/i);
});

test("buildWordPressMediaAttachExecutionPlan marks operations ready for a later live-write phase only after final confirmation", () => {
  const plan = buildWordPressMediaAttachExecutionPlan({
    task: { id: "task-plan", batch_id: "batch-1" },
    confirmationGate: sampleConfirmationGate(),
    finalConfirmation: {
      confirmed: true,
      actor_id: "admin-user",
      confirmed_at: "2026-06-16T01:00:00.000Z"
    },
    env: { WORDPRESS_LIVE_WRITES_ENABLED: "false" }
  });

  assert.equal(plan.plan_status, "ready_for_live_write_phase");
  assert.equal(plan.execution_allowed, false);
  assert.equal(plan.live_writes_enabled, false);
  assert.equal(plan.final_confirmation.confirmed, true);
  assert.equal(plan.summary.ready_for_live_write_phase, 2);
  assert.equal(plan.summary.awaiting_final_confirmation, 0);
  assert.equal(plan.operations[0].operation_status, "ready_for_live_write_phase");
  assert.match(JSON.stringify(plan), /live_write_phase_required_before_execution/);
});
