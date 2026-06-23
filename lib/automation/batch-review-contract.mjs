import {
  normalizeWorkflowErrors,
  resolveBatchWorkflowState,
  resolveItemWorkflowState
} from "./e2e-workflow-state.mjs";

export const BATCH_REVIEW_CONTRACT_VERSION = "batch-review-contract-v1.0";

const USER_SAFE_BLOCKER_MESSAGES_TH = Object.freeze({
  category_shortfall: "จำนวนสินค้าในหมวดนี้ไม่พอตามที่ขอ",
  missing_category_counts: "ยังไม่ได้ระบุจำนวนสินค้าในคำสั่ง",
  unknown_category: "มีหมวดสินค้าที่ระบบยังไม่รู้จัก",
  invalid_count: "จำนวนสินค้าไม่ถูกต้อง",
  count_too_large: "จำนวนสินค้ามากเกิน limit ต่อคำสั่ง",
  missing_reference_assets: "ไม่พบภาพอ้างอิงสินค้า",
  approved_hero_anchor_missing: "ไม่พบ Hero ที่อนุมัติแล้ว",
  approved_hero_anchor_requires_local_file: "Hero ที่อนุมัติแล้วยังไม่มีไฟล์ local สำหรับใช้สร้าง Support",
  generation_provider_failed: "ระบบสร้างภาพไม่สำเร็จ",
  queue_timeout: "งานค้างในคิวนานเกินไป",
  export_failed: "ส่งออกไฟล์ไม่สำเร็จ",
  google_drive_disconnected: "Google Drive ยังไม่พร้อมใช้งาน",
  permission_denied: "บัญชีนี้ไม่มีสิทธิ์ทำรายการ"
});

export function buildBatchReviewPayload({
  batch = {},
  items = [],
  tasks = [],
  profile = {},
  now = new Date(),
  hrefBase = ""
} = {}) {
  const normalizedItems = (items || []).map((item) => normalizeReviewItem(item, { batch, hrefBase }));
  const hrefs = buildBatchHrefs({ batch, hrefBase });
  const workflow = resolveBatchWorkflowState({
    batch,
    items: normalizedItems,
    tasks,
    hrefs
  });
  const itemWorkflowById = new Map();
  normalizedItems.forEach((item) => {
    const contract = resolveItemWorkflowState({ item, tasks, hrefs: buildItemHrefs({ batch, item, hrefBase }) });
    itemWorkflowById.set(item.id, contract);
  });

  const selection = isPlainObject(batch.metadata?.selection) ? batch.metadata.selection : {};
  const requestedCounts = normalizeRequestedCounts(selection.requested_counts);
  const selectedCounts = normalizeSelectedCounts(selection.selected_counts, normalizedItems);
  const itemCards = normalizedItems.map((item) => buildItemCard({
    item,
    workflow: itemWorkflowById.get(item.id),
    batch,
    tasks
  }));
  const blockers = normalizeBlockers([
    ...(Array.isArray(selection.shortfalls) ? selection.shortfalls : []),
    ...(Array.isArray(batch.metadata?.blockers) ? batch.metadata.blockers : []),
    ...itemCards.flatMap((item) => item.blockers || [])
  ]);
  const allowedActions = resolveBatchAllowedActions({
    batch,
    workflow,
    itemCards,
    tasks,
    blockers
  });
  const progress = buildProgressSummary({ workflow, itemCards, tasks });
  const isAdmin = String(profile.role || "").trim().toLowerCase() === "admin";

  return removeUndefined({
    ok: true,
    version: BATCH_REVIEW_CONTRACT_VERSION,
    generated_at: now.toISOString(),
    batch: {
      id: batch.id || null,
      batch_id: batch.batch_key || batch.batch_id || batch.id || "",
      source: batch.source || selection.source || "",
      raw_request_text: batch.command_text || selection.raw_text || "",
      requested_counts: requestedCounts,
      selected_counts: selectedCounts,
      requested_size: Number(batch.requested_size || selection.requested_size || sumCounts(requestedCounts)),
      selected_size: itemCards.filter((item) => item.selected).length,
      item_count: Number(batch.item_count || itemCards.length),
      dry_run: batch.dry_run !== false,
      created_at: batch.created_at || "",
      updated_at: batch.updated_at || ""
    },
    state: workflow.state,
    label_th: workflow.label_th,
    next_action: workflow.next_action,
    allowed_actions: allowedActions,
    blockers,
    progress,
    item_cards: itemCards,
    debug: isAdmin ? buildAdminDebug({ batch, items, tasks, workflow }) : undefined
  });
}

