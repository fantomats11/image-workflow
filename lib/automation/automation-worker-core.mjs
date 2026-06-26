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
  WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
  buildWordPressMediaAttachConfirmationGate
} from "./wordpress-media-confirmation-gate.mjs";
import {
  WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK,
  buildWordPressMediaAttachExecutionPlan
} from "./wordpress-media-attach-execution-plan.mjs";
import {
  WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK,
  buildWordPressMediaRemoteRefetchPreflight
} from "./wordpress-media-remote-refetch-preflight.mjs";
import {
  WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK,
  buildWordPressProductPublishPreflightWithRemoteChecks,
  executeWooCommerceProductDraftPublish
} from "./wordpress-publish-preflight.mjs";
import { runWooCommerceReadOnlyChecksForItem } from "./woocommerce-client.mjs";

export async function processAutomationTaskCore({
  task,
  batchItems = [],
  workerId = "",
  embeddedWorker = false,
  recordAuditEvent,
  completeTask,
  onPreflightCompleted,
  onMediaPreflightCompleted,
  onMediaAttachConfirmationCompleted,
  onMediaAttachExecutionPlanCompleted,
  onMediaRemoteRefetchPreflightCompleted,
  readMediaManifest,
  readReferenceResolutionManifest,
  readModelInputStagingManifest,
  enqueueTask,
  providerGenerate,
  persistLiveExecution,
  updateBatchItemsAfterSupportGeneration,
  onHeroGenerationCompleted,
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
    const shouldPublishNow = (task.payload?.publish_now === true || task.payload?.live_publish === true) && task.payload?.dry_run === false;
    const publishResults = shouldPublishNow
      ? await Promise.all(batchItems.map((item) => executeWooCommerceProductDraftPublish({
        item,
        env,
        fetchImpl
      })))
      : [];
    await recordAuditEvent({
      eventType: shouldPublishNow ? "wordpress_product_publish_live_draft_completed" : "wordpress_product_publish_preflight_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        preflight,
        publish_results: publishResults
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: !shouldPublishNow,
      preflight,
      publish_results: publishResults,
      message: shouldPublishNow
        ? "WordPress/WooCommerce draft publish completed."
        : "WordPress/WooCommerce publish preflight completed. No live write was executed."
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
    if (typeof onMediaPreflightCompleted === "function") {
      await onMediaPreflightCompleted({ task, preflight });
    }
    const queuedConfirmationTask = await maybeEnqueueWordPressMediaAttachConfirmationGate({
      task,
      preflight,
      enqueueTask
    });
    if (queuedConfirmationTask) {
      return { handled: true, dryRun: true, taskType: task.task_type, queuedConfirmationTask };
    }
    return { handled: true, dryRun: true, taskType: task.task_type };
  }

  if (task.task_type === WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK) {
    const confirmationGate = buildWordPressMediaAttachConfirmationGate({
      task,
      mediaPreflight: task.payload?.media_preflight || task.payload?.preflight || null,
      dryRun: true
    });
    await recordAuditEvent({
      eventType: "wordpress_media_attach_confirmation_gate_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        confirmation_gate: confirmationGate
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      confirmation_gate: confirmationGate,
      message: "WordPress media attach confirmation gate completed. No media upload or attach was executed."
    });
    if (typeof onMediaAttachConfirmationCompleted === "function") {
      await onMediaAttachConfirmationCompleted({ task, confirmationGate });
    }
    const queuedExecutionPlanTask = await maybeEnqueueWordPressMediaAttachExecutionPlan({
      task,
      confirmationGate,
      enqueueTask
    });
    if (queuedExecutionPlanTask) {
      return { handled: true, dryRun: true, taskType: task.task_type, confirmationGate, queuedExecutionPlanTask };
    }
    return { handled: true, dryRun: true, taskType: task.task_type, confirmationGate };
  }

  if (task.task_type === WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK) {
    const executionPlan = buildWordPressMediaAttachExecutionPlan({
      task,
      confirmationGate: task.payload?.confirmation_gate || task.payload?.confirmationGate || null,
      finalConfirmation: task.payload?.final_confirmation || task.payload?.finalConfirmation || null,
      dryRun: true,
      env
    });
    await recordAuditEvent({
      eventType: "wordpress_media_attach_execution_plan_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        execution_plan: executionPlan
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      execution_plan: executionPlan,
      message: "WordPress media attach execution plan completed. No media upload or attach was executed."
    });
    if (typeof onMediaAttachExecutionPlanCompleted === "function") {
      await onMediaAttachExecutionPlanCompleted({ task, executionPlan });
    }
    const queuedRemoteRefetchTask = await maybeEnqueueWordPressMediaRemoteRefetchPreflight({
      task,
      executionPlan,
      enqueueTask
    });
    if (queuedRemoteRefetchTask) {
      return { handled: true, dryRun: true, taskType: task.task_type, executionPlan, queuedRemoteRefetchTask };
    }
    return { handled: true, dryRun: true, taskType: task.task_type, executionPlan };
  }

  if (task.task_type === WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK) {
    const executionPlan = task.payload?.execution_plan || task.payload?.executionPlan || null;
    const remoteResults = await resolveMediaRemoteRefetchResults({
      task,
      executionPlan,
      batchItems,
      env,
      fetchImpl
    });
    const remoteRefetchPreflight = buildWordPressMediaRemoteRefetchPreflight({
      task,
      executionPlan,
      remoteResults,
      dryRun: true
    });
    await recordAuditEvent({
      eventType: "wordpress_media_remote_refetch_preflight_completed",
      eventJson: {
        task_id: task.id,
        task_type: task.task_type,
        batch_id: task.batch_id,
        dedupe_key: task.dedupe_key,
        worker_id: workerId,
        embedded_worker: Boolean(embeddedWorker),
        remote_refetch_preflight: remoteRefetchPreflight
      }
    });
    await completeTask(task.id, {
      ...task.payload,
      dry_run: true,
      remote_refetch_preflight: remoteRefetchPreflight,
      message: "WordPress media remote refetch preflight completed. No media upload or attach was executed."
    });
    if (typeof onMediaRemoteRefetchPreflightCompleted === "function") {
      await onMediaRemoteRefetchPreflightCompleted({ task, remoteRefetchPreflight });
    }
    return { handled: true, dryRun: true, taskType: task.task_type, remoteRefetchPreflight };
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
    }) || await maybeEnqueueLiveHeroExecution({
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
        persistedKindCount(persistence, "support") > 0
      ) {
        await updateBatchItemsAfterSupportGeneration({ task, execution, persistence, generationPlan, batchItems });
      }
      if (
        typeof onHeroGenerationCompleted === "function" &&
        persistedKindCount(persistence, "hero") > 0
      ) {
        await onHeroGenerationCompleted({ task, execution, persistence, generationPlan, batchItems });
      }
      if (
        typeof onSupportGenerationCompleted === "function" &&
        persistedKindCount(persistence, "support") > 0
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

async function resolveMediaRemoteRefetchResults({ task, executionPlan, batchItems = [], env, fetchImpl }) {
  const provided = task.payload?.remote_results || task.payload?.remoteResults || null;
  if (provided) return provided;
  if (!isEnvEnabled(env, "WORDPRESS_REMOTE_READS_ENABLED")) return null;

  const operations = Array.isArray(executionPlan?.operations) ? executionPlan.operations : [];
  const uniqueTargets = new Map();
  for (const operation of operations) {
    const sku = String(operation.sku || "").trim();
    const targetSite = String(operation.target_site || "").trim();
    if (!sku) continue;
    const matchingItem = findBatchItemForOperation({ batchItems, operation });
    const brandId = operation.brand_id || matchingItem?.metadata?.brand_id || matchingItem?.brand_id || targetSite;
    uniqueTargets.set(`${sku.toLowerCase()}|${targetSite.toLowerCase()}`, {
      sku,
      target_site: targetSite,
      brand_id: brandId,
      product_name: operation.product_name || matchingItem?.product_name || matchingItem?.metadata?.product_name || "",
      product_type: matchingItem?.product_type || matchingItem?.metadata?.product_type || "",
      category: matchingItem?.category || matchingItem?.metadata?.category || "",
      subcategory: matchingItem?.subcategory || matchingItem?.metadata?.subcategory || ""
    });
  }

  const items = await Promise.all([...uniqueTargets.values()].map(async (item) => {
    const result = await runWooCommerceReadOnlyChecksForItem({ item, env, fetchImpl });
    return compactRemoteWooCheck({ item, result });
  }));
  return { items };
}

function compactRemoteWooCheck({ item, result }) {
  if (result?.status === "not_configured") {
    return {
      sku: item.sku,
      target_site: item.target_site,
      product_remote_status: "not_configured",
      blockers: ["remote_refetch_not_configured"]
    };
  }
  if (result?.status === "error") {
    return {
      sku: item.sku,
      target_site: item.target_site,
      product_remote_status: "error",
      blockers: ["remote_refetch_error"],
      error: result.error || ""
    };
  }
  const matches = Array.isArray(result?.product_by_sku?.matches) ? result.product_by_sku.matches : [];
  const match = matches[0] || null;
  if (!match) {
    return {
      sku: item.sku,
      target_site: item.target_site,
      product_remote_status: "not_found",
      blockers: ["remote_product_not_found"]
    };
  }
  return {
    sku: item.sku,
    target_site: item.target_site,
    product_remote_status: "found",
    product_id: match.id ?? null,
    permalink: match.permalink || "",
    current_main_image_id: match.current_main_image_id ?? null,
    current_gallery_image_ids: Array.isArray(match.current_gallery_image_ids) ? match.current_gallery_image_ids : [],
    media_matches: Array.isArray(match.images) ? match.images.map((image) => ({
      id: image.id,
      source_url: image.src || "",
      file_name: image.name || ""
    })) : []
  };
}

function findBatchItemForOperation({ batchItems, operation }) {
  return (batchItems || []).find((item) => {
    const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
    return item?.sku === operation.sku && (
      item?.target_site === operation.target_site ||
      metadata.target_site === operation.target_site ||
      metadata.brand_id === operation.brand_id ||
      item?.brand_id === operation.brand_id
    );
  }) || null;
}

function isEnvEnabled(env, name) {
  return ["1", "true", "yes", "on"].includes(String(env?.[name] || "").trim().toLowerCase());
}

async function maybeEnqueueLiveSupportExecution({ task, generationPlan, enqueueTask, env }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_live_support) return null;
  if (!isHeroApprovalSupportTask(task)) return null;

  const liveRequested = Boolean(task.payload?.live_generation_requested);
  const liveConfirmed = Boolean(task.payload?.live_generation_confirmed);
  const sku = task.payload?.sku || firstSku(generationPlan);
  const requestKind = hasReadyPlanRequest({ generationPlan, sku, kind: "studio_master" })
    ? "studio_master"
    : "support";
  const liveGenerationGate = buildLivePilotGenerationGate({
    generationPlan,
    mode: "all",
    requestFilter: {
      sku,
      kind: requestKind
    },
    liveRequested,
    liveConfirmed,
    env
  });

  if (!liveGenerationGate.requests.length) return null;

  const payload = {
    ...task.payload,
    action: requestKind === "studio_master"
      ? "generate_studio_master_after_hero_approval"
      : task.payload?.action === "approve_studio_master"
        ? "generate_support_after_studio_master_approval"
        : "generate_support_after_hero_approval",
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
      requestKind,
      task.batch_id || generationPlan.batch_id || "batch",
      sku || "sku",
      task.payload?.generation_id || task.generation_id || task.id
    ].join(":"),
    payload
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

function hasReadyPlanRequest({ generationPlan = {}, sku = "", kind = "" } = {}) {
  return (generationPlan.items || []).some((item) => {
    if (sku && item.sku !== sku) return false;
    return (item.generation_requests || []).some((request) => request.kind === kind);
  });
}

async function maybeEnqueueLiveHeroExecution({ task, generationPlan, enqueueTask, env }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_live_hero) return null;
  if (!isBatchApprovalHeroTask(task) && !isHeroRegenerationTask(task)) return null;

  const liveRequested = Boolean(task.payload?.live_generation_requested);
  const liveConfirmed = Boolean(task.payload?.live_generation_confirmed);
  const sku = task.payload?.sku || "";
  const liveGenerationGate = buildLivePilotGenerationGate({
    generationPlan,
    mode: "hero-only",
    requestFilter: sku ? { sku, kind: "hero" } : {},
    liveRequested,
    liveConfirmed,
    env
  });

  if (!liveGenerationGate.requests.length) return null;

  const payload = {
    ...task.payload,
    action: isHeroRegenerationTask(task) ? "regenerate_hero_after_review" : "generate_hero_after_batch_approval",
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
    priority: Number(task.priority || 100) + 1,
    dedupeKey: [
      "live-hero",
      task.batch_id || generationPlan.batch_id || "batch",
      sku || "all",
      task.id
    ].join(":"),
    dedupe_key: [
      "live-hero",
      task.batch_id || generationPlan.batch_id || "batch",
      sku || "all",
      task.id
    ].join(":"),
    payload
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

function isBatchApprovalHeroTask(task = {}) {
  return task.payload?.action === "approve_batch" &&
    task.payload?.generation_phase === "hero_after_batch_approval";
}

function isHeroRegenerationTask(task = {}) {
  return task.payload?.action === "regenerate_hero" ||
    task.payload?.source_action === "regenerate_hero" ||
    task.payload?.request_mode === "hero-regeneration-only" ||
    task.payload?.generation_phase === "hero_regeneration_after_review";
}

function persistedKindCount(persistence, kind) {
  return (persistence?.items || []).filter((item) => item.kind === kind || item.type === `${kind}_generated`).length;
}

async function maybeEnqueueWordPressMediaAttachConfirmationGate({ task, preflight, enqueueTask }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_final_confirmation_gate) return null;

  const batchId = preflight?.batch_id || task.payload?.batch_id || task.batch_id || null;
  const queuedTask = {
    taskType: WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
    task_type: WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
    batchId: task.batch_id || batchId,
    batch_id: task.batch_id || batchId,
    priority: Number(task.priority || 140) + 1,
    dedupeKey: `line:${WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK}:${batchId || task.id}`,
    dedupe_key: `line:${WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK}:${batchId || task.id}`,
    payload: {
      source: task.payload?.source || "automation_worker",
      action: "wordpress_media_attach_confirmation_gate",
      source_action: task.payload?.action || "",
      batch_id: batchId,
      line_user_id: task.payload?.line_user_id || null,
      dry_run: true,
      requires_final_confirmation: true,
      auto_enqueue_execution_plan: true,
      media_preflight: preflight
    }
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

async function maybeEnqueueWordPressMediaAttachExecutionPlan({ task, confirmationGate, enqueueTask }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_execution_plan) return null;

  const batchId = confirmationGate?.batch_id || task.payload?.batch_id || task.batch_id || null;
  const queuedTask = {
    taskType: WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK,
    task_type: WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK,
    batchId: task.batch_id || batchId,
    batch_id: task.batch_id || batchId,
    priority: Number(task.priority || 141) + 1,
    dedupeKey: `line:${WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK}:${batchId || task.id}`,
    dedupe_key: `line:${WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK}:${batchId || task.id}`,
    payload: {
      source: task.payload?.source || "automation_worker",
      action: "wordpress_media_attach_execution_plan",
      source_action: task.payload?.action || "",
      batch_id: batchId,
      line_user_id: task.payload?.line_user_id || null,
      dry_run: true,
      requires_final_confirmation: true,
      requires_remote_refetch: true,
      final_confirmation: task.payload?.final_confirmation || task.payload?.finalConfirmation || null,
      auto_enqueue_remote_refetch_preflight: true,
      confirmation_gate: confirmationGate
    }
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

async function maybeEnqueueWordPressMediaRemoteRefetchPreflight({ task, executionPlan, enqueueTask }) {
  if (typeof enqueueTask !== "function") return null;
  if (!task.payload?.auto_enqueue_remote_refetch_preflight) return null;
  if (executionPlan?.plan_status !== "ready_for_live_write_phase") return null;

  const batchId = executionPlan?.batch_id || task.payload?.batch_id || task.batch_id || null;
  const queuedTask = {
    taskType: WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK,
    task_type: WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK,
    batchId: task.batch_id || batchId,
    batch_id: task.batch_id || batchId,
    priority: Number(task.priority || 142) + 1,
    dedupeKey: `line:${WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK}:${batchId || task.id}`,
    dedupe_key: `line:${WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK}:${batchId || task.id}`,
    payload: {
      source: task.payload?.source || "automation_worker",
      action: "wordpress_media_remote_refetch_preflight",
      source_action: task.payload?.action || "",
      batch_id: batchId,
      line_user_id: task.payload?.line_user_id || null,
      dry_run: true,
      requires_final_confirmation: true,
      requires_remote_refetch: false,
      execution_plan: executionPlan,
      remote_results: task.payload?.remote_results || task.payload?.remoteResults || null
    }
  };
  await enqueueTask(queuedTask);
  return queuedTask;
}

function isHeroApprovalSupportTask(task) {
  return (
    task.payload?.action === "approve_hero" ||
    task.payload?.action === "approve_studio_master" ||
    task.payload?.source_action === "approve_hero" ||
    task.payload?.source_action === "approve_studio_master" ||
    task.payload?.request_mode === "support-only-after-approved-hero" ||
    task.payload?.request_mode === "support-only-after-approved-studio-master" ||
    task.payload?.generation_phase === "support_after_hero_approval" ||
    task.payload?.generation_phase === "support_after_studio_master_approval"
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
