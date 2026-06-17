#!/usr/bin/env node
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { processAutomationTaskCore } from "../../lib/automation/automation-worker-core.mjs";
import { buildSupabaseMediaAssetManifestForBatch } from "../../lib/automation/supabase-media-asset-manifest.mjs";
import { createFalImageProvider } from "../../lib/automation/fal-image-provider.mjs";
import { persistLiveGenerationExecution } from "../../lib/automation/live-generation-persistence.mjs";
import {
  buildReferenceStagingManifestFromBatchItems,
  stageMediaManifestAssetsForLiveGeneration
} from "../../lib/automation/live-generation-input-staging.mjs";

const workerId = process.env.AUTOMATION_WORKER_ID || `${os.hostname()}-${process.pid}`;
const pollIntervalMs = Number(process.env.AUTOMATION_WORKER_POLL_INTERVAL_MS || 5000);
const once = ["1", "true", "yes"].includes(String(process.env.AUTOMATION_WORKER_ONCE || "").toLowerCase());
const liveInputStagingDir = process.env.AI_GENERATION_INPUT_STAGING_DIR ||
  path.join(os.tmpdir(), "image-workflow-live-inputs");
const generatedDir = process.env.AI_GENERATION_GENERATED_DIR ||
  path.join(os.tmpdir(), "image-workflow-generated");
let falProviderPromise = null;

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
      readMediaManifest,
      readModelInputStagingManifest,
      enqueueTask: enqueueAutomationTask,
      providerGenerate: async (request) => {
        const provider = await getFalProvider();
        return provider(request);
      },
      persistLiveExecution: ({ execution, generationPlan, batch, actorId, dryRun }) => persistLiveGenerationExecution({
        supabaseAdmin,
        execution,
        generationPlan,
        batch,
        actorId,
        dryRun
      }),
      updateBatchItemsAfterSupportGeneration
    });
  } catch (error) {
    await failOrRetryTask(task, error);
  }
}

async function readMediaManifest({ task: currentTask, batchItems: currentBatchItems }) {
  const mediaManifest = await buildSupabaseMediaAssetManifestForBatch({
    supabaseAdmin,
    batch: {
      batch_id: currentTask.batch_id || null,
      items: currentBatchItems
    },
    batchItems: currentBatchItems
  });
  return stageMediaManifestAssetsForLiveGeneration({
    mediaManifest,
    stagingDir: liveInputStagingDir
  });
}

async function readModelInputStagingManifest({ batchItems: currentBatchItems }) {
  return buildReferenceStagingManifestFromBatchItems({
    batchItems: currentBatchItems,
    stagingDir: liveInputStagingDir
  });
}

async function getFalProvider() {
  if (!falProviderPromise) {
    falProviderPromise = createFalImageProvider({
      generatedDir,
      timeoutMs: Number(process.env.FAL_TIMEOUT_MS || 180000),
      verbose: ["1", "true", "yes"].includes(String(process.env.AI_GENERATION_VERBOSE || "").toLowerCase())
    });
  }
  return falProviderPromise;
}

async function enqueueAutomationTask({
  taskType,
  task_type,
  batchId = null,
  batch_id = null,
  batchItemId = null,
  batch_item_id = null,
  jobId = null,
  job_id = null,
  generationId = null,
  generation_id = null,
  dedupeKey,
  dedupe_key,
  payload = {},
  status = "queued",
  priority = 100
} = {}) {
  const row = {
    task_type: taskType || task_type,
    status,
    priority,
    batch_id: batchId || batch_id,
    batch_item_id: batchItemId || batch_item_id,
    job_id: jobId || job_id,
    generation_id: generationId || generation_id,
    dedupe_key: dedupeKey || dedupe_key,
    payload,
    completed_at: status === "completed" ? new Date().toISOString() : null
  };
  const { data, error } = await supabaseAdmin
    .from("automation_tasks")
    .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("*");
  if (error) throw error;
  return data?.[0] || null;
}

async function updateBatchItemsAfterSupportGeneration({ task, persistence, batchItems = [] }) {
  const supportSkus = new Set((persistence?.items || [])
    .filter((item) => item.kind === "support" || item.type === "support_generated")
    .map((item) => item.sku)
    .filter(Boolean));
  if (!supportSkus.size) return;
  for (const item of batchItems) {
    if (!supportSkus.has(item.sku)) continue;
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const supportAssets = buildPersistedSupportAssetsForSku({ persistence, sku: item.sku });
    const { error } = await supabaseAdmin
      .from("automation_batch_items")
      .update({
        status: "support_ready_for_review",
        metadata: {
          ...metadata,
          review_set_status: "awaiting_support_review",
          support_assets: mergeSupportAssets(metadata.support_assets, supportAssets),
          support_generation: {
            status: "support_ready_for_review",
            task_id: task.id,
            generated_at: new Date().toISOString(),
            persistence_summary: persistence.summary || {},
            support_assets: supportAssets
          }
        }
      })
      .eq("id", item.id);
    if (error) throw error;
  }
}

function buildPersistedSupportAssetsForSku({ persistence, sku }) {
  return (persistence?.items || [])
    .filter((entry) => entry.sku === sku)
    .filter((entry) => entry.kind === "support" || entry.type === "support_generated")
    .filter((entry) => entry.public_url || entry.source_url)
    .map((entry) => ({
      asset_id: entry.asset_id || null,
      generation_id: entry.generation_id || null,
      request_id: entry.request_id || null,
      kind: "support",
      slot: entry.slot || "",
      type: entry.type || "support_generated",
      public_url: entry.public_url || entry.source_url || "",
      source_url: entry.public_url || entry.source_url || "",
      file_name: entry.file_name || "",
      mime_type: entry.mime_type || "",
      file_size: entry.file_size || 0,
      prompt: entry.prompt || ""
    }));
}

function mergeSupportAssets(existing = [], next = []) {
  const seen = new Set();
  return [...(Array.isArray(existing) ? existing : []), ...next].filter((asset) => {
    const key = asset.asset_id || asset.generation_id || asset.public_url || asset.source_url || asset.request_id || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
