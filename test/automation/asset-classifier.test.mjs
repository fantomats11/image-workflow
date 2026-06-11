import test from "node:test";
import assert from "node:assert/strict";
import { classifyReferenceAsset, classifyReferenceAssets } from "../../lib/automation/asset-classifier.mjs";
import { referenceAssets } from "./fixtures/reference-assets.mjs";

test("classifies product references from SKU filename and normal photo dimensions", () => {
  const result = classifyReferenceAsset(referenceAssets[0], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "product_reference");
  assert.equal(result.use_as_reference, true);
  assert.equal(result.sku_detected, "RAC-COAT-001");
});

test("classifies label/tag images from OCR evidence", () => {
  const result = classifyReferenceAsset(referenceAssets[1], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "label_or_tag");
  assert.equal(result.use_as_reference, false);
  assert.equal(result.sku_detected, "RAC-COAT-001");
});

test("classifies generated candidates from path/name hints", () => {
  const result = classifyReferenceAsset(referenceAssets[2], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "generated_candidate");
  assert.equal(result.use_as_reference, false);
});

test("classifies likely staff noise from blur/floor hints and small dimensions", () => {
  const result = classifyReferenceAsset(referenceAssets[3], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "staff_noise");
  assert.equal(result.use_as_reference, false);
});

test("summarizes asset counts for a folder", () => {
  const result = classifyReferenceAssets(referenceAssets, { sku: "RAC-COAT-001" });
  assert.equal(result.summary.product_reference, 1);
  assert.equal(result.summary.label_or_tag, 1);
  assert.equal(result.summary.generated_candidate, 1);
  assert.equal(result.summary.staff_noise, 1);
});
