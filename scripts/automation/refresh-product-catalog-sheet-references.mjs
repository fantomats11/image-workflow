#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { readCsvObjects, writeCsvObjects } from "../../lib/automation/csv.mjs";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import {
  extractProductCatalogRowsFromSheetGrid,
  refreshGenerationRowsWithProductCatalogSheet
} from "../../lib/automation/product-catalog-sheet-refresh.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

loadLocalEnv(path.join(repoRoot, ".env"));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Product Catalog sheet reference refresh failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const generationInputPath = path.resolve(options.input || path.join(outputsDir, "generation-input-catalog.csv"));
  const outputPath = path.resolve(options.output || generationInputPath);
  const previewPath = path.join(outputsDir, "generation-input-catalog.product-catalog-sheet.preview.csv");
  const summaryPath = path.join(outputsDir, "product-catalog-sheet-refresh-summary.json");
  const spreadsheetId = options.spreadsheetId || process.env.PRODUCT_CATALOG_SPREADSHEET_ID;
  const sheetName = options.sheetName || process.env.PRODUCT_CATALOG_SHEET_NAME || "Sheet1";
  const shouldWrite = Boolean(options.write);

  if (!spreadsheetId) throw new Error("Missing PRODUCT_CATALOG_SPREADSHEET_ID or --spreadsheet-id.");
  if (!fs.existsSync(generationInputPath)) {
    throw new Error(`Generation input CSV not found: ${generationInputPath}`);
  }

  const rowData = await fetchProductCatalogSheetRows({ spreadsheetId, sheetName });
  const productCatalogRows = extractProductCatalogRowsFromSheetGrid(rowData);
  const generationRows = readCsvObjects(generationInputPath);
  const { rows, summary } = refreshGenerationRowsWithProductCatalogSheet({
    generationRows,
    productCatalogRows,
    shouldOverwriteReadyRows: Boolean(options.overwriteReady)
  });

  const destinationPath = shouldWrite ? outputPath : previewPath;
  writeCsvObjects(destinationPath, rows);
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    ...summary,
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    wrote_csv: shouldWrite,
    output_path: destinationPath
  }, null, 2)}\n`, "utf8");

  console.info(`Product Catalog sheet reference refresh ${shouldWrite ? "wrote" : "previewed"}: ${destinationPath}`);
  console.info(`Summary: ${JSON.stringify(summary)}`);
  console.info(`Summary file: ${summaryPath}`);
}

export async function fetchProductCatalogSheetRows({ spreadsheetId, sheetName }) {
  const sheets = await createGoogleSheetsClientFromEnv();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`${sheetName}!A:O`],
    includeGridData: true,
    fields: "sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue,effectiveValue,textFormatRuns,chipRuns))))"
  });
  return response.data.sheets?.[0]?.data?.[0]?.rowData || [];
}

async function createGoogleSheetsClientFromEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "http://127.0.0.1:8765/api/google/oauth/callback";
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.");
  }
  const tokens = await readGoogleOAuthTokens();
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google OAuth token is missing. Run npm run connect:google-drive first.");
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials(tokens);
  return google.sheets({ version: "v4", auth: oauth2Client });
}

async function readGoogleOAuthTokens() {
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_PATH?.trim();
  if (tokenPath && fs.existsSync(path.resolve(tokenPath))) {
    return JSON.parse(fs.readFileSync(path.resolve(tokenPath), "utf8"));
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return {};

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase
    .from("integration_tokens")
    .select("token_json")
    .eq("id", "google_drive")
    .maybeSingle();
  if (error) throw error;
  return data?.token_json || {};
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--overwrite-ready") {
      parsed.overwriteReady = true;
    } else if (arg === "--spreadsheet-id") {
      parsed.spreadsheetId = args[++index];
    } else if (arg === "--sheet-name") {
      parsed.sheetName = args[++index];
    } else if (arg === "--input") {
      parsed.input = args[++index];
    } else if (arg === "--output") {
      parsed.output = args[++index];
    } else if (arg === "--outputs-dir") {
      parsed.outputsDir = args[++index];
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
    "Usage: node scripts/automation/refresh-product-catalog-sheet-references.mjs [options]",
    "",
    "Options:",
    "  --write                    Replace generation-input-catalog.csv. Without this, writes a preview CSV.",
    "  --overwrite-ready          Refresh rows already mapped from the Product Catalog sheet.",
    "  --spreadsheet-id <id>      Product Catalog spreadsheet id.",
    "  --sheet-name <name>        Product Catalog sheet tab name. Defaults to Sheet1.",
    "  --input <path>             Input generation CSV path.",
    "  --output <path>            Output CSV path when --write is used.",
    "  --outputs-dir <path>       Outputs directory. Defaults to ../../outputs from the repo root."
  ].join("\n"));
  process.exit(0);
}
