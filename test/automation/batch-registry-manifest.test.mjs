import test from "node:test";
import assert from "node:assert/strict";
import { buildAutomationBatchMetadata, buildAutomationBatchItemPayload } from "../../lib/automation/batch-registry.mjs";

test("batch metadata preserves v3 manifest fields", () => {
  const metadata = buildAutomationBatchMetadata({
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    selection: { sku_per_brand: 2 },
    created_at: "2026-06-11T00:00:00Z"
  });
  assert.equal(metadata.prompt_framework_version, "prompt-framework-v3.0-dry-run");
  assert.equal(metadata.selection.sku_per_brand, 2);
});

test("item payload stores brand and reference manifest metadata", () => {
  const payload = buildAutomationBatchItemPayload("batch-id", {
    sku: "RAC-COAT-001",
    brand_id: "rent_a_coat",
    brand_label: "Rent A Coat",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ท",
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    reference_manifest: { confidence: 0.95 },
    asset_classification_summary: { product_reference: 2 }
  });
  assert.equal(payload.batch_id, "batch-id");
  assert.equal(payload.metadata.brand_id, "rent_a_coat");
  assert.equal(payload.metadata.reference_manifest.confidence, 0.95);
});
