#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv, getRequiredEnv } from "../../lib/automation/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(repoRoot, "../..");
const outputsDir = path.join(workspaceRoot, "outputs");
const port = Number(process.env.LINE_WEBHOOK_CAPTURE_PORT || 8787);

loadLocalEnv(path.join(repoRoot, ".env"));

const channelSecret = getRequiredEnv("LINE_CHANNEL_SECRET");
const channelAccessToken = getRequiredEnv("LINE_CHANNEL_ACCESS_TOKEN");
const envPath = path.join(repoRoot, ".env");
fs.mkdirSync(outputsDir, { recursive: true });

function verifySignature(body, signature) {
  const expected = crypto.createHmac("sha256", channelSecret).update(body).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(signature || ""), Buffer.from(expected));
}

function updateEnvUserId(userId) {
  const text = fs.readFileSync(envPath, "utf8");
  const next = text.includes("LINE_TARGET_USER_ID=")
    ? text.replace(/^LINE_TARGET_USER_ID=.*$/m, `LINE_TARGET_USER_ID=${userId}`)
    : `${text.trimEnd()}\nLINE_TARGET_USER_ID=${userId}\n`;
  fs.writeFileSync(envPath, next, "utf8");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function replyLineMessage(replyToken, messages) {
  if (!replyToken) return;
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ replyToken, messages })
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`LINE reply failed ${response.status}: ${text}`);
  }
}

function recordPostback(event) {
  const data = new URLSearchParams(event.postback?.data || "");
  const action = {
    received_at: new Date().toISOString(),
    user_id: event.source?.userId || null,
    action: data.get("action") || null,
    batch_id: data.get("batch_id") || null,
    raw_data: event.postback?.data || ""
  };
  fs.appendFileSync(
    path.join(outputsDir, "line-approval-actions.jsonl"),
    `${JSON.stringify(action)}\n`,
    "utf8"
  );
  return action;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/line/webhook") {
    sendJson(res, 404, { ok: false, error: "not_found" });
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const body = Buffer.concat(chunks);
    const signature = req.headers["x-line-signature"];
    if (!verifySignature(body, Array.isArray(signature) ? signature[0] : signature)) {
      sendJson(res, 401, { ok: false, error: "bad_signature" });
      return;
    }

    const payload = JSON.parse(body.toString("utf8"));
    fs.appendFileSync(
      path.join(outputsDir, "line-webhook-events.jsonl"),
      `${JSON.stringify({ received_at: new Date().toISOString(), payload })}\n`,
      "utf8"
    );

    for (const event of payload.events || []) {
      const source = event.source || {};
      if (source.userId) {
        updateEnvUserId(source.userId);
        fs.writeFileSync(
          path.join(outputsDir, "line-target-user-id.txt"),
          `${source.userId}\n`,
          "utf8"
        );
        console.log(`Captured LINE userId: ${source.userId}`);
        console.log(`Event type: ${event.type}`);
      }

      if (event.type === "postback") {
        const action = recordPostback(event);
        await replyLineMessage(event.replyToken, [
          {
            type: "text",
            text: `รับ action แล้ว: ${action.action || "-"}\nBatch: ${action.batch_id || "-"}\nตอนนี้ยังเป็น dry-run ยังไม่เจนภาพ/ไม่ลง WordPress`
          }
        ]);
      }
    }

    sendJson(res, 200, { ok: true });
  });
});

server.listen(port, () => {
  console.log(`LINE webhook capture listening on http://127.0.0.1:${port}/api/line/webhook`);
  console.log("Start a public HTTPS tunnel to this port, set the LINE webhook endpoint, then send a message to the bot.");
});
