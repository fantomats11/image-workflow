import { Readable } from "node:stream";

export const DRIVE_REFERENCE_STAGING_BUCKET = "product-references";

export const DRIVE_REFERENCE_STAGING_BLOCKERS = Object.freeze({
  driveFolderMissing: "drive_folder_missing",
  driveFilePermissionDenied: "drive_file_permission_denied",
  driveAltMediaFetchFailed: "drive_alt_media_fetch_failed",
  driveFileNotImage: "drive_file_not_image",
  supabaseStorageUploadFailed: "supabase_storage_upload_failed",
  supabaseStorageConflict: "supabase_storage_conflict",
  storageUrlCreateFailed: "storage_url_create_failed",
  stagedUrlMissing: "staged_url_missing"
});

const DEFAULT_MAX_REFERENCES = 8;
const SUPPORTED_IMAGE_MIME = /^image\/(jpeg|jpg|png|webp)$/i;

export async function stageCatalogDriveReferencesToSupabase({
  sku = "",
  drive,
  storage,
  files = [],
  bucket = DRIVE_REFERENCE_STAGING_BUCKET,
  maxReferences = DEFAULT_MAX_REFERENCES,
  fetchImpl = null,
  logger = () => {}
} = {}) {
  const normalizedSku = normalizeSku(sku);
  const references = [];
  const selectedFiles = Array.isArray(files) ? files.slice(0, maxReferences) : [];

  if (!normalizedSku || !selectedFiles.length) {
    return {
      sku: normalizedSku,
      bucket,
      references,
      summary: summarizeReferences(references)
    };
  }

  for (const file of selectedFiles) {
    const staged = await stageOneCatalogDriveReference({
      sku: normalizedSku,
      drive,
      storage,
      bucket,
      file,
      fetchImpl,
      logger
    });
    references.push(staged);
  }

  return {
    sku: normalizedSku,
    bucket,
    references,
    summary: summarizeReferences(references)
  };
}

