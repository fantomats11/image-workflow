const GOOGLE_DRIVE_URL_PATTERN = /^https?:\/\/(?:drive|docs)\.google\.com\//i;

export function isApprovedExportAsset(asset = {}) {
  return String(asset.type || "").toLowerCase() === "approved_export";
}

export function getExportUrlFromAsset(asset = {}) {
  if (!isApprovedExportAsset(asset)) return "";
  const publicUrl = cleanUrl(asset.public_url);
  if (publicUrl) return publicUrl;
  const storageKey = cleanUrl(asset.storage_key);
  if (storageKey) return storageKey;
  return "";
}

export function findUsableApprovedExportAsset(assets = []) {
  return [...assets]
    .filter(isApprovedExportAsset)
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .map((asset) => {
      const exportUrl = getExportUrlFromAsset(asset);
      if (!exportUrl) return null;
      return {
        asset,
        assetId: asset.id || null,
        exportUrl,
        bucket: asset.bucket || "",
        status: isGoogleDriveExportAsset(asset, exportUrl) ? "google_drive" : "exported"
      };
    })
    .find(Boolean) || null;
}

export function shouldSkipRetryExport(assets = []) {
  const existing = findUsableApprovedExportAsset(assets);
  return {
    skip: Boolean(existing),
    existing
  };
}

export function buildExportVisibilitySummary({ approval = null, assets = [], auditEvents = [] } = {}) {
  const existing = findUsableApprovedExportAsset(assets);
  const approvalExportUrl = cleanUrl(approval?.export_path || "");
  const latestExportFailure = [...auditEvents]
    .filter((event) => isExportFailureEvent(event.event_type))
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0] || null;
  const latestSuccessAt = latestTimestamp([
    existing?.asset?.created_at,
    approvalExportUrl ? approval?.approved_at : null
  ]);
  const latestFailureAt = latestExportFailure?.created_at || null;
  const hasFailureAfterSuccess = latestFailureAt && (!latestSuccessAt || new Date(latestFailureAt) > new Date(latestSuccessAt));
  const exportUrl = approvalExportUrl || existing?.exportUrl || "";

  return {
    approved: Boolean(approval),
    exportUrl,
    exportStatus: exportUrl
      ? existing?.status || (GOOGLE_DRIVE_URL_PATTERN.test(exportUrl) ? "google_drive" : "exported")
      : hasFailureAfterSuccess ? "export_failed" : "not_exported",
    canRetryExport: Boolean((approval || existing) && !exportUrl),
    latestExportFailureCode: latestExportFailure?.event_type || ""
  };
}

export function resolveWordPressWriteGuard(env = process.env) {
  const liveWritesEnabled = parseBooleanEnv(env.WORDPRESS_LIVE_WRITES_ENABLED, false);
  const dryRun = parseBooleanEnv(env.WORDPRESS_DRY_RUN, true);
  return {
    wordpress_dry_run: dryRun,
    wordpress_live_writes_enabled: liveWritesEnabled,
    live_write_allowed: false,
    blocked: liveWritesEnabled,
    blocker: liveWritesEnabled ? "wordpress_live_write_must_remain_disabled" : ""
  };
}

function isGoogleDriveExportAsset(asset = {}, exportUrl = "") {
  return String(asset.bucket || "").toLowerCase() === "google_drive" || GOOGLE_DRIVE_URL_PATTERN.test(exportUrl);
}

function isExportFailureEvent(eventType = "") {
  const type = String(eventType || "").toLowerCase();
  return (type.includes("export") || type.includes("drive")) &&
    (type.includes("failed") || type.includes("failure") || type.includes("error"));
}

function cleanUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return text;
  return "";
}

function latestTimestamp(values = []) {
  return values
    .filter(Boolean)
    .sort((left, right) => new Date(right || 0) - new Date(left || 0))[0] || null;
}

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}
