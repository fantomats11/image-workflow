import test from "node:test";
import assert from "node:assert/strict";
import { processAutomationTaskCore } from "../../lib/automation/automation-worker-core.mjs";

test("worker core completes generic dry-run tasks without live processing", async () => {
  const auditEvents = [];
  const completed = [];
  await processAutomationTaskCore({
    task: {
      id: "task-1",
      task_type: "unknown_task",
      batch_id: "batch-1",
      dedupe_key: "dedupe-1",
      payload: { dry_run: true }
    },
    batchItems: [{ sku: "SKU001" }],
    workerId: "test-worker",
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(auditEvents[0].eventType, "automation_task_dry_run_completed");
  assert.equal(completed[0].id, "task-1");
  assert.equal(completed[0].result.batch_item_count, 1);
});

test("worker core turns generate_batch into a pilot generation execution plan", async () => {
  const auditEvents = [];
  const completed = [];
  await processAutomationTaskCore({
    task: {
      id: "task-generate",
      task_type: "generate_batch",
      batch_id: "batch-1",
      dedupe_key: "generate-batch-1",
      payload: { dry_run: true }
    },
    batchItems: [{
      sku: "SKU001",
      target_site: "gomall",
      status: "approved",
      prompt_json: { support_shots: "front_view|back_view" },
      metadata: {
        brand_id: "go_mall",
        product_name: "Coat",
        product_type: "sale",
        category: "เสื้อ",
        reference_url: "https://drive.google.com/drive/folders/folder-id"
      }
    }],
    workerId: "test-worker",
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(auditEvents[0].eventType, "pilot_generation_execution_plan_completed");
  assert.equal(completed[0].id, "task-generate");
  assert.equal(completed[0].result.generation_plan.live_write_allowed, false);
  assert.equal(completed[0].result.generation_plan.summary.planned_generation_requests, 3);
  assert.equal(completed[0].result.generation_plan.summary.needs_reference_asset_resolution, 1);
});

test("worker core can hydrate generate_batch media manifest for LINE-approved support planning", async () => {
  const auditEvents = [];
  const completed = [];
  const readCalls = [];
  await processAutomationTaskCore({
    task: {
      id: "task-line-approved-support",
      task_type: "generate_batch",
      batch_id: "batch-1",
      dedupe_key: "line:approve_hero:batch-1:RAC-001",
      payload: {
        dry_run: true,
        source: "line",
        action: "approve_hero",
        request_mode: "support-only-after-approved-hero"
      }
    },
    batchItems: [{
      sku: "RAC-001",
      target_site: "rentacoat",
      status: "hero_approved",
      metadata: {
        brand_id: "rent_a_coat",
        product_name: "Columbia Snow Boot",
        product_type: "rental",
        category: "รองเท้า",
        reference_url: "https://cdn.example.com/rac-001-front.jpg",
        support_shots: "side_profile",
        line_action: { last_action: "approve_hero" }
      }
    }],
    workerId: "test-worker",
    readMediaManifest: async ({ task, batchItems }) => {
      readCalls.push({ taskId: task.id, count: batchItems.length });
      return {
        assets: [{
          id: "asset-hero-approved",
          sku: "RAC-001",
          type: "hero_generated",
          kind: "hero",
          shot_key: "hero",
          status: "approved",
          local_path: "/tmp/RAC-001/hero.png",
          url: "https://cdn.example.com/hero.png",
          file_name: "hero.png"
        }]
      };
    },
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.deepEqual(readCalls, [{ taskId: "task-line-approved-support", count: 1 }]);
  const plan = completed[0].result.generation_plan;
  assert.equal(auditEvents[0].eventType, "pilot_generation_execution_plan_completed");
  assert.equal(plan.summary.pending_hero_approval_for_support, 0);
  assert.equal(plan.summary.blocked_generation_requests, 0);
  assert.equal(plan.items[0].support_requires_hero_approval, false);
  assert.equal(plan.items[0].generation_requests[0].kind, "support");
  assert.equal(plan.items[0].generation_requests[0].model_input_files[0].source_name, "approved_hero_anchor");
});

test("worker core completes WordPress preflight with no live writes", async () => {
  const auditEvents = [];
  const completed = [];
  const callbacks = [];
  await processAutomationTaskCore({
    task: {
      id: "task-2",
      task_type: "wordpress_product_publish_preflight",
      batch_id: "batch-1",
      dedupe_key: "dedupe-2",
      payload: { dry_run: true }
    },
    batchItems: [{
      id: "item-1",
      sku: "SKU001",
      target_site: "gomall",
      status: "approved",
      metadata: { brand_id: "go_mall" }
    }],
    workerId: "test-worker",
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result }),
    onPreflightCompleted: async (event) => callbacks.push(event)
  });

  assert.equal(auditEvents[0].eventType, "wordpress_product_publish_preflight_completed");
  assert.equal(completed[0].result.preflight.live_write_allowed, false);
  assert.equal(completed[0].result.preflight.requires_final_confirmation, true);
  assert.equal(callbacks[0].task.id, "task-2");
  assert.equal(callbacks[0].preflight.summary.item_count, 1);
});

test("worker core completes WordPress media mapping preflight without media writes", async () => {
  const auditEvents = [];
  const completed = [];
  await processAutomationTaskCore({
    task: {
      id: "task-3",
      task_type: "wordpress_media_mapping_preflight",
      batch_id: "batch-1",
      dedupe_key: "dedupe-3",
      payload: {
        dry_run: true,
        product_preflight: {
          items: [{
            sku: "SKU001",
            brand_id: "go_mall",
            target_site: "gomall",
            preflight_status: "ready_for_proposal",
            proposed_action: "create_draft_product"
          }]
        }
      }
    },
    batchItems: [{
      id: "item-1",
      sku: "SKU001",
      target_site: "gomall",
      prompt_json: { support_shots: "front_view|back_view" },
      metadata: { brand_id: "go_mall" }
    }],
    workerId: "test-worker",
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(auditEvents[0].eventType, "wordpress_media_mapping_preflight_completed");
  assert.equal(completed[0].result.preflight.live_write_allowed, false);
  assert.equal(completed[0].result.preflight.summary.awaiting_media_assets, 1);
  assert.equal(completed[0].result.preflight.items[0].write_policy, "no_upload_or_attach_without_final_confirmation");
});

test("worker core completes live generation execution as a provider-free gate check", async () => {
  const auditEvents = [];
  const completed = [];
  await processAutomationTaskCore({
    task: {
      id: "task-live-execution",
      task_type: "live_pilot_generation_execution",
      batch_id: "batch-1",
      dedupe_key: "live-execution-1",
      payload: {
        dry_run: true,
        gate: {
          gate_status: "ready_for_manual_live_confirmation",
          live_generation_allowed: false,
          requests: [{
            request_id: "SKU001:hero",
            sku: "SKU001",
            kind: "hero",
            slot: "hero",
            gate_status: "ready"
          }]
        }
      }
    },
    workerId: "test-worker",
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(auditEvents[0].eventType, "live_pilot_generation_execution_completed");
  assert.equal(completed[0].id, "task-live-execution");
  assert.equal(completed[0].result.execution.summary.selected_requests, 1);
  assert.equal(completed[0].result.execution.summary.skipped_requests, 1);
  assert.equal(completed[0].result.execution.live_generation_allowed, false);
});
