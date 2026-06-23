import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

export const LINE_KEYWORD_BATCH_INTAKE_VERSION = "line-keyword-batch-intake-v1.0";
export const LINE_KEYWORD_BATCH_MAX_CATEGORY_COUNT = 20;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGED_GENERATION_CATALOG_PATH = path.resolve(__dirname, "../../data/automation/line-keyword-generation-catalog.csv");

const CATEGORY_DEFINITIONS = [
  {
    key: "shoes",
    label: "รองเท้า",
    product_type: "รองเท้า",
    aliases: ["shoes", "shoe", "boots", "boot", "footwear", "รองเท้า", "บูท"],
    matchers: ["รองเท้า", "บูท", "shoe", "boot", "footwear", "เท้า"]
  },
  {
    key: "apparel",
    label: "เสื้อ",
    product_type: "เสื้อ",
    aliases: ["apparel", "clothes", "clothing", "coat", "coats", "jacket", "jackets", "outerwear", "top", "tops", "เสื้อ", "เสื้อกันหนาว", "แจ็คเก็ต", "โค้ท"],
    matchers: ["เสื้อ", "แจ็คเก็ต", "โค้ท", "coat", "jacket", "outerwear", "apparel", "clothing", "ลำตัวบน", "top"]
  }
];

export function parseLineKeywordBatchCommand(text = "") {
  const rawText = String(text || "").trim();
  const normalized = rawText.toLowerCase();
  const recognized = /^(batch|แบทช์|สร้างภาพ|สร้าง batch)\b/i.test(rawText);
  if (!recognized) {
    return {
      recognized: false,
      command: "",
      version: LINE_KEYWORD_BATCH_INTAKE_VERSION,
      raw_text: rawText,
      requested_counts: [],
      total_requested: 0,
      blockers: []
    };
  }

  const requestedCountsByKey = new Map();
  const blockers = [];
  const tokenPattern = /([A-Za-zก-๙_-]+)\s*(?:=|:)\s*(-?\d+)/g;
  for (const match of normalized.matchAll(tokenPattern)) {
    const rawCategory = cleanText(match[1]);
    const count = Number(match[2]);
    const category = resolveCategoryDefinition(rawCategory);
    if (!category) {
      blockers.push({
        code: "unknown_category",
        message: `ไม่รู้จักหมวด ${rawCategory}`,
        category: rawCategory
      });
      continue;
    }
    if (!Number.isInteger(count) || count <= 0) {
      blockers.push({
        code: "invalid_count",
        message: `${category.label} ต้องมีจำนวนตั้งแต่ 1 ขึ้นไป`,
        category: category.key,
        count
      });
      continue;
    }
    if (count > LINE_KEYWORD_BATCH_MAX_CATEGORY_COUNT) {
      blockers.push({
        code: "count_too_large",
        message: `${category.label} จำกัดไม่เกิน ${LINE_KEYWORD_BATCH_MAX_CATEGORY_COUNT} รายการต่อคำสั่ง`,
        category: category.key,
        count
      });
      continue;
    }
    const existing = requestedCountsByKey.get(category.key);
    requestedCountsByKey.set(category.key, {
      key: category.key,
      label: category.label,
      product_type: category.product_type,
      count: (existing?.count || 0) + count
    });
  }

  const requestedCounts = Array.from(requestedCountsByKey.values());
  if (!requestedCounts.length && !blockers.length) {
    blockers.push({
      code: "missing_category_counts",
      message: "ใช้รูปแบบ BATCH รองเท้า=5 เสื้อ=5 หรือ BATCH shoes=5 apparel=5"
    });
  }

  return {
    recognized: true,
    command: "batch",
    version: LINE_KEYWORD_BATCH_INTAKE_VERSION,
    raw_text: rawText,
    requested_counts: requestedCounts,
    total_requested: requestedCounts.reduce((sum, request) => sum + request.count, 0),
    blockers
  };
}

