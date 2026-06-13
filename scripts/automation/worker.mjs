#!/usr/bin/env node
import "dotenv/config";
import os from "node:os";
import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { processAutomationTaskCore } from "../../lib/automation/automation-worker-core.mjs";
import { buildSupabaseMediaAssetManifestForBatch } from "../../lib/automation/supabase-media-asset-manifest.mjs";

const workerId = process.env.AUTOMATION_WORKER_ID || `${os.hostname()}-${process.pid}`;
const pollIntervalMs = Number(process.env.AUTOMATION_WORKER_POLL_INTERVAL_MS || 5000);
const once = ["1", "true", "yes"].includes(String(process.env.AUTOMATION_WORKER_ONCE || "").toLowerCase());

console.log(`[automation-worker] started ${workerId}`);

do {
  const task = await claimNextTask();
  if (!task) {
    if (once) break;
    await sleep(pollIntervalMs);
    continue;
  }

  await processTask(task);
} while (!once);

async function claimNextTask() {
  const { data: candidates, error } = await supabaseAdmin
    .from("automation_tasks")
    .select("*")
    .eq("status", "queued")
    .lte("available_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) throw error;

  for (const candidate of candidates || []) {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("automation_tasks")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: workerId,
        attempts: Number(candidate.attempts || 0) + 1,
        last_error: null
      })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (claimError) throw claimError;
    if (claimed) return claimed;
  }

  return null;
}

async function processTask(task) {
  console.log(`[automation-worker] processing ${task.id} ${task.task_type}`);
  try {
    const batchItems = task.batch_id ? await readBatchItems(task.batch_id) : [];
    await processAutomationTaskCore({
      task,
      batchItems,
      workerId,
      embeddedWorker: false,
      recordAuditEvent,
      completeTask,
      readMediaManifest: ({ task: currentTask, batchItems: currentBatchItems }) => buildSupabaseMediaAssetManifestForBatch({
        supabaseAdmin,
        batch: {
          batch_id: currentTask.batch_id || null,
          items: currentBatchItems
        },
        batchItems: currentBatchItems
      })
    });
  } catch (error) {
    await failOrRetryTask(task, error);
  }
}

async function readBatchItems(batchId) {
  const { data, error } = await supabaseAdmin
    .from("automation_batch_items")
    .select("id, sku, product_type, target_site, product_name, status, woo_status, metadata")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function completeTask(taskId, result = {}) {
  const { error } = await supabaseAdmin
    .from("automation_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      payload: result
    })
    .eq("id", taskId);
  if (error) throw error;
}

async function failOrRetryTask(task, error) {
  const attempts = Number(task.attempts || 1);
  const maxAttempts = Number(task.max_attempts || 3);
  const finalFailure = attempts >= maxAttempts;
  const backoffSeconds = Math.min(300, Math.max(15, attempts * attempts * 15));
  const nextAvailableAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
  const message = error?.message || String(error);

  await recordAuditEvent({
    eventType: finalFailure ? "automation_task_failed" : "automation_task_retry_scheduled",
    eventJson: {
      task_id: task.id,
      task_type: task.task_type,
      batch_id: task.batch_id,
      dedupe_key: task.dedupe_key,
      worker_id: workerId,
      attempts,
      max_attempts: maxAttempts,
      next_available_at: finalFailure ? null : nextAvailableAt,
      error: message
    }
  });

  const { error: updateError } = await supabaseAdmin
    .from("automation_tasks")
    .update({
      status: finalFailure ? "failed" : "queued",
      locked_at: null,
      locked_by: null,
      last_error: message,
      available_at: finalFailure ? task.available_at : nextAvailableAt
    })
    .eq("id", task.id);
  if (updateError) throw updateError;
}

async function recordAuditEvent({ eventType, eventJson = {} }) {
  const { error } = await supabaseAdmin.from("audit_events").insert({
    actor_id: null,
    event_type: eventType,
    event_json: eventJson
  });
  if (error) console.warn(`[automation-worker] audit insert failed: ${error.message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
