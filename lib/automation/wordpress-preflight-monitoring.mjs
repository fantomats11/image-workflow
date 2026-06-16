import { WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK } from "./wordpress-publish-preflight.mjs";
import { WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK } from "./wordpress-media-preflight.mjs";
import { WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK } from "./wordpress-media-confirmation-gate.mjs";
import { WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK } from "./wordpress-media-attach-execution-plan.mjs";

export function buildMonitoringWordPressPreflights(automationTasks = []) {
  return automationTasks
    .filter((task) => [
      WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK,
      WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK,
      WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
      WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK
    ].includes(task.task_type))
    .map((task) => {
      const payload = isPlainObject(task.payload) ? task.payload : {};
      if (task.task_type === WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK) {
        const executionPlan = isPlainObject(payload.execution_plan) ? payload.execution_plan : null;
        return executionPlan ? buildMediaAttachExecutionPlanRow({ task, executionPlan }) : null;
      }
      if (task.task_type === WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK) {
        const confirmationGate = isPlainObject(payload.confirmation_gate) ? payload.confirmation_gate : null;
        return confirmationGate ? buildMediaAttachConfirmationGateRow({ task, confirmationGate }) : null;
      }
      const preflight = isPlainObject(payload.preflight) ? payload.preflight : null;
      if (!preflight) return null;
      if (task.task_type === WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK) {
        return buildMediaMappingPreflightRow({ task, preflight });
      }
      return buildProductPublishPreflightRow({ task, preflight });
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
}

function buildProductPublishPreflightRow({ task, preflight }) {
  const summary = isPlainObject(preflight.summary) ? preflight.summary : {};
  const items = Array.isArray(preflight.items) ? preflight.items : [];
  return {
    id: task.id,
    taskId: task.id,
    phase: "product_publish",
    phaseLabel: "Product publish preflight",
    batchId: task.batch_id || preflight.batch_id || null,
    dedupeKey: safeText(task.dedupe_key || ""),
    status: task.status || "unknown",
    completedAt: task.completed_at || task.created_at || null,
    dryRun: preflight.dry_run !== false,
    liveWriteAllowed: preflight.live_write_allowed === true,
    liveWritesEnabled: preflight.live_writes_enabled === true,
    requiresFinalConfirmation: preflight.requires_final_confirmation !== false,
    summary: {
      itemCount: Number(summary.item_count || 0),
      readyForProposal: Number(summary.ready_for_proposal || 0),
      blocked: Number(summary.blocked || 0),
      createDraftProduct: Number(summary.create_draft_product || 0),
      skipExistingSku: Number(summary.skip_existing_sku || 0),
      remoteChecked: Number(summary.remote_checked || 0),
      remoteErrors: Number(summary.remote_errors || 0),
      remoteSkuExists: Number(summary.remote_sku_exists || 0)
    },
    items: items.slice(0, 20).map((item) => ({
      sku: safeText(item.sku || ""),
      brandId: safeText(item.brand_id || ""),
      targetSite: safeText(item.target_site || ""),
      productType: safeText(item.product_type || ""),
      preflightStatus: safeText(item.preflight_status || ""),
      proposedAction: safeText(item.proposed_action || ""),
      blockers: Array.isArray(item.blockers) ? item.blockers.slice(0, 10).map((blocker) => safeText(blocker)) : [],
      remoteStatus: safeText(item.remote_checks?.status || ""),
      remoteSkuStatus: safeText(item.remote_checks?.product_by_sku?.status || "")
    }))
  };
}

function buildMediaAttachExecutionPlanRow({ task, executionPlan }) {
  const summary = isPlainObject(executionPlan.summary) ? executionPlan.summary : {};
  const operations = Array.isArray(executionPlan.operations) ? executionPlan.operations : [];
  return {
    id: task.id,
    taskId: task.id,
    phase: "media_attach_execution_plan",
    phaseLabel: "Media attach execution plan",
    batchId: task.batch_id || executionPlan.batch_id || null,
    dedupeKey: safeText(task.dedupe_key || ""),
    status: task.status || "unknown",
    completedAt: task.completed_at || task.created_at || null,
    dryRun: executionPlan.dry_run !== false,
    liveWriteAllowed: executionPlan.live_write_allowed === true,
    liveWritesEnabled: executionPlan.live_writes_enabled === true,
    mediaAttachAllowed: executionPlan.media_attach_allowed === true,
    executionAllowed: executionPlan.execution_allowed === true,
    requiresFinalConfirmation: executionPlan.requires_final_confirmation !== false,
    requiresRemoteRefetch: executionPlan.requires_remote_refetch === true,
    planStatus: safeText(executionPlan.plan_status || ""),
    summary: {
      itemCount: Number(summary.item_count || 0),
      readyForProposal: 0,
      blocked: Number(summary.blocked || 0),
      createDraftProduct: 0,
      skipExistingSku: 0,
      remoteChecked: 0,
      remoteErrors: 0,
      remoteSkuExists: 0,
      readyForMediaProposal: 0,
      awaitingMediaAssets: 0,
      missingHeroMedia: 0,
      missingSupportMedia: 0,
      productPreflightBlocked: 0,
      mediaAssetsMatched: 0,
      proposedMainImages: 0,
      proposedGalleryImages: 0,
      readyForConfirmation: 0,
      proposedOperations: Number(summary.proposed_operations || 0),
      readyForLiveWritePhase: Number(summary.ready_for_live_write_phase || 0),
      awaitingFinalConfirmation: Number(summary.awaiting_final_confirmation || 0),
      duplicateIdempotencyKeys: Number(summary.duplicate_idempotency_keys || 0)
    },
    items: operations.slice(0, 20).map((operation) => ({
      sku: safeText(operation.sku || ""),
      targetSite: safeText(operation.target_site || ""),
      role: safeText(operation.role || ""),
      operationType: safeText(operation.operation_type || ""),
      operationStatus: safeText(operation.operation_status || ""),
      idempotencyKey: safeText(operation.idempotency_key || ""),
      blockers: Array.isArray(operation.blockers) ? operation.blockers.slice(0, 10).map((blocker) => safeText(blocker)) : [],
      remoteStatus: "",
      remoteSkuStatus: ""
    }))
  };
}

function buildMediaAttachConfirmationGateRow({ task, confirmationGate }) {
  const summary = isPlainObject(confirmationGate.summary) ? confirmationGate.summary : {};
  const items = Array.isArray(confirmationGate.items) ? confirmationGate.items : [];
  return {
    id: task.id,
    taskId: task.id,
    phase: "media_attach_confirmation",
    phaseLabel: "Media attach confirmation gate",
    batchId: task.batch_id || confirmationGate.batch_id || null,
    dedupeKey: safeText(task.dedupe_key || ""),
    status: task.status || "unknown",
    completedAt: task.completed_at || task.created_at || null,
    dryRun: confirmationGate.dry_run !== false,
    liveWriteAllowed: confirmationGate.live_write_allowed === true,
    liveWritesEnabled: confirmationGate.live_writes_enabled === true,
    mediaAttachAllowed: confirmationGate.media_attach_allowed === true,
    requiresFinalConfirmation: confirmationGate.requires_final_confirmation !== false,
    gateStatus: safeText(confirmationGate.gate_status || ""),
    summary: {
      itemCount: Number(summary.item_count || 0),
      readyForProposal: 0,
      blocked: Number(summary.blocked || 0),
      createDraftProduct: 0,
      skipExistingSku: 0,
      remoteChecked: 0,
      remoteErrors: 0,
      remoteSkuExists: 0,
      readyForMediaProposal: 0,
      awaitingMediaAssets: 0,
      missingHeroMedia: 0,
      missingSupportMedia: 0,
      productPreflightBlocked: 0,
      mediaAssetsMatched: 0,
      proposedMainImages: Number(summary.proposed_main_image_updates || 0),
      proposedGalleryImages: Number(summary.proposed_gallery_image_updates || 0),
      readyForConfirmation: Number(summary.ready_for_confirmation || 0),
      proposedOperations: Number(summary.proposed_operations || 0)
    },
    items: items.slice(0, 20).map((item) => ({
      sku: safeText(item.sku || ""),
      brandId: safeText(item.brand_id || ""),
      targetSite: safeText(item.target_site || ""),
      productType: "",
      productName: safeText(item.product_name || ""),
      confirmationStatus: safeText(item.confirmation_status || ""),
      proposedOperationCount: Array.isArray(item.proposed_operations) ? item.proposed_operations.length : 0,
      proposedMainImage: item.proposed_main_image ? safeText(item.proposed_main_image.url || item.proposed_main_image.local_path || item.proposed_main_image.storage_key || "") : "",
      proposedGalleryImageCount: Array.isArray(item.proposed_gallery_images) ? item.proposed_gallery_images.length : 0,
      blockers: Array.isArray(item.blockers) ? item.blockers.slice(0, 10).map((blocker) => safeText(blocker)) : [],
      remoteStatus: "",
      remoteSkuStatus: ""
    }))
  };
}

function buildMediaMappingPreflightRow({ task, preflight }) {
  const summary = isPlainObject(preflight.summary) ? preflight.summary : {};
  const items = Array.isArray(preflight.items) ? preflight.items : [];
  return {
    id: task.id,
    taskId: task.id,
    phase: "media_mapping",
    phaseLabel: "Media mapping preflight",
    batchId: task.batch_id || preflight.batch_id || null,
    dedupeKey: safeText(task.dedupe_key || ""),
    status: task.status || "unknown",
    completedAt: task.completed_at || task.created_at || null,
    dryRun: preflight.dry_run !== false,
    liveWriteAllowed: preflight.live_write_allowed === true,
    liveWritesEnabled: preflight.live_writes_enabled === true,
    requiresFinalConfirmation: preflight.requires_final_confirmation !== false,
    summary: {
      itemCount: Number(summary.item_count || 0),
      readyForProposal: 0,
      blocked: Number(summary.blocked || 0),
      createDraftProduct: 0,
      skipExistingSku: 0,
      remoteChecked: 0,
      remoteErrors: 0,
      remoteSkuExists: 0,
      readyForMediaProposal: Number(summary.ready_for_media_proposal || 0),
      awaitingMediaAssets: Number(summary.awaiting_media_assets || 0),
      missingHeroMedia: Number(summary.missing_hero_media || 0),
      missingSupportMedia: Number(summary.missing_support_media || 0),
      productPreflightBlocked: Number(summary.product_preflight_blocked || 0),
      mediaAssetsMatched: Number(summary.media_assets_matched || 0),
      proposedMainImages: Number(summary.proposed_main_images || 0),
      proposedGalleryImages: Number(summary.proposed_gallery_images || 0)
    },
    items: items.slice(0, 20).map((item) => ({
      sku: safeText(item.sku || ""),
      brandId: safeText(item.brand_id || ""),
      targetSite: safeText(item.target_site || ""),
      productType: safeText(item.product_type || ""),
      productName: safeText(item.product_name || ""),
      preflightStatus: safeText(item.product_preflight_status || ""),
      mediaStatus: safeText(item.media_status || ""),
      proposedAction: safeText(item.proposed_action || ""),
      proposedMainImage: item.proposed_main_image ? safeText(item.proposed_main_image.url || item.proposed_main_image.local_path || item.proposed_main_image.storage_key || "") : "",
      proposedGalleryImageCount: Array.isArray(item.proposed_gallery_images) ? item.proposed_gallery_images.length : 0,
      mediaAssetCount: Array.isArray(item.media_assets) ? item.media_assets.length : 0,
      blockers: Array.isArray(item.blockers) ? item.blockers.slice(0, 10).map((blocker) => safeText(blocker)) : [],
      remoteStatus: "",
      remoteSkuStatus: ""
    }))
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}
