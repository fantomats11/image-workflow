import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { catalogAuditRows, generationRows } from "./fixtures/catalog-rows.mjs";

test("createPilotBatch selects 2 SKU per brand with framework v3 fields", async () => {
  const { createPilotBatch } = await import("../../scripts/automation/create-pilot-batch.mjs");
  const batch = createPilotBatch({
    auditRows: catalogAuditRows,
    generationRows,
    env: { PILOT_SKU_PER_BRAND: "2" },
    now: new Date("2026-06-11T00:00:00Z")
  });

  assert.equal(batch.items.length, 4);
  assert.equal(batch.prompt_framework_version, "prompt-framework-v3.0-dry-run");
  assert.equal(batch.selection.sku_per_brand, 2);
  assert.equal(batch.items.filter((item) => item.brand_id === "rent_a_coat").length, 2);
  assert.equal(batch.items.filter((item) => item.brand_id === "go_mall").length, 2);

  for (const item of batch.items) {
    assert.equal(item.prompt_framework_version, "prompt-framework-v3.0-dry-run");
    assert.ok(item.brand_id);
    assert.ok(item.brand_label);
    assert.ok(item.hero_prompt);
    assert.ok(item.support_shots);
    assert.ok(item.support_prompt_preview);
  }
});

test("importing create-pilot-batch does not write dry-run output files", async () => {
  const outputsDir = path.resolve(process.cwd(), "../..", "outputs");
  const outputFiles = [
    path.join(outputsDir, "pilot-batch-dry-run.json"),
    path.join(outputsDir, "pilot-batch-dry-run.csv")
  ];
  const beforeStats = outputFiles.map((filePath) => statSnapshot(filePath));

  const stdout = execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "await import('./scripts/automation/create-pilot-batch.mjs')"
  ], { cwd: process.cwd(), encoding: "utf8" });

  assert.equal(stdout, "");
  assert.deepEqual(outputFiles.map((filePath) => statSnapshot(filePath)), beforeStats);
});

function statSnapshot(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return { size: stat.size, mtimeMs: stat.mtimeMs };
}
