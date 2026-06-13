import fs from "node:fs";
import path from "node:path";
import { File } from "node:buffer";

export async function createFalImageProvider({ generatedDir, timeoutMs = 30000, verbose = false } = {}) {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });

  return async function generateWithFal(request) {
    const imageUrls = [];
    for (const file of request.model_input_files || []) {
      if (!file.local_path || !fs.existsSync(file.local_path)) {
        throw new Error(`Model input file not found for ${request.request_id}: ${file.local_path || "(missing path)"}`);
      }
      const buffer = fs.readFileSync(file.local_path);
      const upload = new File([buffer], file.file_name || path.basename(file.local_path), {
        type: inferMimeType(file.file_name || file.local_path)
      });
      if (verbose) console.info(`Uploading model input for ${request.request_id}: ${upload.name}`);
      imageUrls.push(await fal.storage.upload(upload));
    }

    const input = buildFalImageInput(request, imageUrls);

    if (verbose) console.info(`Calling FAL for ${request.request_id}...`);
    const response = await withTimeout(
      fal.subscribe(process.env.FAL_IMAGE_MODEL || "openai/gpt-image-2/edit", {
        input,
        logs: Boolean(verbose)
      }),
      timeoutMs,
      `Timed out waiting for FAL generation for ${request.request_id}.`
    );
    const images = normalizeFalImages(response?.data || response, request);
    const downloadedImages = [];
    for (let index = 0; index < images.length; index += 1) {
      downloadedImages.push(await downloadGeneratedImage({
        image: images[index],
        request,
        generatedDir,
        index,
        timeoutMs
      }));
    }

    return {
      provider_request_id: response?.requestId || response?.request_id || null,
      images: downloadedImages
    };
  };
}

export function buildFalImageInput(request = {}, imageUrls = [], env = process.env) {
  const input = {
    prompt: request.prompt,
    image_urls: imageUrls,
    image_size: env.FAL_IMAGE_SIZE || "auto",
    quality: env.FAL_IMAGE_QUALITY || env.AI_GENERATION_DEFAULT_QUALITY || "medium",
    num_images: Number(env.FAL_NUM_IMAGES || 1),
    output_format: env.FAL_OUTPUT_FORMAT || "png"
  };
  if (env.OPENAI_API_KEY) input.openai_api_key = env.OPENAI_API_KEY;
  return input;
}

function normalizeFalImages(data, request) {
  const rawImages = Array.isArray(data?.images)
    ? data.images
    : Array.isArray(data?.image)
      ? data.image
      : data?.image
        ? [data.image]
        : [];
  return rawImages.map((image, index) => {
    if (typeof image === "string") return { url: image, width: null, height: null, index };
    return {
      url: image.url || image.content_url || image.file_url || "",
      width: image.width || null,
      height: image.height || null,
      contentType: image.content_type || image.mime_type || inferMimeType(`${request.request_id || "generated"}.png`),
      index
    };
  }).filter((image) => image.url);
}

async function downloadGeneratedImage({ image, request, generatedDir, index, timeoutMs }) {
  const response = await fetchWithTimeout(image.url, {}, timeoutMs, `Timed out downloading generated image for ${request.request_id}.`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Generated image download failed for ${request.request_id}: ${response.status} ${response.statusText}: ${text.slice(0, 240)}`);
  }
  const contentType = response.headers.get("content-type") || image.contentType || "image/png";
  const extension = extensionFromMimeType(contentType);
  const requestDir = path.join(generatedDir, sanitizePathSegment(request.sku || "unknown-sku"), sanitizePathSegment(request.request_id || `${request.kind || "image"}-${index + 1}`));
  fs.mkdirSync(requestDir, { recursive: true });
  const fileName = `${String(index + 1).padStart(2, "0")}${extension}`;
  const localPath = path.join(requestDir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
  return {
    ...image,
    contentType,
    local_path: localPath,
    file_name: fileName,
    file_size: buffer.length
  };
}

async function fetchWithTimeout(url, options, timeoutMs, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), Math.max(1000, Number(timeoutMs) || 30000));
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function inferMimeType(fileName = "") {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function extensionFromMimeType(contentType = "") {
  const normalized = String(contentType).split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  return ".png";
}

function sanitizePathSegment(value) {
  return String(value || "file").normalize("NFKC").trim().replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "file";
}