export function buildLineKeywordBatchIntakeResult({
  text = "",
  generationRows = [],
  auditRows = [],
  now = new Date(),
  lineUserId = "",
  snapshotSource = ""
} = {}) {
  const command = parseLineKeywordBatchCommand(text);
  if (!command.recognized) {
    return {
      recognized: false,
      ok: false,
      command,
      batch: null,
      blockers: [],
      replyText: ""
    };
  }

  const result = buildLineKeywordBatchFromCatalog({
    command,
    generationRows,
    auditRows,
    now,
    lineUserId,
    snapshotSource
  });
  return {
    recognized: true,
    ok: result.ok,
    command,
    batch: result.batch,
    blockers: result.blockers,
    replyText: result.ok
      ? buildSuccessReplyText(result.batch)
      : buildBlockedReplyText(result.blockers, command)
  };
}

export function buildLineKeywordBatchFromCatalog({
  command,
  generationRows = [],
  auditRows = [],
  now = new Date(),
  lineUserId = "",
  snapshotSource = ""
} = {}) {
  const parsedCommand = command || parseLineKeywordBatchCommand("");
  const commandBlockers = Array.isArray(parsedCommand.blockers) ? parsedCommand.blockers : [];
  const batchId = `line-keyword-${formatBatchTimestamp(now)}`;
  const catalogRows = normalizeCatalogRows(generationRows, auditRows);
  const usedSkus = new Set();
  const selectedItems = [];
  const selectedCounts = {};
  const blockers = [...commandBlockers];

  for (const request of parsedCommand.requested_counts || []) {
    const candidates = catalogRows
      .filter((row) => row.category_key === request.key)
      .filter((row) => row.sku && !usedSkus.has(row.sku))
      .sort(compareCatalogCandidates);
    const picked = candidates.slice(0, request.count);
    selectedCounts[request.key] = picked.length;
    if (picked.length < request.count) {
      blockers.push({
        code: "category_shortfall",
        message: `${request.label} มี candidate พร้อมใช้ ${picked.length}/${request.count}`,
        category: request.key,
        requested: request.count,
        available: picked.length
      });
    }
    for (const candidate of picked) {
      usedSkus.add(candidate.sku);
      selectedItems.push(buildBatchItem(candidate, request, batchId));
    }
  }

  const requestedCounts = parsedCommand.requested_counts || [];
  const batch = {
    batch_id: batchId,
    dry_run: true,
    batch_size: selectedItems.length,
    prompt_framework_version: "prompt-framework-v3.0",
    created_at: now.toISOString(),
    selection: {
      source: "line_keyword_batch_intake",
      version: LINE_KEYWORD_BATCH_INTAKE_VERSION,
      line_user_id: cleanText(lineUserId),
      snapshot_source: cleanText(snapshotSource),
      raw_text: parsedCommand.raw_text || "",
      requested_counts: requestedCounts,
      selected_counts: selectedCounts,
      requested_size: requestedCounts.reduce((sum, request) => sum + request.count, 0),
      selected_size: selectedItems.length,
      shortfalls: blockers.filter((blocker) => blocker.code === "category_shortfall")
    },
    items: selectedItems
  };

  const canCreateReviewBatch = parsedCommand.recognized === true && commandBlockers.length === 0 && selectedItems.length > 0;

  return {
    ok: canCreateReviewBatch,
    batch,
    blockers
  };
}

export async function loadLineKeywordBatchCatalogSnapshot({
  outputsDir,
  fallbackGenerationPath = process.env.LINE_KEYWORD_GENERATION_CATALOG_CSV || PACKAGED_GENERATION_CATALOG_PATH,
  fallbackAuditPath = process.env.LINE_KEYWORD_AUDIT_CATALOG_CSV || ""
} = {}) {
  const resolvedOutputsDir = path.resolve(outputsDir || process.cwd());
  const generationRows = await readCsvObjectsIfExists(path.join(resolvedOutputsDir, "generation-input-catalog.csv"));
  const auditRows = await readCsvObjectsIfExists(path.join(resolvedOutputsDir, "catalog-vs-woo-sku-audit.csv"));
  if (generationRows.length) {
    return {
      source: "outputs_dir",
      outputsDir: resolvedOutputsDir,
      generationRows,
      auditRows
    };
  }

  const fallbackGenerationRows = await readCsvObjectsIfExists(fallbackGenerationPath);
  const fallbackAuditRows = fallbackAuditPath ? await readCsvObjectsIfExists(fallbackAuditPath) : [];
  return {
    source: fallbackGenerationRows.length ? "packaged_fallback" : "empty",
    outputsDir: resolvedOutputsDir,
    fallbackGenerationPath: path.resolve(fallbackGenerationPath || PACKAGED_GENERATION_CATALOG_PATH),
    fallbackAuditPath: fallbackAuditPath ? path.resolve(fallbackAuditPath) : "",
    generationRows: fallbackGenerationRows,
    auditRows: fallbackAuditRows
  };
}

