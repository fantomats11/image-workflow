import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/i
];

export function isAllowedImageUpload(file = {}) {
  const mimetype = String(file.mimetype || "").trim().toLowerCase();
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  return ALLOWED_IMAGE_MIME_TYPES.has(mimetype) && ALLOWED_IMAGE_EXTENSIONS.has(extension);
}

export function validateUploadedImageFiles(filesByField = {}) {
  const files = Object.values(filesByField || {}).flat().filter(Boolean);
  const invalid = files.find((file) => !isAllowedImageUpload(file));
  if (!invalid) return { ok: true, files };
  return {
    ok: false,
    code: "unsupported_image_upload",
    error: "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP เท่านั้น"
  };
}

export function validateRemoteImageUrl(value = {}) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    return { ok: false, code: "invalid_image_url", error: "URL รูปภาพไม่ถูกต้อง" };
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    return { ok: false, code: "unsupported_image_url_protocol", error: "รองรับเฉพาะ URL แบบ http หรือ https" };
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { ok: false, code: "blocked_private_image_url", error: "ไม่อนุญาตให้ใช้ URL ภายในระบบเป็นรูปภาพอ้างอิง" };
  }

  return { ok: true, url: parsed.toString() };
}

export function parseSafeImageUrls(value, { limit = 6 } = {}) {
  const source = Array.isArray(value) ? value : parseJsonArray(value);
  return source
    .map((url) => validateRemoteImageUrl(url))
    .filter((result) => result.ok)
    .map((result) => result.url)
    .slice(0, limit);
}

export function verifyHmacSha256Base64(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(String(signature));
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function buildSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
