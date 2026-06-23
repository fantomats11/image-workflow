import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportVisibilitySummary,
  findUsableApprovedExportAsset,
  resolveWordPressWriteGuard,
  shouldSkipRetryExport
} from "../../lib/automation/export-asset-verification.mjs";

test("finds usable approved export asset and marks Google Drive export", () => {
  const result = findUsableApprovedExportAsset([
    { id: "asset-old", type: "approved_export", bucket: "local", storage_key: "", created_at: "2026-06-17T01:00:00Z" },
    {
      id: "asset-drive",
      type: "approved_export",
      bucket: "google_drive",
      public_url: "https://drive.google.com/file/d/file-1/view",
      storage_key: "file-1",
      created_at: "2026-06-18T01:00:00Z"
    }
  ]);

  assert.equal(result.assetId, "asset-drive");
  assert.equal(result.status, "google_drive");
  assert.equal(result.exportUrl, "https://drive.google.com/file/d/file-1/view");
});

test("retry export is skipped when a final export link already exists", () => {
  const result = shouldSkipRetryExport([
    {
      id: "asset-approved",
      type: "approved_export",
      bucket: "google_drive",
      public_url: "https://drive.google.com/file/d/final/view",
      created_at: "2026-06-18T01:00:00Z"
    }
  ]);

  assert.equal(result.skip, true);
  assert.equal(result.existing.status, "google_drive");
});

test("export visibility reports failure without leaking provider details", () => {
  const summary = buildExportVisibilitySummary({
    approval: { id: "approval-1", approved_at: "2026-06-18T01:00:00Z" },
    assets: [],
    auditEvents: [{
      event_type: "google_drive_export_failed",
      created_at: "2026-06-18T01:05:00Z",
      event_json: { error: "raw provider stack" }
    }]
  });

  assert.equal(summary.approved, true);
  assert.equal(summary.exportStatus, "export_failed");
  assert.equal(summary.canRetryExport, true);
  assert.equal(summary.latestExportFailureCode, "google_drive_export_failed");
  assert.doesNotMatch(JSON.stringify(summary), /raw provider stack/);
});

test("WordPress live write guard stays blocked even when env is enabled", () => {
  const guard = resolveWordPressWriteGuard({
    WORDPRESS_DRY_RUN: "false",
    WORDPRESS_LIVE_WRITES_ENABLED: "true"
  });

  assert.equal(guard.wordpress_dry_run, false);
  assert.equal(guard.wordpress_live_writes_enabled, true);
  assert.equal(guard.live_write_allowed, false);
  assert.equal(guard.blocker, "wordpress_live_write_must_remain_disabled");
});
