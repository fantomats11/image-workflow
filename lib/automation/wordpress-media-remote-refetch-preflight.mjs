export const WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK = "wordpress_media_remote_refetch_preflight";

export function buildWordPressMediaRemoteRefetchPreflight({
  task = {},
  executionPlan = null,
  remoteResults = null,
  dryRun = true,
  now = new Date()
} = {}) {
  const operations = Array.isArray(executionPlan?.operations) ? executionPlan.operations : [];
  const remoteIndex = buildRemoteIndex(remoteResults);
  const groupedItems = groupOperationsBySkuAndSite(operations);
  const items = groupedItems.map((group) => buildRemoteRefetchItem({ group, remoteIndex }));
  const blockedItems = items.filter((item) => item.remote_refetch_status === "blocked_before_live_write_phase");
  const readyItems = items.filter((item) => item.remote_refetch_status === "ready_for_live_write_phase_review");
  const remoteProductsFound = items.filter((item) => item.product_remote_status === "found").length;
  const remoteProductsMissing = items.filter((item) => item.product_remote_status === "not_found").length;
  const remoteErrors = items.filter((item) => item.product_remote_status === "error").length;
  const notConfigured = items.filter((item) => item.product_remote_status === "not_configured").length;
  const operationCount = items.reduce((total, item) => total + item.operations.length, 0);
  const status = operations.length === 0
    ? "awaiting_execution_plan"
    : blockedItems.length
      ? "blocked_before_live_write_phase"
      : "ready_for_live_write_phase_review";

  return {
    task_type: WORDPRESS_MEDIA_REMOTE_REFETCH_PREFLIGHT_TASK,
    task_id: task.id || null,
    batch_id: task.batch_id || executionPlan?.batch_id || task.payload?.batch_id || null,
    dry_run: dryRun !== false,
    created_at: now.toISOString(),
    preflight_status: status,
    execution_allowed: false,
    live_write_allowed: false,
    live_writes_enabled: false,
    media_attach_allowed: false,
    requires_final_confirmation: true,
    requires_remote_refetch: false,
    remote_refetch_required_before_execution: true,
    proposed_write_scope: "wordpress_media_remote_refetch_preflight_only",
    source_execution_plan: {
      task_type: executionPlan?.task_type || "",
      task_id: executionPlan?.task_id || null,
      batch_id: executionPlan?.batch_id || null,
      plan_status: executionPlan?.plan_status || "",
      created_at: executionPlan?.created_at || ""
    },
    guardrails: [
      "remote_state_checked_before_future_media_attach",
      "product_id_must_match_sku_and_target_site",
      "existing_gallery_state_recorded_before_future_media_change",
      "idempotency_key_required_for_every_operation",
      "no_http_write_method_in_remote_refetch_preflight",
      "line_and_monitoring_summary_required"
    ],
    summary: {
      item_count: items.length,
      operation_count: operationCount,
      remote_products_found: remoteProductsFound,
      remote_products_missing: remoteProductsMissing,
      remote_not_configured: notConfigured,
      remote_errors: remoteErrors,
      ready_items: readyItems.length,
      blocked: blockedItems.length,
      current_gallery_images: items.reduce((total, item) => total + item.current_gallery_image_ids.length, 0),
      remote_media_matches: items.reduce((total, item) => total + item.media_matches.length, 0)
    },
    items
  };
}

function buildRemoteRefetchItem({ group, remoteIndex }) {
  const remote = remoteIndex.get(indexKey(group.sku, group.target_site)) || {};
  const productStatus = normalizeProductStatus(remote);
  const itemBlockers = buildItemBlockers({ productStatus, remote });
  const operations = group.operations.map((operation) => buildRemoteCheckedOperation({ operation, itemBlockers, remote }));
  const operationBlockers = operations.flatMap((operation) => operation.blockers);
  const blockers = uniqueStrings([
    ...itemBlockers,
    ...operationBlockers
  ]);
  const itemStatus = blockers.length ? "blocked_before_live_write_phase" : "ready_for_live_write_phase_review";

  return {
    sku: group.sku,
    target_site: group.target_site,
    product_remote_status: productStatus,
    product_id: remote.product_id ?? null,
    permalink: remote.permalink || "",
    current_main_image_id: remote.current_main_image_id ?? null,
    current_gallery_image_ids: normalizeList(remote.current_gallery_image_ids),
    media_matches: normalizeList(remote.media_matches).map(compactMediaMatch),
    remote_refetch_status: itemStatus,
    blockers,
    operations
  };
}

function buildRemoteCheckedOperation({ operation, itemBlockers, remote }) {
  const operationBlockers = Array.isArray(operation.blockers) ? operation.blockers.filter(Boolean) : [];
  if (!operation.idempotency_key) operationBlockers.push("missing_idempotency_key");
  const source = operation.source_asset || {};
  if (!source.url && !source.storage_key && !source.local_path) operationBlockers.push("missing_source_asset");
  const blockers = uniqueStrings([...itemBlockers, ...operationBlockers]);
  return {
    ...operation,
    current_product_id: remote.product_id ?? null,
    remote_refetch_status: blockers.length ? "blocked" : "checked",
    operation_status: blockers.length ? "blocked_before_live_write_phase" : "remote_checked_ready",
    execution_allowed: false,
    blockers
  };
}

function buildItemBlockers({ productStatus, remote }) {
  const blockers = Array.isArray(remote.blockers) ? remote.blockers.filter(Boolean) : [];
  if (productStatus === "found") return uniqueStrings(blockers);
  if (productStatus === "not_found") blockers.push("remote_product_not_found");
  if (productStatus === "error") blockers.push("remote_refetch_error");
  if (productStatus === "not_configured") blockers.push("remote_refetch_not_configured");
  return uniqueStrings(blockers);
}

function groupOperationsBySkuAndSite(operations = []) {
  const map = new Map();
  for (const operation of operations) {
    const sku = String(operation.sku || "").trim();
    const targetSite = String(operation.target_site || "").trim();
    const key = indexKey(sku, targetSite);
    if (!map.has(key)) {
      map.set(key, { sku, target_site: targetSite, operations: [] });
    }
    map.get(key).operations.push(operation);
  }
  return [...map.values()];
}

function buildRemoteIndex(remoteResults) {
  const items = Array.isArray(remoteResults?.items) ? remoteResults.items : [];
  return new Map(items.map((item) => [indexKey(item.sku, item.target_site), item]));
}

function normalizeProductStatus(remote) {
  const status = String(remote.product_remote_status || remote.status || "").trim();
  if (["found", "not_found", "error", "not_configured"].includes(status)) return status;
  if (remote.product_id) return "found";
  return "not_configured";
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function compactMediaMatch(match = {}) {
  return {
    id: match.id ?? null,
    source_url: match.source_url || match.url || "",
    file_name: match.file_name || match.name || ""
  };
}

function indexKey(sku, targetSite) {
  return `${String(sku || "").trim().toLowerCase()}|${String(targetSite || "").trim().toLowerCase()}`;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
