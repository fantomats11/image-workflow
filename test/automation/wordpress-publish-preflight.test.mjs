import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK,
  buildWordPressProductPublishPreflight,
  buildWordPressProductPublishPreflightWithRemoteChecks
} from "../../lib/automation/wordpress-publish-preflight.mjs";

test("builds a dry-run WooCommerce publish preflight proposal without allowing live writes", () => {
  const proposal = buildWordPressProductPublishPreflight({
    task: { id: "task-1", batch_id: "batch-1" },
    batchItems: [{
      id: "item-1",
      sku: "RAC-001",
      product_type: "rental",
      target_site: "rentacoat",
      product_name: "เสื้อโค้ท",
      status: "approved",
      woo_status: "not_found",
      metadata: { brand_id: "rent_a_coat" }
    }],
    dryRun: true,
    now: new Date("2026-06-12T00:00:00Z")
  });

  assert.equal(proposal.task_type, WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK);
  assert.equal(proposal.live_write_allowed, false);
  assert.equal(proposal.live_writes_enabled, false);
  assert.equal(proposal.requires_final_confirmation, true);
  assert.equal(proposal.summary.create_draft_product, 1);
  assert.equal(proposal.items[0].proposed_action, "create_draft_product");
  assert.equal(proposal.items[0].preflight_status, "ready_for_proposal");
});

test("remote checks can block a draft proposal when SKU already exists", async () => {
  const proposal = await buildWordPressProductPublishPreflightWithRemoteChecks({
    task: { id: "task-1", batch_id: "batch-1", payload: { dry_run: true } },
    batchItems: [{
      id: "item-1",
      sku: "SKU001",
      target_site: "gomall",
      status: "approved",
      metadata: { brand_id: "go_mall" }
    }],
    env: {
      WORDPRESS_REMOTE_READS_ENABLED: "true",
      GOMALL_WP_SITE_URL: "https://shop.example.com",
      GOMALL_WOO_CONSUMER_KEY: "ck_test",
      GOMALL_WOO_CONSUMER_SECRET: "cs_test"
    },
    fetchImpl: async (url) => {
      if (String(url).includes("/products?")) {
        return jsonResponse([{ id: 99, sku: "SKU001", name: "Existing Product" }]);
      }
      return jsonResponse([]);
    },
    now: new Date("2026-06-12T00:00:00Z")
  });

  assert.equal(proposal.summary.remote_checked, 1);
  assert.equal(proposal.summary.remote_sku_exists, 1);
  assert.equal(proposal.items[0].proposed_action, "review_existing_product");
  assert.ok(proposal.items[0].blockers.includes("remote_sku_exists"));
});

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("marks existing WooCommerce SKU as skip without write", () => {
  const proposal = buildWordPressProductPublishPreflight({
    batchItems: [{
      id: "item-1",
      sku: "GM-001",
      target_site: "gomall",
      status: "sku_exists",
      woo_status: "found",
      metadata: { brand_id: "go_mall" }
    }]
  });

  assert.equal(proposal.summary.skip_existing_sku, 1);
  assert.equal(proposal.items[0].proposed_action, "skip_existing_sku");
  assert.equal(proposal.items[0].write_policy, "no_write_without_explicit_update_request");
});

test("blocks incomplete items before any publish proposal", () => {
  const proposal = buildWordPressProductPublishPreflight({
    batchItems: [{
      id: "item-1",
      sku: "",
      status: "draft",
      metadata: {}
    }]
  });

  assert.equal(proposal.summary.blocked, 1);
  assert.deepEqual(proposal.items[0].blockers, [
    "missing_sku",
    "missing_brand_id",
    "missing_target_site",
    "not_approved"
  ]);
});
