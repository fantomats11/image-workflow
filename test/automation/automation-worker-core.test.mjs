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
  const callbacks = [];
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
    completeTask: async (id, result) => completed.push({ id, result }),
    onMediaPreflightCompleted: async (event) => callbacks.push(event)
  });

  assert.equal(auditEvents[0].eventType, "wordpress_media_mapping_preflight_completed");
  assert.equal(completed[0].result.preflight.live_write_allowed, false);
  assert.equal(completed[0].result.preflight.summary.awaiting_media_assets, 1);
  assert.equal(completed[0].result.preflight.items[0].write_policy, "no_upload_or_attach_without_final_confirmation");
  assert.equal(callbacks[0].task.id, "task-3");
  assert.equal(callbacks[0].preflight.requires_final_confirmation, true);
});

test("worker core hydrates WordPress media mapping preflight from media export gate metadata", async () => {
  const completed = [];
  const queued = [];
  await processAutomationTaskCore({
    task: {
      id: "task-media-gate",
      task_type: "wordpress_media_mapping_preflight",
      batch_id: "batch-1",
      dedupe_key: "dedupe-media-gate",
      payload: {
        dry_run: true,
        auto_enqueue_final_confirmation_gate: true,
        line_user_id: "line-target",
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
      metadata: {
        brand_id: "go_mall",
        media_export_preflight_gate: {
          gate_status: "ready_for_export_preflight",
          media_assets: [
            { sku: "SKU001", type: "hero_generated", shot_key: "hero", status: "approved", url: "https://cdn.example.test/hero.png" },
            { sku: "SKU001", type: "support_generated", shot_key: "front_view", status: "approved", url: "https://cdn.example.test/front.png" },
            { sku: "SKU001", type: "support_generated", shot_key: "back_view", status: "approved", url: "https://cdn.example.test/back.png" }
          ]
        }
      }
    }],
    recordAuditEvent: async () => {},
    completeTask: async (id, result) => completed.push({ id, result }),
    enqueueTask: async (queuedTask) => queued.push(queuedTask)
  });

  assert.equal(completed[0].result.preflight.summary.ready_for_media_proposal, 1);
  assert.equal(completed[0].result.preflight.summary.media_assets_matched, 3);
  assert.equal(completed[0].result.preflight.items[0].media_status, "ready_for_media_proposal");
  assert.equal(completed[0].result.preflight.items[0].proposed_gallery_images.length, 2);
  assert.equal(queued[0].taskType, "wordpress_media_attach_confirmation_gate");
  assert.equal(queued[0].payload.media_preflight.summary.ready_for_media_proposal, 1);
  assert.equal(queued[0].payload.requires_final_confirmation, true);
});

test("worker core completes WordPress media attach confirmation gate without media writes", async () => {
  const auditEvents = [];
  const completed = [];
  const callbacks = [];
  await processAutomationTaskCore({
    task: {
      id: "task-confirm",
      task_type: "wordpress_media_attach_confirmation_gate",
      batch_id: "batch-1",
      dedupe_key: "dedupe-confirm",
      payload: {
        dry_run: true,
        media_preflight: {
          batch_id: "batch-1",
          items: [{
            sku: "SKU001",
            target_site: "gomall",
            media_status: "ready_for_media_proposal",
            proposed_main_image: { id: "hero", url: "https://cdn.example.test/hero.png", type: "hero_generated", shot_key: "hero" },
            proposed_gallery_images: [{ id: "front", url: "https://cdn.example.test/front.png", type: "support_generated", shot_key: "front_view" }],
            blockers: []
          }]
        }
      }
    },
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result }),
    onMediaAttachConfirmationCompleted: async (event) => callbacks.push(event)
  });

  assert.equal(auditEvents[0].eventType, "wordpress_media_attach_confirmation_gate_completed");
  assert.equal(completed[0].result.confirmation_gate.live_write_allowed, false);
  assert.equal(completed[0].result.confirmation_gate.media_attach_allowed, false);
  assert.equal(completed[0].result.confirmation_gate.summary.proposed_operations, 2);
  assert.equal(callbacks[0].task.id, "task-confirm");
  assert.equal(callbacks[0].confirmationGate.summary.proposed_operations, 2);
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

