import { BRAND_IDS } from "./brand-profiles-v3.mjs";

export const READY_VIA_PRODUCT_CATALOG_SHEET_STATUS = "ready_via_product_catalog_sheet";
export const PRODUCT_CATALOG_SHEET_STRATEGY = "product_catalog_sheet";
export const PRODUCT_CATALOG_SHEET_VERIFIED = "product_catalog_sheet_row_matched";

export function normalizeProductCatalogBranch(value) {
  const normalized = String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.includes("go mall") || normalized.includes("gomall")) return "GO Mall";
  if (normalized.includes("rent a coat") || normalized.includes("rentacoat") || normalized === "rac") {
    return "Rent A Coat";
  }
  return String(value || "").trim();
}

export function branchToBrandId(value) {
  const branch = normalizeProductCatalogBranch(value);
  if (branch === "GO Mall") return BRAND_IDS.GO_MALL;
  if (branch === "Rent A Coat") return BRAND_IDS.RENT_A_COAT;
  return "";
}

export function branchToTargetSite(value) {
  const brandId = branchToBrandId(value);
  if (brandId === BRAND_IDS.GO_MALL) return "gomall";
  if (brandId === BRAND_IDS.RENT_A_COAT) return "rentacoat";
  return "";
}

export function extractDriveIdFromUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const folderMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = text.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  return "";
}

export function extractProductCatalogRowsFromSheetGrid(rowData = []) {
  if (!Array.isArray(rowData) || rowData.length < 2) return [];
  const headers = (rowData[0]?.values || []).map((cell) => cellText(cell));
  const column = createHeaderLookup(headers);
  const requiredColumns = ["sku", "link", "branch", "process"];
  for (const key of requiredColumns) {
    if (column[key] === undefined) {
      throw new Error(`Product Catalog sheet is missing required column: ${key}`);
    }
  }

  return rowData
    .slice(1)
    .map((row, index) => {
      const values = row?.values || [];
      const linkCell = values[column.link] || {};
      const referenceUrl = cellLink(linkCell) || cellText(linkCell);
      const branch = normalizeProductCatalogBranch(cellText(values[column.branch]));
      return {
        sheet_row: String(index + 2),
        sku: cellText(values[column.sku]),
        reference_url: referenceUrl,
        reference_drive_id: extractDriveIdFromUrl(referenceUrl),
        reference_branch: branch,
        reference_brand_id: branchToBrandId(branch),
        reference_target_site: branchToTargetSite(branch),
        reference_sheet_process: cellText(values[column.process]),
        reference_sheet_note: column.note === undefined ? "" : cellText(values[column.note])
      };
    })
    .filter((row) => row.sku);
}

export function refreshGenerationRowsWithProductCatalogSheet({
  generationRows = [],
  productCatalogRows = [],
  shouldOverwriteReadyRows = false
} = {}) {
  const catalogBySku = buildCatalogRowIndex(productCatalogRows);
  const summary = {
    total_rows: generationRows.length,
    sheet_rows_indexed: productCatalogRows.length,
    matched: 0,
    matched_go_mall: 0,
    matched_rent_a_coat: 0,
    missing: 0,
    duplicate_sheet_sku: countDuplicateSkus(productCatalogRows),
    skipped_ready: 0,
    missing_link: 0,
    missing_branch: 0
  };

  const rows = generationRows.map((row) => {
    if (!shouldOverwriteReadyRows && isReadyFromProductCatalog(row)) {
      summary.skipped_ready += 1;
      return { ...row };
    }

    const catalogRow = catalogBySku.get(row.sku);
    if (!catalogRow) {
      summary.missing += 1;
      return { ...row };
    }
    if (!catalogRow.reference_url) summary.missing_link += 1;
    if (!catalogRow.reference_branch) summary.missing_branch += 1;

    summary.matched += 1;
    if (catalogRow.reference_brand_id === BRAND_IDS.GO_MALL) summary.matched_go_mall += 1;
    if (catalogRow.reference_brand_id === BRAND_IDS.RENT_A_COAT) summary.matched_rent_a_coat += 1;

    return {
      ...row,
      reference_url: catalogRow.reference_url || row.reference_url || "",
      reference_drive_id: catalogRow.reference_drive_id || row.reference_drive_id || "",
      reference_parent_folder_id: "",
      reference_lookup_key: catalogRow.sku,
      reference_lookup_strategy: PRODUCT_CATALOG_SHEET_STRATEGY,
      reference_verified: PRODUCT_CATALOG_SHEET_VERIFIED,
      reference_sheet_row: catalogRow.sheet_row,
      reference_branch: catalogRow.reference_branch,
      reference_brand_id: catalogRow.reference_brand_id,
      reference_target_site: catalogRow.reference_target_site,
      reference_sheet_process: catalogRow.reference_sheet_process,
      reference_sheet_note: catalogRow.reference_sheet_note,
      generation_status: catalogRow.reference_url
        ? READY_VIA_PRODUCT_CATALOG_SHEET_STATUS
        : row.generation_status
    };
  });

  return { rows, summary };
}

function createHeaderLookup(headers) {
  return headers.reduce((lookup, header, index) => {
    const value = String(header || "").trim().toLowerCase();
    if (value === "sku id") lookup.sku = index;
    if (value === "link") lookup.link = index;
    if (value.includes("branch") || value.includes("สาขา")) lookup.branch = index;
    if (value === "process") lookup.process = index;
    if (!value && lookup.note === undefined) lookup.note = index;
    return lookup;
  }, {});
}

function buildCatalogRowIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    if (!row.sku) continue;
    const existing = index.get(row.sku);
    if (!existing || scoreCatalogRow(row) > scoreCatalogRow(existing)) {
      index.set(row.sku, row);
    }
  }
  return index;
}

function scoreCatalogRow(row) {
  return Number(Boolean(row.reference_url)) * 10
    + Number(Boolean(row.reference_branch)) * 5
    + Number(Boolean(row.reference_drive_id)) * 3
    + Number(String(row.reference_sheet_process || "").toLowerCase() !== "true");
}

function countDuplicateSkus(rows) {
  const counts = rows.reduce((map, row) => {
    if (row.sku) map.set(row.sku, (map.get(row.sku) || 0) + 1);
    return map;
  }, new Map());
  return Array.from(counts.values()).filter((count) => count > 1).length;
}

function isReadyFromProductCatalog(row) {
  return row.generation_status === READY_VIA_PRODUCT_CATALOG_SHEET_STATUS
    || row.reference_lookup_strategy === PRODUCT_CATALOG_SHEET_STRATEGY;
}

function cellText(cell = {}) {
  if (cell.formattedValue !== undefined) return String(cell.formattedValue || "").trim();
  const value = cell.effectiveValue || cell.userEnteredValue || {};
  return String(value.stringValue ?? value.numberValue ?? value.boolValue ?? "").trim();
}

function cellLink(cell = {}) {
  const chipUri = cell.chipRuns
    ?.map((run) => run?.chip?.richLinkProperties?.uri)
    .find(Boolean);
  if (chipUri) return chipUri;
  const richTextLink = cell.textFormatRuns
    ?.map((run) => run?.format?.link?.uri)
    .find(Boolean);
  return richTextLink || cell.hyperlink || "";
}
