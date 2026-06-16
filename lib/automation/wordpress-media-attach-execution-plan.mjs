export const WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK = "wordpress_media_attach_execution_plan";

export function buildWordPressMediaAttachExecutionPlan({
  task = {},
  confirmationGate = null,
  finalConfirmation = null,
  dryRun = true,
  env = process.env,
  now = new Date()
} = {}) {
  const batchId = task.batch_id || confirmationGate?.batch_id || task.payload?.batch_id || null;
  const finalConfirmationState = normalizeFinalConfirmation(finalConfirmation);
  const operations = collectOperations(confirmationGate).map((operation, index, allOperations) => {
    const blockers = buildOperationBlockers({ operation, allOperations });
    return {
      ...operation,
      operation_index: index + 1,
      operation_status: blockers.length
        ? "blocked_before_live_write_phase"
        : finalConfirmationState.confirmed
          ? "ready_for_live_write_phase"
          : "awaiting_final_confirmation",
      blockers,
      requires_remote_refetch: true,
      execution_allowed: false
    };
  });
  const duplicateKeys = findDuplicateIdempotencyKeys(operations);
  const blockedOperations = operations.filter((operation) => operation.operation_status === "blocked_before_live_write_phase");
  const readyOperations = operations.filter((operation) => operation.operation_status === "ready_for_live_write_phase");
  const awaitingOperations = operations.filter((operation) => operation.operation_status === "awaiting_final_confirmation");
  const planStatus = blockedOperations.length || confirmationGate?.gate_status === "blocked_before_final_confirmation"
    ? "blocked_before_live_write_phase"
    : finalConfirmationState.confirmed
      ? "ready_for_live_write_phase"
      : "awaiting_final_confirmation";

  return {
    task_type: WORDPRESS_MEDIA_ATTACH_EXECUTION_PLAN_TASK,
    task_id: task.id || null,
    batch_id: batchId,
    dry_run: dryRun !== false,
    created_at: now.toISOString(),
    plan_status: planStatus,
    execution_allowed: false,
    live_write_allowed: false,
    live_writes_enabled: isEnabled(env?.WORDPRESS_LIVE_WRITES_ENABLED),
    media_attach_allowed: false,
    requires_final_confirmation: true,
    requires_remote_refetch: true,
    proposed_write_scope: "wordpress_media_attach_execution_plan_only",
    final_confirmation: finalConfirmationState,
    guardrails: [
      "explicit_final_confirmation_required_before_media_attach",
      "remote_refetch_required_before_media_attach",
      "idempotency_key_required_for_every_operation",
      "live_write_phase_required_before_execution",
      "no_http_write_method_in_execution_plan",
      "log_every_remote_media_write"
    ],
    source_confirmation_gate: {
      task_type: confirmationGate?.task_type || "",
      task_id: confirmationGate?.task_id || null,
      batch_id: confirmationGate?.batch_id || null,
      gate_status: confirmationGate?.gate_status || "",
      created_at: confirmationGate?.created_at || ""
    },
    summary: {
      item_count: countUniqueSkus(operations),
      proposed_operations: operations.length,
      ready_for_live_write_phase: readyOperations.length,
      awaiting_final_confirmation: awaitingOperations.length,
      blocked: blockedOperations.length,
      duplicate_idempotency_keys: duplicateKeys.length
    },
    idempotency_ledger: buildIdempotencyLedger(operations, duplicateKeys),
    operations
  };
}

function collectOperations(confirmationGate) {
  const items = Array.isArray(confirmationGate?.items) ? confirmationGate.items : [];
  return items.flatMap((item) => {
    const operations = Array.isArray(item.proposed_operations) ? item.proposed_operations : [];
    return operations.map((operation) => ({
      operation_type: operation.operation_type || "",
      role: operation.role || "",
      sku: operation.sku || item.sku || "",
      target_site: operation.target_site || item.target_site || "",
      gallery_index: operation.gallery_index || null,
      slot: operation.slot || "",
      idempotency_key: operation.idempotency_key || "",
      source_asset: compactAsset(operation.source_asset || {}),
      product_name: item.product_name || "",
      brand_id: item.brand_id || ""
    }));
  });
}

function buildOperationBlockers({ operation, allOperations }) {
  const blockers = [];
  if (!operation.sku) blockers.push("missing_sku");
  if (!operation.operation_type) blockers.push("missing_operation_type");
  if (!operation.idempotency_key) blockers.push("missing_idempotency_key");
  if (operation.idempotency_key && allOperations.filter((item) => item.idempotency_key === operation.idempotency_key).length > 1) {
    blockers.push("duplicate_idempotency_key");
  }
  const source = operation.source_asset || {};
  if (!source.url && !source.storage_key && !source.local_path) blockers.push("missing_source_asset");
  return blockers;
}

function buildIdempotencyLedger(operations, duplicateKeys) {
  const duplicateSet = new Set(duplicateKeys);
  return operations.map((operation) => ({
    idempotency_key: operation.idempotency_key || "",
    sku: operation.sku || "",
    operation_type: operation.operation_type || "",
    role: operation.role || "",
    status: duplicateSet.has(operation.idempotency_key) ? "duplicate" : "unique"
  }));
}

function findDuplicateIdempotencyKeys(operations) {
  const counts = new Map();
  operations.forEach((operation) => {
    if (!operation.idempotency_key) return;
    counts.set(operation.idempotency_key, Number(counts.get(operation.idempotency_key) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

function normalizeFinalConfirmation(finalConfirmation) {
  const source = finalConfirmation && typeof finalConfirmation === "object" ? finalConfirmation : {};
  return {
    confirmed: source.confirmed === true,
    actor_id: source.actor_id || source.actorId || "",
    confirmed_at: source.confirmed_at || source.confirmedAt || "",
    note: source.note || ""
  };
}

function countUniqueSkus(operations) {
  return new Set(operations.map((operation) => operation.sku).filter(Boolean)).size;
}

function compactAsset(asset = {}) {
  return {
    id: asset.id || asset.asset_id || null,
    type: asset.type || asset.kind || asset.asset_type || "",
    shot_key: asset.shot_key || asset.slot || asset.shotType || asset.shot_type || "",
    status: asset.status || asset.approval_status || "",
    url: asset.url || asset.public_url || asset.image_url || asset.approved_url || "",
    storage_key: asset.storage_key || "",
    local_path: asset.local_path || asset.path || "",
    source: asset.source || ""
  };
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}
