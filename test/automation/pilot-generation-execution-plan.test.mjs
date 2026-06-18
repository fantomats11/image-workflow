import test from "node:test";
import assert from "node:assert/strict";
import { buildPilotGenerationExecutionPlan } from "../../lib/automation/pilot-generation-execution-plan.mjs";
import { PROMPT_FRAMEWORK_V3_VERSION } from "../../lib/automation/prompt-framework-v3.mjs";

const LEAN_HERO_PROMPT = [
  "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล สื่อถึงการใช้งานจริงของสินค้า ให้ความรู้สึกเข้าถึงง่าย น่าเชื่อถือ พร้อมจัดองค์ประกอบภาพให้ดึงดูดและเหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด",
  "",
  "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
  "ธุรกิจเช่า จำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย เน้นกลุ่มเป้าหมายระดับกลางถึงสูง"
].join("\n");

test("buildPilotGenerationExecutionPlan creates hero first and blocks support until hero approval", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-1", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-001",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Snow Jacket",
      product_type: "rental",
      category: "เสื้อ",
      reference_url: "https://cdn.example.com/rac-001-front.jpg",
      support_shots: "front_fit_shape|texture_closeup"
    }],
    now: new Date("2026-06-12T01:00:00Z")
  });

  assert.equal(plan.task_type, "pilot_generation_execution_plan");
  assert.equal(plan.live_write_allowed, false);
  assert.equal(plan.summary.sku_count, 1);
  assert.equal(plan.summary.planned_generation_requests, 3);
  assert.equal(plan.summary.hero_requests, 1);
  assert.equal(plan.summary.support_requests, 2);
  assert.equal(plan.summary.ready_for_live_generation, 0);
  assert.equal(plan.summary.blocked_generation_requests, 2);
  assert.equal(plan.summary.pending_hero_approval_for_support, 2);
  assert.equal(plan.items[0].generation_status, "partially_ready_for_live_generation");
  assert.equal(plan.items[0].support_requires_hero_approval, true);
  assert.equal(plan.items[0].generation_requests[0].kind, "hero");
  assert.equal(plan.items[0].generation_requests[0].request_status, "ready_for_live_generation");
  assert.equal(plan.items[0].generation_requests[0].prompt_framework_version, PROMPT_FRAMEWORK_V3_VERSION);
  assert.equal(plan.items[0].generation_requests[0].prompt, LEAN_HERO_PROMPT);
  assert.equal(plan.items[0].generation_requests[0].visual_variation.variation_group, "lean_hero");
  assert.doesNotMatch(plan.items[0].generation_requests[0].prompt, /ภาพต้องสะอาด สมจริง สินค้าเด่น|ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก|ไม่เพิ่มโลโก้/);
  assert.doesNotMatch(plan.items[0].generation_requests[0].prompt, /Visual variation plan/i);
  assert.doesNotMatch(plan.items[0].generation_requests[0].prompt, /Brand image job/i);
  assert.equal(plan.items[0].generation_requests[0].model_policy.presence, "required");
  assert.equal(plan.items[0].generation_requests[0].model_policy.source, "generated_no_reference_required");
  assert.match(plan.items[0].generation_requests[1].prompt, /มุมด้านหน้า/);
  assert.deepEqual(plan.items[0].generation_requests[1].blockers, ["support_requires_approved_hero_anchor"]);
});

test("buildPilotGenerationExecutionPlan rebuilds stale hero prompts from older framework versions", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-stale", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-BOOT-001",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Snow Boot",
      product_type: "rental",
      category: "รองเท้า",
      reference_url: "https://cdn.example.com/rac-boot-front.jpg",
      support_shots: "front_pair",
      prompt_framework_version: "prompt-framework-v3.0-dry-run",
      hero_prompt: "Old hero prompt without product slot output contract."
    }]
  });

  const hero = plan.items[0].generation_requests[0];
  assert.equal(hero.prompt_framework_version, PROMPT_FRAMEWORK_V3_VERSION);
  assert.notEqual(hero.prompt, "Old hero prompt without product slot output contract.");
  assert.equal(hero.prompt, LEAN_HERO_PROMPT);
  assert.doesNotMatch(hero.prompt, /Use the reference images as the source of truth|Do not add poster layout/i);
  assert.doesNotMatch(hero.prompt, /ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก|ภาพต้องสะอาด สมจริง สินค้าเด่น|ไม่เพิ่มโลโก้/);
  assert.doesNotMatch(hero.prompt, /Product slot output contract/);
  assert.equal(hero.model_policy.presence, "preferred");
  assert.equal(hero.visual_variation.variation_group, "lean_hero");
});

