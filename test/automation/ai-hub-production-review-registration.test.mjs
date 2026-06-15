import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_HUB_PRODUCTION_REVIEW_REGISTRATION_MANIFEST,
  buildAiHubProductionReviewRegistrationPlan
} from "../../lib/automation/ai-hub-production-review-registration.mjs";

function reviewBundle() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    version: "ai-hub-image-review-bundle-v1.0",
    created_at: "2026-06-15T07:52:15.498Z",
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      brand_label: "GO Mall",
      target_site: "go_mall",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      product_type: "เสื้อ",
      category: "เสื้อ",
      approved_hero_anchor: {
        id: "asset-hero-approved-2DJ0493000-v3.12-local",
        public_url: "https://v3b.fal.media/files/b/hero.png",
        local_path: "/outputs/hero/01.png",
        file_name: "01.png",
        file_size: 929227,
        approval_id: "local-qc-2DJ0493000-v3.13-support-test"
      },
      review_assets: [{
        review_asset_id: "support-side",
        request_id: "2DJ0493000:support:side_fit_on_model",
        kind: "support",
        slot: "side_fit_on_model",
        prompt_framework_version: "prompt-framework-v3.15",
        prompt: "อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว สร้างภาพด้านข้าง",
        generated: {
          status: "done",
          provider_request_id: "provider-side",
          source_url: "https://v3b.fal.media/files/b/side.png",
          local_path: "/outputs/support/side/01.png",
          file_name: "side.png",
          mime_type: "image/png",
          file_size: 100
        }
      }, {
        review_asset_id: "support-back",
        request_id: "2DJ0493000:support:back_fit_on_model",
        kind: "support",
        slot: "back_fit_on_model",
        prompt_framework_version: "prompt-framework-v3.15",
        generated: {
          status: "done",
          provider_request_id: "provider-back",
          source_url: "https://v3b.fal.media/files/b/back.png",
          file_name: "back.png"
        }
      }]
    }]
  };
}

test("buildAiHubProductionReviewRegistrationPlan keeps today's hero and support candidates together", () => {
  const plan = buildAiHubProductionReviewRegistrationPlan({
    reviewBundle: reviewBundle(),
    actorEmail: "champ082820@gmail.com",
    reviewBaseUrl: "https://image-workflow.onrender.com",
    now: new Date("2026-06-15T10:00:00.000Z")
  });

  assert.equal(plan.manifest_type, AI_HUB_PRODUCTION_REVIEW_REGISTRATION_MANIFEST);
  assert.equal(plan.batch_key, "ai-hub-review-20260615-2DJ0493000");
  assert.equal(plan.summary.sku_count, 1);
  assert.equal(plan.summary.hero_candidates, 1);
  assert.equal(plan.summary.support_candidates, 2);
  assert.equal(plan.summary.ready_items, 1);
  assert.equal(plan.items[0].hero_asset.type, "hero_generated");
  assert.equal(plan.items[0].hero_asset.review_role, "today_hero_candidate");
  assert.deepEqual(plan.items[0].support_assets.map((asset) => asset.slot), [
    "side_fit_on_model",
    "back_fit_on_model"
  ]);
  assert.deepEqual(plan.blockers, []);
});

test("buildAiHubProductionReviewRegistrationPlan blocks production persist without actor", () => {
  const plan = buildAiHubProductionReviewRegistrationPlan({
    reviewBundle: reviewBundle(),
    dryRun: false
  });

  assert.equal(plan.live_write_allowed, true);
  assert.deepEqual(plan.blockers, ["missing_actor_id_or_email"]);
});
