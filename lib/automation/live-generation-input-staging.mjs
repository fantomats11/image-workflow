import fs from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 30000;

export async function stageMediaManifestAssetsForLiveGeneration({
  mediaManifest = null,
  stagingDir,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (!mediaManifest) return null;
  if (!stagingDir) throw new Error("stagingDir is required.");
  const stagedAssets = [];
  for (const asset of mediaManifest.assets || []) {
    stagedAssets.push(await stageAssetLike({
      source: asset,
      sku: asset.sku || "unknown-sku",
      role: asset.kind || asset.type || "media",
      stagingDir,
      fetchImpl,
      timeoutMs
    }));
  }
  return {
    ...mediaManifest,
    assets: stagedAssets,
    items: Array.isArray(mediaManifest.items)
      ? mediaManifest.items.map((item) => ({
        ...item,
        assets: (item.assets || []).map((asset) => {
          const staged = stagedAssets.find((candidate) => String(candidate.id || "") === String(asset.id || ""));
          return staged || asset;
        })
      }))
      : mediaManifest.items
  };
}

export async function buildReferenceStagingManifestFromBatchItems({
  batchItems = [],
  stagingDir,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date()
} = {}) {
  if (!stagingDir) throw new Error("stagingDir is required.");
  const items = [];
  for (const item of batchItems || []) {
    const sources = collectReferenceSources(item).slice(0, 8);
    const stagedReferenceAssets = [];
    for (const source of sources) {
      stagedReferenceAssets.push(await stageAssetLike({
        source,
        sku: item.sku || source.sku || "unknown-sku",
        role: "reference",
        stagingDir,
        fetchImpl,
        timeoutMs
      }));
    }
    const stagedCount = stagedReferenceAssets.filter((asset) => asset.staging_status === "staged_local_file").length;
    items.push({
      sku: item.sku || "",
      brand_id: item.brand_id || item.metadata?.brand_id || "",
      target_site: item.target_site || item.metadata?.target_site || "",
      product_name: item.product_name || item.metadata?.product_name || "",
      reference_folder_id: item.metadata?.reference_folder_id || "",
      staging_status: stagedCount === stagedReferenceAssets.length && stagedReferenceAssets.length
        ? "model_inputs_staged"
        : "needs_model_input_staging",
      blockers: stagedCount === stagedReferenceAssets.length && stagedReferenceAssets.length
        ? []
        : ["missing_staged_reference_file"],
      selected_reference_count: stagedReferenceAssets.length,
      staged_reference_count: stagedCount,
      staged_reference_assets: stagedReferenceAssets
    });
  }
  return {
    manifest_type: "model_input_staging",
    batch_id: null,
    dry_run: true,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    staged_locally: true,
    proposed_execution_scope: "local_model_input_files",
    summary: summarizeItems(items),
    items
  };
}

function collectReferenceSources(item = {}) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const candidates = [
    ...(Array.isArray(item.reference_images) ? item.reference_images : []),
    ...(Array.isArray(metadata.reference_images) ? metadata.reference_images : []),
    ...(Array.isArray(metadata.selected_reference_assets) ? metadata.selected_reference_assets : []),
    ...(Array.isArray(metadata.reference_resolution?.selected_reference_assets)
      ? metadata.reference_resolution.selected_reference_assets
      : [])
  ];
  const referenceUrl = item.reference_url || metadata.reference_url || "";
  if (referenceUrl && isDirectDownloadUrl(referenceUrl)) {
    candidates.push({ id: "reference-url", name: path.basename(new URL(referenceUrl).pathname), public_url: referenceUrl });
  }
  const seen = new Set();
  return candidates
    .map(normalizeReferenceSource)
    .filter((source) => {
      const url = source.url || source.local_path;
      if (!url) return false;
      const key = `${source.id || ""}:${url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeReferenceSource(source = {}) {
  return {
    id: source.id || source.asset_id || source.drive_file_id || null,
    drive_file_id: source.drive_file_id || source.id || null,
    name: source.name || source.file_name || source.filename || "",
    file_name: source.file_name || source.name || source.filename || "",
    mimeType: source.mimeType || source.mime_type || source.source_mime_type || "",
    url: source.url || source.public_url || source.signed_url || source.proxy_url || source.webContentLink || "",
    public_url: source.public_url || source.url || source.signed_url || source.proxy_url || "",
    local_path: source.local_path || ""
  };
}

async function stageAssetLike({ source = {}, sku, role, stagingDir, fetchImpl, timeoutMs }) {
  const existingLocalPath = source.local_path || "";
  if (existingLocalPath && fs.existsSync(existingLocalPath)) {
    const stat = fs.statSync(existingLocalPath);
    return {
      ...source,
      local_path: existingLocalPath,
      file_name: source.file_name || source.name || path.basename(existingLocalPath),
      file_size: source.file_size || stat.size,
      staging_status: "staged_local_file"
    };
  }

  const url = source.public_url || source.url || "";
  if (!isDirectDownloadUrl(url)) {
    return {
      ...source,
      local_path: "",
      file_name: source.file_name || source.name || "",
      file_size: 0,
      staging_status: "missing_staged_file"
    };
  }

  try {
    const response = await fetchWithTimeout({ url, fetchImpl, timeoutMs });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type") || source.mimeType || source.mime_type || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = safeFileName(source.file_name || source.name || path.basename(new URL(url).pathname) || `${role}${extensionFromMimeType(contentType)}`);
    const localDir = path.join(stagingDir, safePathSegment(String(sku || "unknown-sku")), safePathSegment(role || "input"));
    fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, fileName);
    fs.writeFileSync(localPath, buffer);
    return {
      ...source,
      local_path: localPath,
      file_name: fileName,
      file_size: buffer.length,
      source_name: source.source_name || source.name || fileName,
      source_mime_type: contentType,
      staging_status: "staged_local_file"
    };
  } catch (error) {
    return {
      ...source,
      local_path: "",
      file_name: source.file_name || source.name || "",
      file_size: 0,
      staging_status: "missing_staged_file",
      staging_error: error?.message || String(error)
    };
  }
}

async function fetchWithTimeout({ url, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeItems(items) {
  return {
    sku_count: items.length,
    model_inputs_staged: items.filter((item) => item.staging_status === "model_inputs_staged").length,
    needs_model_input_staging: items.filter((item) => item.staging_status !== "model_inputs_staged").length,
    selected_reference_assets: items.reduce((total, item) => total + item.selected_reference_count, 0),
    staged_reference_assets: items.reduce((total, item) => total + item.staged_reference_count, 0),
    missing_staged_reference_files: items.reduce(
      (total, item) => total + item.staged_reference_assets.filter((asset) => asset.staging_status !== "staged_local_file").length,
      0
    )
  };
}

function isDirectDownloadUrl(value = "") {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function safePathSegment(value = "") {
  return String(value || "file").normalize("NFKC").trim().replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "file";
}

function safeFileName(value = "") {
  const name = safePathSegment(value || "input");
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.jpg`;
}

function extensionFromMimeType(contentType = "") {
  const normalized = String(contentType).split(";")[0].trim().toLowerCase();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  return ".jpg";
}
