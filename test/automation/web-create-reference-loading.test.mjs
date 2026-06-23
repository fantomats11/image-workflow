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
