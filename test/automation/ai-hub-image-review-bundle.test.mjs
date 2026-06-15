import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_HUB_IMAGE_REVIEW_BUNDLE_MANIFEST,
  buildAiHubImageReviewBundle
} from "../../lib/automation/ai-hub-image-review-bundle.mjs";

test("buildAiHubImageReviewBundle merges plan requests with generated execution assets for AI HUB review", () => {
  const bundle = buildAiHubImageReviewBundle({
    generationPlan: generationPlanFixture(),
    executionArtifacts: [executionArtifactFixture()],
    now: new Date("2026-06-15T01:00:00Z")
  });

  assert.equal(bundle.manifest_type, AI_HUB_IMAGE_REVIEW_BUNDLE_MANIFEST);
  assert.equal(bundle.live_write_allowed, false);
  assert.equal(bundle.dry_run, true);
  assert.ok(bundle.guardrails.includes("local_review_only_no_wordpress_or_db_write"));
  assert.ok(bundle.guardrails.includes("generated_images_cannot_override_reference_truth"));
  assert.equal(bundle.summary.sku_count, 1);
  assert.equal(bundle.summary.review_asset_count, 3);
  assert.equal(bundle.summary.generated_asset_count, 2);
  assert.equal(bundle.summary.pending_human_qc, 2);
  assert.equal(bundle.summary.missing_generated_asset_count, 1);

  const side = findAsset(bundle, "2DJ0493000:side_fit_on_model");
  assert.equal(side.generated.status, "done");
  assert.equal(side.generated.provider_request_id, "fal-side-1");
  assert.equal(side.generated.source_url, "https://cdn.example.com/side.png");
  assert.equal(side.qc.review_status, "pending_human_qc");
  assert.ok(side.qc.required_checks.includes("side_or_45_degree_angle_is_clear"));
  assert.ok(side.qc.required_checks.includes("visible_real_logo_patch_markings_if_present"));
  assert.ok(side.qc.required_checks.includes("technical_marking_or_fill_power_accuracy_if_visible"));
  assert.ok(side.qc.human_blocking_flag_options.includes("invented_text_number_logo_or_patch"));
  assert.ok(side.review_actions.includes("regenerate_slot"));
});

test("AI HUB review bundle treats detail support as extreme close-up and blocks missing generated assets", () => {
  const bundle = buildAiHubImageReviewBundle({
    generationPlan: generationPlanFixture(),
    executionArtifacts: [executionArtifactFixture()]
  });

  const detail = findAsset(bundle, "2DJ0493000:material_or_lining_closeup");
  assert.equal(detail.qc.review_status, "pending_human_qc");
  assert.ok(detail.qc.required_checks.includes("extreme_closeup_not_full_body_or_new_scene"));
  assert.ok(detail.qc.required_checks.includes("material_lining_texture_or_construction_detail_visible"));
  assert.ok(detail.qc.required_checks.includes("no_new_text_numbers_logo_or_patch"));
  assert.ok(detail.qc.suggested_regeneration_reasons.includes("needs_tighter_extreme_closeup_or_material_detail"));

  const back = findAsset(bundle, "2DJ0493000:back_fit_on_model");
  assert.equal(back.generated.status, "not_executed");
  assert.equal(back.qc.review_status, "missing_execution_result");
  assert.ok(back.qc.required_checks.includes("back_view_is_clear"));
  assert.ok(back.qc.required_checks.includes("rear_design_hood_closure_length_and_seams_visible"));
  assert.ok(back.qc.human_blocking_flag_options.includes("back_view_missing_or_logo_patch_wrong"));
});

function findAsset(bundle, requestId) {
  return bundle.review_items
    .flatMap((item) => item.review_assets)
    .find((asset) => asset.request_id === requestId);
}

function generationPlanFixture() {
  return {
    task_type: "pilot_generation_execution_plan",
    batch_id: "batch-aihub",
    created_at: "2026-06-15T00:00:00Z",
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      product_type: "sale",
      category: "เสื้อ",
      reference_source_type: "local_staged_reference_files",
      approved_hero_anchor: {
        local_path: "/tmp/hero.png",
        url: "https://cdn.example.com/hero.png",
        source_role: "approved_hero_anchor"
      },
      support_shots: ["side_fit_on_model", "back_fit_on_model", "material_or_lining_closeup"],
      generation_requests: [
        requestFixture("side_fit_on_model", 2, "สร้างภาพด้านข้างบนโมเดล เห็นโลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง ห้ามสร้างข้อความหรือตัวเลขใหม่"),
        requestFixture("back_fit_on_model", 3, "สร้างภาพด้านหลังบนโมเดล เห็นโลโก้ แพตช์ด้านหลังถ้ามีจริง"),
        requestFixture("material_or_lining_closeup", 4, "สร้างภาพ extreme close-up ของวัสดุ ซับใน โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง ห้ามสร้างข้อความหรือตัวเลขใหม่")
      ]
    }]
  };
}

function requestFixture(slot, sequence, prompt) {
  return {
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    kind: "support",
    slot,
    sequence,
    priority_required: true,
    prompt_framework_version: "prompt-framework-v3.15-hero-led-product-marking-lock",
    prompt,
    request_status: "ready_for_live_generation",
    blockers: [],
    approved_hero_anchor: {
      local_path: "/tmp/hero.png",
      url: "https://cdn.example.com/hero.png",
      source_role: "approved_hero_anchor"
    },
    model_input_files: [
      { source_role: "approved_hero_anchor", local_path: "/tmp/hero.png", file_name: "hero.png" },
      { source_role: "product_reference", local_path: "/tmp/ref-back.jpg", file_name: "ref-back.jpg" }
    ],
    reference_assets: [
      { source_name: "ref-back.jpg", source_role: "product_reference" }
    ]
  };
}

function executionArtifactFixture() {
  return {
    manifest_type: "live_pilot_generation_smoke_test",
    execution: {
      results: [
        doneResult("side_fit_on_model", "fal-side-1", "https://cdn.example.com/side.png", "/tmp/side.png"),
        doneResult("material_or_lining_closeup", "fal-detail-1", "https://cdn.example.com/detail.png", "/tmp/detail.png")
      ]
    }
  };
}

function doneResult(slot, providerRequestId, url, localPath) {
  return {
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    kind: "support",
    slot,
    execution_status: "done",
    provider_request_id: providerRequestId,
    generated_images: [{
      url,
      local_path: localPath,
      file_name: `${slot}.png`,
      contentType: "image/png",
      file_size: 123
    }],
    generated_assets: [{
      sku: "2DJ0493000",
      kind: "support",
      slot,
      type: "support_generated",
      source_url: url,
      local_path: localPath,
      file_name: `${slot}.png`,
      mime_type: "image/png",
      file_size: 123,
      image_index: 1
    }]
  };
}
