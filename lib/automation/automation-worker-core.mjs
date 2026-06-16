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
import { buildLivePilotGenerationGate } from "./live-pilot-generation-gate.mjs";
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
  readReferenceResolutionManifest,
  readModelInputStagingManifest,
  enqueueTask,
  providerGenerate,
  persistLiveExecution,
  updateBatchItemsAfterSupportGeneration,
  onSupportGenerationCompleted,
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
    const payloadMediaAssets = Array.isArray(task.payload?.media_assets) ? task.payload.media_assets : [];
    const preflight = buildWordPressMediaMappingPreflight({
      task,
      batchItems,
      productPreflight: task.payload?.product_preflight || task.payload?.preflight || null,
      mediaAssets: payloadMediaAssets.length ? payloadMediaAssets : collectMediaAssetsFromBatchItems(batchItems)
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
    const referenceResolutionManifest = task.payload?.reference_resolution_manifest ||
      task.payload?.referenceResolutionManifest ||
      (typeof readReferenceResolutionManifest === "function"
        ? await readReferenceResolutionManifest({ task, batchItems, mediaManifest })
        : null);
    const modelInputStagingManifest = task.payload?.model_input_staging_manifest ||
      task.payload?.modelInputStagingManifest ||
      (typeof readModelInputStagingManifest === "function"
        ? await readModelInputStagingManifest({ task, batchItems, mediaManifest, referenceResolutionManifest })
        : null);
    const generationPlan = buildPilotGenerationExecutionPlan({
      task,
      batchItems,
      mediaManifest,
      referenceResolutionManifest,
      modelInputStagingManifest,
      mediaAssets,
      liveGenerationEnabled: Boolean(
        task.payload?.live_generation_requested ||
        task.payload?.auto_enqueue_live_support
      )
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
    const queuedLiveTask = await maybeEnqueueLiveSupportExecution({
      task,
      generationPlan,
      enqueueTask,
      env
    });
    if (queuedLiveTask) return { handled: true, dryRun: true, taskType: task.task_type, queuedLiveTask };
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (task.task_type === LIVE_PILOT_GENERATION_EXECUTION_TASK) {
    const generationPlan = task.payload?.generation_plan || task.payload?.generationPlan || {};
    const execution = await executeLivePilotGenerationGate({
      gate: task.payload?.gate || task.payload?.live_generation_gate || {},
      liveRequested: Boolean(task.payload?.live_generation_requested),
      liveConfirmed: Boolean(task.payload?.live_generation_confirmed),
      env,
      maxRequests: task.payload?.max_requests ?? null,
      providerGenerate
    });
    let persistence = null;
    if (
      execution.live_generation_allowed === true &&
      typeof persistLiveExecution === "function"
    ) {
      persistence = await persistLiveExecution({
        execution,
        generationPlan,
        batch: {
          id: task.batch_id || generationPlan.batch_id || execution.batch_id || null,
          batch_id: task.batch_id || generationPlan.batch_id || execution.batch_id || null,
          items: batchItems
        },
        actorId: task.payload?.actor_id || task.payload?.actorId || "",
        dryRun: false,
        task
      });
      if (
        typeof updateBatchItemsAfterSupportGeneration === "function" &&
        Number(persistence?.summary?.persisted || 0) > 0
      ) {
        await updateBatchItemsAfterSupportGeneration({ task, execution, persistence, generationPlan, batchItems });
      }
      if (
        typeof onSupportGenerationCompleted === "function" &&
        Number(persistence?.summary?.persisted || 0) > 0
      ) {
        await onSupportGenerationCompleted({ task, execution, persistence, generationPlan, batchItems });
      }
    }
    await recordAuditEvent({
      eventType: "live_pilot_generation_execution_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        execution,
        persistence
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: !execution.live_generation_allowed,
      execution,
      persistence,
      message: execution.live_generation_allowed
        ? "Live support generation execution completed and persistence was attempted."
        : "Live pilot generation execution checked. Worker did not call the image provider."
    });
    return {
      handled: true,
      action: "live_generation_execution_recorded",
      dryRun: !execution.live_generation_allowed,
      taskType: task.task_type,
      execution,
      persistence
    };
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

async function maybeEnqueueLiveSupportExecution({ task, generationPlan, enqueueTask, env }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_live_support) return null;
  if (!isHeroApprovalSupportTask(task)) return null;

  const liveRequested = Boolean(task.payload?.live_generation_requested);
  const liveConfirmed = Boolean(task.payload?.live_generation_confirmed);
  const sku = task.payload?.sku || firstSku(generationPlan);
  const liveGenerationGate = buildLivePilotGenerationGate({
    generationPlan,
    mode: "all",
    requestFilter: {
      sku,
      kind: "support"
    },
    liveRequested,
    liveConfirmed,
    env
  });

  if (!liveGenerationGate.requests.length) return null;

  const payload = {
    ...task.payload,
    action: "generate_support_after_hero_approval",
    source_action: task.payload?.action || "",
    dry_run: !liveGenerationGate.live_generation_allowed,
    generation_plan: generationPlan,
    live_generation_gate: liveGenerationGate,
    gate: liveGenerationGate,
    live_generation_requested: liveRequested,
    live_generation_confirmed: liveConfirmed
  };
  const queuedTask = {
    taskType: LIVE_PILOT_GENERATION_EXECUTION_TASK,
    task_type: LIVE_PILOT_GENERATION_EXECUTION_TASK,
    batchId: task.batch_id,
    batch_id: task.batch_id,
    generationId: task.payload?.generation_id || task.generation_id || null,
    generation_id: task.payload?.generation_id || task.generation_id || null,
    priority: Number(task.priority || 100) + 1,
    dedupeKey: [
      "live-support",
      task.batch_id || generationPlan.batch_id || "batch",
      sku || "sku",
      task.payload?.generation_id || task.generation_id || task.id
    ].join(":"),
    payload
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

function isHeroApprovalSupportTask(task) {
  return (
    task.payload?.action === "approve_hero" ||
    task.payload?.source_action === "approve_hero" ||
    task.payload?.request_mode === "support-only-after-approved-hero" ||
    task.payload?.generation_phase === "support_after_hero_approval"
  );
}

function firstSku(generationPlan) {
  return (generationPlan.items || []).map((item) => item.sku).find(Boolean) || "";
}

function collectMediaAssetsFromBatchItems(batchItems = []) {
  const seen = new Set();
  return (batchItems || []).flatMap((item) => {
    const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
    const gate = isPlainObject(metadata.media_export_preflight_gate) ? metadata.media_export_preflight_gate : {};
    const mediaAssets = [
      ...(Array.isArray(metadata.media_assets) ? metadata.media_assets : []),
      ...(Array.isArray(gate.media_assets) ? gate.media_assets : [])
    ];
    return mediaAssets.map((asset) => normalizeBatchItemMediaAsset({ asset, item, metadata }));
  }).filter((asset) => {
    const identity = [
      asset.sku,
      asset.id || asset.asset_id || asset.url || asset.public_url || asset.local_path,
      asset.shot_key || asset.slot || asset.type
    ].join(":");
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function normalizeBatchItemMediaAsset({ asset, item, metadata }) {
  const source = isPlainObject(asset) ? asset : {};
  return {
    ...source,
    sku: source.sku || item?.sku || "",
    brand_id: source.brand_id || metadata.brand_id || item?.brand_id || "",
    target_site: source.target_site || metadata.target_site || item?.target_site || ""
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
