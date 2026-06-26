import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveSupportCandidateManifest } from "../../lib/automation/live-support-candidate-manifest.mjs";

test("buildLiveSupportCandidateManifest promotes approved hero and support review state into a local candidate manifest", () => {
  const manifest = buildLiveSupportCandidateManifest({
    batchId: "batch-live-1",
    sku: "2DJ0493000",
    job: {
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      product_type: "เสื้อ",
      reference_brand_id: "go_mall",
      reference_target_site: "gomall"
    },
    heroAsset: {
      id: "hero-asset-1",
      public_url: "https://example.test/hero.png",
      file_name: "hero.png",
      type: "hero_generated"
    },
    studioMasterAsset: {
      id: "studio-master-asset-1",
      public_url: "https://example.test/studio-master.png",
      file_name: "studio-master.png",
      type: "studio_master_generated"
    },
    supportAssets: [
      {
        asset_id: "support-side",
        generation_id: "gen-side",
        request_id: "2DJ0493000:support:side_fit_on_model",
        slot: "side_fit_on_model",
        public_url: "https://example.test/side.png",
        file_name: "side.png"
      },
      {
        asset_id: "support-back",
        generation_id: "gen-back",
        request_id: "2DJ0493000:support:back_fit_on_model",
        slot: "back_fit_on_model",
        public_url: "https://example.test/back.png",
        file_name: "back.png"
      }
    ],
    decisionState: {
      review_status: "support_approved_for_candidate_manifest",
      candidate_manifest_ready: true,
      assets: [
        { asset_id: "support-side", decision: "approve_support", reviewer: "reviewer@test" },
        { asset_id: "support-back", decision: "approve_support", reviewer: "reviewer@test" }
      ]
    },
    now: new Date("2026-06-16T03:00:00Z")
  });

  assert.equal(manifest.manifest_type, "ai_hub_product_image_local_candidate_manifest");
  assert.equal(manifest.manifest_status, "ready_for_media_manifest_preflight");
  assert.equal(manifest.live_write_allowed, false);
  assert.equal(manifest.publish_allowed, false);
  assert.equal(manifest.media_attach_allowed, false);
  assert.equal(manifest.summary.candidate_count, 4);
  assert.equal(manifest.summary.hero_candidates, 1);
  assert.equal(manifest.summary.studio_master_candidates, 1);
  assert.equal(manifest.summary.support_candidates, 2);
  assert.equal(manifest.items[0].candidate_count, 4);
  assert.equal(manifest.candidates[0].candidate_role, "approved_hero_anchor");
  assert.equal(manifest.candidates[1].candidate_role, "approved_studio_master_anchor");
  assert.equal(manifest.candidates[2].candidate_role, "approved_support_candidate");
  assert.doesNotMatch(JSON.stringify(manifest), /publish_now|attach_media|wordpress_write/i);
});

test("buildLiveSupportCandidateManifest blocks when support decisions are not fully approved", () => {
  const manifest = buildLiveSupportCandidateManifest({
    sku: "2DJ0493000",
    heroAsset: { public_url: "https://example.test/hero.png" },
    studioMasterAsset: { public_url: "https://example.test/studio-master.png" },
    supportAssets: [{ asset_id: "support-back", public_url: "https://example.test/back.png", slot: "back_fit_on_model" }],
    decisionState: {
      review_status: "support_regeneration_requested",
      candidate_manifest_ready: false,
      assets: [{ asset_id: "support-back", decision: "regenerate_support" }]
    }
  });

  assert.equal(manifest.manifest_status, "blocked_before_local_candidate_manifest");
  assert.equal(manifest.summary.ready_candidates, 2);
  assert.deepEqual(manifest.manifest_blockers, ["support_review_not_fully_approved"]);
});
