import { isDryRun } from "./env.mjs";
import {
  GENERATE_BATCH_TASK,
  PILOT_GENERATION_EXECUTION_PLAN_TASK,
  buildPilotGenerationExecutionPlan
} from "./pilot-generation-execution-plan.mjs";
import {
  LIVE_PILOT_GENERATION_EXECUTION_TASK,
  executeLivePilotGenerationGate
} from "./live-pilot-generation-executor.mjs";
import {
  WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK,
  buildWordPressMediaMappingPreflight
} from "./wordpress-media-preflight.mjs";
import {
  WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK,
  buildWordPressProductPublishPreflightWithRemoteChecks
} from "./wordpress-publish-preflight.mjs";

export async function processAutomationTaskCore({
  task,
  batchItems = [],
  workerId = "",
  embeddedWorker = false,
  recordAuditEvent,
  completeTask,
  onPreflightCompleted,
  readMediaManifest,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!task?.id) throw new Error("Automation task id is required.");
  if (typeof recordAuditEvent !== "function") throw new Error("recordAuditEvent callback is required.");
  if (typeof completeTask !== "function") throw new Error("completeTask callback is required.");

  const dryRun =
    task.payload?.dry_run !== false ||
    isDryRun("AI_GENERATION_DRY_RUN", true) ||
    isDryRun("WORDPRESS_DRY_RUN", true);

  if (task.task_type === WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK) {
    const preflight = await buildWordPressProductPublishPreflightWithRemoteChecks({
      task,
      batchItems,
      env,
      fetchImpl
    });
    await recordAuditEvent({
      eventType: "wordpress_product_publish_preflight_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        preflight
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      preflight,
      message: "WordPress/WooCommerce publish preflight completed. No live write was executed."
    });
    if (typeof onPreflightCompleted === "function") {
      await onPreflightCompleted({ task, preflight });
    }
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (task.task_type === WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK) {
    const preflight = buildWordPressMediaMappingPreflight({
      task,
      batchItems,
      productPreflight: task.payload?.product_preflight || task.payload?.preflight || null,
      mediaAssets: Array.isArray(task.payload?.media_assets) ? task.payload.media_assets : []
    });
    await recordAuditEvent({
      eventType: "wordpress_media_mapping_preflight_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        preflight
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      preflight,
      message: "WordPress media mapping preflight completed. No media upload or attach was executed."
    });
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (task.task_type === GENERATE_BATCH_TASK || task.task_type === PILOT_GENERATION_EXECUTION_PLAN_TASK) {
    const mediaAssets = Array.isArray(task.payload?.media_assets) ? task.payload.media_assets : [];
    const mediaManifest = task.payload?.media_manifest ||
      (!mediaAssets.length && typeof readMediaManifest === "function"
        ? await readMediaManifest({ task, batchItems })
        : null);
    const generationPlan = buildPilotGenerationExecutionPlan({
      task,
      batchItems,
      mediaManifest,
      mediaAssets,
      liveGenerationEnabled: false
    });
    await recordAuditEvent({
      eventType: "pilot_generation_execution_plan_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        generation_plan: generationPlan
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      generation_plan: generationPlan,
      message: "Pilot generation execution plan completed. No image model call was executed."
    });
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (task.task_type === LIVE_PILOT_GENERATION_EXECUTION_TASK) {
    const execution = await executeLivePilotGenerationGate({
      gate: task.payload?.gate || task.payload?.live_generation_gate || {},
      liveRequested: Boolean(task.payload?.live_generation_requested),
      liveConfirmed: Boolean(task.payload?.live_generation_confirmed),
      env,
      maxRequests: task.payload?.max_requests ?? null
    });
    await recordAuditEvent({
      eventType: "live_pilot_generation_execution_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        execution
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      execution,
      message: "Live pilot generation execution checked. Worker did not call the image provider."
    });
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (dryRun) {
    await recordAuditEvent({
      eventType: "automation_task_dry_run_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        batch_item_count: batchItems.length,
        batch_skus: batchItems.map((item) => item.sku).filter(Boolean).slice(0, 50),
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        payload: task.payload || {}
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      batch_item_count: batchItems.length,
      message: "Dry-run completed. No image generation or WordPress publishing was executed."
    });
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  throw new Error(`Live automation task processing is not enabled yet for ${task.task_type}.`);
}