test("buildPilotGenerationExecutionPlan keeps hero visual variation lean instead of rotating A/B/C/D", () => {
  const batchItems = [0, 1, 2, 3].map((index) => ({
    sku: `SKU-${index + 1}`,
    brand_id: index < 2 ? "rent_a_coat" : "go_mall",
    target_site: index < 2 ? "rentacoat" : "gomall",
    product_name: index % 2 ? "Snow Boot" : "Snow Jacket",
    product_type: index < 2 ? "rental" : "sale",
    category: index % 2 ? "รองเท้า" : "เสื้อ",
    reference_url: `https://cdn.example.com/sku-${index + 1}.jpg`,
    support_shots: "front_fit_shape"
  }));
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-variation", task_type: "generate_batch", batch_id: "batch-variation" },
    batchItems
  });
  const heroGroups = plan.items.map((item) => item.generation_requests.find((request) => request.kind === "hero").visual_variation.variation_group);

  assert.deepEqual(heroGroups, ["lean_hero", "lean_hero", "lean_hero", "lean_hero"]);
  assert.equal(new Set(heroGroups).size, 1);
});

test("buildPilotGenerationExecutionPlan blocks Drive folder references before live generation", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-2", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "GM-001",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Wool Coat",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/folder-id",
      support_shots: "front_fit_shape|back_hood_closure"
    }]
  });

  assert.equal(plan.summary.ready_for_live_generation, 0);
  assert.equal(plan.summary.needs_reference_asset_resolution, 1);
  assert.equal(plan.summary.blocked_generation_requests, 3);
  assert.equal(plan.items[0].reference_source_type, "google_drive_folder");
  assert.deepEqual(plan.items[0].blockers, ["reference_assets_need_resolution"]);
  assert.equal(plan.items[0].generation_requests.every((request) => request.reference_requires_resolution), true);
});

test("buildPilotGenerationExecutionPlan treats pre-approval support assets as non-reusable", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-3", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-002",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Snow Boot",
      product_type: "rental",
      category: "รองเท้า",
      reference_url: "https://cdn.example.com/rac-002-front.jpg",
      support_shots: "front_pair|side_profile|sole_view"
    }],
    mediaManifest: {
      assets: [
        { id: "asset-hero", sku: "RAC-002", type: "hero_generated", kind: "hero", url: "https://cdn.example.com/hero.jpg" },
        { id: "asset-front", sku: "RAC-002", type: "support_generated", kind: "support", shot_key: "front_pair", url: "https://cdn.example.com/front.jpg" }
      ]
    }
  });

  assert.equal(plan.summary.existing_assets_matched, 2);
  assert.equal(plan.summary.skipped_existing_slots, 1);
  assert.equal(plan.summary.planned_generation_requests, 3);
  assert.equal(plan.summary.blocked_generation_requests, 3);
  assert.deepEqual(
    plan.items[0].generation_requests.map((request) => request.slot),
    ["front_pair", "side_profile", "sole_view"]
  );
  assert.equal(plan.items[0].generation_requests.every((request) => request.blockers.includes("support_requires_approved_hero_anchor")), true);
});

