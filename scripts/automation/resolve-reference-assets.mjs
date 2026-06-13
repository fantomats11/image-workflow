#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildReferenceAssetResolution } from "../../lib/automation/reference-asset-resolution.mjs";
import { extractDriveIdFromUrl } from "../../lib/automation/product-catalog-sheet-refresh.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Reference asset resolution failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchJsonPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "reference-asset-resolution.json"));

  if (!fs.existsSync(batchJsonPath)) throw new Error(`Batch JSON not found: ${batchJsonPath}`);
  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  const batchItems = batch.items || [];
  const filesByFolderId = options.filesJson
    ? readFilesJson(options.filesJson)
    : await listFilesForBatchFolders(batchItems, {
      timeoutMs: Number(options.timeoutMs || 15000),
      verbose: Boolean(options.verbose)
    });

  const resolution = buildReferenceAssetResolution({ batch, batchItems, filesByFolderId });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(resolution, null, 2)}\n`, "utf8");

  console.info(`Reference asset resolution wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(resolution.summary)}`);
}

async function listFilesForBatchFolders(batchItems, { timeoutMs, verbose = false } = {}) {
  if (verbose) console.info("Creating Google Drive REST auth...");
  const auth = await createGoogleDriveRestAuthFromEnv({ verbose });
  const folderIds = Array.from(new Set(batchItems.map(extractFolderIdFromItem).filter(Boolean)));
  if (verbose) console.info(`Listing ${folderIds.length} Google Drive folders...`);
  const entries = await Promise.all(folderIds.map(async (folderId) => [folderId, await listGoogleDriveChildFiles(auth, folderId, { timeoutMs, verbose })]));
  return Object.fromEntries(entries);
}

async function listGoogleDriveChildFiles(auth, folderId, { timeoutMs, verbose = false } = {}) {
  const files = [];
  let pageToken;
  do {
    if (verbose) console.info(`Listing folder ${folderId}${pageToken ? " next page" : ""}...`);
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${escapeGoogleDriveQueryValue(folderId)}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, imageMediaMetadata(width,height), createdTime, modifiedTime)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetchJsonWithTimeout(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    }, timeoutMs || 15000, `Timed out listing Google Drive folder ${folderId}.`);
    files.push(...(response.files || []));
    pageToken = response.nextPageToken;
  } while (pageToken);
  return files;
}

async function createGoogleDriveRestAuthFromEnv({ verbose = false } = {}) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.");

  if (verbose) console.info("Reading Google OAuth token...");
  const tokens = await readGoogleOAuthTokens({ timeoutMs: Number(process.env.GOOGLE_DRIVE_TOKEN_READ_TIMEOUT_MS || 10000), verbose });
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google OAuth token is missing. Run npm run connect:google-drive first, or pass --files-json.");
  }

  if (tokens.refresh_token) {
    if (verbose) console.info("Refreshing Google OAuth access token...");
    const refreshed = await fetchJsonWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      })
    }, Number(process.env.GOOGLE_DRIVE_TOKEN_READ_TIMEOUT_MS || 10000), "Timed out refreshing Google OAuth access token.");
    if (!refreshed.access_token) throw new Error("Google OAuth refresh did not return an access token.");
    return { accessToken: refreshed.access_token };
  }
  return { accessToken: tokens.access_token };
}

async function readGoogleOAuthTokens({ timeoutMs = 10000, verbose = false } = {}) {
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_PATH?.trim();
  if (tokenPath && fs.existsSync(path.resolve(tokenPath))) {
    if (verbose) console.info("Using Google OAuth token file.");
    return JSON.parse(fs.readFileSync(path.resolve(tokenPath), "utf8"));
  }

  const supabaseUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL?.trim());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return {};

  if (verbose) console.info("Reading Google OAuth token from Supabase...");
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/integration_tokens`);
    url.searchParams.set("id", "eq.google_drive");
    url.searchParams.set("select", "token_json");
    const data = await fetchJsonWithTimeout(
      url,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      },
      timeoutMs,
      "Timed out reading Google OAuth token from Supabase. Run npm run connect:google-drive, set GOOGLE_DRIVE_TOKEN_PATH to an existing token file, or pass --files-json."
    );
    return Array.isArray(data) ? data[0]?.token_json || {} : data?.token_json || {};
  } catch (error) {
    throw error;
  }
}

function readFilesJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  throw new Error("--files-json must be an object keyed by Drive folder id.");
}

function extractFolderIdFromItem(item = {}) {
  return item.reference_drive_id || extractDriveIdFromUrl(item.reference_url || item.metadata?.reference_url || "");
}

function escapeGoogleDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeSupabaseProjectUrl(value = "") {
  return String(value || "").trim().replace(/\/rest\/v1\/?$/i, "");
}

async function fetchJsonWithTimeout(url, options, timeoutMs, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 240)}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--files-json") parsed.filesJson = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
    else if (arg === "--verbose") parsed.verbose = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/resolve-reference-assets.mjs [options]",
    "",
    "Options:",
    "  --batch-json <path>     Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --files-json <path>     Optional JSON object keyed by Drive folder id, for offline/dry tests.",
    "  --timeout-ms <ms>       Google Drive request timeout. Default: 15000.",
    "  --verbose               Print read-only progress diagnostics without secrets.",
    "  --output <path>         Output JSON path. Defaults to outputs/reference-asset-resolution.json.",
    "  --outputs-dir <path>    Outputs directory."
  ].join("\n"));
  process.exit(0);
}
