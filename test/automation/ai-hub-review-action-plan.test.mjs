import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_HUB_IMAGE_REVIEW_ACTION_PLAN_MANIFEST,
  AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST,
  buildAiHubImageReviewActionPlan,
  buildAiHubImageReviewDecisionTemplate
} from "../../lib/automation/ai-hub-review-action-plan.mjs";

test("buildAiHubImageReviewDecisionTemplate defaults every asset to manual review, not approval", () => {
  const template = buildAiHubImageReviewDecisionTemplate({
    reviewBundle: reviewBundleFixture(),
    reviewer: "operator-1",
    now: new Date("2026-06-15T01:00:00Z")
  });

  assert.equal(template.manifest_type, AI_HUB_IMAGE_REVIEW_DECISIONS_MANIFEST);
  assert.equal(template.reviewer, "operator-1");
  assert.equal(template.decisions.length, 3);
  assert.equal(template.decisions.every((decision) => decision.action === "needs_manual_review"), true);
});

test("buildAiHubImageReviewActionPlan converts human decisions into approved candidates and regeneration requests", () => {
  const plan = buildAiHubImageReviewActionPlan({
    reviewBundle: reviewBundleFixture(),
    decisions: {
      reviewer: "operator-1",
      decisions: [
        {
          review_asset_id: "2DJ0493000:side_fit_on_model",
          action: "approve_asset",
          passed_checks: ["product_color_shape_material_matches_reference"],
          notes: "side angle usable"
        },
        {
          review_asset_id: "2DJ0493000:back_fit_on_model",
          action: "regenerate_slot",
          flags: ["missing_required_logo_patch_or_marking"],
          notes: "rear logo missing"
        }
      ]
    },
    now: new Date("2026-06-15T02:00:00Z")
  });

  assert.equal(plan.manifest_type, AI_HUB_IMAGE_REVIEW_ACTION_PLAN_MANIFEST);
  assert.equal(plan.live_write_allowed, false);
  assert.ok(plan.guardrails.includes("approved_candidates_are_not_published_media"));
  assert.equal(plan.summary.review_action_count, 3);
  assert.equal(plan.summary.approved_media_candidates, 1);
  assert.equal(plan.summary.regeneration_requests, 1);
  assert.equal(plan.summary.pending_human_decision, 1);

  const item = plan.items[0];
  assert.equal(item.approved_media_candidates.length, 1);
  assert.equal(item.approved_media_candidates[0].slot, "side_fit_on_model");
  assert.equal(item.approved_media_candidates[0].status, "ai_hub_review_approved_candidate");
  assert.equal(item.approved_media_candidates[0].publish_status, "not_published_requires_later_media_preflight");
  assert.equal(item.regeneration_requests.length, 1);
  assert.equal(item.regeneration_requests[0].slot, "back_fit_on_model");
  assert.equal(item.regeneration_requests[0].prompt, "Prompt for back");
  assert.deepEqual(item.regeneration_requests[0].flags, ["missing_required_logo_patch_or_marking"]);
  assert.equal(item.pending_assets[0].request_id, "2DJ0493000:material_or_lining_closeup");
});

test("buildAiHubImageReviewActionPlan blocks unsafe approval decisions", () => {
  const plan = buildAiHubImageReviewActionPlan({
    reviewBundle: reviewBundleFixture(),
    decisions: {
      decisions: [{
        review_asset_id: "2DJ0493000:side_fit_on_model",
        action: "approve_asset",
        flags: ["product_truth_mismatch"]
      }]
    }
  });

  const sideAction = plan.items[0].actions.find((action) => action.request_id === "2DJ0493000:side_fit_on_model");
  assert.equal(sideAction.action_status, "blocked");
  assert.ok(sideAction.blockers.includes("approve_has_blocking_qc_flags"));
  assert.equal(plan.summary.blocked_actions, 1);
  assert.equal(plan.summary.approved_media_candidates, 0);
});

function reviewBundleFixture() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    version: "ai-hub-image-review-bundle-v1.0",
    created_at: "2026-06-15T00:00:00Z",
    source_plan: {
      batch_id: "batch-aihub"
    },
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      review_assets: [
        reviewAsset("side_fit_on_model", "Prompt for side"),
        reviewAsset("back_fit_on_model", "Prompt for back"),
        reviewAsset("material_or_lining_closeup", "Prompt for detail")
      ]
    }]
  };
}

function reviewAsset(slot, prompt) {
  return {
    review_asset_id: `2DJ0493000:${slot}`,
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    kind: "support",
    slot,
    model: "openai/gpt-image-2/edit",
    prompt_framework_version: "prompt-framework-v3.15-hero-led-product-marking-lock",
    prompt,
    approved_hero_anchor: {
      local_path: "/tmp/hero.png"
    },
    reference_assets: [{
      source_name: "front.jpg"
    }],
    model_input_files: [{
      source_role: "approved_hero_anchor",
      local_path: "/tmp/hero.png"
    }],
    generated: {
      status: "done",
      provider_request_id: `fal-${slot}`,
      source_url: `https://cdn.example.com/${slot}.png`,
      local_path: `/tmp/${slot}.png`,
      file_name: `${slot}.png`,
      mime_type: "image/png",
      file_size: 123
    },
    qc: {
      review_status: "pending_human_qc",
      required_checks: [
        "product_color_shape_material_matches_reference"
      ]
    },
    review_actions: [
      "approve_asset",
      "regenerate_slot",
      "reject_asset",
      "needs_manual_review"
    ]
  };
}
