import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { readCsvObjects, writeCsvObjects } from "../../lib/automation/csv.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import {
  refreshGenerationRowsWithReferenceFolders
} from "../../lib/automation/reference-folder-refresh.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

loadLocalEnv(path.join(repoRoot, ".env"));

main().catch((error) => {
  console.error(`Reference folder refresh failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const generationInputPath = path.resolve(options.input || path.join(outputsDir, "generation-input-catalog.csv"));
  const outputPath = path.resolve(options.output || generationInputPath);
  const rootFolderId = options.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  const shouldWrite = Boolean(options.write);

  if (!fs.existsSync(generationInputPath)) {
    throw new Error(`Generation input CSV not found: ${generationInputPath}`);
  }
  if (!rootFolderId) {
    throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER_ID or --root-folder-id.");
  }

  const generationRows = readCsvObjects(generationInputPath);
  const folders = options.foldersJson
    ? readFoldersJson(options.foldersJson)
    : await listGoogleDriveChildFoldersFromEnv(rootFolderId);

  const { rows, summary } = refreshGenerationRowsWithReferenceFolders({
    generationRows,
    folders,
    rootFolderId,
    shouldOverwriteReadyRows: Boolean(options.overwriteReady)
  });

  const brandSummary = summarizeMatchedBrands(generationRows, rows);
  const previewPath = shouldWrite
    ? outputPath
    : path.join(outputsDir, "generation-input-catalog.reference-refresh.preview.csv");
  writeCsvObjects(previewPath, rows);

  const summaryPath = path.join(outputsDir, "reference-folder-refresh-summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    ...summary,
    matched_by_business_source: brandSummary,
    wrote_csv: shouldWrite,
    output_path: previewPath
  }, null, 2)}\n`, "utf8");

  console.info(`Reference folder refresh ${shouldWrite ? "wrote" : "previewed"}: ${previewPath}`);
  console.info(`Summary: ${JSON.stringify({ ...summary, matched_by_business_source: brandSummary })}`);
  console.info(`Summary file: ${summaryPath}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--overwrite-ready") {
      parsed.overwriteReady = true;
    } else if (arg === "--folders-json") {
      parsed.foldersJson = args[++index];
    } else if (arg === "--input") {
      parsed.input = args[++index];
    } else if (arg === "--output") {
      parsed.output = args[++index];
    } else if (arg === "--outputs-dir") {
      parsed.outputsDir = args[++index];
    } else if (arg === "--root-folder-id") {
      parsed.rootFolderId = args[++index];
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/refresh-reference-folder-lookup.mjs [options]",
    "",
    "Options:",
    "  --write                 Replace generation-input-catalog.csv. Without this, writes a preview CSV.",
    "  --overwrite-ready       Re-match rows that are already ready_via_drive_folder_lookup.",
    "  --folders-json <path>   Use a JSON folder list instead of Google Drive API.",
    "  --input <path>          Input generation CSV path.",
    "  --output <path>         Output CSV path when --write is used.",
    "  --outputs-dir <path>    Outputs directory. Defaults to ../../outputs from the repo root.",
    "  --root-folder-id <id>   Google Drive product_photos root folder id."
  ].join("\n"));
  process.exit(0);
}

function readFoldersJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.files)) return parsed.files;
  if (Array.isArray(parsed.folders)) return parsed.folders;
  throw new Error("--folders-json must contain an array, files array, or folders array.");
}

async function listGoogleDriveChildFoldersFromEnv(rootFolderIdValue) {
  const drive = await createGoogleDriveClientFromEnv();
  const folders = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${escapeGoogleDriveQueryValue(rootFolderIdValue)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    folders.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return folders;
}

async function createGoogleDriveClientFromEnv() {
  const authMode = String(process.env.GOOGLE_DRIVE_AUTH_MODE || "").trim().toLowerCase();
  const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON?.trim();
  const applicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_PATH?.trim();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "http://localhost:3000/auth/google/callback";

  if (authMode === "oauth") {
    if (!clientId || !clientSecret || !tokenPath) {
      throw new Error("Google Drive OAuth config is incomplete. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_DRIVE_TOKEN_PATH, or run with --folders-json.");
    }
    const tokens = await readGoogleOAuthTokens(tokenPath);
    if (!tokens.refresh_token && !tokens.access_token) {
      throw new Error("Google Drive token is missing. Connect OAuth at /api/google/oauth/start, or run with --folders-json.");
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials(tokens);
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  if (!credentialsJson && !applicationCredentials) {
    throw new Error("Google Drive credentials are missing. Add GOOGLE_DRIVE_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS, or run with --folders-json.");
  }

  const auth = credentialsJson
    ? new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsJson),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    })
    : new google.auth.GoogleAuth({
      keyFile: path.resolve(applicationCredentials),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

async function readGoogleOAuthTokens(tokenPath) {
  const resolvedTokenPath = path.resolve(tokenPath);
  if (fs.existsSync(resolvedTokenPath)) {
    return JSON.parse(fs.readFileSync(resolvedTokenPath, "utf8"));
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return {};

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data, error } = await supabase
    .from("integration_tokens")
    .select("token_json")
    .eq("id", "google_drive")
    .maybeSingle();
  if (error) throw error;
  return data?.token_json || {};
}

function escapeGoogleDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function summarizeMatchedBrands(beforeRows, afterRows) {
  return afterRows.reduce((summary, row, index) => {
    const before = beforeRows[index] || {};
    if (before.generation_status === row.generation_status && before.reference_drive_id === row.reference_drive_id) {
      return summary;
    }
    const key = String(row.business_source || row.product_type || "unknown").trim() || "unknown";
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}
