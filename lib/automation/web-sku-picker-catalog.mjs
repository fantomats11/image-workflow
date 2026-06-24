import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseCsv } from "./csv.mjs";
import { extractDriveIdFromUrl } from "./product-catalog-sheet-refresh.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
export const WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR = path.resolve(repoRoot, "../../outputs");
export const WEB_SKU_PICKER_OUTPUTS_CATALOG_FILENAME = "generation-input-catalog.csv";
export const WEB_SKU_PICKER_DEFAULT_CATALOG_PATH = path.resolve(
  __dirname,
  "../../data/automation/line-keyword-generation-catalog.csv"
);
export const WEB_SKU_PICKER_MIN_QUERY_LENGTH = 3;
export const WEB_SKU_PICKER_DEFAULT_LIMIT = 20;
export const WEB_SKU_PICKER_MAX_LIMIT = 50;
export const WEB_SKU_PICKER_CACHE_TTL_MS = 60_000;

const catalogSnapshotCache = new Map();
const catalogSkuIndexCache = new Map();
const catalogExactSkuItemCache = new Map();
const catalogExactSkuItemPromiseCache = new Map();
const normalizedRowsCache = new WeakMap();

const LOCKED_FIELD_CANDIDATES = [
  "sku",
  "product_name",
  "branch",
  "category",
  "subcategory",
  "reference_url",
  "reference_drive_id",
  "reference_lookup_strategy"
];

const OPTIONAL_MAPPING_FIELDS = [
  "brand",
  "color",
  "price",
  "stock_status",
  "woo_product_id",
  "woo_status",
  "drive_export_status"
];

export async function loadWebSkuPickerCatalogSnapshot({
  catalogPath = process.env.WEB_SKU_PICKER_CATALOG_CSV || process.env.LINE_KEYWORD_GENERATION_CATALOG_CSV || "",
  outputsDir = process.env.WEB_SKU_PICKER_OUTPUTS_DIR || process.env.LINE_KEYWORD_OUTPUTS_DIR || WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR
} = {}) {
  const { path: resolvedPath, source } = await resolveWebSkuPickerCatalogPath({ catalogPath, outputsDir });
  const stats = await fs.stat(resolvedPath);
  const cacheKey = resolvedPath;
  const cached = catalogSnapshotCache.get(cacheKey);
  const now = Date.now();
  if (
    cached &&
    cached.source === source &&
    cached.size === stats.size &&
    cached.mtimeMs === stats.mtimeMs
  ) {
    return cached.snapshot;
  }

  const text = await fs.readFile(resolvedPath, "utf8");
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  let snapshot;
  if (!rows.length) {
    snapshot = {
      source,
      path: resolvedPath,
      file_signature: buildCatalogFileSignature({ path: resolvedPath, source, stats }),
      rows: []
    };
    catalogSnapshotCache.set(cacheKey, { source, size: stats.size, mtimeMs: stats.mtimeMs, loadedAt: now, snapshot });
    return snapshot;
  }
  const headers = rows[0].map((header) => cleanText(header));
  const objects = rows
    .slice(1)
    .filter((row) => row.some((value) => cleanText(value)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));

  snapshot = {
    source,
    path: resolvedPath,
    file_signature: buildCatalogFileSignature({ path: resolvedPath, source, stats }),
    rows: objects
  };
  catalogSnapshotCache.set(cacheKey, { source, size: stats.size, mtimeMs: stats.mtimeMs, loadedAt: now, snapshot });
  return snapshot;
}

