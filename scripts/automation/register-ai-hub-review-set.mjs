#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import { registerAiHubProductionReviewSet } from "../../lib/automation/ai-hub-production-review-registration.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`AI HUB review registration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const bundlePath = path.resolve(options.bundle || path.join(outputsDir, "ai-hub-image-review-bundle-2DJ0493000-v3.15.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "ai-hub-production-review-registration.json"));
  if (!fs.existsSync(bundlePath)) throw new Error(`AI HUB review bundle not found: ${bundlePath}`);

  const reviewBundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const dryRun = !options.persist;
  const actorId = options.actorId || process.env.AUTOMATION_ACTOR_ID || process.env.SUPABASE_AUTOMATION_ACTOR_ID || "";
  const actorEmail = options.actorEmail || process.env.AUTOMATION_ACTOR_EMAIL || "";
  const reviewBaseUrl = options.reviewBaseUrl ||
    process.env.REVIEW_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_BASE_URL ||
    "";
  const supabaseAdmin = dryRun ? null : await loadSupabaseAdmin();

  const result = await registerAiHubProductionReviewSet({
    supabaseAdmin,
    reviewBundle,
    batchKey: options.batchKey,
    actorId,
    actorEmail,
    reviewBaseUrl,
    dryRun
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.info(`AI HUB review registration wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(result.summary)}`);
  console.info(`Registration status: ${result.registration_status || (dryRun ? "dry_run" : "unknown")}`);
  if (result.blockers?.length) console.info(`Blockers: ${result.blockers.join(", ")}`);
  const reviewUrl = result.items?.find((item) => item.review_url)?.review_url;
  if (reviewUrl) console.info(`Review URL: ${reviewUrl}`);
}

async function loadSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in .env");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: buildTimeoutFetch(15000)
    }
  });
}

function buildTimeoutFetch(timeoutMs) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") parsed.bundle = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--batch-key") parsed.batchKey = args[++index];
    else if (arg === "--actor-id") parsed.actorId = args[++index];
    else if (arg === "--actor-email") parsed.actorEmail = args[++index];
    else if (arg === "--review-base-url") parsed.reviewBaseUrl = args[++index];
    else if (arg === "--persist") parsed.persist = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/register-ai-hub-review-set.mjs [options]",
    "",
    "Options:",
    "  --bundle <path>              AI HUB image review bundle JSON.",
    "  --output <path>              Output registration result JSON.",
    "  --batch-key <key>            Automation batch key to create/update.",
    "  --actor-id <uuid>            Actor profile id for persisted review writes.",
    "  --actor-email <email>        Actor profile email; used when actor id is omitted.",
    "  --review-base-url <url>      Public Render review base URL.",
    "  --persist                    Write review state to Supabase. Omit for dry-run."
  ].join("\n"));
  process.exit(0);
}
