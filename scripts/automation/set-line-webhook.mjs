#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv, getRequiredEnv } from "../../lib/automation/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadLocalEnv(path.join(repoRoot, ".env"));

const endpoint = normalizeEndpoint(process.argv[2] || process.env.LINE_WEBHOOK_ENDPOINT || process.env.PUBLIC_BASE_URL);
if (!endpoint) {
  console.error("Usage: node scripts/automation/set-line-webhook.mjs https://example.com/api/line/webhook");
  console.error("Or set PUBLIC_BASE_URL / LINE_WEBHOOK_ENDPOINT in .env.");
  process.exit(1);
}

const token = getRequiredEnv("LINE_CHANNEL_ACCESS_TOKEN");
const response = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
  method: "PUT",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ endpoint })
});
const text = await response.text();
console.log(response.status, text || "{}");

const infoResponse = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
  headers: { "Authorization": `Bearer ${token}` }
});
console.log("current", infoResponse.status, await infoResponse.text());

const testResponse = await fetch("https://api.line.me/v2/bot/channel/webhook/test", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ endpoint })
});
console.log("test", testResponse.status, await testResponse.text());

function normalizeEndpoint(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("/api/line/webhook")) return trimmed;
  return `${trimmed.replace(/\/+$/, "")}/api/line/webhook`;
}