export async function loadWebSkuPickerSkuIndex({
  catalogPath = process.env.WEB_SKU_PICKER_CATALOG_CSV || process.env.LINE_KEYWORD_GENERATION_CATALOG_CSV || "",
  outputsDir = process.env.WEB_SKU_PICKER_OUTPUTS_DIR || process.env.LINE_KEYWORD_OUTPUTS_DIR || WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR
} = {}) {
  const startedAt = Date.now();
  const { path: resolvedPath, source } = await resolveWebSkuPickerCatalogPath({ catalogPath, outputsDir });
  const stats = await fs.stat(resolvedPath);
  const signature = buildCatalogFileSignature({ path: resolvedPath, source, stats });
  const cacheKey = signature.path;
  const cached = catalogSkuIndexCache.get(cacheKey);
  if (cached && isSameCatalogFileSignature(cached.signature, signature)) {
    cached.index.diagnostics = {
      ...cached.index.diagnostics,
      cache_hit: true,
      load_ms: Date.now() - startedAt,
      total_ms: Date.now() - startedAt
    };
    return cached.index;
  }

  const snapshotLoadStartedAt = Date.now();
  const snapshot = await loadWebSkuPickerCatalogSnapshot({ catalogPath, outputsDir });
  const loadMs = Date.now() - snapshotLoadStartedAt;
  const normalizeStartedAt = Date.now();
  const index = buildWebSkuPickerSkuIndex(snapshot.rows, {
    source: snapshot.source,
    path: snapshot.path,
    file_signature: snapshot.file_signature || signature
  });
  const normalizeMs = Date.now() - normalizeStartedAt;
  const indexed = {
    ...index,
    diagnostics: {
      cache_hit: false,
      load_ms: loadMs,
      normalize_ms: normalizeMs,
      total_ms: Date.now() - startedAt
    }
  };
  catalogSkuIndexCache.set(cacheKey, { signature, index: indexed });
  return indexed;
}

export async function getCachedWebSkuPickerSkuIndex({
  catalogPath = process.env.WEB_SKU_PICKER_CATALOG_CSV || process.env.LINE_KEYWORD_GENERATION_CATALOG_CSV || "",
  outputsDir = process.env.WEB_SKU_PICKER_OUTPUTS_DIR || process.env.LINE_KEYWORD_OUTPUTS_DIR || WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR
} = {}) {
  const startedAt = Date.now();
  const { path: resolvedPath, source } = await resolveWebSkuPickerCatalogPath({ catalogPath, outputsDir });
  const stats = await fs.stat(resolvedPath);
  const signature = buildCatalogFileSignature({ path: resolvedPath, source, stats });
  const cached = catalogSkuIndexCache.get(signature.path);
  if (!cached || !isSameCatalogFileSignature(cached.signature, signature)) return null;
  cached.index.diagnostics = {
    ...cached.index.diagnostics,
    cache_hit: true,
    load_ms: Date.now() - startedAt,
    total_ms: Date.now() - startedAt
  };
  return cached.index;
}

export async function readWebSkuPickerCatalogItemBySku({
  sku = "",
  catalogPath = process.env.WEB_SKU_PICKER_CATALOG_CSV || process.env.LINE_KEYWORD_GENERATION_CATALOG_CSV || "",
  outputsDir = process.env.WEB_SKU_PICKER_OUTPUTS_DIR || process.env.LINE_KEYWORD_OUTPUTS_DIR || WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR
} = {}) {
  const startedAt = Date.now();
  const normalizedSku = cleanSku(sku);
  if (!normalizedSku) {
    return {
      item: null,
      diagnostics: {
        cache_hit: false,
        lookup_strategy: "exact_row_scan",
        load_ms: 0,
        normalize_ms: 0,
        lookup_ms: 0,
        total_ms: Date.now() - startedAt
      }
    };
  }

  const { path: resolvedPath, source } = await resolveWebSkuPickerCatalogPath({ catalogPath, outputsDir });
  const stats = await fs.stat(resolvedPath);
  const signature = buildCatalogFileSignature({ path: resolvedPath, source, stats });
  const cacheKey = `${signature.path}:${signature.source}:${signature.size}:${signature.mtimeMs}:${normalizedSku}`;
  const cached = catalogExactSkuItemCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      diagnostics: {
        ...cached.diagnostics,
        cache_hit: true,
        lookup_ms: Date.now() - startedAt,
        total_ms: Date.now() - startedAt
      }
    };
  }
  if (catalogExactSkuItemPromiseCache.has(cacheKey)) {
    return catalogExactSkuItemPromiseCache.get(cacheKey);
  }

  const promise = scanWebSkuPickerCatalogItemBySku({
    filePath: resolvedPath,
    normalizedSku,
    source,
    signature,
    startedAt
  }).then((result) => {
    catalogExactSkuItemCache.set(cacheKey, result);
    return result;
  }).finally(() => {
    catalogExactSkuItemPromiseCache.delete(cacheKey);
  });

  catalogExactSkuItemPromiseCache.set(cacheKey, promise);
  return promise;
}

