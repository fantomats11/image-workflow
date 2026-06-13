export const READY_VIA_DRIVE_FOLDER_STATUS = "ready_via_drive_folder_lookup";
export const NEEDS_REFERENCE_IMAGE_STATUS = "needs_reference_image";
export const DRIVE_FOLDER_LOOKUP_STRATEGY = "drive_folder";
export const FOLDER_MATCH_VERIFIED = "folder_matched";
export const FOLDER_MATCH_AMBIGUOUS = "ambiguous_folder_match";

export function normalizeSkuForFolderMatch(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "")
    .replace(/[-_]+/g, "");
}

export function buildReferenceFolderIndex(folders = []) {
  const exact = new Map();
  const normalizedFolders = folders
    .map((folder) => normalizeFolder(folder))
    .filter((folder) => folder.id && folder.name && folder.normalizedName);

  for (const folder of normalizedFolders) {
    const existing = exact.get(folder.normalizedName) || [];
    existing.push(folder);
    exact.set(folder.normalizedName, existing);
  }

  return {
    folders: normalizedFolders,
    exact
  };
}

export function findReferenceFolderForSku(index, sku) {
  const target = normalizeSkuForFolderMatch(sku);
  if (!target) return { status: "missing_sku", folder: null, candidates: [] };

  const exactMatches = index.exact.get(target) || [];
  if (exactMatches.length === 1) return { status: "exact", folder: exactMatches[0], candidates: exactMatches };
  if (exactMatches.length > 1) return { status: "ambiguous", folder: null, candidates: exactMatches };

  const partialMatches = index.folders.filter((folder) => {
    if (!folder.normalizedName) return false;
    return folder.normalizedName.includes(target) || target.includes(folder.normalizedName);
  });
  if (partialMatches.length === 1) return { status: "partial", folder: partialMatches[0], candidates: partialMatches };
  if (partialMatches.length > 1) return { status: "ambiguous", folder: null, candidates: partialMatches };

  return { status: "missing", folder: null, candidates: [] };
}

export function refreshGenerationRowsWithReferenceFolders({
  generationRows = [],
  folders = [],
  rootFolderId = "",
  onlyStatuses = [NEEDS_REFERENCE_IMAGE_STATUS],
  shouldOverwriteReadyRows = false
} = {}) {
  const index = buildReferenceFolderIndex(folders);
  const statusSet = new Set(onlyStatuses.filter(Boolean));
  const shouldCheckStatus = (row) => shouldOverwriteReadyRows || statusSet.size === 0 || statusSet.has(row.generation_status);
  const summary = {
    total_rows: generationRows.length,
    folders_indexed: index.folders.length,
    matched: 0,
    exact: 0,
    partial: 0,
    ambiguous: 0,
    missing: 0,
    skipped_status: 0,
    missing_sku: 0
  };

  const rows = generationRows.map((row) => {
    if (!shouldCheckStatus(row)) {
      summary.skipped_status += 1;
      return { ...row };
    }

    const match = findReferenceFolderForSku(index, row.sku);
    if (match.status === "missing_sku") {
      summary.missing_sku += 1;
      return { ...row };
    }
    if (match.status === "missing") {
      summary.missing += 1;
      return { ...row };
    }
    if (match.status === "ambiguous") {
      summary.ambiguous += 1;
      return {
        ...row,
        reference_verified: FOLDER_MATCH_AMBIGUOUS
      };
    }

    summary.matched += 1;
    summary[match.status] += 1;
    return {
      ...row,
      reference_drive_id: match.folder.id,
      reference_parent_folder_id: rootFolderId || row.reference_parent_folder_id || "",
      reference_lookup_key: row.sku,
      reference_lookup_strategy: DRIVE_FOLDER_LOOKUP_STRATEGY,
      reference_verified: FOLDER_MATCH_VERIFIED,
      generation_status: READY_VIA_DRIVE_FOLDER_STATUS
    };
  });

  return { rows, summary };
}

function normalizeFolder(folder) {
  const id = String(folder?.id || "").trim();
  const name = String(folder?.name || "").trim();
  return {
    ...folder,
    id,
    name,
    normalizedName: normalizeSkuForFolderMatch(name)
  };
}