export async function stageOneCatalogDriveReference({
  sku = "",
  drive,
  storage,
  bucket = DRIVE_REFERENCE_STAGING_BUCKET,
  file = {},
  fetchImpl = null,
  logger = () => {}
} = {}) {
  const normalizedSku = normalizeSku(sku);
  const driveFileId = cleanText(file.drive_file_id || file.id);
  const fileName = cleanText(file.file_name || file.name || driveFileId || "reference");
  const driveMimeType = cleanText(file.drive_mime_type || file.mime_type || file.mimeType || mimeTypeFromFileName(fileName));
  const storagePath = buildCatalogReferenceStoragePath({ sku: normalizedSku, driveFileId, fileName, mimeType: driveMimeType });
  const base = {
    id: driveFileId,
    drive_file_id: driveFileId,
    name: fileName,
    file_name: fileName,
    mimeType: driveMimeType,
    mime_type: driveMimeType,
    drive_mime_type: driveMimeType,
    width: Number(file.width || file.imageMediaMetadata?.width || 0) || 0,
    height: Number(file.height || file.imageMediaMetadata?.height || 0) || 0,
    webViewLink: file.webViewLink || "",
    thumbnailLink: file.thumbnailLink || "",
    classification: file.classification || null,
    storage_path: storagePath,
    storage_key: storagePath,
    storage_bucket: bucket,
    preview_url: "",
    generation_url: "",
    staged_url: "",
    staged_public_url: "",
    stage_available: false,
    upload_reused: false,
    download_method: "",
    staging_status: "staging_failed",
    blocker_code: "",
    blocker_message: ""
  };

  if (!driveFileId) {
    return logAndReturn(logger, { ...base, blocker_code: DRIVE_REFERENCE_STAGING_BLOCKERS.driveFolderMissing, blocker_message: "ไม่พบ Drive file id ของ reference" }, { sku: normalizedSku, bucket });
  }

  if (!SUPPORTED_IMAGE_MIME.test(driveMimeType)) {
    return logAndReturn(logger, { ...base, blocker_code: DRIVE_REFERENCE_STAGING_BLOCKERS.driveFileNotImage, blocker_message: "ไฟล์ reference จาก Drive ไม่ใช่ไฟล์ภาพที่รองรับ" }, { sku: normalizedSku, bucket });
  }

  const storageBucket = storage?.from?.(bucket);
  if (!storageBucket) {
    return logAndReturn(logger, { ...base, blocker_code: DRIVE_REFERENCE_STAGING_BLOCKERS.supabaseStorageUploadFailed, blocker_message: "Supabase Storage ยังไม่พร้อมสำหรับ stage reference" }, { sku: normalizedSku, bucket });
  }

  const existing = await findExistingCatalogObject({ storageBucket, storagePath, driveFileId });
  if (existing.ok && existing.exists) {
    const urlResult = await createGenerationUrl({ storageBucket, storagePath });
    if (!urlResult.url) {
      return logAndReturn(logger, { ...base, upload_reused: true, blocker_code: urlResult.blockerCode, blocker_message: "พบ staged object แล้วแต่ยังไม่มี URL สำหรับ Generate Hero" }, { sku: normalizedSku, bucket });
    }
    return logAndReturn(logger, {
      ...base,
      preview_url: urlResult.url,
      generation_url: urlResult.url,
      staged_url: urlResult.url,
      staged_public_url: urlResult.url,
      stage_available: true,
      upload_reused: true,
      staging_status: "staged_to_supabase"
    }, { sku: normalizedSku, bucket });
  }

  let download;
  try {
    download = await downloadDriveImageBinary({ drive, driveFileId });
  } catch (error) {
    try {
      download = await downloadPublicDriveImageBinary({
        fetchImpl,
        driveFileId,
        fileName,
        driveMimeType
      });
    } catch (fallbackError) {
      const blockerCode = isDrivePermissionDenied(error)
        ? DRIVE_REFERENCE_STAGING_BLOCKERS.driveFilePermissionDenied
        : DRIVE_REFERENCE_STAGING_BLOCKERS.driveAltMediaFetchFailed;
      return logAndReturn(logger, {
        ...base,
        blocker_code: blockerCode,
        blocker_message: blockerCode === DRIVE_REFERENCE_STAGING_BLOCKERS.driveFilePermissionDenied
          ? "ไม่มีสิทธิ์ download reference จาก Google Drive"
          : "download รูปจาก Google Drive ด้วย alt=media ไม่สำเร็จ"
      }, { sku: normalizedSku, bucket, error: fallbackError || error });
    }
  }

  const uploadContentType = download.contentType || driveMimeType;
  const upload = await storageBucket.upload(storagePath, download.body, {
    contentType: uploadContentType,
    cacheControl: "3600",
    upsert: false,
    metadata: {
      source: "google_drive",
      sku: normalizedSku,
      drive_file_id: driveFileId,
      original_name: fileName
    }
  });

  if (upload.error) {
    if (isStorageConflict(upload.error)) {
      const urlResult = await createGenerationUrl({ storageBucket, storagePath });
      if (urlResult.url) {
        return logAndReturn(logger, {
          ...base,
          preview_url: urlResult.url,
          generation_url: urlResult.url,
          staged_url: urlResult.url,
          staged_public_url: urlResult.url,
          stage_available: true,
          upload_reused: true,
          download_method: download.method,
          staging_status: "staged_to_supabase"
        }, { sku: normalizedSku, bucket, error: upload.error });
      }
      return logAndReturn(logger, {
        ...base,
        blocker_code: DRIVE_REFERENCE_STAGING_BLOCKERS.supabaseStorageConflict,
        blocker_message: "พบไฟล์ staged ซ้ำ แต่ยัง reuse URL ไม่สำเร็จ"
      }, { sku: normalizedSku, bucket, error: upload.error });
    }
    return logAndReturn(logger, {
      ...base,
      blocker_code: DRIVE_REFERENCE_STAGING_BLOCKERS.supabaseStorageUploadFailed,
      blocker_message: "upload reference เข้า Supabase Storage ไม่สำเร็จ"
    }, { sku: normalizedSku, bucket, error: upload.error });
  }

  const urlResult = await createGenerationUrl({ storageBucket, storagePath });
  if (!urlResult.url) {
    return logAndReturn(logger, {
      ...base,
      blocker_code: urlResult.blockerCode,
      blocker_message: "อัปโหลด reference สำเร็จแต่ยังไม่มี URL สำหรับ Generate Hero"
    }, { sku: normalizedSku, bucket });
  }

  return logAndReturn(logger, {
    ...base,
    preview_url: urlResult.url,
    generation_url: urlResult.url,
    staged_url: urlResult.url,
    staged_public_url: urlResult.url,
    stage_available: true,
    download_method: download.method,
    staging_status: "staged_to_supabase"
  }, { sku: normalizedSku, bucket });
}

