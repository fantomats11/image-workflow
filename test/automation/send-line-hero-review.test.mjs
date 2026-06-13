import test from "node:test";
import assert from "node:assert/strict";
import { buildHeroReviewPayload } from "../../scripts/automation/send-line-hero-review.mjs";

test("hero review payload separates visual-only local heroes from send-ready generations", () => {
  const payload = buildHeroReviewPayload({
    batch: {
      batch_id: "batch-hero-1",
      items: [{
        sku: "2CT1600000",
        brand_label: "GO Mall",
        product_name: "Discovery Expedition Trench Coat"
      }]
    },
    mediaManifest: {
      items: [{
        sku: "2CT1600000",
        assets: [{
          id: "2CT1600000:hero:local:1",
          type: "hero_generated",
          kind: "hero",
          public_url: "https://cdn.example.com/hero.png"
        }]
      }]
    },
    referenceResolution: {
      items: [{
        sku: "2CT1600000",
        selected_reference_assets: [{
          name: "2CT1600000_front.jpg",
          thumbnailLink: "https://cdn.example.com/ref-front.jpg"
        }]
      }]
    },
    reviewBaseUrl: "https://image-workflow.onrender.com"
  });

  assert.equal(payload.summary.hero_review_ready, 0);
  assert.equal(payload.summary.visual_review_only_missing_generation, 1);
  assert.equal(payload.send_blockers.length, 1);
  assert.equal(payload.items[0].status, "visual_review_only_missing_generation");
  assert.equal(payload.items[0].review_page_ready, false);
  assert.equal(payload.messages.length, 4);
  assert.equal(payload.messages[3].type, "template");
  assert.equal(payload.messages[3].template.actions.length, 2);
  assert.doesNotMatch(JSON.stringify(payload.messages), /Open review page/);
});

test("hero review payload marks persisted generation heroes as send ready", () => {
  const payload = buildHeroReviewPayload({
    batch: {
      batch_id: "batch-hero-1",
      items: [{
        sku: "2CT1600000",
        brand_label: "GO Mall",
        product_name: "Discovery Expedition Trench Coat"
      }]
    },
    mediaManifest: {
      items: [{
        sku: "2CT1600000",
        assets: [{
          id: "asset-hero-1",
          generation_id: "gen-hero-1",
          type: "hero_generated",
          kind: "hero",
          public_url: "https://cdn.example.com/hero.png"
        }]
      }]
    },
    referenceResolution: {
      items: [{
        sku: "2CT1600000",
        selected_reference_assets: [{
          name: "2CT1600000_front.jpg",
          thumbnailLink: "https://cdn.example.com/ref-front.jpg"
        }]
      }]
    },
    reviewBaseUrl: "https://image-workflow.onrender.com"
  });

  assert.equal(payload.summary.hero_review_ready, 1);
  assert.equal(payload.summary.visual_review_only_missing_generation, 0);
  assert.equal(payload.send_blockers.length, 0);
  assert.equal(payload.items[0].status, "ready_for_line_hero_review");
  assert.equal(payload.items[0].review_page_ready, true);
  assert.equal(payload.items[0].reference_assets.length, 1);
  assert.match(JSON.stringify(payload.messages), /Open review page/);
});
