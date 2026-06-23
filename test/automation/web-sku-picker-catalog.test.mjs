import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReferenceKey,
  buildWebSkuReferenceContract,
  findWebSkuPickerItemBySku,
  normalizeWebSkuPickerRows,
  searchWebSkuPickerCatalog
} from "../../lib/automation/web-sku-picker-catalog.mjs";

const rows = [
  catalogRow({
    sku: "R24CBF0013",
    product_name: "Women's Slopeside Peak Luxe Waterproof Snow Boot",
    category: "รองเท้า",
    subcategory: "รองเท้าลุยหิมะ",
    feature_notes: "Omni-Heat | กันน้ำ",
    reference_url: "https://drive.google.com/drive/folders/ref-shoe",
    reference_drive_id: "ref-shoe",
    reference_branch: "Rent A Coat",
    reference_brand_id: "rent_a_coat",
    source_row: "3"
  }),
  catalogRow({
    sku: "R23CBT0048",
    product_name: "Columbia Alpine Crux Titanium Down Hooded Jacket",
    category: "เสื้อ",
    subcategory: "เสื้อขนเป็ด",
    feature_notes: "Titanium | hood",
    reference_url: "https://drive.google.com/drive/folders/ref-coat",
    reference_drive_id: "ref-coat",
    reference_branch: "GO Mall",
    reference_brand_id: "go_mall",
    source_row: "4"
  }),
  catalogRow({
    sku: "MISSREF001",
    product_name: "Missing Reference Gloves",
    category: "ถุงมือ",
    subcategory: "ถุงมือกันหนาว",
    reference_url: "",
    reference_drive_id: "",
    reference_branch: "Rent A Coat",
    source_row: "5"
  })
];

test("searchWebSkuPickerCatalog returns safe empty results for blank query", () => {
  const result = searchWebSkuPickerCatalog({ rows, query: "" });

  assert.equal(result.ok, true);
  assert.equal(result.query, "");
  assert.equal(result.items.length, 0);
  assert.equal(result.total, 0);
});

test("searchWebSkuPickerCatalog searches by SKU and normalizes canonical fields", () => {
  const result = searchWebSkuPickerCatalog({ rows, query: "R24CBF0013" });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].sku, "R24CBF0013");
  assert.equal(result.items[0].product_name, "Women's Slopeside Peak Luxe Waterproof Snow Boot");
  assert.equal(result.items[0].branch, "Rent A Coat");
  assert.equal(result.items[0].canonical_source, "catalog_snapshot");
  assert.equal(result.items[0].reference_readiness.status, "ready");
  assert.equal(result.items[0].reference_readiness.reference_count, 1);
  assert.deepEqual(result.items[0].locked_fields, [
    "sku",
    "product_name",
    "branch",
    "category",
    "subcategory",
    "reference_url",
    "reference_drive_id",
    "reference_lookup_strategy"
  ]);
  assert(result.items[0].needs_mapping.includes("brand"));
  assert(result.items[0].needs_mapping.includes("color"));
});

test("searchWebSkuPickerCatalog searches by product name and branch/category filters", () => {
  const byName = searchWebSkuPickerCatalog({ rows, query: "Columbia", branch: "GO Mall" });
  assert.equal(byName.total, 1);
  assert.equal(byName.items[0].sku, "R23CBT0048");

  const byCategory = searchWebSkuPickerCatalog({ rows, query: "กันหนาว", category: "ถุงมือ" });
  assert.equal(byCategory.total, 1);
  assert.equal(byCategory.items[0].sku, "MISSREF001");
});

test("searchWebSkuPickerCatalog limits results and does not mutate rows", () => {
  const source = [
    ...rows,
    catalogRow({ sku: "A001", product_name: "Alpha coat", category: "เสื้อ" }),
    catalogRow({ sku: "A002", product_name: "Alpha boot", category: "รองเท้า" })
  ];
  const before = JSON.stringify(source);
  const result = searchWebSkuPickerCatalog({ rows: source, query: "a", limit: 2 });

  assert.equal(result.items.length, 2);
  assert.equal(JSON.stringify(source), before);
});

