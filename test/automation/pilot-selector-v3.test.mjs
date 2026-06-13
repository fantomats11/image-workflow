import test from "node:test";
import assert from "node:assert/strict";
import { selectPilotItemsV3 } from "../../lib/automation/pilot-selector-v3.mjs";
import { catalogAuditRows, generationRows } from "./fixtures/catalog-rows.mjs";

test("selects exactly 2 SKU per brand when enough candidates exist", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows,
    generationRows,
    skuPerBrand: 2,
    now: new Date("2026-06-11T00:00:00Z")
  });
  assert.equal(batch.items.length, 4);
  assert.equal(batch.items.filter((item) => item.brand_id === "rent_a_coat").length, 2);
  assert.equal(batch.items.filter((item) => item.brand_id === "go_mall").length, 2);
});

test("attaches v3 prompt fields and dry-run actions", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows,
    generationRows,
    skuPerBrand: 2,
    now: new Date("2026-06-11T00:00:00Z")
  });
  const first = batch.items[0];
  assert.match(first.prompt_framework_version, /v3/);
  assert.equal(first.dry_run_action.includes("dry-run"), true);
  assert.ok(first.hero_prompt);
  assert.ok(first.support_prompt_preview);
});

test("marks existing WooCommerce SKU as skip completed candidate when selected explicitly", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows.filter((row) => row.sku === "GM-EXIST-001"),
    generationRows: [{ sku: "GM-EXIST-001", generation_status: "ready_via_drive_folder_lookup", reference_parent_folder_id: "x", reference_lookup_key: "GM-EXIST-001" }],
    skuPerBrand: 2,
    includeExistingSku: true,
    now: new Date("2026-06-11T00:00:00Z")
  });
  assert.equal(batch.items[0].woo_status, "found");
  assert.match(batch.items[0].dry_run_action, /mark completed/);
});

test("uses Product Catalog branch metadata to select GO Mall even when audit row is rental", () => {
  const batch = selectPilotItemsV3({
    auditRows: [{
      sku: "FSTR260013",
      product_type: "rental",
      target_site: "rentacoat",
      wp_product_name: "เสื้อกันหนาว",
      wp_category: "เสื้อ",
      wp_subcategory: "โค้ท",
      automation_action: "generate_then_publish_or_attach_after_review",
      woo_status: "not_found"
    }],
    generationRows: [{
      sku: "FSTR260013",
      generation_status: "ready_via_product_catalog_sheet",
      reference_lookup_strategy: "product_catalog_sheet",
      reference_url: "https://drive.google.com/drive/folders/folder-123",
      reference_branch: "GO Mall",
      reference_target_site: "gomall"
    }],
    skuPerBrand: 2,
    now: new Date("2026-06-11T00:00:00Z")
  });

  assert.equal(batch.selection.go_mall_candidates, 1);
  assert.equal(batch.items[0].brand_id, "go_mall");
  assert.equal(batch.items[0].target_site, "gomall");
});
