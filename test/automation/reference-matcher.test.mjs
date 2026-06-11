import test from "node:test";
import assert from "node:assert/strict";
import { classifyReferenceAssets } from "../../lib/automation/asset-classifier.mjs";
import { matchReferenceFolderToSku } from "../../lib/automation/reference-matcher.mjs";
import { referenceAssets } from "./fixtures/reference-assets.mjs";

test("exact SKU in path creates high-confidence auto match", () => {
  const classified = classifyReferenceAssets(referenceAssets, { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-1",
    folderPath: "Rent-A-Coat/RAC-COAT-001",
    classifiedAssets: classified.assets
  });
  assert.equal(match.match_method, "exact_sku_path_or_filename");
  assert.equal(match.confidence >= 0.9, true);
  assert.equal(match.needs_review, false);
  assert.equal(match.asset_manifest.length, 4);
});

test("label OCR evidence can support a proposed match", () => {
  const classified = classifyReferenceAssets([referenceAssets[1]], { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-2",
    folderPath: "unmapped-folder",
    classifiedAssets: classified.assets
  });
  assert.equal(match.match_method, "ocr_sku_label");
  assert.equal(match.confidence >= 0.8, true);
  assert.equal(match.needs_review, true);
});

test("weak evidence requires review", () => {
  const classified = classifyReferenceAssets([{ id: "x", name: "image.jpg", path: "unknown/image.jpg", mimeType: "image/jpeg" }], { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-3",
    folderPath: "unknown",
    classifiedAssets: classified.assets
  });
  assert.equal(match.needs_review, true);
  assert.equal(match.confidence < 0.7, true);
});
