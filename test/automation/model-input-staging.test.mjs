import test from "node:test";
import assert from "node:assert/strict";
import { buildModelInputStagingManifest } from "../../lib/automation/model-input-staging.mjs";

test("buildModelInputStagingManifest marks staged reference files ready", () => {
  const manifest = buildModelInputStagingManifest({
    referenceResolution: {
      batch_id: "batch-1",
      items: [{
        sku: "RAC-001",
        brand_id: "rent_a_coat",
        selected_reference_assets: [
          { drive_file_id: "file-1", name: "front.jpg", mimeType: "image/jpeg", width: 1200, height: 1600 },
          { drive_file_id: "file-2", name: "side.jpg", mimeType: "image/jpeg", width: 1200, height: 1600 }
        ]
      }]
    },
    stagedFilesByDriveId: {
      "file-1": { local_path: "/tmp/front.jpg", file_name: "front.jpg", file_size: 12, sha256: "abc", staged_at: "2026-06-12T01:00:00Z" },
      "file-2": { local_path: "/tmp/side.jpg", file_name: "side.jpg", file_size: 13, sha256: "def", staged_at: "2026-06-12T01:00:00Z" }
    },
    now: new Date("2026-06-12T02:00:00Z")
  });

  assert.equal(manifest.manifest_type, "model_input_staging");
  assert.equal(manifest.live_write_allowed, false);
  assert.equal(manifest.summary.model_inputs_staged, 1);
  assert.equal(manifest.summary.staged_reference_assets, 2);
  assert.equal(manifest.items[0].staging_status, "model_inputs_staged");
  assert.equal(manifest.items[0].staged_reference_assets[0].sha256, "abc");
});

test("buildModelInputStagingManifest reports missing staged files", () => {
  const manifest = buildModelInputStagingManifest({
    referenceResolution: {
      items: [{
        sku: "GM-001",
        selected_reference_assets: [{ drive_file_id: "file-1", name: "front.jpg" }]
      }]
    },
    stagedFilesByDriveId: {}
  });

  assert.equal(manifest.summary.needs_model_input_staging, 1);
  assert.equal(manifest.summary.missing_staged_reference_files, 1);
  assert.deepEqual(manifest.items[0].blockers, ["missing_staged_reference_file"]);
});
