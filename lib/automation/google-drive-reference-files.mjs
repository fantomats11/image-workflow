export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const GOOGLE_DRIVE_SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";
export const GOOGLE_DRIVE_REFERENCE_IMAGE_MIME_PREFIX = "image/";

export async function listGoogleDriveReferenceImageFiles(drive, folderId, {
  maxDepth = 1,
  pageSize = 100,
  maxFiles = 120,
  requestTimeoutMs = 8_000
} = {}) {
  const rootFolderId = cleanDriveId(folderId);
  if (!drive || !rootFolderId) return [];

  const files = [];
  const seenFileIds = new Set();
  const seenFolderIds = new Set();
  const pendingFolders = [{ id: rootFolderId, depth: 0 }];

  while (pendingFolders.length && files.length < maxFiles) {
    const current = pendingFolders.shift();
    if (!current?.id || seenFolderIds.has(current.id) || current.depth > maxDepth) continue;
    seenFolderIds.add(current.id);

    const children = await listDriveFolderChildren(drive, current.id, { pageSize, requestTimeoutMs });
    for (const child of children) {
      if (files.length >= maxFiles) break;
      const normalized = normalizeDriveReferenceFile(child, { parentFolderId: current.id });
      if (!normalized.id || seenFileIds.has(normalized.id)) continue;
      seenFileIds.add(normalized.id);
      files.push(normalized);

      if (normalized.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && current.depth < maxDepth) {
        pendingFolders.push({ id: normalized.id, depth: current.depth + 1 });
      }

      if (normalized.mimeType === GOOGLE_DRIVE_SHORTCUT_MIME_TYPE) {
        const targetId = cleanDriveId(normalized.shortcutDetails?.targetId);
        const targetMimeType = normalized.shortcutDetails?.targetMimeType || "";
        if (!targetId) continue;

        if (targetMimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && current.depth < maxDepth) {
          pendingFolders.push({ id: targetId, depth: current.depth + 1 });
        } else if (targetMimeType.startsWith(GOOGLE_DRIVE_REFERENCE_IMAGE_MIME_PREFIX)) {
          const target = await getDriveFile(drive, targetId, { requestTimeoutMs });
          const resolvedTarget = normalizeDriveReferenceFile(target || {
            id: targetId,
            name: normalized.name,
            mimeType: targetMimeType
          }, {
            parentFolderId: current.id,
            shortcutSourceId: normalized.id
          });
          if (resolvedTarget.id && !seenFileIds.has(resolvedTarget.id)) {
            seenFileIds.add(resolvedTarget.id);
            files.push(resolvedTarget);
          }
        }
      }
    }
  }

  return files;
}

async function listDriveFolderChildren(drive, folderId, { pageSize, requestTimeoutMs }) {
  const files = [];
  let pageToken;
  do {
    const response = await driveRequestWithTimeout(
      drive.files.list({
        q: `'${escapeGoogleDriveQueryValue(folderId)}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, imageMediaMetadata(width,height), createdTime, modifiedTime, shortcutDetails(targetId,targetMimeType))",
        pageSize,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }, { timeout: requestTimeoutMs }),
      requestTimeoutMs,
      `Google Drive folder list timed out for ${folderId}`
    );
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function getDriveFile(drive, fileId, { requestTimeoutMs }) {
  const response = await driveRequestWithTimeout(
    drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, imageMediaMetadata(width,height), createdTime, modifiedTime, shortcutDetails(targetId,targetMimeType)",
      supportsAllDrives: true
    }, { timeout: requestTimeoutMs }),
    requestTimeoutMs,
    `Google Drive file read timed out for ${fileId}`
  );
  return response.data || null;
}

async function driveRequestWithTimeout(requestPromise, timeoutMs, message) {
  if (!timeoutMs) return requestPromise;
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message);
      error.code = "google_drive_reference_timeout";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([requestPromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeDriveReferenceFile(file = {}, { parentFolderId = "", shortcutSourceId = "" } = {}) {
  return {
    id: cleanDriveId(file.id),
    drive_file_id: cleanDriveId(file.id),
    parent_folder_id: cleanDriveId(parentFolderId),
    shortcut_source_id: cleanDriveId(shortcutSourceId),
    name: String(file.name || "").trim(),
    mimeType: file.mimeType || "",
    size: file.size || "",
    webViewLink: file.webViewLink || "",
    webContentLink: file.webContentLink || "",
    thumbnailLink: file.thumbnailLink || "",
    imageMediaMetadata: file.imageMediaMetadata || null,
    createdTime: file.createdTime || "",
    modifiedTime: file.modifiedTime || "",
    shortcutDetails: file.shortcutDetails || null
  };
}

function cleanDriveId(value = "") {
  return String(value || "").trim();
}

function escapeGoogleDriveQueryValue(value = "") {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
