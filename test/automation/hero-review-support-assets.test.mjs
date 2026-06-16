import test from "node:test";
import assert from "node:assert/strict";
import { buildHeroReviewSupportAssets } from "../../lib/automation/hero-review-support-assets.mjs";

test("buildHeroReviewSupportAssets merges persisted support assets from job and batch metadata", () => {
  const supportAssets = buildHeroReviewSupportAssets({
    assets: [{
      id: "asset-side",
      type: "support_generated",
      public_url: "https://cdn.example.com/side.png",
      file_name: "side.png",
      mime_type: "image/png",
      file_size: 123
    }],
    generations: [{
      id: "gen-side",
      kind: "support",
      request_id: "2DJ0493000:side_fit_on_model",
      image_asset_id: "asset-side",
      prompt: "side prompt",
      completed_at: "2026-06-16T08:00:00.000Z"
    }],
    batchMetadata: {
      support_assets: [{
        asset_id: "asset-back",
        generation_id: "gen-back",
        slot: "back_fit_on_model",
        source_url: "https://cdn.example.com/back.png",
        file_name: "back.png"
      }]
    }
  });

  assert.equal(supportAssets.length, 2);
  assert.deepEqual(
    supportAssets.map((asset) => asset.slot),
    ["side_fit_on_model", "back_fit_on_model"]
  );
  assert.equal(supportAssets[0].public_url, "https://cdn.example.com/side.png");
  assert.equal(supportAssets[0].generation_id, "gen-side");
});
