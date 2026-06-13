import test from "node:test";
import assert from "node:assert/strict";
import {
  FOLDER_MATCH_AMBIGUOUS,
  READY_VIA_DRIVE_FOLDER_STATUS,
  buildReferenceFolderIndex,
  findReferenceFolderForSku,
  normalizeSkuForFolderMatch,
  refreshGenerationRowsWithReferenceFolders
} from "../../lib/automation/reference-folder-refresh.mjs";

test("normalizes SKU folder names for case, spaces, hyphens, and underscores", () => {
  assert.equal(normalizeSkuForFolderMatch(" S24-GAF_0318 "), "s24gaf0318");
  assert.equal(normalizeSkuForFolderMatch("S24 GAF 0318"), "s24gaf0318");
});

test("matches shared product_photos folders for both Rent A Coat and GO Mall SKU rows", () => {
  const generationRows = [
    { sku: "RAC-COAT-001", generation_status: "needs_reference_image", product_type: "rental" },
    { sku: "S24GAF0318", generation_status: "needs_reference_image", product_type: "sale" }
  ];
  const folders = [
    { id: "drive-rac-coat", name: "RAC COAT 001" },
    { id: "drive-gomall-sweater", name: "S24-GAF-0318" }
  ];

  const { rows, summary } = refreshGenerationRowsWithReferenceFolders({
    generationRows,
    folders,
    rootFolderId: "product-photos-root"
  });

  assert.equal(summary.matched, 2);
  assert.equal(rows[0].generation_status, READY_VIA_DRIVE_FOLDER_STATUS);
  assert.equal(rows[0].reference_parent_folder_id, "product-photos-root");
  assert.equal(rows[0].reference_drive_id, "drive-rac-coat");
  assert.equal(rows[0].reference_lookup_key, "RAC-COAT-001");
  assert.equal(rows[1].reference_drive_id, "drive-gomall-sweater");
  assert.equal(rows[1].reference_lookup_strategy, "drive_folder");
});

test("does not mark ambiguous partial folder matches as ready", () => {
  const { rows, summary } = refreshGenerationRowsWithReferenceFolders({
    generationRows: [{ sku: "ABC123", generation_status: "needs_reference_image" }],
    folders: [
      { id: "folder-1", name: "ABC123 front" },
      { id: "folder-2", name: "ABC123 backup" }
    ],
    rootFolderId: "product-photos-root"
  });

  assert.equal(summary.ambiguous, 1);
  assert.equal(rows[0].generation_status, "needs_reference_image");
  assert.equal(rows[0].reference_verified, FOLDER_MATCH_AMBIGUOUS);
});

test("preserves already ready rows unless overwrite is requested", () => {
  const generationRows = [{
    sku: "S24GAF0318",
    generation_status: READY_VIA_DRIVE_FOLDER_STATUS,
    reference_parent_folder_id: "existing-root",
    reference_drive_id: "existing-folder",
    reference_lookup_key: "S24GAF0318"
  }];
  const folders = [{ id: "new-folder", name: "S24GAF0318" }];

  const unchanged = refreshGenerationRowsWithReferenceFolders({
    generationRows,
    folders,
    rootFolderId: "new-root"
  });
  assert.equal(unchanged.rows[0].reference_drive_id, "existing-folder");
  assert.equal(unchanged.summary.skipped_status, 1);

  const overwritten = refreshGenerationRowsWithReferenceFolders({
    generationRows,
    folders,
    rootFolderId: "new-root",
    shouldOverwriteReadyRows: true
  });
  assert.equal(overwritten.rows[0].reference_drive_id, "new-folder");
  assert.equal(overwritten.rows[0].reference_parent_folder_id, "new-root");
});

test("folder index supports exact lookup before partial lookup", () => {
  const index = buildReferenceFolderIndex([
    { id: "partial", name: "S24GAF0318 backup" },
    { id: "exact", name: "S24GAF0318" }
  ]);
  const match = findReferenceFolderForSku(index, "S24-GAF-0318");
  assert.equal(match.status, "exact");
  assert.equal(match.folder.id, "exact");
});
