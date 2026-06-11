import test from "node:test";
import assert from "node:assert/strict";
import { buildPilotBatchFlex, buildReferenceMatchFlex } from "../../lib/automation/line-client.mjs";

test("pilot batch flex includes brand scope and dry-run state", () => {
  const flex = buildPilotBatchFlex({
    batch_id: "dry-test",
    dry_run: true,
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    items: [
      { sku: "RAC-COAT-001", brand_label: "Rent A Coat", asset_classification_summary: { product_reference: 2, label_or_tag: 1 } },
      { sku: "GM-HAT-001", brand_label: "GO Mall", asset_classification_summary: { product_reference: 1, label_or_tag: 0 } }
    ]
  });
  const text = JSON.stringify(flex);
  assert.match(text, /Rent A Coat/);
  assert.match(text, /GO Mall/);
  assert.match(text, /dry-test/);
  assert.match(text, /Approve batch/);
  assert.doesNotMatch(text, /undefined/);
});

test("reference match flex exposes confidence and review action", () => {
  const flex = buildReferenceMatchFlex({
    batch_id: "dry-test",
    sku: "RAC-COAT-001",
    brand_label: "Rent A Coat",
    product_name: "เสื้อโค้ท",
    reference_manifest: {
      confidence: 0.82,
      match_method: "ocr_sku_label",
      needs_review: true
    },
    asset_classification_summary: {
      product_reference: 1,
      label_or_tag: 1,
      generated_candidate: 1,
      staff_noise: 0,
      ambiguous: 0
    }
  });
  const text = JSON.stringify(flex);
  assert.match(text, /0.82/);
  assert.match(text, /Needs review/);
  assert.match(text, /ocr_sku_label/);
  assert.match(text, /approve_sku/);
  assert.doesNotMatch(text, /approve_reference/);
  assert.doesNotMatch(text, /undefined/);
});

test("reference match flex encodes postback data for URLSearchParams", () => {
  const sku = "RAC&COAT=001 ไทย";
  const batchId = "dry=test & batch";
  const flex = buildReferenceMatchFlex({
    batch_id: batchId,
    sku,
    brand_label: "Rent A Coat",
    product_name: "เสื้อโค้ท",
    reference_manifest: {
      confidence: 0.82,
      match_method: "ocr_sku_label",
      needs_review: true
    }
  });
  const buttons = flex.contents.footer.contents;
  assert.equal(buttons.length, 3);

  const actions = buttons.map((button) => {
    assert.ok(button.action.data.length <= 300);
    const params = new URLSearchParams(button.action.data);
    assert.equal(params.get("batch_id"), batchId);
    assert.equal(params.get("sku"), sku);
    return params.get("action");
  });
  assert.deepEqual(actions, ["approve_sku", "needs_review", "reject_sku"]);
});
