import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildReferenceKey,
  buildWebSkuPickerSkuIndex,
  buildWebSkuReferenceContract,
  findWebSkuPickerItemBySku,
  loadWebSkuPickerSkuIndex,
  loadWebSkuPickerCatalogSnapshot,
  normalizeWebSkuPickerRows,
  readWebSkuPickerCatalogItemBySku,
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

test("searchWebSkuPickerCatalog waits for a specific enough query", () => {
  const result = searchWebSkuPickerCatalog({ rows, query: "R2" });

  assert.equal(result.ok, true);
  assert.equal(result.query, "R2");
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
  assert.equal(result.items[0].reference_readiness.status, "warning");
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
  const result = searchWebSkuPickerCatalog({ rows: source, query: "alp", limit: 2 });

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

test("normalizeWebSkuPickerRows extracts Drive folder ids from URL-shaped reference ids", () => {
  const normalized = normalizeWebSkuPickerRows([
    catalogRow({
      sku: "DRIVEURL001",
      product_name: "Drive URL Reference Boot",
      reference_url: "",
      reference_drive_id: "https://drive.google.com/drive/folders/1bujKCgf5YUNRHYEAWH-gxQwwTIuoY876"
    })
  ]);

  assert.equal(normalized[0].reference_drive_id, "1bujKCgf5YUNRHYEAWH-gxQwwTIuoY876");
  assert.equal(normalized[0].references[0].source, "google_drive");
});

test("buildWebSkuReferenceContract exposes staged Drive reference fields for Hero generation", () => {
  const contract = buildWebSkuReferenceContract({
    item: catalogRow({
      sku: "FSTR240017",
      product_name: "BLUE DOG The Spirit of Adventure",
      reference_url: "https://drive.google.com/drive/folders/folder-1",
      reference_drive_id: "folder-1",
      reference_verified: "product_catalog_sheet_row_matched"
    }),
    resolvedReferenceAssets: [{
      drive_file_id: "drive-front",
      name: "front.jpg",
      mimeType: "image/jpeg",
      storage_path: "catalog/FSTR240017/drive-front-front.jpg",
      preview_url: "https://storage.example.test/front-preview",
      generation_url: "https://storage.example.test/front-signed",
      staged_url: "https://storage.example.test/front-signed",
      stage_available: true,
      upload_reused: true,
      blocker_code: "",
      blocker_message: ""
    }]
  });

  assert.equal(contract.reference_readiness.status, "ready");
  assert.equal(contract.references[0].stage_available, true);
  assert.equal(contract.references[0].drive_file_id, "drive-front");
  assert.equal(contract.references[0].storage_path, "catalog/FSTR240017/drive-front-front.jpg");
  assert.equal(contract.references[0].staged_url, "https://storage.example.test/front-signed");
  assert.equal(contract.references[0].generation_url, "https://storage.example.test/front-signed");
  assert.equal(contract.references[0].blocker_code, "");
});

test("buildWebSkuReferenceContract exposes staging blocker details when Drive image cannot be staged", () => {
  const contract = buildWebSkuReferenceContract({
    item: catalogRow({
      sku: "FSTR240017",
      product_name: "BLUE DOG The Spirit of Adventure",
      reference_url: "https://drive.google.com/drive/folders/folder-1",
      reference_drive_id: "folder-1",
      reference_verified: "product_catalog_sheet_row_matched"
    }),
    resolvedReferenceAssets: [{
      drive_file_id: "drive-front",
      name: "front.jpg",
      mimeType: "image/jpeg",
      storage_path: "catalog/FSTR240017/drive-front-front.jpg",
      stage_available: false,
      blocker_code: "drive_alt_media_fetch_failed",
      blocker_message: "download รูปจาก Google Drive ด้วย alt=media ไม่สำเร็จ"
    }]
  });

  assert.equal(contract.reference_readiness.status, "warning");
  assert.equal(contract.references[0].stage_available, false);
  assert.equal(contract.references[0].blocker_code, "drive_alt_media_fetch_failed");
  assert.equal(contract.references[0].blocker_message, "download รูปจาก Google Drive ด้วย alt=media ไม่สำเร็จ");
  assert.equal(contract.references[0].blockers[0].code, "drive_alt_media_fetch_failed");
});

test("loadWebSkuPickerCatalogSnapshot prefers refreshed outputs snapshot before packaged fallback", async () => {
  const outputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-sku-picker-"));
  await fs.writeFile(
    path.join(outputsDir, "generation-input-catalog.csv"),
    [
      "sku,product_name,category,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "LIVE001,Live Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/live-folder-id,live-folder-id,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall"
    ].join("\n"),
    "utf8"
  );

  const snapshot = await loadWebSkuPickerCatalogSnapshot({ outputsDir });

  assert.equal(snapshot.source, "outputs_dir");
  assert.equal(snapshot.rows.length, 1);
  assert.equal(snapshot.rows[0].sku, "LIVE001");
});

test("loadWebSkuPickerCatalogSnapshot reuses unchanged parsed snapshots", async () => {
  const outputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-sku-picker-cache-"));
  await fs.writeFile(
    path.join(outputsDir, "generation-input-catalog.csv"),
    [
      "sku,product_name,category,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "CACHE001,Cached Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/cache-folder-id,cache-folder-id,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall"
    ].join("\n"),
    "utf8"
  );

  const first = await loadWebSkuPickerCatalogSnapshot({ outputsDir });
  const second = await loadWebSkuPickerCatalogSnapshot({ outputsDir });

  assert.equal(second, first);
  assert.equal(second.rows, first.rows);
});

test("buildWebSkuPickerSkuIndex creates exact normalized SKU map from catalog rows", () => {
  const index = buildWebSkuPickerSkuIndex(rows);

  assert.equal(index.itemsBySku.get("R23CBT0048").product_name, "Columbia Alpine Crux Titanium Down Hooded Jacket");
  assert.equal(index.itemsBySku.get("r23cbt0048"), undefined);
  assert.equal(index.itemsBySku.get("MISSREF001").reference_readiness.status, "blocked");
  assert.equal(index.normalized_rows.length, rows.length);
});

test("loadWebSkuPickerSkuIndex reuses cache when source mtime and size are unchanged", async () => {
  const outputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-sku-picker-index-cache-"));
  await fs.writeFile(
    path.join(outputsDir, "generation-input-catalog.csv"),
    [
      "sku,product_name,category,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "INDEX001,Indexed Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/index-folder-id,index-folder-id,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall"
    ].join("\n"),
    "utf8"
  );

  const first = await loadWebSkuPickerSkuIndex({ outputsDir });
  const second = await loadWebSkuPickerSkuIndex({ outputsDir });

  assert.equal(second, first);
  assert.equal(second.itemsBySku.get("INDEX001").product_name, "Indexed Catalog Coat");
});

test("loadWebSkuPickerSkuIndex rebuilds cache when source mtime or size changes", async () => {
  const outputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-sku-picker-index-rebuild-"));
  const catalogPath = path.join(outputsDir, "generation-input-catalog.csv");
  await fs.writeFile(
    catalogPath,
    [
      "sku,product_name,category,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "INDEX002,Old Indexed Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/index-folder-id,index-folder-id,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall"
    ].join("\n"),
    "utf8"
  );

  const first = await loadWebSkuPickerSkuIndex({ outputsDir });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await fs.writeFile(
    catalogPath,
    [
      "sku,product_name,category,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "INDEX002,New Indexed Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/index-folder-id,index-folder-id,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall",
      "INDEX003,Second Indexed Catalog Coat,เสื้อ,https://drive.google.com/drive/folders/index-folder-id-2,index-folder-id-2,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall"
    ].join("\n"),
    "utf8"
  );

  const second = await loadWebSkuPickerSkuIndex({ outputsDir });

  assert.notEqual(second, first);
  assert.equal(second.itemsBySku.get("INDEX002").product_name, "New Indexed Catalog Coat");
  assert.equal(second.itemsBySku.get("INDEX003").product_name, "Second Indexed Catalog Coat");
});

test("readWebSkuPickerCatalogItemBySku returns one exact normalized row without full index warmup", async () => {
  const outputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-sku-picker-exact-row-"));
  await fs.writeFile(
    path.join(outputsDir, "generation-input-catalog.csv"),
    [
      "sku,product_name,category,subcategory,reference_url,reference_drive_id,reference_lookup_strategy,reference_verified,generation_status,reference_branch",
      "MISS001,Wrong Catalog Coat,เสื้อ,เสื้อโค้ท,,,,manual_reference_needed,needs_reference_image,GO Mall",
      "FSTR240017,BLUE DOG The Spirit of Adventure,เสื้อ,เสื้อขนเป็ด,https://drive.google.com/drive/folders/ref-folder,ref-folder,product_catalog_sheet,product_catalog_sheet_row_matched,ready_via_product_catalog_sheet,GO Mall",
      "MISS002,Another Catalog Coat,เสื้อ,เสื้อโค้ท,,,,manual_reference_needed,needs_reference_image,Rent A Coat"
    ].join("\n"),
    "utf8"
  );

  const result = await readWebSkuPickerCatalogItemBySku({ sku: "fstr240017", outputsDir });

  assert.equal(result.item.sku, "FSTR240017");
  assert.equal(result.item.product_name, "BLUE DOG The Spirit of Adventure");
  assert.equal(result.item.branch, "GO Mall");
  assert.equal(result.item.reference_readiness.status, "warning");
  assert.equal(result.diagnostics.lookup_strategy, "exact_row_scan");
});

test("exact SKU lookup uses SKU index map instead of broad catalog search", () => {
  const index = buildWebSkuPickerSkuIndex(rows);
  const item = findWebSkuPickerItemBySku(index, "r23cbt0048");

  assert.equal(item.sku, "R23CBT0048");
  assert.equal(item.product_name, "Columbia Alpine Crux Titanium Down Hooded Jacket");
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
      staged_public_url: "https://project.supabase.co/storage/v1/object/sign/product-references/catalog/R23CBT0048/front.jpg?token=masked",
      storage_bucket: "product-references",
      storage_key: "catalog/R23CBT0048/front.jpg",
      staging_status: "staged_to_supabase",
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
  assert.equal(contract.references[0].storage_bucket, "product-references");
  assert.equal(contract.references[0].storage_key, "catalog/R23CBT0048/front.jpg");
  assert.notEqual(contract.references[0].reference_key, "1abcDEFghiJKLMnopQRs");
  assert.equal(contract.references[0].generation_url.includes("supabase.co/storage"), true);
  assert.equal(contract.references[0].preview_url.includes("/api/public/line-image/"), true);
});

test("buildWebSkuReferenceContract keeps Drive preview but blocks generation until Supabase staging exists", () => {
  const item = findWebSkuPickerItemBySku(rows, "R23CBT0048");
  const contract = buildWebSkuReferenceContract({
    item,
    resolvedReferenceAssets: [{
      drive_file_id: "1abcDEFghiJKLMnopQRs",
      name: "R23CBT0048_Front.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 1600,
      staging_status: "staging_failed",
      staging_error_code: "permission_or_policy",
      staging_error_message_th: "stage รูปจาก Drive เข้า Supabase Storage ไม่สำเร็จ",
      classification: { use_as_reference: true, asset_type: "product_reference" }
    }],
    buildPreviewUrl: ({ driveFileId }) => `https://image-workflow.example.test/api/public/line-image/${driveFileId}?sig=masked`
  });

  assert.equal(contract.reference_readiness.status, "warning");
  assert.equal(contract.references[0].preview_available, true);
  assert.equal(contract.references[0].stage_available, false);
  assert.equal(contract.references[0].generation_url, "");
  assert.deepEqual(contract.references[0].blockers.map((blocker) => blocker.code), ["permission_or_policy"]);
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
