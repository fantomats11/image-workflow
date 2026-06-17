import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildLineKeywordBatchFromCatalog,
  buildLineKeywordBatchIntakeResult,
  loadLineKeywordBatchCatalogSnapshot,
  parseLineKeywordBatchCommand
} from "../../lib/automation/line-keyword-batch-intake.mjs";

const NOW = new Date("2026-06-16T03:30:00.000Z");

test("parses English keyword batch command into locked category counts", () => {
  const command = parseLineKeywordBatchCommand("BATCH shoes=5 apparel=5");

  assert.equal(command.recognized, true);
  assert.equal(command.command, "batch");
  assert.equal(command.total_requested, 10);
  assert.deepEqual(command.requested_counts.map((request) => [request.key, request.count]), [
    ["shoes", 5],
    ["apparel", 5]
  ]);
  assert.deepEqual(command.blockers, []);
});

test("parses Thai keyword batch command into locked category counts", () => {
  const command = parseLineKeywordBatchCommand("batch รองเท้า=2 เสื้อ=3");

  assert.equal(command.recognized, true);
  assert.equal(command.total_requested, 5);
  assert.deepEqual(command.requested_counts.map((request) => [request.key, request.label, request.product_type, request.count]), [
    ["shoes", "รองเท้า", "รองเท้า", 2],
    ["apparel", "เสื้อ", "เสื้อ", 3]
  ]);
});

test("blocks malformed batch commands before touching automation state", () => {
  assert.equal(parseLineKeywordBatchCommand("hello").recognized, false);

  const empty = parseLineKeywordBatchCommand("BATCH");
  assert.equal(empty.recognized, true);
  assert.deepEqual(empty.blockers.map((blocker) => blocker.code), ["missing_category_counts"]);

  const invalid = parseLineKeywordBatchCommand("BATCH shoes=0 apparel=99");
  assert.equal(invalid.recognized, true);
  assert.deepEqual(invalid.blockers.map((blocker) => blocker.code), ["invalid_count", "count_too_large"]);
});

test("builds a LINE keyword batch from catalog rows with category selection", () => {
  const command = parseLineKeywordBatchCommand("BATCH รองเท้า=2 เสื้อ=1");
  const result = buildLineKeywordBatchFromCatalog({
    command,
    generationRows: [
      catalogRow({ sku: "SHOE-001", type: "รองเท้า", process: "FALSE", referenceUrl: "https://drive.example/shoe-1" }),
      catalogRow({ sku: "COAT-001", type: "เสื้อ", process: "FALSE", referenceUrl: "https://drive.example/coat-1" }),
      catalogRow({ sku: "SHOE-002", type: "รองเท้า", process: "FALSE", referenceUrl: "https://drive.example/shoe-2" }),
      catalogRow({ sku: "SHOE-DONE", type: "รองเท้า", process: "TRUE", referenceUrl: "https://drive.example/shoe-done" })
    ],
    now: NOW
  });

  assert.equal(result.ok, true);
  assert.equal(result.batch.batch_id, "line-keyword-20260616T033000Z");
  assert.equal(result.batch.items.length, 3);
  assert.deepEqual(result.batch.items.map((item) => item.sku), ["SHOE-001", "SHOE-002", "COAT-001"]);
  assert.equal(result.batch.selection.source, "line_keyword_batch_intake");
  assert.equal(result.batch.selection.requested_size, 3);
  assert.equal(result.batch.items[0].metadata.keyword_category, "shoes");
  assert.match(result.batch.items[0].dry_run_action, /wait for LINE batch approval/i);
});

test("reports shortfalls when the catalog snapshot cannot satisfy a keyword batch", () => {
  const command = parseLineKeywordBatchCommand("BATCH shoes=2 apparel=1");
  const result = buildLineKeywordBatchFromCatalog({
    command,
    generationRows: [
      catalogRow({ sku: "SHOE-001", type: "รองเท้า", process: "FALSE", referenceUrl: "https://drive.example/shoe-1" })
    ],
    now: NOW
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.blockers.map((blocker) => blocker.code), ["category_shortfall", "category_shortfall"]);
  assert.equal(result.batch.items.length, 1);
});

test("intake result turns a recognized LINE message into a registerable batch", () => {
  const result = buildLineKeywordBatchIntakeResult({
    text: "BATCH shoes=1 apparel=1",
    generationRows: [
      catalogRow({ sku: "SHOE-001", type: "boots", process: "FALSE", referenceUrl: "https://drive.example/shoe-1" }),
      catalogRow({ sku: "COAT-001", type: "jacket", process: "FALSE", referenceUrl: "https://drive.example/coat-1" })
    ],
    now: NOW,
    lineUserId: "U-line-user"
  });

  assert.equal(result.recognized, true);
  assert.equal(result.ok, true);
  assert.equal(result.batch.items.length, 2);
  assert.equal(result.batch.selection.line_user_id, "U-line-user");
  assert.match(result.replyText, /สร้าง batch จาก LINE keyword แล้ว/);
});

test("catalog snapshot loader falls back to packaged keyword catalog when outputs are absent", async () => {
  const emptyOutputsDir = await fs.mkdtemp(path.join(os.tmpdir(), "line-keyword-empty-"));
  const snapshot = await loadLineKeywordBatchCatalogSnapshot({ outputsDir: emptyOutputsDir });
  const result = buildLineKeywordBatchIntakeResult({
    text: "BATCH รองเท้า=1 เสื้อ=1",
    generationRows: snapshot.generationRows,
    auditRows: snapshot.auditRows,
    now: NOW,
    lineUserId: "U-line-user",
    snapshotSource: snapshot.source
  });

  assert.equal(snapshot.source, "packaged_fallback");
  assert.equal(result.ok, true);
  assert.equal(result.batch.items.length, 2);
  assert.equal(result.batch.selection.snapshot_source, "packaged_fallback");
});

function catalogRow({
  sku,
  type,
  process = "FALSE",
  referenceUrl = "",
  branch = "go_mall",
  name = ""
}) {
  return {
    SKU: sku,
    product_type: type,
    product_name: name || `${sku} product`,
    reference_branch: branch,
    reference_brand_id: branch,
    reference_target_site: branch,
    reference_url: referenceUrl,
    Process: process
  };
}