test("normalizeWebSkuPickerRows marks missing references as blocked", () => {
  const normalized = normalizeWebSkuPickerRows(rows);
  const blocked = normalized.find((item) => item.sku === "MISSREF001");

  assert.equal(blocked.reference_readiness.status, "blocked");
  assert.equal(blocked.reference_readiness.usable_reference_count, 0);
  assert.deepEqual(blocked.reference_readiness.blockers.map((blocker) => blocker.code), ["missing_reference_assets"]);
});

test("normalizeWebSkuPickerRows marks unverified references as warning", () => {
  const normalized = normalizeWebSkuPickerRows([
    catalogRow({
      sku: "WARNREF001",
      product_name: "Unverified Reference Coat",
      reference_url: "https://drive.google.com/drive/folders/ref-warning",
      reference_drive_id: "ref-warning",
      reference_verified: ""
    })
  ]);

  assert.equal(normalized[0].reference_readiness.status, "warning");
  assert(normalized[0].reference_readiness.warnings.some((warning) => warning.code === "reference_not_verified"));
});

test("buildWebSkuReferenceContract creates stageable Drive cards without exposing raw key", () => {
  const item = findWebSkuPickerItemBySku(rows, "R23CBT0048");
  const contract = buildWebSkuReferenceContract({
    item,
    resolvedReferenceAssets: [{
      drive_file_id: "1abcDEFghiJKLMnopQRs",
      name: "R23CBT0048_Front.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 1600,
      classification: { use_as_reference: true, asset_type: "product_reference" }
    }],
    buildPreviewUrl: ({ driveFileId }) => `https://image-workflow.example.test/api/public/line-image/${driveFileId}?sig=masked`
  });

  assert.equal(contract.reference_readiness.status, "ready");
  assert.equal(contract.reference_readiness.stageable_reference_count, 1);
  assert.equal(contract.references.length, 1);
  assert.equal(contract.references[0].source, "google_drive");
  assert.equal(contract.references[0].preview_available, true);
  assert.equal(contract.references[0].stage_available, true);
  assert.notEqual(contract.references[0].reference_key, "1abcDEFghiJKLMnopQRs");
  assert.equal(contract.references[0].generation_url.includes("1abcDEFghiJKLMnopQRs"), true);
});

test("buildWebSkuReferenceContract blocks label/tag assets as visual truth", () => {
  const item = findWebSkuPickerItemBySku(rows, "R23CBT0048");
  const contract = buildWebSkuReferenceContract({
    item,
    resolvedReferenceAssets: [{
      drive_file_id: "1labelDEFghiJKLMnopQR",
      name: "R23CBT0048_SkuCard.jpg",
      mimeType: "image/jpeg",
      classification: { use_as_reference: false, asset_type: "label_or_tag" }
    }],
    buildPreviewUrl: ({ driveFileId }) => `https://image-workflow.example.test/api/public/line-image/${driveFileId}?sig=masked`
  });

  assert.equal(contract.references[0].stage_available, false);
  assert.deepEqual(contract.references[0].blockers.map((blocker) => blocker.code), ["not_product_visual_truth"]);
});

test("buildReferenceKey is deterministic and scoped by source", () => {
  assert.equal(buildReferenceKey("google_drive", "abc"), buildReferenceKey("google_drive", "abc"));
  assert.notEqual(buildReferenceKey("google_drive", "abc"), buildReferenceKey("catalog", "abc"));
});

function catalogRow(overrides = {}) {
  return {
    sku: "",
    product_type: "rental",
    product_name: "",
    category: "",
    subcategory: "",
    feature_notes: "",
    reference_url: "",
    reference_drive_id: "",
    reference_lookup_strategy: "product_catalog_sheet",
    reference_verified: "product_catalog_sheet_row_matched",
    generation_status: "ready_via_product_catalog_sheet",
    reference_branch: "",
    reference_brand_id: "",
    reference_target_site: "",
    reference_sheet_process: "FALSE",
    source_file: "catalog.csv",
    source_row: "",
    ...overrides
  };
}
