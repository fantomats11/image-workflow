import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK,
  buildWordPressMediaRemoteRefetchPreflight
} from "../../lib/automation/wordpress-media-remote-refetch-preflight.mjs";

test("remote refetch preflight marks ready operations after read-only product check", () => {
  const preflight = buildWordPressMediaRemoteRefetchPreflight({
    task: { id: "task-refetch", batch_id: "batch-1" },
    executionPlan: {
      batch_id: "batch-1",
      plan_status: "ready_for_live_write_phase",
      operations: [
        {
          sku: "SKU001",
          target_site: "gomall",
          role: "main_image",
          operation_type: "set_product_main_image",
          operation_status: "ready_for_live_write_phase",
          idempotency_key: "media_attach:SKU001:batch-1:main",
          source_asset: { id: "hero", url: "https://cdn.example.test/hero.png" }
        },
        {
          sku: "SKU001",
          target_site: "gomall",
          role: "gallery_image",
          operation_type: "append_gallery_image",
          operation_status: "ready_for_live_write_phase",
          idempotency_key: "media_attach:SKU001:batch-1:gallery:1",
          source_asset: { id: "side", url: "https://cdn.example.test/side.png" }
        }
      ]
    },
    remoteResults: {
      items: [{
        sku: "SKU001",
        target_site: "gomall",
        product_remote_status: "found",
        product_id: 123,
        permalink: "https://shop.example.test/product/sku001",
        current_main_image_id: 11,
        current_gallery_image_ids: [12, 13],
        media_matches: [{ id: 11, source_url: "https://shop.example.test/wp-content/old-main.png" }]
      }]
    },
    now: new Date("2026-06-16T01:00:00.000Z")
  });

  assert.equal(preflight.task_type, WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK);
  assert.equal(preflight.preflight_status, "ready_for_live_write_phase_review");
  assert.equal(preflight.live_write_allowed, false);
  assert.equal(preflight.media_attach_allowed, false);
  assert.equal(preflight.execution_allowed, false);
  assert.equal(preflight.requires_remote_refetch, false);
  assert.equal(preflight.summary.item_count, 1);
  assert.equal(preflight.summary.operation_count, 2);
  assert.equal(preflight.summary.remote_products_found, 1);
  assert.equal(preflight.summary.remote_media_matches, 1);
  assert.equal(preflight.items[0].product_id, 123);
  assert.equal(preflight.items[0].operations[0].remote_refetch_status, "checked");
  assert.equal(preflight.items[0].operations[0].operation_status, "remote_checked_ready");
  assert.doesNotMatch(JSON.stringify(preflight), /attach_now|publish_now/i);
});

test("remote refetch preflight blocks when product can no longer be found", () => {
  const preflight = buildWordPressMediaRemoteRefetchPreflight({
    task: { id: "task-refetch", batch_id: "batch-1" },
    executionPlan: {
      batch_id: "batch-1",
      plan_status: "ready_for_live_write_phase",
      operations: [{
        sku: "SKU404",
        target_site: "gomall",
        role: "main_image",
        operation_type: "set_product_main_image",
        operation_status: "ready_for_live_write_phase",
        idempotency_key: "media_attach:SKU404:batch-1:main",
        source_asset: { id: "hero", url: "https://cdn.example.test/hero.png" }
      }]
    },
    remoteResults: {
      items: [{
        sku: "SKU404",
        target_site: "gomall",
        product_remote_status: "not_found",
        blockers: ["remote_product_not_found"]
      }]
    },
    now: new Date("2026-06-16T01:00:00.000Z")
  });

  assert.equal(preflight.preflight_status, "blocked_before_live_write_phase");
  assert.equal(preflight.summary.ready_items, 0);
  assert.equal(preflight.summary.blocked, 1);
  assert.deepEqual(preflight.items[0].blockers, ["remote_product_not_found"]);
  assert.equal(preflight.items[0].operations[0].operation_status, "blocked_before_live_write_phase");
  assert.equal(preflight.items[0].operations[0].remote_refetch_status, "blocked");
});
