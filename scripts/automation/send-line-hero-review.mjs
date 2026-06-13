#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv, getRequiredEnv } from "../../lib/automation/env.mjs";
import { buildHeroReviewMessages, pushLineMessage } from "../../lib/automation/line-client.mjs";
import { canUseSupabaseAutomation, registerAutomationBatch } from "../../lib/automation/batch-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LINE hero review failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const batchPath = path.resolve(options.batchJson || path.join(outputsDir, "pilot-batch-dry-run.json"));
  const mediaManifestPath = path.resolve(options.mediaManifest || path.join(outputsDir, "generation-approval-media-manifest.json"));
  const referenceResolutionPath = path.resolve(options.referenceResolution || path.join(outputsDir, "reference-asset-resolution.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "line-hero-review-payload.json"));

  if (!fs.existsSync(batchPath)) throw new Error(`Batch JSON not found: ${batchPath}`);
  if (!fs.existsSync(mediaManifestPath)) throw new Error(`Media manifest JSON not found: ${mediaManifestPath}`);

  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
  const mediaManifest = JSON.parse(fs.readFileSync(mediaManifestPath, "utf8"));
  const referenceResolution = fs.existsSync(referenceResolutionPath)
    ? JSON.parse(fs.readFileSync(referenceResolutionPath, "utf8"))
    : null;
  const payload = buildHeroReviewPayload({
    batch,
    mediaManifest,
    referenceResolution,
    reviewBaseUrl: options.reviewBaseUrl || process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "",
    lineImageProxyBaseUrl: options.lineImageProxyBaseUrl || options.reviewBaseUrl || process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "",
    lineImageProxySecret: options.lineImageProxySecret || process.env.LINE_IMAGE_PROXY_SECRET || process.env.LINE_CHANNEL_SECRET || ""
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.info(`LINE hero review payload wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(payload.summary)}`);

  const registration = await registerHeroReviewBatchContext({
    batch,
    payload,
    lineUserId: options.to || process.env.LINE_TARGET_USER_ID || ""
  });
  if (registration?.ok) {
    console.info(`LINE hero review batch context registered: ${registration.itemCount} item(s)`);
  } else if (registration?.skipped) {
    console.info(`LINE hero review batch context registration skipped: ${registration.reason}`);
  }

  if (options.send) {
    assertSafeToSendHeroReviewPayload(payload, options);
    const to = options.to || getRequiredEnv("LINE_TARGET_USER_ID");
    for (const chunk of chunkArray(payload.messages, 5)) {
      await pushLineMessage({ to, messages: chunk });
    }
    console.info(`LINE hero review messages sent: ${payload.messages.length}`);
  }
}

export function buildHeroReviewPayload({
  batch = {},
  mediaManifest = {},
  referenceResolution = {},
  reviewBaseUrl = "",
  lineImageProxyBaseUrl = "",
  lineImageProxySecret = ""
} = {}) {
  const mediaBySku = groupBy(mediaManifest.items || [], (item) => normalizeSku(item.sku));
  const refBySku = groupBy(referenceResolution?.items || [], (item) => normalizeSku(item.sku));
  const items = (batch.items || []).map((item) => {
    const sku = normalizeSku(item.sku);
    const mediaItem = (mediaBySku.get(sku) || [])[0] || {};
    const referenceItem = (refBySku.get(sku) || [])[0] || {};
    const heroAsset = (mediaItem.assets || []).find((asset) =>
      String(asset.kind || "").toLowerCase() === "hero" ||
      String(asset.shot_key || "").toLowerCase() === "hero" ||
      String(asset.type || "").toLowerCase() === "hero_generated"
    );
    const referenceAssets = Array.isArray(referenceItem.selected_reference_assets)
      ? referenceItem.selected_reference_assets
      : [];
    const hasGenerationId = Boolean(heroAsset?.generation_id);
    return {
      sku: item.sku || "",
      brand_id: item.brand_id || "",
      brand_label: item.brand_label || "",
      product_name: item.product_name || "",
      status: heroAsset
        ? hasGenerationId ? "ready_for_line_hero_review" : "visual_review_only_missing_generation"
        : "missing_hero_asset",
      review_page_ready: Boolean(heroAsset && hasGenerationId),
      missing_generation_id: Boolean(heroAsset && !hasGenerationId),
      hero_asset: heroAsset || null,
      reference_assets: referenceAssets
    };
  });
  const messages = items
    .filter((item) => item.hero_asset)
    .flatMap((item) => buildHeroReviewMessages({
      batchId: batch.batch_id || mediaManifest.batch_id || "unknown-batch",
      item,
      heroAsset: item.hero_asset,
      referenceAssets: item.reference_assets,
      reviewBaseUrl: item.review_page_ready ? reviewBaseUrl : "",
      lineImageProxyBaseUrl,
      lineImageProxySecret
    }));
  const missingGenerationId = items.filter((item) => item.missing_generation_id).length;

  return {
    manifest_type: "line_hero_review_payload",
    batch_id: batch.batch_id || mediaManifest.batch_id || null,
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    send_policy: "send_only_with_explicit_send_flag",
    guardrails: [
      "hero_review_before_support_generation",
      "line_approval_does_not_publish_wordpress",
      "support_generation_requires_approve_hero_postback",
      "live_send_requires_generation_id_for_review_actions"
    ],
    send_blockers: missingGenerationId
      ? [`${missingGenerationId} hero item(s) have no generation_id; rebuild media manifest from Supabase after assets are persisted before live send.`]
      : [],
    summary: {
      sku_count: items.length,
      hero_review_ready: items.filter((item) => item.status === "ready_for_line_hero_review").length,
      visual_review_only_missing_generation: missingGenerationId,
      missing_hero_asset: items.filter((item) => item.status === "missing_hero_asset").length,
      messages: messages.length
    },
    items,
    messages
  };
}

async function registerHeroReviewBatchContext({ batch = {}, payload = {}, lineUserId = "" } = {}) {
  if (!canUseSupabaseAutomation()) {
    return { ok: false, skipped: true, reason: "Supabase automation env is incomplete." };
  }
  const reviewItemsBySku = new Map((payload.items || []).map((item) => [normalizeSku(item.sku), item]));
  const enrichedBatch = {
    ...batch,
    batch_id: batch.batch_id || payload.batch_id || "",
    dry_run: true,
    items: (batch.items || []).map((item) => {
      const reviewItem = reviewItemsBySku.get(normalizeSku(item.sku)) || {};
      return {
        ...item,
        hero_review_status: reviewItem.status || "",
        hero_review_ready: Boolean(reviewItem.review_page_ready),
        hero_review_hero_asset: reviewItem.hero_asset || null,
        hero_review_reference_assets: Array.isArray(reviewItem.reference_assets) ? reviewItem.reference_assets : []
      };
    })
  };
  return registerAutomationBatch(enrichedBatch, {
    source: "line_hero_review",
    lineUserId
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--batch-json") parsed.batchJson = args[++index];
    else if (arg === "--media-manifest") parsed.mediaManifest = args[++index];
    else if (arg === "--reference-resolution") parsed.referenceResolution = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--to") parsed.to = args[++index];
    else if (arg === "--review-base-url") parsed.reviewBaseUrl = args[++index];
    else if (arg === "--line-image-proxy-base-url") parsed.lineImageProxyBaseUrl = args[++index];
    else if (arg === "--line-image-proxy-secret") parsed.lineImageProxySecret = args[++index];
    else if (arg === "--send") parsed.send = true;
    else if (arg === "--allow-unresolved-review-actions") parsed.allowUnresolvedReviewActions = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/send-line-hero-review.mjs [options]",
    "",
    "Options:",
    "  --batch-json <path>            Batch JSON path. Defaults to outputs/pilot-batch-dry-run.json.",
    "  --media-manifest <path>        Media manifest JSON with generated hero assets.",
    "  --reference-resolution <path>  Optional reference asset resolution JSON.",
    "  --output <path>                Output JSON path. Defaults to outputs/line-hero-review-payload.json.",
    "  --outputs-dir <path>           Outputs directory.",
    "  --send                         Push the hero review messages to LINE.",
    "  --to <line-user-id>            Optional target user id. Defaults to LINE_TARGET_USER_ID.",
    "  --review-base-url <url>        Base URL for the web hero review page.",
    "  --line-image-proxy-base-url <url>",
    "                                Base URL for signed Drive image proxy. Defaults to review base URL.",
    "  --line-image-proxy-secret <secret>",
    "                                HMAC secret for Drive image proxy. Defaults to LINE_IMAGE_PROXY_SECRET or LINE_CHANNEL_SECRET.",
    "  --allow-unresolved-review-actions",
    "                                Allow --send even when hero assets do not have generation_id. Not recommended."
  ].join("\n"));
  process.exit(0);
}

function assertSafeToSendHeroReviewPayload(payload, options = {}) {
  if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
    throw new Error("Refusing to send LINE hero review: no hero review messages were generated.");
  }
  if (options.allowUnresolvedReviewActions) return;
  const missingGenerationId = Number(payload?.summary?.visual_review_only_missing_generation || 0);
  if (missingGenerationId > 0) {
    throw new Error(`Refusing to send LINE hero review: ${missingGenerationId} hero item(s) have no generation_id. Use --from-supabase media manifest after assets are persisted, or pass --allow-unresolved-review-actions for visual-only testing.`);
  }
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function chunkArray(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
