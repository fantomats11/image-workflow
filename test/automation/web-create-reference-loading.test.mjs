import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJs = fs.readFileSync(path.resolve("app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve("server.mjs"), "utf8");
const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");

test("manual create reference panel distinguishes Drive loading from SKU search", () => {
  assert.match(appJs, /กำลังโหลดไฟล์ภาพจาก Google Drive/);
  assert.match(appJs, /กำลังโหลดรายการไฟล์ภาพจาก Google Drive/);
  assert.doesNotMatch(appJs, /กำลังโหลด reference จาก catalog\/Drive/);
});

test("manual create reference load keeps user-safe error message after loading ends", () => {
  assert.match(appJs, /let finalMessage = "";/);
  assert.match(appJs, /renderCatalogReferencePanel\(finalMessage\);/);
  assert.match(appJs, /if \(selectedCatalogSku\?\.sku !== requestedSku\) return;/);
});

test("web SKU Drive reference lookup is recursive, timeout-safe, and cached", () => {
  assert.match(serverJs, /GOOGLE_DRIVE_REFERENCE_FILES_CACHE_TTL_MS/);
  assert.match(serverJs, /listGoogleDriveReferenceFilesCached\(drive, folderId\)/);
  assert.match(serverJs, /listGoogleDriveReferenceImageFiles\(drive, folderId/);
  assert.match(serverJs, /requestTimeoutMs: googleDriveReferenceFilesTimeoutMs/);
});

test("manual create auto-uses catalog references for one-click Hero generation", () => {
  assert.match(appJs, /function autoStageCatalogReferencesForHero\(\)/);
  assert.match(appJs, /autoStageCatalogReferencesForHero\(\);/);
  assert.match(appJs, /catalogReferenceAutoUse", "true"/);
  assert.match(appJs, /canAutoUseCatalogReferencesForHero\(\)/);
  assert.doesNotMatch(appJs, /กดใช้ reference จาก catalog\/Drive กับ Hero/);
});

test("server resolves catalog references automatically when requested by create flow", () => {
  assert.match(serverJs, /const autoUseCatalogReferences = req\.body\?\.catalogReferenceAutoUse === "true";/);
  assert.match(serverJs, /stageableReferences\.map\(\(reference\) => reference\.reference_key\)\.slice\(0, 6\)/);
  assert.match(serverJs, /ยังโหลดรูป reference จาก Google Drive มาใช้กับ Hero ไม่ได้/);
});

test("server stages Drive references to Supabase Storage before Hero generation", () => {
  assert.match(serverJs, /stageWebSkuReferenceAssetsForGeneration/);
  assert.match(serverJs, /drive\.files\.get\(\s*\{\s*fileId: driveFileId,\s*alt: "media"/);
  assert.match(serverJs, /\.from\(bucket\)\s*\.upload\(storageKey, uploadStream/);
  assert.match(serverJs, /const bucket = "product-references";/);
  assert.match(serverJs, /staged_public_url: staged\.publicUrl/);
  assert.match(serverJs, /reference_storage_url_unavailable/);
});

test("Web-first create page is the default and visible navigation path", () => {
  assert.match(indexHtml, /href="#create" data-page-link="create">สร้างภาพสินค้า/);
  assert.match(appJs, /#create/);
  assert.match(appJs, /page === "next"/);
  assert.match(appJs, /return pageMeta\[page\] \? page : "create";/);
});

test("reference panel shows Drive source and only auto-uses stageable images", () => {
  assert.match(appJs, /function hasSelectedCatalogStageableReferences\(\)/);
  assert.match(appJs, /selectedCatalogReferences\.some\(\(reference\) => reference\.stage_available && reference\.reference_key\)/);
  assert.match(appJs, /เปิด Google Drive folder/);
  assert.match(appJs, /resolution_summary/);
  assert.match(appJs, /ยังไม่มีภาพ reference จาก Google Drive ที่ใช้กับ Hero ได้/);
});

test("SKU picker avoids broad two-character searches", () => {
  assert.match(appJs, /const skuPickerMinQueryLength = 3;/);
  assert.match(appJs, /query\.length < skuPickerMinQueryLength/);
  assert.match(appJs, /พิมพ์ SKU หรือชื่อสินค้าอย่างน้อย/);
  assert.match(serverJs, /WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
  assert.match(serverJs, /min_query_length: WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
});

test("SKU picker search fails fast and ignores stale responses", () => {
  assert.match(appJs, /const skuPickerSearchTimeoutMs = 8000;/);
  assert.match(appJs, /authFetchWithTimeout\(\s*`\/api\/catalog\/sku-search/);
  assert.match(appJs, /ค้นหา SKU ใช้เวลานานผิดปกติ/);
  assert.match(appJs, /requestId !== skuPickerSearchRequestSeq/);
});

test("exact SKU lookup bypasses broad search before loading Drive references", () => {
  assert.match(serverJs, /app\.get\("\/api\/catalog\/sku\/:sku", requireUser/);
  assert.match(serverJs, /readWebSkuPickerItemFast\(req\.params\.sku/);
  assert.match(serverJs, /catalog_warming/);
  assert.match(serverJs, /lookup_ms/);
  assert.match(serverJs, /load_ms/);
  assert.match(appJs, /function looksLikeExactCatalogSku/);
  assert.match(appJs, /lookupExactCatalogSku\(query, requestId\)/);
  assert.match(appJs, /`\/api\/catalog\/sku\/\$\{encodeURIComponent\(sku\)\}`/);
  assert.match(appJs, /selectCatalogSku\(data\.item\)/);
});

test("manual create shows warm catalog status separately from timeout and errors", () => {
  assert.match(appJs, /กำลังเตรียมข้อมูล catalog ครั้งแรก/);
  assert.match(appJs, /renderSkuPickerStatus\("กำลังเตรียมข้อมูล catalog ครั้งแรก\.\.\."\);/);
  assert.match(appJs, /data\.code === "catalog_warming"/);
  assert.match(appJs, /lookupExactCatalogSku\(sku, requestId, \{ retryAfterMs/);
  assert.match(appJs, /"กำลังเตรียมข้อมูล catalog ครั้งแรก หากเป็นรอบแรกอาจใช้เวลานานกว่าปกติ"/);
});

test("exact SKU lookup retries after warm catalog timeout instead of staying stuck", () => {
  assert.match(appJs, /const exactSkuLookupMaxWarmRetries = 4;/);
  assert.match(appJs, /function isExactSkuWarmTimeout\(error\)/);
  assert.match(appJs, /isExactSkuWarmTimeout\(error\)/);
  assert.match(appJs, /attempt < exactSkuLookupMaxWarmRetries/);
  assert.match(appJs, /lookupExactCatalogSku\(sku, requestId, \{ retryAfterMs: nextRetryAfterMs, attempt: attempt \+ 1 \}\)/);
});

test("server tries exact row scan before returning catalog warming", () => {
  assert.match(serverJs, /readWebSkuPickerCatalogItemBySku\(\{ sku \}\)/);
  assert.match(serverJs, /lookup_strategy: "exact_row_scan"/);
  assert.match(serverJs, /catalog_warming/);
});

test("SKU picker results listbox stays hidden when empty to avoid layout jumps", () => {
  assert.match(indexHtml, /<div class="sku-picker-results" id="skuPickerResults" role="listbox" aria-label="ผลค้นหา SKU" hidden><\/div>/);
  assert.match(appJs, /els\.skuPickerResults\.hidden = !items\.length;/);
  assert.match(appJs, /els\.skuPickerResults\.setAttribute\("aria-hidden", String\(!items\.length\)\);/);
  assert.match(indexHtml, /<div class="sku-picker-combobox">/);
  assert.match(indexHtml, /<\/div>\s*<div class="sku-picker-status"/);
});

test("manual create shows product summary before async Drive reference load finishes", () => {
  assert.match(appJs, /ข้อมูลสินค้า:/);
  assert.match(appJs, /มี Google Drive reference/);
  assert.match(appJs, /กำลังโหลด Drive reference แยกจากการเลือก SKU/);
  assert.match(appJs, /renderSkuPickerStatus\(\);\n  renderSelectedProductSummary\(\);[\s\S]*loadCatalogReferencesForSelectedSku\(\);/);
});

test("create flow renders a compact product summary as the primary catalog path", () => {
  assert.match(indexHtml, /id="selectedProductSummary"/);
  assert.match(appJs, /function renderSelectedProductSummary\(\)/);
  assert.match(appJs, /selected-product-summary/);
  assert.match(appJs, /SKU/);
  assert.match(appJs, /product_name/);
  assert.match(appJs, /branch \/ brand profile/);
  assert.match(appJs, /category \/ subcategory/);
  assert.match(appJs, /renderSelectedProductSummary\(\);[\s\S]*loadCatalogReferencesForSelectedSku\(\);/);
});

test("manual upload controls are a native fallback disclosure, not the primary path", () => {
  assert.match(indexHtml, /<details class="manual-reference-fallback"/);
  assert.match(indexHtml, /<summary>อัปโหลด reference เองเมื่อ catalog ใช้ไม่ได้<\/summary>/);
  assert.match(indexHtml, /id="fallbackReferenceSection"/);
  assert.match(appJs, /function updateCatalogDrivenFieldHierarchy\(\)/);
  assert.match(appJs, /catalog-driven-selected/);
});

test("reference readiness card separates loading ready blocked warning and fallback states", () => {
  assert.match(indexHtml, /id="referenceReadinessCard"/);
  assert.match(appJs, /function getReferenceReadinessViewModel\(/);
  assert.match(appJs, /reference-state-loading/);
  assert.match(appJs, /reference-state-ready/);
  assert.match(appJs, /reference-state-blocked/);
  assert.match(appJs, /reference-state-warning/);
  assert.match(appJs, /manual_fallback_needed/);
  assert.match(appJs, /found files/);
  assert.match(appJs, /stageable images/);
  assert.match(appJs, /blocked files/);
});

test("create Hero button exposes a specific disabled reason", () => {
  assert.match(indexHtml, /id="generateButtonReason"/);
  assert.match(appJs, /function getGenerateHeroReadiness\(\)/);
  assert.match(appJs, /กำลังโหลด reference/);
  assert.match(appJs, /ยังไม่มี staged reference/);
  assert.match(appJs, /ต้องอัปโหลด fallback/);
  assert.match(appJs, /ยังไม่ได้ login/);
  assert.match(appJs, /els\.generateButtonReason\.textContent = readiness\.reason/);
});
