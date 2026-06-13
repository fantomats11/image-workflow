import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_CATALOG_SHEET_STRATEGY,
  READY_VIA_PRODUCT_CATALOG_SHEET_STATUS,
  branchToBrandId,
  extractDriveIdFromUrl,
  extractProductCatalogRowsFromSheetGrid,
  refreshGenerationRowsWithProductCatalogSheet
} from "../../lib/automation/product-catalog-sheet-refresh.mjs";

test("extracts SKU, branch, process, note, and rich link chip from Product Catalog grid rows", () => {
  const rows = extractProductCatalogRowsFromSheetGrid([
    {
      values: [
        cell("Timestamp"), cell("Staff Name"), cell("SKU ID"), cell("Front"), cell("Back"),
        cell("Side"), cell("Inside"), cell("Extra 1"), cell("Extra 2"), cell("Extra 3"),
        cell("SKU Card"), cell("Link"), cell("สาขา (Branch)"), cell("Process"), cell("")
      ]
    },
    {
      values: [
        cell("24/04/2026 18:31:41"), cell("ขวัญ"), cell("FSTR260013"), cell(""), cell(""),
        cell(""), cell(""), cell(""), cell(""), cell(""),
        cell(""), linkCell("FSTR260013", "https://drive.google.com/drive/folders/folder-123"),
        cell("GO Mall"), cell("TRUE"), cell("already done")
      ]
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sku, "FSTR260013");
  assert.equal(rows[0].reference_branch, "GO Mall");
  assert.equal(rows[0].reference_brand_id, "go_mall");
  assert.equal(rows[0].reference_target_site, "gomall");
  assert.equal(rows[0].reference_drive_id, "folder-123");
  assert.equal(rows[0].reference_sheet_process, "TRUE");
  assert.equal(rows[0].reference_sheet_note, "already done");
});

test("refreshes generation rows from Product Catalog sheet and keeps branch metadata", () => {
  const generationRows = [
    {
      sku: "FSTR260013",
      generation_status: "ready_via_drive_folder_lookup",
      reference_lookup_strategy: "drive_folder",
      product_type: "rental"
    },
    { sku: "MISSING001", generation_status: "needs_reference_image" }
  ];
  const productCatalogRows = [
    {
      sheet_row: "2",
      sku: "FSTR260013",
      reference_url: "https://drive.google.com/drive/folders/folder-123",
      reference_drive_id: "folder-123",
      reference_branch: "GO Mall",
      reference_brand_id: "go_mall",
      reference_target_site: "gomall",
      reference_sheet_process: "FALSE"
    }
  ];

  const { rows, summary } = refreshGenerationRowsWithProductCatalogSheet({ generationRows, productCatalogRows });

  assert.equal(summary.matched, 1);
  assert.equal(summary.missing, 1);
  assert.equal(summary.matched_go_mall, 1);
  assert.equal(rows[0].generation_status, READY_VIA_PRODUCT_CATALOG_SHEET_STATUS);
  assert.equal(rows[0].reference_lookup_strategy, PRODUCT_CATALOG_SHEET_STRATEGY);
  assert.equal(rows[0].reference_branch, "GO Mall");
  assert.equal(rows[0].reference_target_site, "gomall");
});

test("normalizes Product Catalog branches to brand ids", () => {
  assert.equal(branchToBrandId("GO Mall"), "go_mall");
  assert.equal(branchToBrandId("Rent A Coat"), "rent_a_coat");
});

test("extracts Drive ids from common Drive URL shapes", () => {
  assert.equal(extractDriveIdFromUrl("https://drive.google.com/drive/folders/folder_abc-123"), "folder_abc-123");
  assert.equal(extractDriveIdFromUrl("https://drive.google.com/open?id=file_abc-123"), "file_abc-123");
});

function cell(value) {
  return { formattedValue: String(value) };
}

function linkCell(value, uri) {
  return {
    formattedValue: String(value),
    chipRuns: [{
      chip: {
        richLinkProperties: { uri, mimeType: "application/vnd.google-apps.folder" }
      }
    }]
  };
}
