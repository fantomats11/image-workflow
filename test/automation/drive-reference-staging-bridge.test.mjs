import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  DRIVE_REFERENCE_STAGING_BLOCKERS,
  buildCatalogReferenceStoragePath,
  stageCatalogDriveReferencesToSupabase
} from "../../lib/automation/drive-reference-staging-bridge.mjs";

test("stageCatalogDriveReferencesToSupabase downloads Drive image with alt=media and uploads to canonical catalog cache path", async () => {
  const drive = mockDrive({ "drive-front": Buffer.from("front-image") });
  const storage = mockStorage();

  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive,
    storage,
    files: [
      { id: "drive-front", name: "FSTR240017 Front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.summary.stage_available_count, 1);
  assert.equal(result.references[0].stage_available, true);
  assert.equal(result.references[0].drive_file_id, "drive-front");
  assert.equal(result.references[0].file_name, "FSTR240017 Front.jpg");
  assert.equal(result.references[0].drive_mime_type, "image/jpeg");
  assert.equal(result.references[0].storage_path, "catalog/FSTR240017/drive-front-FSTR240017_Front.jpg");
  assert.equal(result.references[0].generation_url, "https://storage.example.test/product-references/catalog/FSTR240017/drive-front-FSTR240017_Front.jpg?sig=1");
  assert.equal(result.references[0].staged_url, result.references[0].generation_url);
  assert.equal(result.references[0].preview_url, result.references[0].generation_url);
  assert.equal(result.references[0].upload_reused, false);
  assert.equal(result.references[0].blocker_code, "");
  assert.deepEqual(drive.mediaGets, [{ fileId: "drive-front", alt: "media" }]);
  assert.deepEqual(storage.uploads.map((upload) => [upload.bucket, upload.path, upload.options.contentType, upload.options.upsert]), [
    ["product-references", "catalog/FSTR240017/drive-front-FSTR240017_Front.jpg", "image/jpeg", false]
  ]);
});

test("stageCatalogDriveReferencesToSupabase reuses existing staged object for the same SKU and Drive file id", async () => {
  const drive = mockDrive({ "drive-front": Buffer.from("front-image") });
  const storage = mockStorage({
    existingPaths: ["catalog/FSTR240017/drive-front-FSTR240017_Front.jpg"]
  });

  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "fstr240017",
    drive,
    storage,
    files: [
      { id: "drive-front", name: "FSTR240017 Front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, true);
  assert.equal(result.references[0].upload_reused, true);
  assert.equal(result.references[0].storage_path, "catalog/FSTR240017/drive-front-FSTR240017_Front.jpg");
  assert.equal(drive.mediaGets.length, 0);
  assert.equal(storage.uploads.length, 0);
});

test("stageCatalogDriveReferencesToSupabase blocks non-image Drive files with drive_file_not_image", async () => {
  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive: mockDrive({}),
    storage: mockStorage(),
    files: [
      { id: "drive-pdf", name: "manual.pdf", mimeType: "application/pdf" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, false);
  assert.equal(result.references[0].blocker_code, DRIVE_REFERENCE_STAGING_BLOCKERS.driveFileNotImage);
  assert.match(result.references[0].blocker_message, /ไม่ใช่ไฟล์ภาพ/);
});

test("stageCatalogDriveReferencesToSupabase reports Drive alt=media failures without hiding the blocker layer", async () => {
  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive: mockDrive({ "drive-front": new Error("socket closed") }),
    storage: mockStorage(),
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, false);
  assert.equal(result.references[0].blocker_code, DRIVE_REFERENCE_STAGING_BLOCKERS.driveAltMediaFetchFailed);
  assert.equal(result.summary.stage_available_count, 0);
});

test("stageCatalogDriveReferencesToSupabase falls back to public Drive download when alt=media is blocked", async () => {
  const error = new Error("permission denied");
  error.status = 403;
  const drive = mockDrive({ "drive-front": error });
  const storage = mockStorage();
  const fetchCalls = [];

  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive,
    storage,
    fetchImpl: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === "content-type" ? "image/jpeg" : "" },
        arrayBuffer: async () => Uint8Array.from(Buffer.from("public-drive-image")).buffer
      };
    },
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, true);
  assert.equal(result.references[0].blocker_code, "");
  assert.equal(result.references[0].download_method, "public_drive_download");
  assert.equal(result.summary.stage_available_count, 1);
  assert.deepEqual(drive.mediaGets, [{ fileId: "drive-front", alt: "media" }]);
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0], /^https:\/\/drive\.google\.com\/uc\?export=download&id=drive-front/);
  assert.deepEqual(storage.uploads.map((upload) => [upload.bucket, upload.path, upload.options.contentType]), [
    ["product-references", "catalog/FSTR240017/drive-front-front.jpg", "image/jpeg"]
  ]);
});

