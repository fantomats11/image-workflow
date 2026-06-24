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

test("Web-first create page is the default and visible navigation path", () => {
  assert.match(indexHtml, /href="#create" data-page-link="create">สร้างภาพสินค้า/);
  assert.match(appJs, /#create/);
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