test("buildPilotGenerationExecutionPlan attaches approved hero anchor to support model inputs", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-anchor", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "GM-004",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Discovery Expedition Puffer Jacket",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/folder-4",
      support_shots: "front_fit_shape"
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "GM-004",
        staged_reference_assets: [{
          drive_file_id: "file-1",
          source_name: "GM-004_front.jpg",
          local_path: "/tmp/GM-004/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "asset-hero-approved",
        sku: "GM-004",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "approved",
        url: "https://cdn.example.com/hero.png",
        local_path: "/tmp/GM-004/hero.png",
        file_name: "hero.png",
        file_size: 20,
        approval_id: "approval-1"
      }]
    }
  });

  assert.equal(plan.summary.planned_generation_requests, 1);
  assert.equal(plan.summary.blocked_generation_requests, 0);
  assert.equal(plan.items[0].generation_status, "ready_for_live_generation");
  assert.equal(plan.items[0].support_requires_hero_approval, false);
  const support = plan.items[0].generation_requests[0];
  assert.equal(support.kind, "support");
  assert.equal(support.request_status, "ready_for_live_generation");
  assert.equal(support.model_input_files.length, 2);
  assert.equal(support.model_input_files[0].source_name, "approved_hero_anchor");
  assert.equal(support.model_input_files[0].source_role, "approved_hero_anchor");
  assert.equal(support.model_input_files[0].local_path, "/tmp/GM-004/hero.png");
  assert.equal(support.model_input_files[1].source_name, "GM-004_front.jpg");
  assert.equal(support.model_input_files[1].source_role, "product_reference");
  assert.equal(support.model_input_files[1].local_path, "/tmp/GM-004/front.jpg");
  assert.match(support.prompt, /^อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว/);
  assert.match(support.prompt, /สี ทรง วัสดุ โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่/);
  assert.match(support.prompt, /ภาพต้องดูเป็นเซ็ตเดียวกับภาพหลัก/);
  assert.doesNotMatch(support.prompt, /approved hero/i);
  assert.doesNotMatch(support.prompt, /approved hero image as the model, styling, fit, lighting, and realism anchor/i);
});

test("buildPilotGenerationExecutionPlan accepts metadata reference images as reference source", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-metadata-ref", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "GM-005",
      status: "hero_approved",
      metadata: {
        brand_id: "go_mall",
        target_site: "gomall",
        product_name: "The North Face White Cream Puffer Jacket, Down 600",
        product_type: "sale",
        category: "เสื้อ",
        support_shots: "side_fit_on_model",
        line_action: { last_action: "approve_hero" },
        reference_images: [{
          drive_file_id: "front-ref-1",
          name: "GM-005_front.jpg",
          public_url: "https://cdn.example.com/front.jpg"
        }]
      }
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "GM-005",
        staged_reference_assets: [{
          drive_file_id: "front-ref-1",
          source_name: "GM-005_front.jpg",
          local_path: "/tmp/GM-005/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "asset-hero-approved",
        sku: "GM-005",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "approved",
        url: "https://cdn.example.com/hero.png",
        local_path: "/tmp/GM-005/hero.png",
        file_name: "hero.png",
        file_size: 20,
        approval_id: "approval-1"
      }]
    }
  });

  assert.equal(plan.items[0].reference_url, "https://cdn.example.com/front.jpg");
  assert.equal(plan.summary.blocked_generation_requests, 0);
  assert.equal(plan.items[0].generation_requests[0].request_status, "ready_for_live_generation");
});

test("buildPilotGenerationExecutionPlan treats LINE-approved generated hero as support anchor", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-line-anchor", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-ANCHOR",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Columbia Snow Jacket",
      product_type: "rental",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/folder-line",
      support_shots: "front_fit_shape",
      status: "hero_approved",
      metadata: { line_action: { last_action: "approve_hero" } }
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "RAC-ANCHOR",
        staged_reference_assets: [{
          drive_file_id: "file-1",
          source_name: "RAC-ANCHOR_front.jpg",
          local_path: "/tmp/RAC-ANCHOR/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "asset-hero-generated",
        sku: "RAC-ANCHOR",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "generated",
        url: "https://cdn.example.com/hero.png",
        local_path: "/tmp/RAC-ANCHOR/hero.png",
        file_name: "hero.png",
        file_size: 20
      }]
    }
  });

  const support = plan.items[0].generation_requests[0];
  assert.equal(plan.items[0].support_requires_hero_approval, false);
  assert.equal(support.request_status, "ready_for_live_generation");
  assert.equal(support.approved_hero_anchor.id, "asset-hero-generated");
  assert.equal(support.model_input_files[0].source_name, "approved_hero_anchor");
  assert.equal(support.model_input_files[1].source_name, "RAC-ANCHOR_front.jpg");
});