export function buildLineKeywordBatchTextMessages({ result } = {}) {
  if (!result?.recognized) return [];
  return [{ type: "text", text: result.replyText || buildBlockedReplyText(result.blockers || [], result.command || {}) }];
}

function normalizeCatalogRows(generationRows = [], auditRows = []) {
  const auditBySku = new Map(
    (auditRows || [])
      .map((row) => [cleanSku(firstValue(row, ["sku", "SKU"])), row])
      .filter(([sku]) => sku)
  );

  return (generationRows || [])
    .map((row, index) => {
      const sku = cleanSku(firstValue(row, ["sku", "SKU", "Sku", "product_sku"]));
      const auditRow = auditBySku.get(sku) || {};
      const categoryText = [
        allValues(row, ["product_type", "category", "subcategory", "product_name", "feature_notes"]),
        allValues(auditRow, ["product_type", "wp_category", "wp_subcategory", "wp_product_name", "wp_description", "category", "subcategory", "product_name"])
      ].filter(Boolean).join(" ");
      const category = resolveCategoryFromCatalogText(categoryText);
      const referenceUrl = cleanText(firstValue(row, [
        "reference_url",
        "Reference URL",
        "image_url",
        "imageUrl",
        "line_image_url",
        "source_url"
      ]));
      const referenceDriveId = cleanText(firstValue(row, ["reference_drive_id", "drive_file_id"]));
      const processState = cleanText(firstValue(row, ["reference_sheet_process", "Process", "process", "generation_status"]));
      const productType = category?.product_type || cleanText(firstValue(row, ["product_type", "category"])) || "";
      const targetSite = cleanText(firstValue(row, ["reference_target_site", "target_site", "brand_id"])) || inferTargetSite(row);
      const branch = cleanText(firstValue(row, ["reference_branch", "branch", "business_source"])) || targetSite;

      return {
        row,
        row_index: index,
        sku,
        category_key: category?.key || "",
        product_type: productType,
        product_name: cleanText(firstValue(row, ["product_name", "name", "title"])) || sku,
        brand_id: cleanText(firstValue(row, ["reference_brand_id", "brand_id", "brand"])) || targetSite,
        brand_label: brandLabelFromTarget(targetSite || branch),
        target_site: targetSite,
        branch,
        reference_url: referenceUrl,
        reference_drive_id: referenceDriveId,
        reference_lookup_strategy: cleanText(firstValue(row, ["reference_lookup_strategy"])),
        reference_verified: cleanText(firstValue(row, ["reference_verified"])),
        process_state: processState,
        has_reference: Boolean(referenceUrl || referenceDriveId),
        source_file: cleanText(firstValue(row, ["source_file"])),
        source_row: cleanText(firstValue(row, ["source_row", "reference_sheet_row"]))
      };
    })
    .filter((row) => row.sku && row.category_key);
}

function buildBatchItem(candidate, request, batchId) {
  const referenceManifest = candidate.has_reference
    ? {
      match_method: candidate.reference_lookup_strategy || "line_keyword_catalog_snapshot",
      confidence: candidate.reference_verified === "yes" || candidate.reference_verified === "true" ? 0.9 : 0.72,
      needs_review: candidate.reference_verified !== "yes" && candidate.reference_verified !== "true",
      source_url: candidate.reference_url || "",
      drive_file_id: candidate.reference_drive_id || ""
    }
    : null;

  return {
    batch_id: batchId,
    sku: candidate.sku,
    product_type: candidate.product_type || request.product_type,
    target_site: candidate.target_site,
    product_name: candidate.product_name,
    brand_id: candidate.brand_id,
    brand_label: candidate.brand_label,
    woo_status: "",
    prompt_framework_version: "prompt-framework-v3.0",
    dry_run_action: "dry-run: wait for LINE batch approval, then generate hero first",
    reference_url: candidate.reference_url,
    reference_drive_id: candidate.reference_drive_id,
    reference_manifest: referenceManifest,
    hero_prompt: "",
    support_prompt_preview: "",
    support_shots: "",
    metadata: {
      intake_source: "line_keyword_batch_intake",
      keyword_category: request.key,
      keyword_label: request.label,
      reference_branch: candidate.branch,
      reference_sheet_process: candidate.process_state,
      source_file: candidate.source_file,
      source_row: candidate.source_row
    }
  };
}

