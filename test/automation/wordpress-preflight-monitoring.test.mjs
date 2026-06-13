import test from "node:test";
import assert from "node:assert/strict";
import { buildMonitoringWordPressPreflights } from "../../lib/automation/wordpress-preflight-monitoring.mjs";

test("buildMonitoringWordPressPreflights compacts completed preflight task payloads", () => {
  const rows = buildMonitoringWordPressPreflights([
    {
      id: "task-old",
      task_type: "wordpress_product_publish_preflight",
      batch_id: "batch-old",
      dedupe_key: "line:old",
      status: "completed",
      completed_at: "2026-06-11T00:00:00.000Z",
      payload: {
        preflight: {
          dry_run: true,
          live_write_allowed: false,
          live_writes_enabled: false,
          requires_final_confirmation: true,
          summary: {
            item_count: 1,
            ready_for_proposal: 1
          },
          items: []
        }
      }
    },
    {
      id: "task-new",
      task_type: "wordpress_product_publish_preflight",
      batch_id: "batch-new",
      dedupe_key: "line:new",
      status: "completed",
      completed_at: "2026-06-12T00:00:00.000Z",
      payload: {
        preflight: {
          dry_run: true,
          live_write_allowed: false,
          live_writes_enabled: false,
          requires_final_confirmation: true,
          summary: {
            item_count: 2,
            ready_for_proposal: 1,
            blocked: 1,
            remote_checked: 2,
            remote_sku_exists: 1
          },
          items: [{
            sku: "GM-001",
            brand_id: "go_mall",
            target_site: "gomall",
            product_type: "coat",
            preflight_status: "blocked",
            proposed_action: "review_existing_product",
            blockers: ["remote_sku_exists"],
            remote_checks: {
              status: "checked",
              product_by_sku: { status: "found" }
            }
          }]
        }
      }
    },
    {
      id: "task-ignore",
      task_type: "generate_batch",
      payload: {}
    }
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].taskId, "task-new");
  assert.equal(rows[0].liveWriteAllowed, false);
  assert.equal(rows[0].liveWritesEnabled, false);
  assert.equal(rows[0].requiresFinalConfirmation, true);
  assert.equal(rows[0].summary.remoteSkuExists, 1);
  assert.equal(rows[0].items[0].remoteSkuStatus, "found");
  assert.deepEqual(rows[0].items[0].blockers, ["remote_sku_exists"]);
});
