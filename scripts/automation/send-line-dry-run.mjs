#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv, getRequiredEnv } from "../../lib/automation/env.mjs";
import { registerAutomationBatch } from "../../lib/automation/batch-registry.mjs";
import { pushLineMessage, buildPilotBatchFlex } from "../../lib/automation/line-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(repoRoot, "../..");
const outputsDir = path.join(workspaceRoot, "outputs");

loadLocalEnv(path.join(repoRoot, ".env"));

const targetUserId = getRequiredEnv("LINE_TARGET_USER_ID");
const batchPath = path.join(outputsDir, "pilot-batch-dry-run.json");
const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
try {
  const registry = await registerAutomationBatch(batch, {
    source: "line_dry_run_script",
    lineUserId: targetUserId
  });
  if (registry.ok) {
    console.log(`Registered automation batch ${batch.batch_id} (${registry.itemCount} items)`);
  } else {
    console.warn(`Automation batch registration skipped: ${registry.reason}`);
  }

  const response = await pushLineMessage({
    to: targetUserId,
    messages: [
      buildPilotBatchFlex(batch),
      {
        type: "text",
        text: `Dry-run ready: ${batch.batch_id}\nSKU: ${batch.items.length}\nNo image generation or WordPress publish has been executed.`
      }
    ]
  });

  console.log("LINE dry-run message sent");
  console.log(JSON.stringify(response));
} catch (error) {
  console.error("LINE dry-run message failed.");
  console.error(error.message);
  console.error("Check that LINE_TARGET_USER_ID belongs to the same Messaging API channel and that the user has added or chatted with the bot.");
  process.exitCode = 1;
}
