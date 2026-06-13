import { WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK } from "./wordpress-publish-preflight.mjs";

export function buildMonitoringWordPressPreflights(automationTasks = []) {
  return automationTasks
    .filter((task) => task.task_type === WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK)
    .map((task) => {
      const payload = isPlainObject(task.payload) ? task.payload : {};
      const preflight = isPlainObject(payload.preflight) ? payload.preflight : null;
      if (!preflight) return null;
      const summary = isPlainObject(preflight.summary) ? preflight.summary : {};
      const items = Array.isArray(preflight.items) ? preflight.items : [];
      return {
        id: task.id,
        taskId: task.id,
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
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}