test("buildPilotGenerationExecutionPlan blocks LINE-approved support when hero anchor is not locally staged", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-line-remote-anchor", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-REMOTE-HERO",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Columbia Snow Boot",
      product_type: "rental",
      category: "รองเท้า",
      reference_url: "https://drive.google.com/drive/folders/folder-remote",
      support_shots: "side_profile",
      status: "hero_approved",
      metadata: { line_action: { last_action: "approve_hero" } }
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "RAC-REMOTE-HERO",
        staged_reference_assets: [{
          drive_file_id: "file-1",
          source_name: "RAC-REMOTE-HERO_front.jpg",
          local_path: "/tmp/RAC-REMOTE-HERO/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "asset-hero-remote",
        sku: "RAC-REMOTE-HERO",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "generated",
        url: "https://cdn.example.com/remote-hero.png"
      }]
    }
  });

  const support = plan.items[0].generation_requests[0];
  assert.equal(plan.items[0].support_requires_hero_approval, false);
  assert.equal(plan.summary.pending_hero_approval_for_support, 0);
  assert.equal(support.request_status, "blocked_before_live_generation");
  assert.deepEqual(support.blockers, ["approved_hero_anchor_requires_local_file"]);
  assert.equal(support.model_input_files[0].source_name, "approved_hero_anchor");
  assert.equal(support.model_input_files[0].staging_status, "missing_local_file");
  assert.equal(support.model_input_files[1].source_name, "RAC-REMOTE-HERO_front.jpg");
});

test("buildPilotGenerationExecutionPlan uses resolved Drive reference files and requires model input staging", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-4", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "GM-002",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Coat",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/folder-2",
      support_shots: "front_view"
    }],
    referenceResolutionManifest: {
      items: [{
        sku: "GM-002",
        selected_reference_assets: [{
          drive_file_id: "file-1",
          name: "GM-002_front.jpg",
          mimeType: "image/jpeg",
          width: 1200,
          height: 1600,
          model_input_status: "needs_download_or_signed_staging"
        }]
      }]
    }
  });

  assert.equal(plan.summary.needs_reference_asset_resolution, 0);
  assert.equal(plan.summary.needs_model_input_staging, 1);
  assert.equal(plan.items[0].reference_source_type, "google_drive_resolved_files");
  assert.deepEqual(plan.items[0].blockers, ["reference_assets_need_model_input_staging"]);
  assert.equal(plan.items[0].generation_requests[0].reference_assets[0].drive_file_id, "file-1");
});

test("buildPilotGenerationExecutionPlan marks staged local model inputs ready for hero confirmation", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: { id: "task-5", task_type: "generate_batch", batch_id: "batch-1" },
    batchItems: [{
      sku: "GM-003",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Coat",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/folder-3",
      support_shots: "front_view"
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "GM-003",
        staged_reference_assets: [{
          drive_file_id: "file-1",
          source_name: "GM-003_front.jpg",
          local_path: "/tmp/GM-003/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    }
  });

  assert.equal(plan.summary.ready_for_live_generation, 0);
  assert.equal(plan.summary.blocked_generation_requests, 1);
  assert.equal(plan.summary.needs_model_input_staging, 0);
  assert.equal(plan.summary.model_inputs_staged, 1);
  assert.equal(plan.items[0].reference_source_type, "local_staged_reference_files");
  assert.deepEqual(plan.items[0].blockers, []);
  assert.equal(plan.items[0].generation_status, "partially_ready_for_live_generation");
  assert.equal(plan.items[0].generation_requests[0].model_input_files[0].local_path, "/tmp/GM-003/front.jpg");
  assert.equal(plan.items[0].generation_requests[0].kind, "hero");
  assert.equal(plan.items[0].generation_requests[0].request_status, "ready_for_live_generation");
  assert.deepEqual(plan.items[0].generation_requests[1].blockers, ["support_requires_approved_hero_anchor"]);
});

test("buildPilotGenerationExecutionPlan obeys regenerate hero review action even when a hero asset exists", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: {
      id: "task-regenerate-hero",
      task_type: "generate_batch",
      batch_id: "batch-review-action",
      payload: {
        action: "regenerate_hero",
        sku: "R24CBF0013",
        generation_id: "675e34a7-a41c-48c9-a4f2-d0ae352660b1",
        request_mode: "hero-regeneration-only"
      }
    },
    batchItems: [{
      sku: "R24CBF0013",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Women's Slopeside Peak Luxe Waterproof Snow Boot",
      product_type: "rental",
      category: "รองเท้า",
      reference_url: "https://drive.google.com/drive/folders/boot-ref",
      support_shots: ""
    }, {
      sku: "R23CBT0048",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Columbia Alpine Crux Titanium Down Hooded Jacket",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/jacket-ref",
      support_shots: ""
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "R24CBF0013",
        staged_reference_assets: [{
          drive_file_id: "boot-front",
          source_name: "R24CBF0013_Front.jpg",
          local_path: "/tmp/R24CBF0013/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "existing-hero",
        sku: "R24CBF0013",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "generated",
        local_path: "/tmp/R24CBF0013/hero.png",
        url: "https://cdn.example.com/existing-hero.png"
      }]
    }
  });

  assert.equal(plan.review_action, "regenerate_hero");
  assert.equal(plan.summary.hero_requests, 1);
  assert.equal(plan.summary.support_requests, 0);
  assert.equal(plan.summary.skipped_existing_slots, 0);
  assert.equal(plan.items[0].generation_status, "ready_for_live_generation");
  assert.equal(plan.items[0].generation_requests[0].kind, "hero");
  assert.equal(plan.items[0].generation_requests[0].request_status, "ready_for_live_generation");
  assert.match(plan.items[0].generation_requests[0].request_id, /^R24CBF0013:hero:regenerate:675e34a7$/);
  assert.equal(plan.items[1].generation_status, "not_selected_for_review_action");
  assert.deepEqual(plan.items[1].generation_requests, []);
});

