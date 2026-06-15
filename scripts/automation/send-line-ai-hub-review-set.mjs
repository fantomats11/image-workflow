#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv, getRequiredEnv } from "../../lib/automation/env.mjs";
import { pushLineMessage } from "../../lib/automation/line-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LINE AI HUB review set push failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const inputPath = path.resolve(options.input || path.join(outputsDir, "ai-hub-production-review-registration.json"));
  if (!fs.existsSync(inputPath)) throw new Error(`Registration result not found: ${inputPath}`);

  const registration = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const messages = buildAiHubReviewSetLineMessages(registration);
  const target = options.to || process.env.LINE_TARGET_USER_ID || getRequiredEnv("LINE_TARGET_USER_ID");
  const result = await pushLineMessage({ to: target, messages });
  console.info(`LINE AI HUB review set pushed: ${messages.length} messages`);
  console.info(JSON.stringify(result));
}

export function buildAiHubReviewSetLineMessages(registration = {}) {
  const item = (registration.items || []).find((entry) => entry.review_url) || registration.items?.[0] || {};
  const sku = item.sku || "unknown-sku";
  const productName = item.product_name || "";
  const reviewUrl = item.review_url || "";
  const supportAssets = Array.isArray(item.support_assets) ? item.support_assets : [];
  const messages = [{
    type: "text",
    text: [
      `Hero Review | SKU ${sku}`,
      productName,
      supportAssets.length ? `Support plan after approval: ${supportAssets.length} shots` : "",
      reviewUrl || "ยังไม่มี review URL ที่พร้อมใช้งาน",
      "ขั้นตอนจริง: ตรวจ Hero ก่อน ถ้า Approve ระบบค่อยปล่อย support generation ถ้า Regenerate ระบบทำ Hero ใหม่"
    ].filter(Boolean).join("\n")
  }];

  const heroUrl = item.hero_asset?.source_url || "";
  if (heroUrl) messages.push(imageMessage(heroUrl));
  return messages.slice(0, 5);
}

function imageMessage(url) {
  return {
    type: "image",
    originalContentUrl: url,
    previewImageUrl: url
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") parsed.input = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--to") parsed.to = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/send-line-ai-hub-review-set.mjs [options]",
    "",
    "Options:",
    "  --input <path>       AI HUB production review registration JSON.",
    "  --to <lineUserId>    LINE target user id. Defaults to LINE_TARGET_USER_ID."
  ].join("\n"));
  process.exit(0);
}