export function buildWebSkuPickerSkuIndex(rows = [], metadata = {}) {
  const normalizedRows = getCachedNormalizedWebSkuPickerRows(rows);
  const itemsBySku = new Map();
  for (const item of normalizedRows) {
    const skuKey = cleanSku(item.sku);
    if (skuKey && !itemsBySku.has(skuKey)) {
      itemsBySku.set(skuKey, item);
    }
  }
  return {
    ok: true,
    source: metadata.source || "",
    path: metadata.path || "",
    file_signature: metadata.file_signature || null,
    row_count: normalizedRows.length,
    normalized_rows: normalizedRows,
    itemsBySku
  };
}

async function scanWebSkuPickerCatalogItemBySku({ filePath, normalizedSku, source, signature, startedAt }) {
  const lookupStartedAt = Date.now();
  const stream = createReadStream(filePath, { encoding: "utf8" });
  let headers = null;
  let row = [];
  let field = "";
  let inQuotes = false;
  let dataRowIndex = 0;

  const processRow = (csvRow) => {
    if (!csvRow.some((value) => cleanText(value))) return null;
    if (!headers) {
      headers = csvRow.map((header, index) => (index === 0 ? cleanText(header).replace(/^\uFEFF/, "") : cleanText(header)));
      return null;
    }
    const object = Object.fromEntries(headers.map((header, index) => [header, csvRow[index] || ""]));
    const rowSku = cleanSku(firstValue(object, ["sku", "SKU", "Sku", "product_sku", "SKU ID"]));
    dataRowIndex += 1;
    if (rowSku !== normalizedSku) return null;
    const normalizeStartedAt = Date.now();
    const item = normalizeWebSkuPickerRow(object, dataRowIndex - 1);
    return {
      item,
      source,
      path: filePath,
      diagnostics: {
        cache_hit: false,
        lookup_strategy: "exact_row_scan",
        load_ms: 0,
        normalize_ms: Date.now() - normalizeStartedAt,
        lookup_ms: Date.now() - lookupStartedAt,
        total_ms: Date.now() - startedAt,
        row_index: item.row_index
      },
      file_signature: signature
    };
  };

  for await (const chunk of stream) {
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];
      const next = chunk[index + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        const result = processRow(row);
        if (result) {
          stream.destroy();
          return result;
        }
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
  }

  if (field || row.length) {
    row.push(field);
    const result = processRow(row);
    if (result) return result;
  }

  return {
    item: null,
    source,
    path: filePath,
    diagnostics: {
      cache_hit: false,
      lookup_strategy: "exact_row_scan",
      load_ms: 0,
      normalize_ms: 0,
      lookup_ms: Date.now() - lookupStartedAt,
      total_ms: Date.now() - startedAt
    },
    file_signature: signature
  };
}

async function resolveWebSkuPickerCatalogPath({ catalogPath = "", outputsDir = "" } = {}) {
  if (catalogPath) {
    return {
      path: path.resolve(catalogPath),
      source: "configured_catalog"
    };
  }

  const resolvedOutputsDir = path.resolve(outputsDir || WEB_SKU_PICKER_DEFAULT_OUTPUTS_DIR);
  const outputCatalogPath = path.join(resolvedOutputsDir, WEB_SKU_PICKER_OUTPUTS_CATALOG_FILENAME);
  if (await fileExists(outputCatalogPath)) {
    return {
      path: outputCatalogPath,
      source: "outputs_dir"
    };
  }

  return {
    path: WEB_SKU_PICKER_DEFAULT_CATALOG_PATH,
    source: "packaged_fallback"
  };
}

