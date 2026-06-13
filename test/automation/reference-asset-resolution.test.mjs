import test from "node:test";
import assert from "node:assert/strict";
import { buildReferenceAssetResolution } from "../../lib/automation/reference-asset-resolution.mjs";

test("buildReferenceAssetResolution selects product reference images from Drive folder files", () => {
  const resolution = buildReferenceAssetResolution({
    batch: { batch_id: "batch-1" },
    batchItems: [{
      sku: "RAC-COAT-001",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      product_name: "Snow Coat",
      reference_url: "https://drive.google.com/drive/folders/folder-1"
    }],
    filesByFolderId: {
      "folder-1": [
        {
          id: "file-front",
          name: "RAC-COAT-001_front.jpg",
          mimeType: "image/jpeg",
          imageMediaMetadata: { width: 1600, height: 2000 },
          webViewLink: "https://drive.google.com/file/d/file-front/view"
        },
        {
          id: "file-label",
          name: "RAC-COAT-001_label.jpg",
          mimeType: "image/jpeg",
          imageMediaMetadata: { width: 1200, height: 900 }
        }
      ]
    },
    now: new Date("2026-06-12T02:00:00Z")
  });

  assert.equal(resolution.manifest_type, "reference_asset_resolution");
  assert.equal(resolution.live_write_allowed, false);
  assert.equal(resolution.summary.sku_count, 1);
  assert.equal(resolution.summary.resolved_reference_files, 1);
  assert.equal(resolution.summary.selected_reference_assets, 1);
  assert.equal(resolution.summary.label_or_tag, 1);
  assert.equal(resolution.items[0].resolution_status, "resolved_reference_files");
  assert.equal(resolution.items[0].selected_reference_assets[0].drive_file_id, "file-front");
  assert.equal(resolution.items[0].selected_reference_assets[0].model_input_status, "needs_download_or_signed_staging");
});

test("buildReferenceAssetResolution keeps label-only folders in review state", () => {
  const resolution = buildReferenceAssetResolution({
    batchItems: [{
      sku: "GM-001",
      brand_id: "go_mall",
      reference_url: "https://drive.google.com/drive/folders/folder-2"
    }],
    filesByFolderId: {
      "folder-2": [
        {
          id: "file-label",
          name: "GM-001_sku_tag.jpg",
          mimeType: "image/jpeg",
          imageMediaMetadata: { width: 1200, height: 900 }
        }
      ]
    }
  });

  assert.equal(resolution.summary.needs_reference_review, 1);
  assert.equal(resolution.summary.resolved_reference_files, 0);
  assert.deepEqual(resolution.items[0].blockers, ["no_auto_usable_product_reference"]);
  assert.equal(resolution.items[0].classification_summary.label_or_tag, 1);
});

test("buildReferenceAssetResolution reports unreadable or empty reference folders", () => {
  const resolution = buildReferenceAssetResolution({
    batchItems: [{
      sku: "GM-002",
      reference_url: "https://drive.google.com/drive/folders/folder-3"
    }],
    filesByFolderId: { "folder-3": [] }
  });

  assert.equal(resolution.summary.needs_reference_review, 1);
  assert.deepEqual(resolution.items[0].blockers, ["empty_or_unreadable_reference_folder"]);
});