export function buildCatalogReferenceStoragePath({
  sku = "",
  driveFileId = "",
  fileName = "",
  mimeType = ""
} = {}) {
  const normalizedSku = normalizeSku(sku) || "UNKNOWN-SKU";
  const safeDriveFileId = safeSegment(driveFileId || "drive-file");
  const extension = safeExtension(fileName) || extensionFromMimeType(mimeType) || "jpg";
  const baseName = safeSegment(stripExtension(fileName || "reference")) || "reference";
  return `catalog/${normalizedSku}/${safeDriveFileId}-${baseName}.${extension}`;
}

export function isReferenceStageGenerateReady({ catalogFound = false, driveFilesFound = false, references = [] } = {}) {
  return Boolean(
    catalogFound &&
    driveFilesFound &&
    references.some((reference) => reference.stage_available && (reference.generation_url || reference.staged_url))
  );
}

async function downloadDriveImageBinary({ drive, driveFileId }) {
  if (!drive?.files?.get) throw new Error("google_drive_client_missing");
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return {
    body: toReadableBody(response?.data),
    contentType: cleanText(response?.headers?.["content-type"] || response?.headers?.get?.("content-type") || ""),
    method: "drive_alt_media"
  };
}

async function downloadPublicDriveImageBinary({ fetchImpl, driveFileId, fileName, driveMimeType }) {
  if (typeof fetchImpl !== "function") throw new Error("public_drive_fetch_unavailable");
  const urls = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`,
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveFileId)}&export=download&confirm=t`
  ];
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        redirect: "follow",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8"
        }
      });
      if (!response?.ok) {
        lastError = new Error(`public_drive_download_failed:${response?.status || "unknown"}`);
        continue;
      }
      const contentType = resolvePublicDownloadContentType({
        responseType: response.headers?.get?.("content-type"),
        driveMimeType,
        fileName
      });
      if (!SUPPORTED_IMAGE_MIME.test(contentType)) {
        lastError = new Error(`public_drive_download_not_image:${contentType || "unknown"}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        body: toReadableBody(arrayBuffer),
        contentType,
        method: "public_drive_download"
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("public_drive_download_failed");
}

function toReadableBody(data) {
  if (!data) return Readable.from([]);
  if (typeof data.pipe === "function") return data;
  if (data instanceof ArrayBuffer) return Readable.from([Buffer.from(data)]);
  if (ArrayBuffer.isView(data)) return Readable.from([Buffer.from(data.buffer, data.byteOffset, data.byteLength)]);
  if (Buffer.isBuffer(data)) return Readable.from([data]);
  return Readable.from([Buffer.from(String(data))]);
}

async function findExistingCatalogObject({ storageBucket, storagePath, driveFileId }) {
  const parts = storagePath.split("/");
  const objectName = parts.pop();
  const prefix = parts.join("/");
  try {
    const result = await storageBucket.list(prefix, { search: `${driveFileId}-`, limit: 10 });
    if (result.error) return { ok: false, exists: false, error: result.error };
    return {
      ok: true,
      exists: (result.data || []).some((item) => item.name === objectName)
    };
  } catch (error) {
    return { ok: false, exists: false, error };
  }
}

async function createGenerationUrl({ storageBucket, storagePath }) {
  let hadError = false;
  try {
    const signed = await storageBucket.createSignedUrl?.(storagePath, 60 * 60 * 24 * 7);
    if (signed?.error) hadError = true;
    if (!signed?.error && signed?.data?.signedUrl) return { url: signed.data.signedUrl, blockerCode: "" };
  } catch {
    hadError = true;
  }

  try {
    const publicResult = storageBucket.getPublicUrl?.(storagePath);
    const publicUrl = publicResult?.data?.publicUrl || "";
    return {
      url: publicUrl,
      blockerCode: publicUrl
        ? ""
        : hadError
          ? DRIVE_REFERENCE_STAGING_BLOCKERS.storageUrlCreateFailed
          : DRIVE_REFERENCE_STAGING_BLOCKERS.stagedUrlMissing
    };
  } catch {
    return { url: "", blockerCode: DRIVE_REFERENCE_STAGING_BLOCKERS.storageUrlCreateFailed };
  }
}

function summarizeReferences(references = []) {
  return {
    file_count: references.length,
    found_files: references.length,
    stage_available_count: references.filter((reference) => reference.stage_available).length,
    stageable_image_count: references.filter((reference) => reference.stage_available).length,
    blocked_file_count: references.filter((reference) => reference.blocker_code).length,
    blockers: [...new Set(references.map((reference) => reference.blocker_code).filter(Boolean))]
  };
}

function logAndReturn(logger, reference, { sku, bucket, error } = {}) {
  logger({
    sku,
    drive_file_id: reference.drive_file_id,
    drive_file_name: reference.file_name,
    drive_mime_type: reference.drive_mime_type,
    bucket,
    storage_path: reference.storage_path,
    upload_reused: reference.upload_reused,
    download_method: reference.download_method,
    stage_available: reference.stage_available,
    blocker_code: reference.blocker_code,
    error: error ? safeError(error) : undefined
  });
  return reference;
}

function safeError(error = {}) {
  return {
    status: error.status || error.statusCode || error.code || "",
    code: error.code || "",
    message: error.message || String(error || "")
  };
}

function isDrivePermissionDenied(error = {}) {
  const status = Number(error.status || error.statusCode || error.response?.status || 0);
  const message = String(error.message || "").toLowerCase();
  return status === 401 || status === 403 || /permission|forbidden|unauthorized/.test(message);
}

function isStorageConflict(error = {}) {
  const status = Number(error.status || error.statusCode || 0);
  const message = String(error.message || error.error || "").toLowerCase();
  return status === 409 || /already exists|duplicate|resource already exists|conflict/.test(message);
}

function normalizeSku(value = "") {
  return String(value || "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "");
}

function cleanText(value = "") {
  return String(value || "").normalize("NFKC").trim();
}

function cleanContentType(value = "") {
  return cleanText(value).split(";")[0].trim().toLowerCase();
}

function resolvePublicDownloadContentType({ responseType = "", driveMimeType = "", fileName = "" } = {}) {
  const normalizedResponseType = cleanContentType(responseType);
  if (SUPPORTED_IMAGE_MIME.test(normalizedResponseType)) return normalizedResponseType;
  if (normalizedResponseType && normalizedResponseType !== "application/octet-stream") return normalizedResponseType;
  return cleanContentType(driveMimeType) || mimeTypeFromFileName(fileName);
}

function safeSegment(value = "") {
  return cleanText(value)
    .replace(/\.[A-Za-z0-9]{1,8}$/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160);
}

function stripExtension(value = "") {
  return cleanText(value).replace(/\.[A-Za-z0-9]{1,8}$/i, "");
}

function safeExtension(fileName = "") {
  const match = cleanText(fileName).toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|[?#])/);
  if (!match) return "";
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  return ["jpg", "png", "webp"].includes(extension) ? extension : "";
}

function extensionFromMimeType(mimeType = "") {
  const normalized = cleanText(mimeType).toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return "";
}

function mimeTypeFromFileName(fileName = "") {
  const extension = safeExtension(fileName);
  if (extension === "jpg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}
