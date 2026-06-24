import test from "node:test";
import assert from "node:assert/strict";
import { listGoogleDriveReferenceImageFiles } from "../../lib/automation/google-drive-reference-files.mjs";

test("listGoogleDriveReferenceImageFiles returns direct images and scans one subfolder", async () => {
  const drive = mockDrive({
    root: [
      folder("subfolder", "NFAR250003 photos"),
      image("front-root", "NFAR250003_Front.jpg")
    ],
    subfolder: [
      image("inside-sub", "NFAR250003_Inside.jpg")
    ]
  });

  const files = await listGoogleDriveReferenceImageFiles(drive, "root", { requestTimeoutMs: 1000 });

  assert.deepEqual(files.map((file) => file.id), ["subfolder", "front-root", "inside-sub"]);
  assert.equal(files.find((file) => file.id === "inside-sub").parent_folder_id, "subfolder");
});

test("listGoogleDriveReferenceImageFiles resolves image and folder shortcuts", async () => {
  const drive = mockDrive({
    root: [
      shortcut("shortcut-image", "Shortcut image", "target-image", "image/jpeg"),
      shortcut("shortcut-folder", "Shortcut folder", "target-folder", "application/vnd.google-apps.folder")
    ],
    "target-folder": [
      image("folder-target-image", "NFAR250003_Back.jpg")
    ]
  }, {
    "target-image": image("target-image", "NFAR250003_Front.jpg")
  });

  const files = await listGoogleDriveReferenceImageFiles(drive, "root", { requestTimeoutMs: 1000 });
  const imageIds = files.filter((file) => String(file.mimeType).startsWith("image/")).map((file) => file.id);

  assert.deepEqual(imageIds, ["target-image", "folder-target-image"]);
  assert.equal(files.find((file) => file.id === "target-image").shortcut_source_id, "shortcut-image");
});

test("listGoogleDriveReferenceImageFiles times out Drive list calls safely", async () => {
  const drive = {
    files: {
      list: () => new Promise(() => {}),
      get: () => {
        throw new Error("unexpected get");
      }
    }
  };

  await assert.rejects(
    () => listGoogleDriveReferenceImageFiles(drive, "root", { requestTimeoutMs: 5 }),
    /timed out/
  );
});

function mockDrive(folders = {}, filesById = {}) {
  return {
    files: {
      list: async ({ q }) => {
        const folderId = String(q).match(/'([^']+)' in parents/)?.[1] || "";
        return { data: { files: folders[folderId] || [] } };
      },
      get: async ({ fileId }) => {
        return { data: filesById[fileId] || null };
      }
    }
  };
}

function image(id, name) {
  return {
    id,
    name,
    mimeType: "image/jpeg",
    imageMediaMetadata: { width: 1200, height: 1600 }
  };
}

function folder(id, name) {
  return {
    id,
    name,
    mimeType: "application/vnd.google-apps.folder"
  };
}

function shortcut(id, name, targetId, targetMimeType) {
  return {
    id,
    name,
    mimeType: "application/vnd.google-apps.shortcut",
    shortcutDetails: { targetId, targetMimeType }
  };
}
