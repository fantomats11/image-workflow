import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJs = fs.readFileSync(path.resolve("app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve("server.mjs"), "utf8");

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

test("web SKU Drive reference lookup is image-only and cached", () => {
  assert.match(serverJs, /GOOGLE_DRIVE_REFERENCE_FILES_CACHE_TTL_MS/);
  assert.match(serverJs, /listGoogleDriveReferenceFilesCached\(drive, folderId\)/);
  assert.match(serverJs, /mimeType contains 'image\/'/);
  assert.match(serverJs, /pageSize: 200/);
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

test("SKU picker avoids broad two-character searches", () => {
  assert.match(appJs, /const skuPickerMinQueryLength = 3;/);
  assert.match(appJs, /query\.length < skuPickerMinQueryLength/);
  assert.match(appJs, /พิมพ์ SKU หรือชื่อสินค้าอย่างน้อย/);
  assert.match(serverJs, /WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
  assert.match(serverJs, /min_query_length: WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
});