export function resolveBatchAllowedActions({
  batch = {},
  workflow = {},
  itemCards = [],
  tasks = [],
  blockers = []
} = {}) {
  const actions = [];
  const activeItems = itemCards.filter((item) => item.selected && item.state !== "skipped");
  const hasBlockingShortfall = blockers.some((blocker) => blocker.code === "category_shortfall");
  const hasActiveGeneration = hasActiveGenerationTask(tasks);
  const batchState = workflow.state || "";
  const batchStatus = normalizeToken(batch.status);

  if (
    activeItems.length &&
    !hasBlockingShortfall &&
    ["draft_created", "waiting_batch_review", "ready_to_confirm"].includes(batchState)
  ) {
    actions.push(actionContract("confirm_batch", "ยืนยันชุด SKU"));
  }

  if (isBatchCancelable({ batchState, batchStatus, hasActiveGeneration })) {
    actions.push(actionContract("cancel_batch", "ยกเลิกชุดงาน"));
  }

  return actions;
}

export function resolveItemAllowedActions({ item = {}, workflow = {}, tasks = [] } = {}) {
  const actions = [];
  if (isItemSkippable({ item, workflow, tasks })) {
    actions.push(actionContract("skip_item", "ข้าม SKU นี้"));
  }
  if (isItemRetryable({ item, workflow, tasks })) {
    actions.push(actionContract("retry_item", "ลองสร้างใหม่"));
  }
  return actions;
}

export function isBatchCancelable({ batchState = "", batchStatus = "", hasActiveGeneration = false } = {}) {
  if (hasActiveGeneration) return false;
  if (["cancelled", "failed", "hero_queued", "hero_generating", "hero_waiting_review", "hero_approved", "support_ready", "support_queued", "support_generating", "support_waiting_review", "support_approved", "export_ready", "exported"].includes(batchState)) {
    return false;
  }
  if (["approved", "hero_reviewed", "needs_hero_regeneration", "cancelled", "rejected"].includes(batchStatus)) return false;
  return true;
}

export function isItemSkippable({ item = {}, workflow = {}, tasks = [] } = {}) {
  if (hasActiveTaskForItem(tasks, item)) return false;
  const status = normalizeToken(item.status);
  if (["skipped", "rejected", "hero_approved", "support_ready_for_review", "support_approved_for_candidate_manifest", "exported"].includes(status)) {
    return false;
  }
  return ["selected", "missing_reference", "support_blocked_waiting_hero"].includes(workflow.state);
}

export function isItemRetryable({ item = {}, workflow = {}, tasks = [] } = {}) {
  if (hasActiveTaskForItem(tasks, item)) return false;
  return ["hero_failed", "support_failed"].includes(workflow.state);
}

export function normalizeBlockers(values = []) {
  const normalized = [];
  const seen = new Set();
  for (const value of values || []) {
    const code = normalizeBlockerCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    normalized.push({
      code,
      label_th: USER_SAFE_BLOCKER_MESSAGES_TH[code] || code
    });
  }
  return normalized;
}

function normalizeReviewItem(item = {}, { batch = {}, hrefBase = "" } = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  return {
    id: item.id || "",
    batch_id: item.batch_id || batch.id || "",
    sku: item.sku || metadata.sku || "",
    product_name: item.product_name || metadata.product_name || "",
    product_type: item.product_type || metadata.product_type || "",
    target_site: item.target_site || metadata.target_site || "",
    status: item.status || "",
    woo_status: item.woo_status || "",
    prompt_framework_version: item.prompt_framework_version || "",
    reference_url: metadata.reference_url || metadata.reference_manifest?.source_url || "",
    reference_drive_id: metadata.reference_drive_id || metadata.reference_manifest?.drive_file_id || "",
    review_href: buildReviewHref({ batch, item, hrefBase }),
    metadata
  };
}

function buildItemCard({ item, workflow, batch, tasks }) {
  const blockers = normalizeBlockers([
    ...(workflow?.errors || []),
    ...(Array.isArray(item.metadata?.blockers) ? item.metadata.blockers : []),
    ...(Array.isArray(item.metadata?.generation_blockers) ? item.metadata.generation_blockers : [])
  ]);
  const selected = !["skipped", "rejected", "sku_exists"].includes(normalizeToken(item.status));
  return {
    id: item.id,
    sku: item.sku,
    product_name: item.product_name,
    product_type: item.product_type,
    target_site: item.target_site,
    brand_id: item.metadata?.brand_id || "",
    brand_label: item.metadata?.brand_label || "",
    selected,
    state: workflow?.state || "selected",
    label_th: workflow?.label_th || "เลือก SKU แล้ว",
    next_action: workflow?.next_action || actionContract("none", "ไม่ต้องทำอะไรต่อ"),
    allowed_actions: resolveItemAllowedActions({ item, workflow, tasks }),
    blockers,
    reference: {
      has_reference: Boolean(item.reference_url || item.reference_drive_id || item.metadata?.reference_manifest),
      confidence: item.metadata?.reference_manifest?.confidence || item.metadata?.reference_confidence || "",
      source_url: item.reference_url || "",
      drive_file_id: item.reference_drive_id || ""
    },
    hrefs: {
      batch_review: buildBatchReviewHref({ batch }),
      review: item.review_href || ""
    }
  };
}

