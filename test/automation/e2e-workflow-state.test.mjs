import test from "node:test";
import assert from "node:assert/strict";
import {
  BATCH_OPERATOR_STATES,
  ITEM_OPERATOR_STATES,
  STAFF_ERROR_CODES,
  getBatchOperatorStateContract,
  getItemOperatorStateContract,
  normalizeWorkflowErrors,
  resolveBatchWorkflowState,
  resolveItemWorkflowState,
  validateE2EWorkflowInvariants,
  validateSupportModelInputFiles
} from "../../lib/automation/e2e-workflow-state.mjs";

test("exports the operator-facing batch, item, and staff error state contracts", () => {
  assert.deepEqual(BATCH_OPERATOR_STATES, [
    "draft_created",
    "waiting_batch_review",
    "ready_to_confirm",
    "hero_queued",
    "hero_generating",
    "hero_waiting_review",
    "hero_approved",
    "support_ready",
    "support_queued",
    "support_generating",
    "support_waiting_review",
    "support_approved",
    "export_ready",
    "exported",
    "partially_failed",
    "failed",
    "cancelled"
  ]);
  assert.deepEqual(ITEM_OPERATOR_STATES, [
    "selected",
    "skipped",
    "missing_reference",
    "hero_pending",
    "hero_generating",
    "hero_failed",
    "hero_waiting_review",
    "hero_approved",
    "support_blocked_waiting_hero",
    "support_ready",
    "support_generating",
    "support_failed",
    "support_waiting_review",
    "support_approved",
    "exported"
  ]);
  assert.deepEqual(STAFF_ERROR_CODES, [
    "missing_reference_assets",
    "approved_hero_anchor_missing",
    "approved_hero_anchor_requires_local_file",
    "generation_provider_failed",
    "queue_timeout",
    "export_failed",
    "google_drive_disconnected",
    "permission_denied"
  ]);

  assert.deepEqual(getBatchOperatorStateContract("hero_waiting_review"), {
    scope: "batch",
    state: "hero_waiting_review",
    label_th: "รอตรวจ Hero"
  });
  assert.deepEqual(getItemOperatorStateContract("support_blocked_waiting_hero"), {
    scope: "item",
    state: "support_blocked_waiting_hero",
    label_th: "Support ถูกล็อก รออนุมัติ Hero"
  });
});

test("normalizes internal item state into one operator-facing next action", () => {
  const state = resolveItemWorkflowState({
    item: {
      sku: "R23CBT0048",
      status: "hero_approved",
      reference_url: "https://drive.example/ref",
      metadata: {
        web_review_action: { last_action: "approve_hero" },
        hero_review_hero_asset: { asset_id: "asset-hero", approved: true }
      }
    },
    hrefs: {
      review: "/#review?generation_id=gen-1&sku=R23CBT0048"
    }
  });

  assert.equal(state.state, "support_ready");
  assert.equal(state.label_th, "พร้อมสร้าง Support");
  assert.deepEqual(state.next_action, {
    type: "wait_system",
    label_th: "รอระบบสร้าง Support",
    href: ""
  });
  assert.deepEqual(state.errors, []);
});

test("normalizes batch state from mixed item states and exposes one next action", () => {
  const state = resolveBatchWorkflowState({
    batch: { id: "batch-uuid", batch_key: "line-keyword-1", status: "approved" },
    items: [{
      sku: "A",
      status: "hero_approved",
      reference_url: "https://drive.example/a",
      metadata: {
        web_review_action: { last_action: "approve_hero" },
        hero_review_hero_asset: { asset_id: "asset-a", approved: true },
        support_generation: { status: "support_ready_for_review" },
        support_assets: [{ asset_id: "support-a" }]
      }
    }, {
      sku: "B",
      status: "hero_approved",
      reference_url: "https://drive.example/b",
      metadata: {
        web_review_action: { last_action: "approve_hero" },
        hero_review_hero_asset: { asset_id: "asset-b", approved: true },
        support_generation: { status: "support_ready_for_review" },
        support_assets: [{ asset_id: "support-b" }]
      }
    }],
    hrefs: { review: "/#review?batch_id=line-keyword-1" }
  });

  assert.equal(state.state, "support_waiting_review");
  assert.equal(state.label_th, "รอตรวจ Support");
  assert.equal(state.next_action.type, "open_review");
  assert.equal(state.next_action.label_th, "เปิดหน้าตรวจ Support");
  assert.equal(state.item_summary.total, 2);
  assert.deepEqual(state.item_summary.by_state, { support_waiting_review: 2 });
});

test("maps internal blockers into staff-safe error codes", () => {
  assert.deepEqual(normalizeWorkflowErrors([
    "reference_assets_need_resolution",
    "support_requires_approved_hero_anchor",
    "approved_hero_anchor_requires_local_file",
    "fal_failed",
    "missing_google_drive_oauth",
    "forbidden",
    "unknown_internal_noise"
  ]), [
    { code: "missing_reference_assets", label_th: "ไม่พบภาพอ้างอิงสินค้า" },
    { code: "approved_hero_anchor_missing", label_th: "ไม่พบ Hero ที่อนุมัติแล้ว" },
    { code: "approved_hero_anchor_requires_local_file", label_th: "Hero ที่อนุมัติแล้วยังไม่มีไฟล์ local สำหรับใช้สร้าง Support" },
    { code: "generation_provider_failed", label_th: "ระบบสร้างภาพไม่สำเร็จ" },
    { code: "google_drive_disconnected", label_th: "Google Drive ยังไม่พร้อมใช้งาน" },
    { code: "permission_denied", label_th: "บัญชีนี้ไม่มีสิทธิ์ทำรายการ" }
  ]);
});

test("enforces support model input ordering invariants", () => {
  assert.deepEqual(validateSupportModelInputFiles([
    { source_role: "product_reference", local_path: "/tmp/front.jpg" }
  ]), [
    "support_first_model_input_must_be_approved_hero_anchor"
  ]);

  assert.deepEqual(validateSupportModelInputFiles([
    { source_role: "approved_hero_anchor", local_path: "/tmp/hero.jpg" },
    { source_role: "product_reference", local_path: "/tmp/front.jpg" },
    { source_role: "product_reference", local_path: "/tmp/back.jpg" }
  ]), []);
});

test("enforces E2E hard guardrails without live writes", () => {
  const violations = validateE2EWorkflowInvariants({
    itemState: "support_ready",
    approvedHeroAnchor: null,
    generationRequest: {
      kind: "support",
      model_input_files: [
        { source_role: "approved_hero_anchor", local_path: "" },
        { source_role: "product_reference", local_path: "/tmp/ref.jpg" }
      ]
    },
    env: { WORDPRESS_LIVE_WRITES_ENABLED: "true" },
    action: { type: "approve_hero" },
    lineWebhookLongRunning: true,
    retryAssetKeys: ["sku:hero", "sku:hero"]
  });

  assert.deepEqual(violations, [
    "support_generation_requires_approved_hero",
    "approved_hero_anchor_requires_local_file",
    "wordpress_live_write_must_remain_disabled",
    "line_webhook_must_not_run_long_generation",
    "approve_hero_requires_dedupe_key",
    "retry_must_not_duplicate_final_assets"
  ]);
});
