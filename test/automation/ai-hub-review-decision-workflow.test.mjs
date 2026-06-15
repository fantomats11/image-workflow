import test from "node:test";
import assert from "node:assert/strict";
import { buildAiHubReviewDecisionSubmission } from "../../lib/automation/ai-hub-review-decision-workflow.mjs";

test("buildAiHubReviewDecisionSubmission creates local decisions and action plan from console payload", () => {
  const submission = buildAiHubReviewDecisionSubmission({
    reviewBundle: reviewBundleFixture(),
    reviewer: "operator-1",
    decisions: [
      {
        review_asset_id: "2DJ0493000:side_fit_on_model",
        action: "approve_asset",
        passed_checks: "product_color_shape_material_matches_reference, same_set_as_approved_hero_when_available",
        notes: "ผ่าน ใช้ได้"
      },
      {
        review_asset_id: "2DJ0493000:back_fit_on_model",
        action: "regenerate_slot",
        flags: "missing_required_logo_patch_or_marking",
        notes: "โลโก้หลังไม่ตรง"
      }
    ],
    now: new Date("2026-06-15T03:00:00Z")
  });

  assert.equal(submission.live_write_allowed, false);
  assert.equal(submission.decisions.live_write_allowed, false);
  assert.equal(submission.summary.submitted_decisions, 2);
  assert.equal(submission.summary.valid_decisions, 2);
  assert.equal(submission.summary.approved_media_candidates, 1);
  assert.equal(submission.summary.regeneration_requests, 1);
  assert.equal(submission.summary.pending_human_decision, 1);
  assert.equal(submission.action_plan.items[0].approved_media_candidates[0].slot, "side_fit_on_model");
  assert.equal(submission.action_plan.items[0].regeneration_requests[0].slot, "back_fit_on_model");
});

test("buildAiHubReviewDecisionSubmission keeps unsafe approval blocked", () => {
  const submission = buildAiHubReviewDecisionSubmission({
    reviewBundle: reviewBundleFixture(),
    decisions: [{
      review_asset_id: "2DJ0493000:side_fit_on_model",
      action: "approve_asset",
      flags: ["product_truth_mismatch"],
      notes: "ไม่ควรผ่าน"
    }]
  });

  const decision = submission.decisions.decisions[0];
  assert.equal(decision.validation_status, "invalid");
  assert.ok(decision.validation_blockers.includes("approve_requires_no_qc_flags"));
  assert.equal(submission.summary.blocked_actions, 1);
  assert.equal(submission.summary.approved_media_candidates, 0);
});

function reviewBundleFixture() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      review_assets: [
        reviewAsset("side_fit_on_model"),
        reviewAsset("back_fit_on_model"),
        reviewAsset("material_or_lining_closeup")
      ]
    }]
  };
}

function reviewAsset(slot) {
  return {
    review_asset_id: `2DJ0493000:${slot}`,
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    kind: "support",
    slot,
    model: "openai/gpt-image-2/edit",
    prompt_framework_version: "prompt-framework-v3.15-hero-led-product-marking-lock",
    prompt: `Prompt for ${slot}`,
    generated: {
      status: "done",
      provider_request_id: `fal-${slot}`,
      source_url: `https://cdn.example.com/${slot}.png`,
      file_name: `${slot}.png`,
      mime_type: "image/png",
      file_size: 123
    },
    qc: {
      review_status: "pending_human_qc",
      required_checks: [
        "product_color_shape_material_matches_reference",
        "same_set_as_approved_hero_when_available"
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
