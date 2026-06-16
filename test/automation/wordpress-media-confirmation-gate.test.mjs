import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
  buildWordPressMediaAttachConfirmationGate
} from "../../lib/automation/wordpress-media-confirmation-gate.mjs";

test("buildWordPressMediaAttachConfirmationGate creates final-confirmation operations without live writes", () => {
  const gate = buildWordPressMediaAttachConfirmationGate({
    task: { id: "task-confirm", batch_id: "batch-1" },
    mediaPreflight: {
      batch_id: "batch-1",
      items: [{
        sku: "2DJ0493000",
        target_site: "gomall",
        media_status: "ready_for_media_proposal",
        proposed_main_image: { id: "asset-hero", url: "https://cdn.example.test/hero.png", type: "hero_generated", shot_key: "hero" },
        proposed_gallery_images: [
          { id: "asset-front", url: "https://cdn.example.test/front.png", type: "support_generated", shot_key: "front_view" },
          { id: "asset-back", url: "https://cdn.example.test/back.png", type: "support_generated", shot_key: "back_view" }
        ],
        blockers: []
      }]
    },
    now: new Date("2026-06-16T00:00:00.000Z")
  });

  assert.equal(gate.task_type, WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK);
  assert.equal(gate.gate_status, "awaiting_final_confirmation");
  assert.equal(gate.live_write_allowed, false);
  assert.equal(gate.live_writes_enabled, false);
  assert.equal(gate.media_attach_allowed, false);
  assert.equal(gate.requires_final_confirmation, true);
  assert.equal(gate.summary.ready_for_confirmation, 1);
  assert.equal(gate.summary.proposed_operations, 3);
  assert.equal(gate.summary.proposed_main_image_updates, 1);
  assert.equal(gate.summary.proposed_gallery_image_updates, 2);
  assert.equal(gate.items[0].confirmation_status, "ready_for_final_confirmation");
  assert.equal(gate.items[0].proposed_operations[0].operation_type, "set_product_main_image");
  assert.equal(gate.items[0].proposed_operations[1].operation_type, "append_gallery_image");
  assert.equal(gate.items[0].proposed_operations[1].idempotency_key, "media_attach:2DJ0493000:batch-1:gallery:front_view");
  assert.match(JSON.stringify(gate), /final_confirmation_required_before_media_attach/);
  assert.doesNotMatch(JSON.stringify(gate), /media_attach_allowed":true|live_write_allowed":true|publish_now|attach_now/i);
});

test("buildWordPressMediaAttachConfirmationGate blocks confirmation when media preflight is not ready", () => {
  const gate = buildWordPressMediaAttachConfirmationGate({
    task: { id: "task-confirm", batch_id: "batch-1" },
    mediaPreflight: {
      batch_id: "batch-1",
      items: [{
        sku: "2DJ0493000",
        target_site: "gomall",
        media_status: "awaiting_media_assets",
        proposed_main_image: null,
        proposed_gallery_images: [],
        blockers: ["missing_hero_media", "missing_support_media"]
      }]
    }
  });

  assert.equal(gate.gate_status, "blocked_before_final_confirmation");
  assert.equal(gate.summary.ready_for_confirmation, 0);
  assert.equal(gate.summary.blocked, 1);
  assert.equal(gate.summary.proposed_operations, 0);
  assert.equal(gate.items[0].confirmation_status, "blocked_before_final_confirmation");
  assert.deepEqual(gate.items[0].blockers, ["media_preflight_not_ready", "missing_hero_media", "missing_support_media"]);
});
