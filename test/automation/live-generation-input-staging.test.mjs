import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReferenceStagingManifestFromBatchItems,
  stageMediaManifestAssetsForLiveGeneration
} from "../../lib/automation/live-generation-input-staging.mjs";

test("stageMediaManifestAssetsForLiveGeneration downloads remote hero assets", async () => {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-media-stage-"));
  const manifest = {
    batch_id: "batch-1",
    assets: [{
      id: "hero-asset-1",
      sku: "2DJ0493000",
      type: "hero_generated",
      kind: "hero",
      url: "https://cdn.example.com/hero.png",
      public_url: "https://cdn.example.com/hero.png",
      file_name: "hero.png"
    }]
  };

  const staged = await stageMediaManifestAssetsForLiveGeneration({
    mediaManifest: manifest,
    stagingDir,
    fetchImpl: async () => new Response(Buffer.from("hero-image"), {
      status: 200,
      headers: { "content-type": "image/png" }
    })
  });

  assert.equal(staged.assets[0].staging_status, "staged_local_file");
  assert.equal(fs.existsSync(staged.assets[0].local_path), true);
  assert.equal(fs.readFileSync(staged.assets[0].local_path, "utf8"), "hero-image");
});

test("buildReferenceStagingManifestFromBatchItems stages reference image urls", async () => {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-ref-stage-"));
  const manifest = await buildReferenceStagingManifestFromBatchItems({
    batchItems: [{
      sku: "2DJ0493000",
      metadata: {
        reference_images: [{
          drive_file_id: "front-ref-1",
          name: "front.jpg",
          public_url: "https://cdn.example.com/front.jpg"
        }]
      }
    }],
    stagingDir,
    fetchImpl: async () => new Response(Buffer.from("front-image"), {
      status: 200,
      headers: { "content-type": "image/jpeg" }
    })
  });

  assert.equal(manifest.summary.staged_reference_assets, 1);
  assert.equal(manifest.items[0].staged_reference_assets[0].staging_status, "staged_local_file");
  assert.equal(manifest.items[0].staged_reference_assets[0].source_name, "front.jpg");
  assert.equal(fs.existsSync(manifest.items[0].staged_reference_assets[0].local_path), true);
});
