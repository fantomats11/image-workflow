import test from "node:test";
import assert from "node:assert/strict";
import { renderAiHubImageReviewPage } from "../../lib/automation/ai-hub-review-page.mjs";

test("renderAiHubImageReviewPage renders generated assets, guardrails, prompts, and interactive review actions", () => {
  const html = renderAiHubImageReviewPage(reviewBundleFixture(), {
    bundleName: "ai-hub-image-review-bundle-2DJ0493000-v3.15.json"
  });

  assert.match(html, /AI HUB Review - 2DJ0493000/);
  assert.match(html, /local review only no wordpress or db write/i);
  assert.match(html, /2DJ0493000:side_fit_on_model/);
  assert.match(html, /side fit on model/);
  assert.match(html, /https:\/\/cdn\.example\.com\/side\.png/);
  assert.match(html, /Prompt ที่ใช้ยิงโมเดล/);
  assert.match(html, /อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว/);
  assert.match(html, /technical marking or fill power accuracy if visible/);
  assert.match(html, /Review Decision Console/);
  assert.match(html, /data-decision-endpoint="\/api\/ai-hub\/review-decisions"/);
  assert.match(html, /<select class="decision-action">/);
  assert.match(html, /data-action-value="approve_asset"/);
  assert.match(html, /Submit Decisions/);
  assert.doesNotMatch(html, /<button type="button" disabled>approve asset<\/button>/);
});

test("renderAiHubImageReviewPage uses local-image endpoint when only local_path exists", () => {
  const bundle = reviewBundleFixture();
  bundle.review_items[0].review_assets[0].generated.source_url = "";
  bundle.review_items[0].review_assets[0].generated.local_path = "/tmp/outputs/generated/side.png";

  const html = renderAiHubImageReviewPage(bundle);

  assert.match(html, /\/api\/ai-hub\/local-image\?path=%2Ftmp%2Foutputs%2Fgenerated%2Fside\.png/);
});

function reviewBundleFixture() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    version: "ai-hub-image-review-bundle-v1.0",
    guardrails: [
      "local_review_only_no_wordpress_or_db_write",
      "approve_before_publish_or_media_attach"
    ],
    summary: {
      sku_count: 1,
      review_asset_count: 1,
      generated_asset_count: 1,
      pending_human_qc: 1
    },
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      review_status: "pending_human_qc",
      approved_hero_anchor: {
        url: "https://cdn.example.com/hero.png",
        file_name: "hero.png"
      },
      review_assets: [{
        review_asset_id: "2DJ0493000:side_fit_on_model",
        request_id: "2DJ0493000:side_fit_on_model",
        sku: "2DJ0493000",
        kind: "support",
        slot: "side_fit_on_model",
        prompt_framework_version: "prompt-framework-v3.15-hero-led-product-marking-lock",
        prompt: "อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว สร้างภาพด้านข้าง",
        generated: {
          status: "done",
          provider_request_id: "fal-side",
          source_url: "https://cdn.example.com/side.png",
          local_path: "",
          file_name: "side.png",
          mime_type: "image/png",
          file_size: 123,
          image_index: 1
        },
        qc: {
          review_status: "pending_human_qc",
          required_checks: [
            "side_or_45_degree_angle_is_clear",
            "technical_marking_or_fill_power_accuracy_if_visible"
          ]
        },
        review_actions: [
          "approve_asset",
          "regenerate_slot",
          "reject_asset",
          "needs_manual_review"
        ]
      }]
    }]
  };
}