test("buildPilotGenerationExecutionPlan creates default support requests after hero approval when keyword intake has no support shots", () => {
  const plan = buildPilotGenerationExecutionPlan({
    task: {
      id: "task-approve-hero",
      task_type: "generate_batch",
      batch_id: "batch-review-action",
      payload: {
        action: "approve_hero",
        sku: "R23CBT0048",
        generation_id: "a43f727e-f8ea-4362-8690-b3161fc8e29d",
        request_mode: "support-only-after-hero-approval"
      }
    },
    batchItems: [{
      sku: "R24CBF0013",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Women's Slopeside Peak Luxe Waterproof Snow Boot",
      product_type: "rental",
      category: "รองเท้า",
      reference_url: "https://drive.google.com/drive/folders/boot-ref",
      support_shots: ""
    }, {
      sku: "R23CBT0048",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Columbia Alpine Crux Titanium Down Hooded Jacket LightPink Goose Down Women’s",
      product_type: "sale",
      category: "เสื้อ",
      reference_url: "https://drive.google.com/drive/folders/jacket-ref",
      support_shots: "",
      status: "hero_approved",
      metadata: { web_review_action: { action: "approve_hero" } }
    }],
    modelInputStagingManifest: {
      items: [{
        sku: "R23CBT0048",
        staged_reference_assets: [{
          drive_file_id: "jacket-front",
          source_name: "R23CBT0048_Front.jpg",
          local_path: "/tmp/R23CBT0048/front.jpg",
          file_name: "front.jpg",
          file_size: 10,
          sha256: "abc",
          staging_status: "staged_local_file"
        }]
      }]
    },
    mediaManifest: {
      assets: [{
        id: "approved-hero",
        sku: "R23CBT0048",
        type: "hero_generated",
        kind: "hero",
        shot_key: "hero",
        status: "approved",
        local_path: "/tmp/R23CBT0048/hero.png",
        url: "https://cdn.example.com/approved-hero.png",
        approved_at: "2026-06-18T02:00:00Z"
      }]
    }
  });

  assert.equal(plan.review_action, "approve_hero");
  assert.equal(plan.summary.hero_requests, 0);
  assert.equal(plan.summary.support_requests, 3);
  assert.equal(plan.summary.blocked_generation_requests, 0);
  assert.equal(plan.items[0].generation_status, "not_selected_for_review_action");
  assert.deepEqual(plan.items[1].support_shots, ["side_fit_on_model", "back_fit_on_model", "material_or_lining_closeup"]);
  assert.equal(plan.items[1].generation_status, "ready_for_live_generation");
  assert.equal(plan.items[1].generation_requests.every((request) => request.kind === "support"), true);
  assert.equal(plan.items[1].generation_requests[0].model_input_files[0].source_name, "approved_hero_anchor");
});
