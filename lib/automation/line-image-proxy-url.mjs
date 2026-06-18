import { createHmac } from "node:crypto";

export const LINE_IMAGE_PROXY_TTL_SECONDS = 60 * 60 * 24 * 30;
export const LINE_IMAGE_PROXY_EXPIRY_BUCKET_SECONDS = 60 * 60 * 24;

export function buildStableLineImageProxyExpiry(now = Date.now()) {
  const nowSeconds = Math.floor(Number(now) / 1000);
  const safeNowSeconds = Number.isFinite(nowSeconds) && nowSeconds > 0
    ? nowSeconds
    : Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(safeNowSeconds / LINE_IMAGE_PROXY_EXPIRY_BUCKET_SECONDS) *
    LINE_IMAGE_PROXY_EXPIRY_BUCKET_SECONDS;
  return bucketStart + LINE_IMAGE_PROXY_TTL_SECONDS;
}

export function buildLineImageProxyUrl({ baseUrl = "", secret = "", driveFileId = "", fileName = "" } = {}) {
  const base = safeHttpsUrl(baseUrl).replace(/\/+$/, "");
  const fileId = String(driveFileId || "").trim();
  const signingSecret = String(secret || "").trim();
  if (!base || !fileId || !signingSecret) return "";
  const exp = buildStableLineImageProxyExpiry();
  const sig = createHmac("sha256", signingSecret)
    .update(`${fileId}.${exp}`)
    .digest("hex");
  const params = new URLSearchParams({ exp: String(exp), sig });
  if (fileName) params.set("name", fileName);
  return `${base}/api/public/line-image/${encodeURIComponent(fileId)}?${params.toString()}`;
}

function safeHttpsUrl(value = "") {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}