function compareCatalogCandidates(a, b) {
  return scoreCatalogCandidate(b) - scoreCatalogCandidate(a) || a.row_index - b.row_index;
}

function scoreCatalogCandidate(row) {
  let score = 0;
  if (row.has_reference) score += 100;
  const process = cleanText(row.process_state).toLowerCase();
  if (["false", "no", "ready", "needs_reference_image", ""].includes(process)) score += 20;
  if (process === "true" || process === "done" || process === "completed") score -= 40;
  if (row.reference_verified === "yes" || row.reference_verified === "true") score += 10;
  return score;
}

function resolveCategoryDefinition(rawCategory) {
  const normalized = cleanText(rawCategory).toLowerCase();
  return CATEGORY_DEFINITIONS.find((definition) => definition.aliases.some((alias) => alias.toLowerCase() === normalized));
}

function resolveCategoryFromCatalogText(text) {
  const normalized = cleanText(text).toLowerCase();
  return CATEGORY_DEFINITIONS.find((definition) => definition.matchers.some((matcher) => normalized.includes(matcher.toLowerCase())));
}

function formatBatchTimestamp(now) {
  return new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildSuccessReplyText(batch) {
  const requested = batch.selection?.requested_counts || [];
  const requestedText = requested.map((request) => `${request.label}=${request.count}`).join(" ");
  const shortfallCount = Array.isArray(batch.selection?.shortfalls) ? batch.selection.shortfalls.length : 0;
  return [
    "สร้าง Batch แล้ว",
    `Batch: ${batch.batch_id}`,
    `Request: ${requestedText || "-"} · Selected: ${batch.items?.length || 0}`,
    shortfallCount ? `มีบางรายการต้องตรวจ reference ก่อนเริ่ม (${shortfallCount})` : "พร้อมเปิด Batch Review",
    "ขั้นต่อไป: กด เปิด Batch Review"
  ].join("\n");
}

function buildBlockedReplyText(blockers = [], command = {}) {
  const blockerText = blockers.length
    ? blockers.map((blocker) => `- ${blocker.message || blocker.code}`).join("\n")
    : "- ไม่สามารถสร้าง batch ได้";
  return [
    "ยังสร้าง batch จาก LINE keyword ไม่ได้",
    blockerText,
    `ตัวอย่าง: ${command?.raw_text ? "BATCH รองเท้า=5 เสื้อ=5" : "BATCH รองเท้า=5 เสื้อ=5 หรือ BATCH shoes=5 apparel=5"}`
  ].join("\n");
}

async function readCsvObjectsIfExists(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const rows = parseCsv(text.replace(/^\uFEFF/, ""));
    if (!rows.length) return [];
    const headers = rows[0].map((header) => cleanText(header));
    return rows
      .slice(1)
      .filter((row) => row.some((value) => cleanText(value)))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function firstValue(row = {}, keys = []) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && cleanText(row[key]) !== "") return row[key];
  }
  return "";
}

function allValues(row = {}, keys = []) {
  return keys
    .map((key) => cleanText(row[key]))
    .filter(Boolean)
    .join(" ");
}

function inferTargetSite(row = {}) {
  const source = cleanText(firstValue(row, ["business_source", "source_file", "reference_branch"])).toLowerCase();
  if (source.includes("go") || source.includes("gomall")) return "go_mall";
  if (source.includes("rent") || source.includes("rac")) return "rent_a_coat";
  return "";
}

function brandLabelFromTarget(target = "") {
  const normalized = cleanText(target).toLowerCase();
  if (normalized === "go_mall" || normalized.includes("go")) return "GO Mall";
  if (normalized === "rent_a_coat" || normalized.includes("rent")) return "Rent A Coat";
  return cleanText(target) || "Automation";
}

function cleanSku(value = "") {
  return cleanText(value).toUpperCase();
}

function cleanText(value = "") {
  return String(value ?? "").trim();
}
