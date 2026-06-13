#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { buildModelInputStagingManifest } from "../../lib/automation/model-input-staging.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Model input staging failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const referenceResolutionPath = path.resolve(options.referenceResolution || path.join(outputsDir, "reference-asset-resolution.json"));
  const stagingDir = path.resolve(options.stagingDir || path.join(outputsDir, "model-input-staging"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "model-input-staging.json"));
  const timeoutMs = Number(options.timeoutMs || 15000);
  const limitPerSku = Number(options.limitPerSku || 6);

  if (!fs.existsSync(referenceResolutionPath)) throw new Error(`Reference resolution JSON not found: ${referenceResolutionPath}`);
  const referenceResolution = JSON.parse(fs.readFileSync(referenceResolutionPath, "utf8"));
  const auth = await createGoogleDriveRestAuthFromEnv({ verbose: Boolean(options.verbose) });
  const stagedFilesByDriveId = {};

  fs.mkdirSync(stagingDir, { recursive: true });
  for (const item of referenceResolution.items || []) {
    const sku = item.sku || "unknown-sku";
    const skuDir = path.join(stagingDir, sanitizePathSegment(sku));
    fs.mkdirSync(skuDir, { recursive: true });
    const selectedAssets = (item.selected_reference_assets || []).slice(0, limitPerSku);
    for (let index = 0; index < selectedAssets.length; index += 1) {
      const asset = selectedAssets[index];
      const driveFileId = asset.drive_file_id || asset.id;
      if (!driveFileId) continue;
      const extension = extensionForAsset(asset);
      const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(asset.name || driveFileId)}${extension}`;
      const outputFilePath = path.join(skuDir, fileName);
      if (options.verbose) console.info(`Staging ${sku}/${asset.name || driveFileId}...`);
      await downloadDriveFile({ accessToken: auth.accessToken, driveFileId, outputFilePath, timeoutMs });
      const stat = fs.statSync(outputFilePath);
      stagedFilesByDriveId[driveFileId] = {
        local_path: outputFilePath,
        file_name: path.basename(outputFilePath),
        file_size: stat.size,
        sha256: hashFile(outputFilePath),
        staged_at: new Date().toISOString()
      };
    }
  }

  const manifest = buildModelInputStagingManifest({
    referenceResolution,
    stagedFilesByDriveId
  });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.info(`Model input staging wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(manifest.summary)}`);
}

async function downloadDriveFile({ accessToken, driveFileId, outputFilePath, timeoutMs }) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`);
  url.searchParams.set("alt", "media");
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }, timeoutMs, `Timed out downloading Google Drive file ${driveFileId}.`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Download failed for ${driveFileId}: ${response.status} ${response.statusText}: ${text.slice(0, 240)}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputFilePath, buffer);
}

async function createGoogleDriveRestAuthFromEnv({ verbose = false } = {}) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.");
  const tokens = await readGoogleOAuthTokens({ timeoutMs: Number(process.env.GOOGLE_DRIVE_TOKEN_READ_TIMEOUT_MS || 10000), verbose });
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google OAuth token is missing. Run npm run connect:google-drive first.");
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
  const url = new URL(`${supabaseUrl}/rest/v1/integration_tokens`);
  url.searchParams.set("id", "eq.google_drive");
  url.searchParams.set("select", "token_json");
  const data = await fetchJsonWithTimeout(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  }, timeoutMs, "Timed out reading Google OAuth token from Supabase.");
  return Array.isArray(data) ? data[0]?.token_json || {} : data?.token_json || {};
}

async function fetchJsonWithTimeout(url, options, timeoutMs, message) {
  const response = await fetchWithTimeout(url, options, timeoutMs, message);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 240)}`);
  }
  return response.json();
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

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sanitizePathSegment(value) {
  return String(value || "file").normalize("NFKC").trim().replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "file";
}

function extensionForAsset(asset = {}) {
  const name = String(asset.name || "");
  const existing = path.extname(name);
  if (existing) return "";
  if (asset.mimeType === "image/png") return ".png";
  if (asset.mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function normalizeSupabaseProjectUrl(value = "") {
  return String(value || "").trim().replace(/\/rest\/v1\/?$/i, "");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--reference-resolution") parsed.referenceResolution = args[++index];
    else if (arg === "--staging-dir") parsed.stagingDir = args[++index];
    else if (arg === "--limit-per-sku") parsed.limitPerSku = args[++index];
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
    "Usage: node scripts/automation/stage-model-inputs.mjs [options]",
    "",
    "Options:",
    "  --reference-resolution <path>  Reference asset resolution JSON.",
    "  --staging-dir <path>           Directory for staged local model inputs.",
    "  --limit-per-sku <n>            Max selected references to stage per SKU. Default: 6.",
    "  --output <path>                Output JSON path. Defaults to outputs/model-input-staging.json.",
    "  --outputs-dir <path>           Outputs directory.",
    "  --timeout-ms <ms>              Google Drive download timeout. Default: 15000.",
    "  --verbose                      Print read-only progress diagnostics without secrets."
  ].join("\n"));
  process.exit(0);
}