test("stageCatalogDriveReferencesToSupabase accepts public Drive octet-stream downloads when Drive metadata says image", async () => {
  const drive = mockDrive({ "drive-front": new Error("socket closed") });
  const storage = mockStorage();

  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive,
    storage,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/octet-stream" : "" },
      arrayBuffer: async () => Uint8Array.from(Buffer.from("public-drive-image")).buffer
    }),
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, true);
  assert.equal(result.references[0].download_method, "public_drive_download");
  assert.equal(storage.uploads[0].options.contentType, "image/jpeg");
});

test("stageCatalogDriveReferencesToSupabase reports Drive permission failures with a staff-safe blocker", async () => {
  const error = new Error("permission denied");
  error.status = 403;
  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive: mockDrive({ "drive-front": error }),
    storage: mockStorage(),
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, false);
  assert.equal(result.references[0].blocker_code, DRIVE_REFERENCE_STAGING_BLOCKERS.driveFilePermissionDenied);
  assert.match(result.references[0].blocker_message, /ไม่มีสิทธิ์/);
});

test("stageCatalogDriveReferencesToSupabase reports storage URL creation failure separately from upload", async () => {
  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive: mockDrive({ "drive-front": Buffer.from("front-image") }),
    storage: mockStorage({ signedUrlError: new Error("signed url denied"), publicUrl: "" }),
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, false);
  assert.equal(result.references[0].blocker_code, DRIVE_REFERENCE_STAGING_BLOCKERS.storageUrlCreateFailed);
});

test("stageCatalogDriveReferencesToSupabase reports staged_url_missing when storage APIs succeed but no URL is returned", async () => {
  const result = await stageCatalogDriveReferencesToSupabase({
    sku: "FSTR240017",
    drive: mockDrive({ "drive-front": Buffer.from("front-image") }),
    storage: mockStorage({ signedUrl: "", publicUrl: "" }),
    files: [
      { id: "drive-front", name: "front.jpg", mimeType: "image/jpeg" }
    ],
    logger: () => {}
  });

  assert.equal(result.references[0].stage_available, false);
  assert.equal(result.references[0].blocker_code, DRIVE_REFERENCE_STAGING_BLOCKERS.stagedUrlMissing);
});

test("buildCatalogReferenceStoragePath keeps legacy job upload path separate from catalog cache path", () => {
  assert.equal(
    buildCatalogReferenceStoragePath({ sku: "NF AR 250003", driveFileId: "drive-id", fileName: "front shot.png" }),
    "catalog/NFAR250003/drive-id-front_shot.png"
  );
  assert.doesNotMatch(
    buildCatalogReferenceStoragePath({ sku: "NFAR250003", driveFileId: "drive-id", fileName: "front.png" }),
    /^jobs\//
  );
});

function mockDrive(mediaById = {}) {
  const mediaGets = [];
  return {
    mediaGets,
    files: {
      get: async (params) => {
        if (params.alt !== "media") return { data: {} };
        mediaGets.push({ fileId: params.fileId, alt: params.alt });
        const payload = mediaById[params.fileId];
        if (payload instanceof Error) throw payload;
        return { data: Readable.from([payload || Buffer.from("image")]) };
      }
    }
  };
}

function mockStorage({ existingPaths = [], signedUrlError = null, signedUrl = null, publicUrl = null } = {}) {
  const uploads = [];
  return {
    uploads,
    from(bucket) {
      return {
        list: async (prefix, options = {}) => {
          const found = existingPaths
            .filter((path) => path.startsWith(`${prefix}/`))
            .map((path) => ({ name: path.split("/").pop() }))
            .filter((item) => !options.search || item.name.includes(options.search));
          return { data: found, error: null };
        },
        upload: async (storagePath, body, options = {}) => {
          for await (const _chunk of body) {
            // Drain stream so byte-limit and stream errors are exercised.
          }
          uploads.push({ bucket, path: storagePath, options });
          return { data: { path: storagePath }, error: null };
        },
        createSignedUrl: async (storagePath) => {
          if (signedUrlError) return { data: null, error: signedUrlError };
          return {
            data: { signedUrl: signedUrl === null ? `https://storage.example.test/${bucket}/${storagePath}?sig=1` : signedUrl },
            error: null
          };
        },
        getPublicUrl: (storagePath) => ({
          data: { publicUrl: publicUrl === null ? `https://storage.example.test/${bucket}/${storagePath}` : publicUrl }
        })
      };
    }
  };
}
