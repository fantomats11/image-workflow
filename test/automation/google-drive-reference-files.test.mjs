import test from "node:test";
import assert from "node:assert/strict";
import {
  findGoogleDriveChildFolderByExactName,
  listGoogleDriveReferenceImageFiles,
  parsePublicGoogleDriveFolderImageFiles
} from "../../lib/automation/google-drive-reference-files.mjs";

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

test("listGoogleDriveReferenceImageFiles falls back to public Drive folder HTML", async () => {
  const drive = mockDrive({ root: [] });
  const files = await listGoogleDriveReferenceImageFiles(drive, "root", {
    requestTimeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      text: async () => [
        '<div data-id="12_un_ToqQ-iXHNi6jjfxNm0PROaZZHiQ" data-tooltip="FSTR240017_Front_1780718357569.jpg Image"></div>',
        '<div data-id="1pcW26EJIMly9JCQ4cJGQIGqssepWz21f" data-tooltip="FSTR240017_Back_1780718358739.jpg Image"></div>'
      ].join("")
    })
  });

  assert.deepEqual(files.map((file) => file.id), [
    "12_un_ToqQ-iXHNi6jjfxNm0PROaZZHiQ",
    "1pcW26EJIMly9JCQ4cJGQIGqssepWz21f"
  ]);
  assert.equal(files[0].mimeType, "image/jpeg");
  assert.equal(files[0].parent_folder_id, "root");
});

test("listGoogleDriveReferenceImageFiles uses public fallback when Drive API list fails", async () => {
  const drive = {
    files: {
      list: async () => {
        throw new Error("Drive API cannot list public folder");
      },
      get: async () => null
    }
  };
  const files = await listGoogleDriveReferenceImageFiles(drive, "root", {
    requestTimeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      text: async () => '<div data-id="public-image-12345" data-tooltip="FSTR240017_Front.jpg Image"></div>'
    })
  });

  assert.deepEqual(files.map((file) => file.id), ["public-image-12345"]);
});

test("listGoogleDriveReferenceImageFiles preserves Drive API failure when public fallback has no files", async () => {
  const drive = {
    files: {
      list: async () => {
        throw new Error("Drive API cannot list private folder");
      },
      get: async () => null
    }
  };

  await assert.rejects(
    () => listGoogleDriveReferenceImageFiles(drive, "root", {
      requestTimeoutMs: 1000,
      fetchImpl: async () => ({ ok: true, text: async () => "" })
    }),
    /private folder/
  );
});

test("parsePublicGoogleDriveFolderImageFiles dedupes public Drive cards", () => {
  const files = parsePublicGoogleDriveFolderImageFiles([
    '<div data-id="file-public-12345" data-tooltip="FSTR240017_Front.jpg Image"></div>',
    '<div data-id="file-public-12345" data-tooltip="FSTR240017_Front.jpg Image"></div>',
    '<div data-id="file-public-67890" data-tooltip="FSTR240017_Detail.png Image"></div>'
  ].join(""), { parentFolderId: "folder-public" });

  assert.deepEqual(files.map((file) => [file.id, file.name, file.mimeType]), [
    ["file-public-12345", "FSTR240017_Front.jpg", "image/jpeg"],
    ["file-public-67890", "FSTR240017_Detail.png", "image/png"]
  ]);
});

test("findGoogleDriveChildFolderByExactName resolves a SKU folder under a source folder", async () => {
  const drive = mockDrive({
    "source-root": [
      folder("target-folder", "FSTR260021"),
      folder("other-folder", "FSTR260022")
    ]
  });

  const match = await findGoogleDriveChildFolderByExactName(drive, "source-root", "fstr 260021", { requestTimeoutMs: 1000 });

  assert.equal(match?.id, "target-folder");
  assert.equal(match?.name, "FSTR260021");
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
