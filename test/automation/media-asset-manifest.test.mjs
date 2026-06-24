import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMediaAssetManifest,
  normalizeAssetForManifest
} from "../../lib/automation/media-asset-manifest.mjs";

test("buildMediaAssetManifest maps approved assets to batch SKUs and excludes generated drafts", () => {
  const manifest = buildMediaAssetManifest({
    batch: {
      batch_id: "batch-1",
      items: [
        { sku: "RAC-001", brand_id: "rent_a_coat", target_site: "rentacoat", support_shots: "front_view|texture_closeup" },
        { sku: "GM-001", brand_id: "go_mall", target_site: "gomall", support_shots: "front_view|back_view" }
      ]
    },
    jobs: [
      { id: "job-1", sku: "RAC-001", form_json: { sku: "RAC-001", jobKind: "hero" } },
      { id: "job-2", sku: "RAC-001", form_json: { sku: "RAC-001", jobKind: "front_view" } },
      { id: "job-3", sku: "OTHER-001", form_json: { sku: "OTHER-001", jobKind: "hero" } }
    ],
    generations: [
      { id: "gen-1", job_id: "job-1", kind: "hero" },
      { id: "gen-2", job_id: "job-2", kind: "front_view" },
      { id: "gen-3", job_id: "job-3", kind: "hero" }
    ],
    approvals: [
      { id: "approval-1", generation_id: "gen-1", approved_at: "2026-06-12T01:00:00Z" }
    ],
    assets: [
      { id: "asset-1", job_id: "job-1", generation_id: "gen-1", type: "hero_generated", bucket: "generated-images", public_url: "https://cdn.example.com/hero.png", created_at: "2026-06-12T00:00:00Z" },
      { id: "asset-2", job_id: "job-2", generation_id: "gen-2", type: "support_generated", bucket: "remote_url", public_url: "https://cdn.example.com/front.png", created_at: "2026-06-12T00:10:00Z" },
      { id: "asset-3", job_id: "job-3", generation_id: "gen-3", type: "hero_generated", bucket: "generated-images", public_url: "https://cdn.example.com/other.png", created_at: "2026-06-12T00:20:00Z" },
      { id: "asset-4", job_id: "job-1", type: "product_reference", bucket: "product-references", public_url: "https://cdn.example.com/ref.png" }
    ],
    now: new Date("2026-06-12T02:00:00Z")
  });

  assert.equal(manifest.manifest_type, "generation_approval_asset_manifest");
  assert.equal(manifest.live_write_allowed, false);
  assert.equal(manifest.summary.sku_count, 2);
  assert.equal(manifest.summary.asset_count, 1);
  assert.equal(manifest.summary.sku_with_assets, 1);
  assert.equal(manifest.summary.sku_without_assets, 1);
  assert.equal(manifest.summary.hero_generated, 1);
  assert.equal(manifest.summary.support_generated, 0);
  assert.equal(manifest.summary.excluded_unapproved_assets, 1);
  assert.equal(manifest.summary.orphan_assets, 0);
  assert.equal(manifest.items[0].sku, "RAC-001");
  assert.equal(manifest.items[0].asset_count, 1);
  assert.equal(manifest.items[0].assets[0].status, "approved");
  assert.equal(manifest.items[1].status, "no_assets_found");
  assert.equal(manifest.assets.every((asset) => asset.sku === "RAC-001"), true);
});

test("normalizeAssetForManifest derives SKU and shot metadata from joined job/generation rows", () => {
  const asset = normalizeAssetForManifest({
    asset: {
      id: "asset-1",
      job_id: "job-1",
      generation_id: "gen-1",
      type: "support_generated",
      bucket: "remote_url",
      storage_key: "https://cdn.example.com/side.png",
      public_url: "https://cdn.example.com/side.png"
    },
    job: {
      id: "job-1",
      sku: "",
      form_json: JSON.stringify({ sku: "GM-001", jobKind: "side_profile" })
    },
    generation: {
      id: "gen-1",
      kind: "side_profile"
    }
  });

  assert.equal(asset.sku, "GM-001");
  assert.equal(asset.shot_key, "side_profile");
  assert.equal(asset.status, "generated");
  assert.equal(asset.source, "remote_url");
  assert.equal(asset.url, "https://cdn.example.com/side.png");
});

test("buildMediaAssetManifest exposes only approved assets as WooCommerce ordered image slots", () => {
  const manifest = buildMediaAssetManifest({
    batch: {
      batch_id: "batch-approved",
      items: [{ sku: "FSTR240017", brand_id: "go_mall", target_site: "gomall", support_shots: "front_view|back_view|side_view" }]
    },
    jobs: [
      { id: "job-hero", sku: "FSTR240017", form_json: { sku: "FSTR240017", jobKind: "hero" } },
      { id: "job-front", sku: "FSTR240017", form_json: { sku: "FSTR240017", jobKind: "front_view" } },
      { id: "job-back", sku: "FSTR240017", form_json: { sku: "FSTR240017", jobKind: "back_view" } },
      { id: "job-side", sku: "FSTR240017", form_json: { sku: "FSTR240017", jobKind: "side_view" } }
    ],
    generations: [
      { id: "gen-hero", job_id: "job-hero", kind: "hero" },
      { id: "gen-front", job_id: "job-front", kind: "front_view" },
      { id: "gen-back", job_id: "job-back", kind: "back_view" },
      { id: "gen-side", job_id: "job-side", kind: "side_view" }
    ],
    approvals: [
      { id: "approval-hero", generation_id: "gen-hero", approved_at: "2026-06-24T04:00:00.000Z" },
      { id: "approval-front", generation_id: "gen-front", approved_at: "2026-06-24T04:01:00.000Z" },
      { id: "approval-back", generation_id: "gen-back", approved_at: "2026-06-24T04:02:00.000Z" }
    ],
    assets: [
      { id: "asset-hero", job_id: "job-hero", generation_id: "gen-hero", type: "hero_generated", bucket: "generated-images", public_url: "https://cdn.example.test/hero.png" },
      { id: "asset-front", job_id: "job-front", generation_id: "gen-front", type: "support_generated", bucket: "generated-images", public_url: "https://cdn.example.test/front.png" },
      { id: "asset-back", job_id: "job-back", generation_id: "gen-back", type: "support_generated", bucket: "generated-images", public_url: "https://cdn.example.test/back.png" },
      { id: "asset-side-draft", job_id: "job-side", generation_id: "gen-side", type: "support_generated", bucket: "generated-images", public_url: "https://cdn.example.test/side-draft.png" }
    ]
  });

  assert.equal(manifest.items[0].asset_count, 3);
  assert.equal(manifest.items[0].excluded_unapproved_asset_count, 1);
  assert.deepEqual(manifest.items[0].media_slots.map((slot) => [slot.role, slot.position, slot.shot_key, slot.asset_id]), [
    ["main_image", 0, "hero", "asset-hero"],
    ["gallery_image", 1, "front_view", "asset-front"],
    ["gallery_image", 2, "back_view", "asset-back"]
  ]);
  assert.equal(manifest.summary.excluded_unapproved_assets, 1);
  assert.doesNotMatch(JSON.stringify(manifest), /asset-side-draft/);
});