function buildProgressSummary({ workflow = {}, itemCards = [], tasks = [] } = {}) {
  const byState = {};
  for (const item of itemCards) byState[item.state] = (byState[item.state] || 0) + 1;
  const taskStatuses = {};
  for (const task of tasks || []) {
    const status = task.status || "unknown";
    taskStatuses[status] = (taskStatuses[status] || 0) + 1;
  }
  return {
    total_items: itemCards.length,
    selected_items: itemCards.filter((item) => item.selected).length,
    skipped_items: itemCards.filter((item) => item.state === "skipped").length,
    blocked_items: itemCards.filter((item) => (item.blockers || []).length).length,
    failed_items: itemCards.filter((item) => ["hero_failed", "support_failed"].includes(item.state)).length,
    waiting_review_items: itemCards.filter((item) => ["hero_waiting_review", "support_waiting_review"].includes(item.state)).length,
    completed_items: itemCards.filter((item) => ["support_approved", "exported"].includes(item.state)).length,
    by_state: byState,
    batch_item_summary: workflow.item_summary || { total: itemCards.length, by_state: byState },
    task_statuses: taskStatuses
  };
}

function buildAdminDebug({ batch = {}, items = [], tasks = [], workflow = {} } = {}) {
  return {
    batch_internal_status: batch.status || "",
    batch_metadata_keys: Object.keys(batch.metadata || {}).sort(),
    item_internal_statuses: (items || []).map((item) => ({
      id: item.id || "",
      sku: item.sku || "",
      status: item.status || "",
      metadata_keys: Object.keys(item.metadata || {}).sort()
    })),
    task_summary: (tasks || []).map((task) => ({
      id: task.id || "",
      task_type: task.task_type || "",
      status: task.status || "",
      dedupe_key: task.dedupe_key || "",
      attempts: Number(task.attempts || 0)
    })),
    workflow_state: workflow.state || ""
  };
}

function buildBatchHrefs({ batch = {}, hrefBase = "" } = {}) {
  const batchId = encodeURIComponent(batch.batch_key || batch.id || "");
  return {
    batch: `${hrefBase}/#batch-review?batch_id=${batchId}`,
    jobs: `${hrefBase}/#jobs`,
    review: `${hrefBase}/#jobs`,
    export: `${hrefBase}/#jobs`,
    reference: `${hrefBase}/#assets`
  };
}

function buildItemHrefs({ batch = {}, item = {}, hrefBase = "" } = {}) {
  return {
    ...buildBatchHrefs({ batch, hrefBase }),
    review: item.review_href || `${hrefBase}/#jobs`
  };
}

function buildReviewHref({ batch = {}, item = {}, hrefBase = "" } = {}) {
  const generationId = item.metadata?.hero_review_hero_asset?.generation_id ||
    item.metadata?.web_review_action?.generation_id ||
    item.metadata?.line_action?.generation_id ||
    "";
  if (!generationId) return "";
  const params = new URLSearchParams({
    generation_id: generationId,
    sku: item.sku || ""
  });
  const batchKey = batch.batch_key || batch.id || "";
  if (batchKey) params.set("batch_id", batchKey);
  return `${hrefBase}/#review?${params.toString()}`;
}

function buildBatchReviewHref({ batch = {} } = {}) {
  const batchId = encodeURIComponent(batch.batch_key || batch.id || "");
  return `/#batch-review?batch_id=${batchId}`;
}

function normalizeRequestedCounts(values = []) {
  return (Array.isArray(values) ? values : []).map((item) => ({
    key: item.key || "",
    label: item.label || item.product_type || item.key || "",
    product_type: item.product_type || item.label || "",
    count: Number(item.count || 0)
  }));
}

function normalizeSelectedCounts(values = {}, items = []) {
  if (isPlainObject(values) && Object.keys(values).length) return values;
  return items.reduce((acc, item) => {
    const key = item.product_type || item.metadata?.category_key || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sumCounts(counts = []) {
  return (counts || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function normalizeBlockerCode(value) {
  if (typeof value === "string") return normalizeToken(value);
  if (value?.code) return normalizeToken(value.code);
  if (value?.label_th) return normalizeToken(value.label_th);
  const mapped = normalizeWorkflowErrors([value?.message || ""])[0]?.code || "";
  return mapped || "";
}

function hasActiveGenerationTask(tasks = []) {
  return (tasks || []).some((task) => {
    const status = normalizeToken(task.status);
    if (!["queued", "running"].includes(status)) return false;
    const text = `${task.task_type || ""} ${task.payload?.generation_phase || ""} ${task.payload?.request_mode || ""}`;
    return /generate|hero|support/i.test(text);
  });
}

function hasActiveTaskForItem(tasks = [], item = {}) {
  const sku = normalizeSku(item.sku);
  return (tasks || []).some((task) => {
    const status = normalizeToken(task.status);
    if (!["queued", "running"].includes(status)) return false;
    if (task.batch_item_id && item.id && task.batch_item_id === item.id) return true;
    return sku && normalizeSku(task.payload?.sku || "") === sku;
  });
}

function actionContract(type, labelTh, href = "") {
  return {
    type,
    label_th: labelTh,
    href
  };
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeToken(value = "") {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function normalizeSku(value = "") {
  return normalizeToken(value).replace(/\s+/g, "");
}

function removeUndefined(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