test("worker core executes and persists armed live support generation", async () => {
  const auditEvents = [];
  const completed = [];
  const providerRequests = [];
  const persistenceCalls = [];
  const supportCallbacks = [];
  const task = {
    id: "task-live-support-1",
    task_type: "live_pilot_generation_execution",
    batch_id: "batch-live-support",
    payload: {
      actor_id: "actor-1",
      live_generation_requested: true,
      live_generation_confirmed: true,
      generation_plan: {
        batch_id: "batch-live-support",
        items: [{
          sku: "2DJ0493000",
          generation_requests: [{
            request_id: "2DJ0493000:support:side_fit_on_model",
            sku: "2DJ0493000",
            kind: "support",
            slot: "side_fit_on_model",
            prompt: "support prompt",
            request_status: "ready_for_live_generation",
            model_input_files: [{
              source_name: "approved_hero_anchor",
              local_path: "/tmp/hero.png",
              staging_status: "staged_local_file"
            }]
          }]
        }]
      },
      live_generation_gate: {
        batch_id: "batch-live-support",
        gate_status: "live_generation_armed",
        live_generation_allowed: true,
        requests: [{
          request_id: "2DJ0493000:support:side_fit_on_model",
          sku: "2DJ0493000",
          kind: "support",
          slot: "side_fit_on_model",
          prompt: "support prompt",
          gate_status: "ready",
          request_status: "ready_for_live_generation"
        }]
      }
    }
  };

  const result = await processAutomationTaskCore({
    task,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "test-fal-key" },
    batchItems: [],
    workerId: "test-worker",
    providerGenerate: async (request) => {
      providerRequests.push(request);
      return {
        provider_request_id: "fal-side-1",
        images: [{
          url: "https://cdn.example.com/side.png",
          file_name: "side.png",
          contentType: "image/png",
          file_size: 123
        }]
      };
    },
    persistLiveExecution: async (payload) => {
      persistenceCalls.push(payload);
      return {
        persistence_status: "completed",
        summary: { persisted: 1 },
        items: [{
          sku: "2DJ0493000",
          kind: "support",
          slot: "side_fit_on_model",
          public_url: "https://cdn.example.com/side.png"
        }]
      };
    },
    onSupportGenerationCompleted: async (payload) => supportCallbacks.push(payload),
    recordAuditEvent: async (event) => auditEvents.push(event),
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(result.action, "live_generation_execution_recorded");
  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0].request_id, "2DJ0493000:support:side_fit_on_model");
  assert.equal(persistenceCalls.length, 1);
  assert.equal(persistenceCalls[0].generationPlan.batch_id, "batch-live-support");
  assert.equal(completed.length, 1);
  assert.equal(completed[0].result.dry_run, false);
  assert.equal(completed[0].result.execution.summary.executed_requests, 1);
  assert.equal(completed[0].result.persistence.summary.persisted, 1);
  assert.equal(supportCallbacks.length, 1);
  assert.equal(supportCallbacks[0].persistence.summary.persisted, 1);
  assert.equal(auditEvents[0].eventType, "live_pilot_generation_execution_completed");
});

test("worker core enqueues live support execution after approved hero plan", async () => {
  const completed = [];
  const enqueued = [];
  await processAutomationTaskCore({
    task: {
      id: "task-support-plan-1",
      task_type: "generate_batch",
      batch_id: "batch-live-support",
      dedupe_key: "approve-hero:batch-live-support:2DJ0493000",
      payload: {
        action: "approve_hero",
        actor_id: "actor-1",
        sku: "2DJ0493000",
        generation_id: "hero-gen-1",
        generation_phase: "support_after_hero_approval",
        request_mode: "support-only-after-approved-hero",
        requires_approved_hero_anchor: true,
        auto_enqueue_live_support: true,
        live_generation_requested: true,
        live_generation_confirmed: true
      }
    },
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "test-fal-key" },
    batchItems: [{
      id: "item-1",
      sku: "2DJ0493000",
      target_site: "gomall",
      status: "hero_approved",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      category: "เสื้อ",
      metadata: {
        brand_id: "go_mall",
        product_name: "The North Face White Cream Puffer Jacket, Down 600",
        product_type: "sale",
        reference_url: "https://drive.google.com/drive/folders/ref-folder",
        support_shots: "side_fit_on_model",
        web_review_action: {
          action: "approve_hero",
          hero_asset_id: "hero-asset-1",
          generation_id: "hero-gen-1"
        },
        image_assets: [{
          id: "hero-asset-1",
          kind: "hero",
          generation_id: "hero-gen-1",
          public_url: "https://cdn.example.com/hero.png"
        }],
        reference_images: [{
          role: "front",
          public_url: "https://cdn.example.com/front.jpg"
        }]
      }
    }],
    readMediaManifest: async () => ({
      assets: [{
        id: "hero-asset-1",
        sku: "2DJ0493000",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "approved",
        local_path: "/tmp/hero.png",
        url: "https://cdn.example.com/hero.png",
        file_name: "hero.png"
      }]
    }),
    readModelInputStagingManifest: async () => ({
      items: [{
        sku: "2DJ0493000",
        staged_reference_assets: [{
          drive_file_id: "front-ref-1",
          source_name: "2DJ0493000_Front_1779015437999.jpg",
          source_mime_type: "image/jpeg",
          local_path: "/tmp/front.jpg",
          file_name: "front.jpg",
          file_size: 456,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    }),
    enqueueTask: async (taskPayload) => enqueued.push(taskPayload),
    recordAuditEvent: async () => {},
    completeTask: async (id, result) => completed.push({ id, result })
  });

  assert.equal(completed.length, 1);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].taskType, "live_pilot_generation_execution");
  assert.equal(enqueued[0].payload.action, "generate_support_after_hero_approval");
  assert.equal(enqueued[0].payload.live_generation_gate.live_generation_allowed, true);
  assert.equal(enqueued[0].payload.live_generation_gate.requests.length, 1);
  assert.equal(enqueued[0].payload.generation_plan.items[0].generation_requests[0].kind, "support");
});