export function searchWebSkuPickerCatalog({
  rows = [],
  query = "",
  branch = "",
  category = "",
  limit = WEB_SKU_PICKER_DEFAULT_LIMIT
} = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedBranch = normalizeSearchText(branch);
  const normalizedCategory = normalizeSearchText(category);
  const safeLimit = normalizeLimit(limit);
  if (!normalizedQuery || normalizedQuery.length < WEB_SKU_PICKER_MIN_QUERY_LENGTH) {
    return {
      ok: true,
      query: cleanText(query),
      total: 0,
      items: []
    };
  }

  const normalizedRows = getCachedNormalizedWebSkuPickerRows(rows);
  const matches = normalizedRows
    .filter((item) => {
      if (normalizedBranch && normalizeSearchText(item.branch) !== normalizedBranch) return false;
      if (normalizedCategory && normalizeSearchText(item.category) !== normalizedCategory) return false;
      return [
        item.sku,
        item.product_name,
        item.brand,
        item.branch,
        item.category,
        item.subcategory,
        item.feature_notes
      ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => scoreSearchResult(b, normalizedQuery) - scoreSearchResult(a, normalizedQuery) || a.sku.localeCompare(b.sku))
    .slice(0, safeLimit);

  return {
    ok: true,
    query: cleanText(query),
    total: matches.length,
    items: matches
  };
}

export function normalizeWebSkuPickerRows(rows = []) {
  return (rows || [])
    .map((row, index) => normalizeWebSkuPickerRow(row, index))
    .filter((item) => item.sku);
}

export function normalizeWebSkuPickerRow(row = {}, index = 0) {
  const sku = cleanSku(firstValue(row, ["sku", "SKU", "Sku", "product_sku"]));
  const referenceUrl = cleanText(firstValue(row, ["reference_url", "Reference URL", "image_url", "source_url"]));
  const rawReferenceDriveId = cleanText(firstValue(row, ["reference_drive_id", "drive_file_id"]));
  const referenceDriveId = extractDriveIdFromUrl(rawReferenceDriveId) || rawReferenceDriveId || extractDriveIdFromUrl(referenceUrl);
  const branch = normalizeBranchLabel(cleanText(firstValue(row, ["reference_branch", "branch", "business_source", "reference_target_site"])));
  const item = {
    sku,
    product_name: cleanText(firstValue(row, ["product_name", "name", "title"])) || sku,
    brand: cleanText(firstValue(row, ["product_brand", "brand_name", "brand"])) || "",
    branch: branch || "unknown",
    category: cleanText(firstValue(row, ["category", "product_type"])) || "",
    subcategory: cleanText(firstValue(row, ["subcategory", "product_subtype"])) || "",
    color: cleanText(firstValue(row, ["color", "สี"])) || "",
    product_type: cleanText(firstValue(row, ["product_type"])) || "",
    feature_notes: cleanText(firstValue(row, ["feature_notes", "notes", "description"])) || "",
    canonical_source: "catalog_snapshot",
    reference_url: referenceUrl,
    reference_drive_id: referenceDriveId,
    reference_lookup_strategy: cleanText(firstValue(row, ["reference_lookup_strategy"])) || "",
    reference_verified: cleanText(firstValue(row, ["reference_verified"])) || "",
    generation_status: cleanText(firstValue(row, ["generation_status"])) || "",
    source_file: cleanText(firstValue(row, ["source_file"])) || "",
    source_row: cleanText(firstValue(row, ["source_row", "reference_sheet_row"])) || "",
    row_index: index
  };

  item.reference_readiness = buildReferenceReadiness(item);
  item.references = buildWebSkuReferenceCards({ item });
  item.locked_fields = LOCKED_FIELD_CANDIDATES.filter((field) => cleanText(item[field]));
  item.needs_mapping = OPTIONAL_MAPPING_FIELDS.filter((field) => !cleanText(item[field]));
  return item;
}

export function findWebSkuPickerItemBySku(rows = [], sku = "") {
  const normalizedSku = cleanSku(sku);
  if (!normalizedSku) return null;
  if (rows?.itemsBySku instanceof Map) {
    return rows.itemsBySku.get(normalizedSku) || null;
  }
  return getCachedNormalizedWebSkuPickerRows(rows).find((item) => item.sku === normalizedSku) || null;
}

function getCachedNormalizedWebSkuPickerRows(rows = []) {
  if (!Array.isArray(rows)) return normalizeWebSkuPickerRows(rows);
  const cached = normalizedRowsCache.get(rows);
  if (cached) return cached;
  const normalized = normalizeWebSkuPickerRows(rows);
  normalizedRowsCache.set(rows, normalized);
  return normalized;
}

export function buildWebSkuReferenceContract({
  item = {},
  resolvedReferenceAssets = [],
  buildPreviewUrl = () => ""
} = {}) {
  const references = buildWebSkuReferenceCards({ item, resolvedReferenceAssets, buildPreviewUrl });
  return {
    sku: item.sku || "",
    reference_readiness: buildReferenceReadiness(item, references),
    references
  };
}

export function buildWebSkuReferenceCards({
  item = {},
  resolvedReferenceAssets = [],
  buildPreviewUrl = () => ""
} = {}) {
  const cards = [];
  const driveAssets = (resolvedReferenceAssets || []).filter((asset) => asset?.drive_file_id || asset?.id);
  for (const asset of driveAssets.slice(0, 8)) {
    const driveFileId = cleanText(asset.drive_file_id || asset.id);
    const fileName = cleanText(asset.name || asset.file_name || driveFileId);
    const previewUrl = buildPreviewUrl({ driveFileId, fileName }) || "";
    const generationUrl = cleanText(asset.staged_public_url || asset.public_url || asset.generation_url);
    const classification = asset.classification || {};
    const isUsableReference = classification.use_as_reference !== false;
    const blockers = isUsableReference
      ? generationUrl
        ? []
        : [{
          code: asset.staging_error_code || "reference_not_staged",
          message_th: asset.staging_error_message_th || "ยัง stage รูปจาก Drive เข้า Supabase Storage ไม่สำเร็จ"
        }]
      : [{
        code: "not_product_visual_truth",
        message_th: "ไฟล์นี้ไม่ควรใช้เป็น visual truth ของสินค้า"
      }];
    cards.push({
      reference_key: buildReferenceKey("google_drive", driveFileId),
      source: "google_drive",
      drive_id_present: true,
      verified: isReferenceVerified(item.reference_verified),
      preview_available: Boolean(previewUrl),
      stage_available: Boolean(generationUrl && isUsableReference),
      label_th: fileName || "ภาพอ้างอิงจาก Google Drive",
      file_name: fileName,
      mime_type: cleanText(asset.mimeType || asset.mime_type),
      width: Number(asset.width || 0),
      height: Number(asset.height || 0),
      preview_url: previewUrl,
      generation_url: generationUrl,
      storage_bucket: cleanText(asset.storage_bucket),
      storage_key: cleanText(asset.storage_key),
      staging_status: cleanText(asset.staging_status || (generationUrl ? "staged_to_supabase" : "")),
      warnings: buildReferenceWarnings({ item, asset, isUsableReference, generationUrl }),
      blockers
    });
  }

  if (!cards.length && (item.reference_drive_id || item.reference_url)) {
    cards.push({
      reference_key: buildReferenceKey("catalog", `${item.sku}:${item.reference_drive_id || item.reference_url}`),
      source: item.reference_drive_id ? "google_drive" : "catalog_url",
      drive_id_present: Boolean(item.reference_drive_id),
      verified: isReferenceVerified(item.reference_verified),
      preview_available: false,
      stage_available: false,
      label_th: item.reference_drive_id
        ? "พบ Google Drive reference ใน catalog แต่ยังไม่ได้โหลดรายการไฟล์"
        : "พบ reference URL ใน catalog แต่ยังไม่ใช่ direct staged image",
      warnings: [{
        code: "reference_preview_not_loaded",
        message_th: "ต้องเปิด/ตรวจ reference หรืออัปโหลดภาพเองก่อน Generate Hero"
      }],
      blockers: []
    });
  }

  if (!cards.length) {
    cards.push({
      reference_key: buildReferenceKey("manual", item.sku || "missing-reference"),
      source: "manual_required",
      drive_id_present: false,
      verified: false,
      preview_available: false,
      stage_available: false,
      label_th: "ยังไม่มี reference ใน catalog",
      warnings: [],
      blockers: [{
        code: "missing_reference_assets",
        message_th: "ต้องเพิ่มหรืออัปโหลดภาพอ้างอิงสินค้าก่อน Generate Hero"
      }]
    });
  }

  return cards;
}

export function buildReferenceKey(source = "", rawValue = "") {
  const input = `${cleanText(source)}:${cleanText(rawValue)}`;
  const digest = createHash("sha256").update(input).digest("hex").slice(0, 20);
  return `${cleanText(source) || "ref"}-${digest}`;
}

function buildReferenceReadiness(item, references = []) {
  const hasReference = Boolean(item.reference_url || item.reference_drive_id);
  const stageableCount = references.filter((reference) => reference.stage_available).length;
  const previewCount = references.filter((reference) => reference.preview_available).length;
  const blockers = [];
  const warnings = [];
  if (!hasReference) {
    blockers.push({
      code: "missing_reference_assets",
      message_th: "SKU นี้ยังไม่มีภาพอ้างอิงสินค้าที่ใช้สร้างได้"
    });
  }
  if (hasReference && !isReferenceVerified(item.reference_verified)) {
    warnings.push({
      code: "reference_not_verified",
      message_th: "มี reference แต่สถานะ verified ยังไม่ชัด ต้องตรวจด้วยตาก่อน Generate Hero"
    });
  }
  if (hasReference && !stageableCount) {
    warnings.push({
      code: "reference_requires_manual_upload_or_preview",
      message_th: "ยังไม่มีภาพ reference ที่ stage เข้า Generate ได้โดยตรง"
    });
  }
  if (hasReference || stageableCount) {
    warnings.push({
      code: "manual_visual_truth_check_required",
      message_th: "ตรวจด้วยตาว่าภาพ tag, barcode หรือ SKU card ไม่ถูกใช้เป็น visual truth ของสินค้า"
    });
  }
  const status = !hasReference
    ? "blocked"
    : stageableCount
      ? "ready"
      : "warning";
  return {
    status,
    label_th: status === "ready"
      ? "มีภาพ reference จาก catalog/Drive พร้อมใช้กับ Hero"
      : status === "warning"
        ? "มี reference จาก catalog/Drive แต่ยังต้องโหลดไฟล์ภาพ"
        : "ยังไม่มี reference พร้อมใช้",
    reference_count: Math.max(references.length, hasReference ? 1 : 0),
    usable_reference_count: stageableCount,
    preview_count: previewCount,
    stageable_reference_count: stageableCount,
    blockers,
    warnings
  };
}

function buildReferenceWarnings({ item = {}, asset = {}, isUsableReference = true, generationUrl = "" } = {}) {
  const warnings = [];
  if (!isReferenceVerified(item.reference_verified)) {
    warnings.push({
      code: "reference_not_verified",
      message_th: "สถานะ verified ยังไม่ชัด ต้องตรวจด้วยตาก่อนใช้"
    });
  }
  const assetType = asset.classification?.asset_type || "";
  if (!isUsableReference || ["label_or_tag", "staff_noise", "generated_candidate"].includes(assetType)) {
    warnings.push({
      code: "not_visual_truth",
      message_th: "ไฟล์นี้อาจเป็น tag/barcode/SKU card/noise หรือ generated image ห้ามใช้เป็น visual truth"
    });
  }
  if (isUsableReference && !generationUrl) {
    warnings.push({
      code: asset.staging_error_code || "reference_not_staged",
      message_th: asset.staging_error_message_th || "ยังไม่มี Supabase staged URL สำหรับใช้ Generate Hero"
    });
  }
  warnings.push({
    code: "manual_visual_truth_check_required",
    message_th: "ตรวจว่าเป็นภาพสินค้าจริง ไม่ใช่ tag/barcode/SKU card"
  });
  return warnings;
}

function isReferenceVerified(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return ["true", "yes", "verified", "product_catalog_sheet_row_matched"].includes(normalized);
}

function scoreSearchResult(item, normalizedQuery) {
  const sku = normalizeSearchText(item.sku);
  const name = normalizeSearchText(item.product_name);
  const brand = normalizeSearchText(item.brand || item.branch);
  let score = 0;
  if (sku === normalizedQuery) score += 100;
  if (sku.startsWith(normalizedQuery)) score += 60;
  if (name.includes(normalizedQuery)) score += 30;
  if (brand.includes(normalizedQuery)) score += 15;
  if (item.reference_readiness?.status === "ready") score += 5;
  return score;
}

function normalizeLimit(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return WEB_SKU_PICKER_DEFAULT_LIMIT;
  return Math.min(WEB_SKU_PICKER_MAX_LIMIT, Math.floor(value));
}

function normalizeBranchLabel(value = "") {
  const text = cleanText(value);
  const normalized = text.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized.includes("gomall")) return "GO Mall";
  if (normalized.includes("rentacoat") || normalized === "rac") return "Rent A Coat";
  return text;
}

function cleanSku(value = "") {
  return cleanText(value).toUpperCase();
}

function normalizeSearchText(value = "") {
  return cleanText(value).toLowerCase();
}

function cleanText(value = "") {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

async function fileExists(filePath = "") {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function buildCatalogFileSignature({ path: filePath = "", source = "", stats = {} } = {}) {
  return {
    path: filePath,
    source,
    size: Number(stats.size || 0),
    mtimeMs: Number(stats.mtimeMs || 0)
  };
}

function isSameCatalogFileSignature(left = {}, right = {}) {
  return left.path === right.path &&
    left.source === right.source &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs;
}

function firstValue(row = {}, keys = []) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && cleanText(row[key])) return row[key];
  }
  return "";
}
