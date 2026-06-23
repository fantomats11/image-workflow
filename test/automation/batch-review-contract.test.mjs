import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBatchReviewPayload,
  isBatchCancelable,
  isItemRetryable,
  isItemSkippable,
  resolveBatchAllowedActions,
  resolveItemAllowedActions
} from "../../lib/automation/batch-review-contract.mjs";

const sampleBatch = {
  id: "batch-uuid",
  batch_key: "line-keyword-20260623T010203Z",
  source: "line_keyword",
  status: "awaiting_approval",
  dry_run: true,
  requested_size: 2,
  item_count: 2,
  command_text: "BATCH รองเท้า=1 เสื้อ=1",
  created_at: "2026-06-23T01:02:03.000Z",
  updated_at: "2026-06-23T01:02:03.000Z",
  metadata: {
    selection: {
      source: "line_keyword_batch_intake",
      raw_text: "BATCH รองเท้า=1 เสื้อ=1",
      requested_counts: [
        { key: "shoes", label: "รองเท้า", product_type: "รองเท้า", count: 1 },
        { key: "apparel", label: "เสื้อ", product_type: "เสื้อ", count: 1 }
      ],
      selected_counts: { shoes: 1, apparel: 1 },
      requested_size: 2,
      selected_size: 2,
      shortfalls: []
    }
  }
};

const sampleItems = [{
  id: "item-shoes",
  batch_id: "batch-uuid",
  sku: "R24CBF0013",
  product_type: "รองเท้า",
  target_site: "rentacoat",
  product_name: "Snow Boot",
  status: "awaiting_approval",
  metadata: {
    brand_id: "rent_a_coat",
    brand_label: "Rent A Coat",
    reference_manifest: { source_url: "https://drive.example/boot", confidence: "high" }
  }
}, {
  id: "item-apparel",
  batch_id: "batch-uuid",
  sku: "R23CBT0048",
  product_type: "เสื้อ",
  target_site: "gomall",
  product_name: "Down Jacket",
  status: "awaiting_approval",
  metadata: {
    brand_id: "go_mall",
    brand_label: "GO Mall",
    reference_manifest: { source_url: "https://drive.example/jacket", confidence: "high" }
  }
}];

test("buildBatchReviewPayload returns operator-facing Thai state, summary, cards, and next action", () => {
  const payload = buildBatchReviewPayload({
    batch: sampleBatch,
    items: sampleItems,
    tasks: [],
    profile: { role: "staff" },
    now: new Date("2026-06-23T02:00:00.000Z"),
    hrefBase: "https://image-workflow.example"
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.batch.batch_id, "line-keyword-20260623T010203Z");
  assert.equal(payload.batch.raw_request_text, "BATCH รองเท้า=1 เสื้อ=1");
  assert.deepEqual(payload.batch.selected_counts, { shoes: 1, apparel: 1 });
  assert.equal(payload.state, "ready_to_confirm");
  assert.equal(payload.label_th, "รอยืนยัน SKU");
  assert.equal(payload.next_action.type, "confirm_batch");
  assert.equal(payload.next_action.label_th, "ยืนยันชุด SKU");
  assert.equal(payload.allowed_actions.some((action) => action.type === "confirm_batch"), true);
  assert.equal(payload.allowed_actions.some((action) => action.type === "cancel_batch"), true);
  assert.equal(payload.progress.total_items, 2);
  assert.equal(payload.progress.selected_items, 2);
  assert.equal(payload.item_cards.length, 2);
  assert.equal(payload.item_cards[0].label_th, "Support ถูกล็อก รออนุมัติ Hero");
  assert.equal(payload.item_cards[0].allowed_actions[0].type, "skip_item");
  assert.equal(payload.debug, undefined);
});

test("buildBatchReviewPayload includes debug only for admin", () => {
  const staffPayload = buildBatchReviewPayload({
    batch: sampleBatch,
    items: sampleItems,
    tasks: [],
    profile: { role: "staff" }
  });
  const adminPayload = buildBatchReviewPayload({
    batch: sampleBatch,
    items: sampleItems,
    tasks: [{ id: "task-1", task_type: "generate_batch", status: "queued", dedupe_key: "line:approve_batch:x" }],
    profile: { role: "admin" }
  });

  assert.equal(staffPayload.debug, undefined);
  assert.equal(adminPayload.debug.batch_internal_status, "awaiting_approval");
  assert.equal(adminPayload.debug.task_summary[0].dedupe_key, "line:approve_batch:x");
  assert.equal(JSON.stringify(adminPayload).includes("SERVICE_ROLE"), false);
});

test("batch blockers prevent confirm but still allow cancellation before generation", () => {
  const batch = {
    ...sampleBatch,
    metadata: {
      selection: {
        ...sampleBatch.metadata.selection,
        shortfalls: [{ code: "category_shortfall", category: "shoes", requested: 3, available: 1 }]
      }
    }
  };
  const payload = buildBatchReviewPayload({
    batch,
    items: sampleItems,
    tasks: [],
    profile: { role: "staff" }
  });

  assert.equal(payload.blockers[0].code, "category_shortfall");
  assert.equal(payload.blockers[0].label_th, "จำนวนสินค้าในหมวดนี้ไม่พอตามที่ขอ");
  assert.equal(payload.allowed_actions.some((action) => action.type === "confirm_batch"), false);
  assert.equal(payload.allowed_actions.some((action) => action.type === "cancel_batch"), true);
});

test("allowed action helpers enforce idempotent confirm/cancel boundaries", () => {
  assert.deepEqual(resolveBatchAllowedActions({
    batch: { status: "approved" },
    workflow: { state: "hero_queued" },
    itemCards: sampleItems.map((item) => ({ ...item, selected: true, state: "selected" })),
    tasks: [{ status: "queued", task_type: "generate_batch", payload: { generation_phase: "hero_after_batch_approval" } }],
    blockers: []
  }), []);

  assert.equal(isBatchCancelable({
    batchState: "ready_to_confirm",
    batchStatus: "awaiting_approval",
    hasActiveGeneration: false
  }), true);
  assert.equal(isBatchCancelable({
    batchState: "hero_queued",
    batchStatus: "approved",
    hasActiveGeneration: true
  }), false);
});

test("item action helpers allow skip before generation and retry only for failed states", () => {
  const selectedItem = {
    id: "item-1",
    sku: "SKU-1",
    status: "awaiting_approval",
    reference_url: "https://drive.example/ref",
    metadata: {}
  };
  assert.equal(isItemSkippable({
    item: selectedItem,
    workflow: { state: "selected" },
    tasks: []
  }), true);
  assert.equal(resolveItemAllowedActions({
    item: selectedItem,
    workflow: { state: "selected" },
    tasks: []
  })[0].label_th, "ข้าม SKU นี้");

  assert.equal(isItemSkippable({
    item: selectedItem,
    workflow: { state: "selected" },
    tasks: [{ status: "running", payload: { sku: "SKU-1" } }]
  }), false);
  assert.equal(isItemRetryable({
    item: { ...selectedItem, status: "hero_failed" },
    workflow: { state: "hero_failed" },
    tasks: []
  }), true);
  assert.equal(resolveItemAllowedActions({
    item: { ...selectedItem, status: "support_failed" },
    workflow: { state: "support_failed" },
    tasks: []
  })[0].type, "retry_item");
});
