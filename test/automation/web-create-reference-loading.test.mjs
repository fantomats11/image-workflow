import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJs = fs.readFileSync(path.resolve("app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve("server.mjs"), "utf8");
const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");
const driveStagingBridgeJs = fs.readFileSync(path.resolve("lib/automation/drive-reference-staging-bridge.mjs"), "utf8");

test("manual create reference panel distinguishes Drive loading from SKU search", () => {
  assert.match(appJs, /กำลังโหลดรูปจาก Google Drive/);
  assert.match(appJs, /กำลังโหลดรูปอ้างอิงจาก Google Drive/);
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
  assert.match(serverJs, /stageCatalogDriveReferencesToSupabase/);
  assert.match(driveStagingBridgeJs, /fileId: driveFileId,\s*alt: "media"/);
  assert.match(driveStagingBridgeJs, /downloadPublicDriveImageBinary/);
  assert.match(driveStagingBridgeJs, /\.upload\(storagePath, download\.body/);
  assert.match(driveStagingBridgeJs, /DRIVE_REFERENCE_STAGING_BUCKET = "product-references"/);
  assert.match(driveStagingBridgeJs, /staged_public_url: url/);
  assert.match(driveStagingBridgeJs, /storageUrlCreateFailed: "storage_url_create_failed"/);
  assert.doesNotMatch(driveStagingBridgeJs, /upsert: true/);
});

test("server exposes a SKU reference staging endpoint with canonical catalog cache fields", () => {
  assert.match(serverJs, /stageCatalogDriveReferencesToSupabase/);
  assert.match(serverJs, /app\.post\("\/api\/catalog\/sku\/:sku\/references\/stage", requireUser/);
  assert.match(serverJs, /readWebSkuPickerItemFast\(req\.params\.sku/);
  assert.match(serverJs, /catalog\/<sku>\/<drive_file_id>-<safe_filename>/);
  assert.match(serverJs, /drive_file_id/);
  assert.match(serverJs, /storage_path/);
  assert.match(serverJs, /generation_url/);
  assert.match(serverJs, /blocker_code/);
  assert.match(serverJs, /drive_reference_stage/);
});

test("create flow lists Drive reference cards before Supabase staging", () => {
  assert.match(serverJs, /app\.get\("\/api\/catalog\/sku\/:sku\/references", requireUser, async \(req, res\) => \{\s*return handleCatalogSkuReferenceStageRequest\(req, res, \{ stageReferences: false \}\);/);
  assert.match(serverJs, /app\.post\("\/api\/catalog\/sku\/:sku\/references\/stage", requireUser, async \(req, res\) => \{\s*return handleCatalogSkuReferenceStageRequest\(req, res, \{ stageReferences: true \}\);/);
  assert.match(serverJs, /reference_load_mode: stageReferences \? "staged" : "listed"/);
  assert.match(serverJs, /if \(stageReferences\) \{[\s\S]*stageCatalogDriveReferencesToSupabase/);
  assert.match(serverJs, /staging_status: stageReferences \? "staged" : "not_requested"/);
  assert.match(appJs, /authFetch\(`\/api\/catalog\/sku\/\$\{encodeURIComponent\(requestedSku\)\}\/references`\)/);
  assert.match(appJs, /พบรูปจาก Drive แล้ว กำลังเตรียมให้พร้อมสร้างภาพหลัก/);
  assert.match(appJs, /authFetch\(`\/api\/catalog\/sku\/\$\{encodeURIComponent\(requestedSku\)\}\/references\/stage`, \{\s*method: "POST"/);
});

test("create flow uses same-origin Drive image proxy for instant reference previews", () => {
  assert.match(serverJs, /function buildSignedDriveReferencePreviewUrl/);
  assert.match(serverJs, /return `\/api\/public\/line-image\/\$\{encodeURIComponent\(fileId\)\}\?\$\{params\.toString\(\)\}`;/);
  assert.match(serverJs, /buildSignedDriveReferencePreviewUrl\(\{ driveFileId, fileName \}\)\s*\|\|\s*buildSignedLineImageProxyUrl/);
  assert.match(serverJs, /verifyLineImageProxySignature/);
});

test("server resolves runtime exact SKU folder before staging Drive references", () => {
  assert.match(serverJs, /findGoogleDriveChildFolderByExactName/);
  assert.match(serverJs, /reference_parent_folder_id/);
  assert.match(serverJs, /reference_lookup_key/);
  assert.match(serverJs, /drive_folder_exact_sku_lookup/);
  assert.match(serverJs, /drive_folder_exact_sku_not_found/);
});

test("server falls through parent Drive folders into exact child SKU folder like the fast demo", () => {
  assert.match(serverJs, /GOOGLE_DRIVE_FOLDER_MIME_TYPE/);
  assert.match(serverJs, /resolveDriveReferenceChildFolderFromListedFiles/);
  assert.match(serverJs, /drive_child_folder_exact_sku_fallback/);
  assert.match(serverJs, /folderId: sourceFolderId \|\| fallbackFolderId/);
  assert.match(serverJs, /files = await listGoogleDriveReferenceFilesCached\(drive, childFolder\.id\)/);
  assert.match(serverJs, /reference_source_folder_id: resolvedFolder\.sourceFolderId/);
});

test("server validates Google OAuth token instead of treating stale tokens as Drive ready", () => {
  assert.match(serverJs, /isGoogleDriveAuthError/);
  assert.match(serverJs, /async function validateGoogleOAuthToken/);
  assert.match(serverJs, /google_drive_oauth_token_invalid/);
  assert.match(serverJs, /tokenErrorCode/);
  assert.match(serverJs, /connected: mode === "oauth" && isGoogleOAuthConfigured\(\) && tokenValidation\.valid/);
  assert.match(appJs, /Google Drive ต้อง reconnect/);
  assert.match(appJs, /data\.tokenError \|\| "Google Drive ยังไม่ได้เชื่อมต่อ/);
});

test("server can use demo-style service account settings from Supabase", () => {
  assert.match(serverJs, /readGlobalSetting\("gdriveServiceAccount"\)/);
  assert.match(serverJs, /readGlobalSetting\("gdriveRootFolderId"\)/);
  assert.match(serverJs, /resolveGoogleDriveAuthMode\(settings\)/);
  assert.match(serverJs, /parseGoogleDriveServiceAccountJson/);
  assert.match(serverJs, /service_account_email/);
  assert.match(serverJs, /provider: "service_account"/);
});

test("Next Actions is the production home and create remains a visible work path", () => {
  assert.match(indexHtml, /href="#next" data-page-link="next">งานของฉัน/);
  assert.match(indexHtml, /href="#create" data-page-link="create">เริ่มงานภาพ/);
  assert.match(appJs, /#create/);
  assert.match(appJs, /#next/);
  assert.match(appJs, /page === "next"/);
  assert.match(appJs, /return pageMeta\[page\] \? page : "create";/);
});

test("reference panel shows Drive source and only auto-uses stageable images", () => {
  assert.match(appJs, /function hasSelectedCatalogStageableReferences\(\)/);
  assert.match(appJs, /selectedCatalogReferences\.some\(\(reference\) => reference\.stage_available && \(reference\.generation_url \|\| reference\.staged_url\) && reference\.reference_key\)/);
  assert.match(appJs, /เปิดโฟลเดอร์ใน Google Drive/);
  assert.match(appJs, /resolution_summary/);
  assert.match(appJs, /ยังไม่มีรูปจาก Google Drive ที่ใช้สร้างภาพหลักได้/);
});

test("SKU picker avoids broad two-character searches", () => {
  assert.match(appJs, /const skuPickerMinQueryLength = 3;/);
  assert.match(appJs, /query\.length < skuPickerMinQueryLength/);
  assert.match(appJs, /พิมพ์รหัสสินค้าหรือชื่อสินค้าอย่างน้อย/);
  assert.match(serverJs, /WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
  assert.match(serverJs, /min_query_length: WEB_SKU_PICKER_MIN_QUERY_LENGTH/);
});

test("SKU picker search fails fast and ignores stale responses", () => {
  assert.match(appJs, /const skuPickerSearchTimeoutMs = 8000;/);
  assert.match(appJs, /authFetchWithTimeout\(\s*`\/api\/catalog\/sku-search/);
  assert.match(appJs, /ค้นหาสินค้าใช้เวลานานผิดปกติ/);
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
  assert.match(indexHtml, /<div class="sku-picker-results" id="skuPickerResults" role="listbox" aria-label="ผลค้นหาสินค้า" hidden><\/div>/);
  assert.match(appJs, /els\.skuPickerResults\.hidden = !items\.length;/);
  assert.match(appJs, /els\.skuPickerResults\.setAttribute\("aria-hidden", String\(!items\.length\)\);/);
  assert.match(indexHtml, /<div class="sku-picker-combobox">/);
  assert.match(indexHtml, /<div class="sku-picker-panel command-sku-panel">[\s\S]*<div class="sku-picker-combobox">/);
  assert.match(indexHtml, /<div class="sku-picker-panel command-sku-panel">[\s\S]*<div class="sku-picker-status" id="skuPickerStatus"/);
  assert.match(indexHtml, /<div class="command-readiness-stack"[\s\S]*id="referenceReadinessCard"/);
});

test("manual create shows product summary before async Drive reference load finishes", () => {
  assert.match(appJs, /ข้อมูลสินค้า:/);
  assert.match(appJs, /มีรูปใน Google Drive/);
  assert.match(appJs, /กำลังโหลดรูปจาก Google Drive/);
  assert.match(appJs, /renderSkuPickerStatus\(\);\n  renderSelectedProductSummary\(\);[\s\S]*loadCatalogReferencesForSelectedSku\(\);/);
});

test("manual create stages Drive references asynchronously and opens Hero only after staged URL exists", () => {
  assert.match(appJs, /กำลังเตรียมรูปจาก Drive/);
  assert.match(appJs, /authFetch\(`\/api\/catalog\/sku\/\$\{encodeURIComponent\(requestedSku\)\}\/references\/stage`, \{\s*method: "POST"/);
  assert.match(appJs, /reference\.stage_available && \(reference\.generation_url \|\| reference\.staged_url\)/);
  assert.match(appJs, /reference\.blocker_message \|\| reference\.blocker_code/);
  assert.match(appJs, /เตรียมรูปสำเร็จ/);
});

test("create flow renders a compact product summary as the primary catalog path", () => {
  assert.match(indexHtml, /id="selectedProductSummary"/);
  assert.match(appJs, /function renderSelectedProductSummary\(\)/);
  assert.match(appJs, /selected-product-summary/);
  assert.match(appJs, /รหัสสินค้า/);
  assert.match(appJs, /ชื่อสินค้า/);
  assert.match(appJs, /สาขา \/ โปรไฟล์ภาพ/);
  assert.match(appJs, /หมวดสินค้า/);
  assert.match(appJs, /renderSelectedProductSummary\(\);[\s\S]*loadCatalogReferencesForSelectedSku\(\);/);
});

test("manual upload controls are a native fallback disclosure, not the primary path", () => {
  assert.match(indexHtml, /<details class="manual-reference-fallback"/);
  assert.match(indexHtml, /<summary>อัปโหลดรูปเองเมื่อใช้รูปจากแคตตาล็อกไม่ได้<\/summary>/);
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
  assert.match(appJs, /ไฟล์ที่พบ/);
  assert.match(appJs, /รูปพร้อมใช้/);
  assert.match(appJs, /ต้องตรวจ/);
});

test("create diagnostics live in an inspector disclosure instead of the command readiness card", () => {
  assert.match(indexHtml, /<details class="control-section diagnostics-section catalog-secondary-section" id="diagnosticsSection">/);
  assert.match(indexHtml, /<strong>ตรวจปัญหา<\/strong>/);
  assert.match(indexHtml, /id="createDiagnosticsPanel" aria-live="off"/);
  assert.match(appJs, /function buildCreateDiagnosticsModel\(/);
  assert.match(appJs, /function renderCreateDiagnosticsPanel\(/);
  assert.match(appJs, /claim_status_endpoint/);
  assert.match(appJs, /http_status/);
  assert.match(appJs, /referenceIssues/);
  assert.doesNotMatch(appJs, /<details class="reference-diagnostics">/);
});

test("create Hero button exposes a specific disabled reason", () => {
  assert.match(indexHtml, /id="generateButtonReason"/);
  assert.match(appJs, /function getGenerateHeroReadiness\(\)/);
  assert.match(appJs, /กำลังโหลดรูปอ้างอิง/);
  assert.match(appJs, /ยังไม่มีรูปจากแคตตาล็อก\/Drive ที่พร้อมใช้/);
  assert.match(appJs, /ต้องอัปโหลดรูปเอง/);
  assert.match(appJs, /กรุณาเข้าสู่ระบบก่อนเริ่มสร้างภาพ/);
  assert.match(appJs, /els\.generateButtonReason\.textContent = readiness\.reason/);
});
