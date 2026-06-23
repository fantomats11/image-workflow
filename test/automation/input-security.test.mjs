import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  buildSecurityHeaders,
  isAllowedImageUpload,
  parseSafeImageUrls,
  validateRemoteImageUrl,
  validateUploadedImageFiles,
  verifyHmacSha256Base64
} from "../../lib/security/input-security.mjs";

test("LINE webhook HMAC helper accepts valid signature and rejects invalid signature", () => {
  const secret = "line-secret-for-test";
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const signature = createHmac("sha256", secret).update(body).digest("base64");

  assert.equal(verifyHmacSha256Base64(body, signature, secret), true);
  assert.equal(verifyHmacSha256Base64(body, "bad-signature", secret), false);
  assert.equal(verifyHmacSha256Base64(body, signature, ""), false);
});

test("image upload validation accepts only supported image mimetype and extension pairs", () => {
  const png = { originalname: "front.png", mimetype: "image/png" };
  const disguisedScript = { originalname: "front.png", mimetype: "text/javascript" };
  const unsupportedGif = { originalname: "front.gif", mimetype: "image/gif" };

  assert.equal(isAllowedImageUpload(png), true);
  assert.equal(isAllowedImageUpload(disguisedScript), false);
  assert.equal(isAllowedImageUpload(unsupportedGif), false);

  assert.deepEqual(validateUploadedImageFiles({ productImages: [png] }).ok, true);
  assert.deepEqual(validateUploadedImageFiles({ productImages: [png, disguisedScript] }), {
    ok: false,
    code: "unsupported_image_upload",
    error: "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP เท่านั้น"
  });
});

test("remote image URL validation blocks unsupported and private targets", () => {
  assert.equal(validateRemoteImageUrl("https://v3b.fal.media/files/b/image.png").ok, true);
  assert.equal(validateRemoteImageUrl("file:///tmp/image.png").code, "unsupported_image_url_protocol");
  assert.equal(validateRemoteImageUrl("http://localhost:8765/.env").code, "blocked_private_image_url");
  assert.equal(validateRemoteImageUrl("http://127.0.0.1:8765/image.png").code, "blocked_private_image_url");
});

test("parseSafeImageUrls drops unsafe reference URLs and keeps public image URLs", () => {
  const urls = parseSafeImageUrls(JSON.stringify([
    "https://cdn.example.test/front.jpg",
    "http://localhost:8765/private.png",
    "ftp://cdn.example.test/back.jpg"
  ]));

  assert.deepEqual(urls, ["https://cdn.example.test/front.jpg"]);
});

test("security headers helper returns safe defaults without CSP risk", () => {
  assert.deepEqual(buildSecurityHeaders(), {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
});
