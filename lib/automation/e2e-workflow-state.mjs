export const BATCH_OPERATOR_STATES = Object.freeze([
  "draft_created",
  "waiting_batch_review",
  "ready_to_confirm",
  "hero_queued",
  "hero_generating",
  "hero_waiting_review",
  "hero_approved",
  "support_ready",
  "support_queued",
  "support_generating",
  "support_waiting_review",
  "support_approved",
  "export_ready",
  "exported",
  "partially_failed",
  "failed",
  "cancelled"
]);

export const ITEM_OPERATOR_STATES = Object.freeze([
  "selected",
  "skipped",
  "missing_reference",
  "hero_pending",
  "hero_generating",
  "hero_failed",
  "hero_waiting_review",
  "hero_approved",
  "support_blocked_waiting_hero",
  "support_ready",
  "support_generating",
  "support_failed",
  "support_waiting_review",
  "support_approved",
  "exported"
]);

export const STAFF_ERROR_CODES = Object.freeze([
  "missing_reference_assets",
  "approved_hero_anchor_missing",
  "approved_hero_anchor_requires_local_file",
  "generation_provider_failed",
  "queue_timeout",
  "export_failed",
  "google_drive_disconnected",
  "permission_denied"
]);

export const E2E_WORKFLOW_STATE_VERSION = "e2e-workflow-state-v1.0";

const BATCH_LABELS_TH = Object.freeze({
  draft_created: "สร้างชุดงานแล้ว",
  waiting_batch_review: "รอตรวจชุดงาน",
  ready_to_confirm: "รอยืนยัน SKU",
  hero_queued: "รอคิวสร้าง Hero",
  hero_generating: "กำลังสร้าง Hero",
  hero_waiting_review: "รอตรวจ Hero",
  hero_approved: "อนุมัติ Hero แล้ว",
  support_ready: "พร้อมสร้าง Support",
  support_queued: "รอคิวสร้าง Support",
  support_generating: "กำลังสร้าง Support",
  support_waiting_review: "รอตรวจ Support",
  support_approved: "อนุมัติ Support แล้ว",
  export_ready: "พร้อมตรวจไฟล์ก่อนส่งออก",
  exported: "ส่งออกแล้ว",
  partially_failed: "สำเร็จบางส่วน",
  failed: "งานไม่สำเร็จ",
  cancelled: "ยกเลิกแล้ว"
});

const ITEM_LABELS_TH = Object.freeze({
  selected: "เลือก SKU แล้ว",
  skipped: "ข้าม SKU นี้",
  missing_reference: "ขาดภาพอ้างอิง",
  hero_pending: "รอสร้าง Hero",
  hero_generating: "กำลังสร้าง Hero",
  hero_failed: "สร้าง Hero ไม่สำเร็จ",
  hero_waiting_review: "รอตรวจ Hero",
  hero_approved: "อนุมัติ Hero แล้ว",
  support_blocked_waiting_hero: "Support ถูกล็อก รออนุมัติ Hero",
  support_ready: "พร้อมสร้าง Support",
  support_generating: "กำลังสร้าง Support",
  support_failed: "สร้าง Support ไม่สำเร็จ",
  support_waiting_review: "รอตรวจ Support",
  support_approved: "อนุมัติ Support แล้ว",
  exported: "ส่งออกแล้ว"
});

const STAFF_ERROR_LABELS_TH = Object.freeze({
  missing_reference_assets: "ไม่พบภาพอ้างอิงสินค้า",
  approved_hero_anchor_missing: "ไม่พบ Hero ที่อนุมัติแล้ว",
  approved_hero_anchor_requires_local_file: "Hero ที่อนุมัติแล้วยังไม่มีไฟล์ local สำหรับใช้สร้าง Support",
  generation_provider_failed: "ระบบสร้างภาพไม่สำเร็จ",
  queue_timeout: "งานค้างในคิวนานเกินไป",
  export_failed: "ส่งออกไฟล์ไม่สำเร็จ",
  google_drive_disconnected: "Google Drive ยังไม่พร้อมใช้งาน",
  permission_denied: "บัญชีนี้ไม่มีสิทธิ์ทำรายการ"
});

const FINAL_STATES = new Set(["exported", "failed", "cancelled", "skipped"]);
const FAILURE_STATES = new Set(["hero_failed", "support_failed"]);
const SUPPORT_ACTIVE_STATES = new Set([
  "support_ready",
  "support_generating",
  "support_waiting_review",
  "support_approved",
  "exported"
]);

export function getBatchOperatorStateContract(state) {
  return buildStateContract({
    state: normalizeKnownState(state, BATCH_OPERATOR_STATES, "draft_created"),
    labelMap: BATCH_LABELS_TH,
    scope: "batch"
  });
}

export function getItemOperatorStateContract(state) {
  return buildStateContract({
    state: normalizeKnownState(state, ITEM_OPERATOR_STATES, "selected"),
    labelMap: ITEM_LABELS_TH,
    scope: "item"
  });
}

export function resolveBatchWorkflowState({
  batch = {},
  items = [],
  tasks = [],
  hrefs = {}
} = {}) {
  const itemContracts = (items || []).map((item) => resolveItemWorkflowState({ item, tasks, hrefs }));
  const state = deriveBatchState({ batch, itemContracts, tasks });
  const contract = getBatchOperatorStateContract(state);
  return {
    ...contract,
    version: E2E_WORKFLOW_STATE_VERSION,
    batch_id: batch.batch_key || batch.batch_id || batch.id || "",
    internal_status: batch.status || "",
    next_action: buildNextAction({ state, scope: "batch", hrefs, itemContracts }),
    item_summary: summarizeItemContracts(itemContracts),
    items: itemContracts
  };
}

export function resolveItemWorkflowState({
  item = {},
  tasks = [],
  hrefs = {}
} = {}) {
  const state = deriveItemState({ item, tasks });
  const contract = getItemOperatorStateContract(state);
  const errors = normalizeWorkflowErrors([
    ...(Array.isArray(item.blockers) ? item.blockers : []),
    ...(Array.isArray(item.metadata?.blockers) ? item.metadata.blockers : []),
    ...(Array.isArray(item.metadata?.generation_blockers) ? item.metadata.generation_blockers : []),
    ...(Array.isArray(item.metadata?.media_export_preflight_gate?.gate_blockers)
      ? item.metadata.media_export_preflight_gate.gate_blockers
      : [])
  ]);

  return {
    ...contract,
    version: E2E_WORKFLOW_STATE_VERSION,
    sku: item.sku || "",
    internal_status: item.status || "",
    next_action: buildNextAction({ state, scope: "item", hrefs, item }),
    errors
  };
}

export function mapInternalBatchStatus(status = "") {
  const normalized = normalizeToken(status);
  if (["cancelled", "canceled", "rejected", "reject_batch"].includes(normalized)) return "cancelled";
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["exported", "completed_exported"].includes(normalized)) return "exported";
  if (["needs_review", "review_batch"].includes(normalized)) return "waiting_batch_review";
  if (["awaiting_approval", "received", "ready_to_confirm"].includes(normalized)) return "ready_to_confirm";
  if (["approved", "approve_batch"].includes(normalized)) return "hero_queued";
  if (["draft", "draft_created"].includes(normalized)) return "draft_created";
  return "draft_created";
}

export function mapInternalItemStatus(status = "") {
  const normalized = normalizeToken(status);
  if (["rejected", "reject_sku", "sku_exists", "skipped"].includes(normalized)) return "skipped";
  if (["missing_reference", "missing_reference_assets"].includes(normalized)) return "missing_reference";
  if (["hero_failed"].includes(normalized)) return "hero_failed";
  if (["support_failed"].includes(normalized)) return "support_failed";
  if (["hero_approved", "approved"].includes(normalized)) return "hero_approved";
  if (["needs_hero_regeneration"].includes(normalized)) return "hero_pending";
  if (["support_ready_for_review", "awaiting_support_review", "support_ready_for_review"].includes(normalized)) {
    return "support_waiting_review";
  }
  if (["support_approved_for_candidate_manifest", "candidate_manifest_ready"].includes(normalized)) {
    return "support_approved";
  }
  if (["exported"].includes(normalized)) return "exported";
  if (["awaiting_approval", "selected", "received"].includes(normalized)) return "selected";
  return normalized ? "selected" : "selected";
}

export function normalizeWorkflowErrors(values = []) {
  const errors = Array.from(new Set((values || []).flatMap((value) => mapInternalErrorCode(value)).filter(Boolean)));
  return errors.map((code) => ({
    code,
    label_th: STAFF_ERROR_LABELS_TH[code] || code
  }));
}

export function validateE2EWorkflowInvariants({
  itemState = "",
  approvedHeroAnchor = null,
  generationRequest = null,
  env = {},
  action = null,
  lineWebhookLongRunning = false,
  retryAssetKeys = []
} = {}) {
  const violations = [];
  const normalizedItemState = normalizeKnownState(itemState, ITEM_OPERATOR_STATES, "");
  const hasApprovedHero = Boolean(approvedHeroAnchor || generationRequest?.approved_hero_anchor);

  if (SUPPORT_ACTIVE_STATES.has(normalizedItemState) && !hasApprovedHero) {
    violations.push("support_generation_requires_approved_hero");
  }

  if (generationRequest?.kind === "support") {
    violations.push(...validateSupportModelInputFiles(generationRequest.model_input_files || []));
  }

  if (isWordPressLiveWriteEnabled(env)) {
    violations.push("wordpress_live_write_must_remain_disabled");
  }

  if (lineWebhookLongRunning) {
    violations.push("line_webhook_must_not_run_long_generation");
  }

  if (action?.type === "confirm_batch" && !action.dedupe_key) {
    violations.push("batch_confirmation_requires_dedupe_key");
  }
  if (action?.type === "approve_hero" && !action.dedupe_key) {
    violations.push("approve_hero_requires_dedupe_key");
  }

  const duplicates = findDuplicates(retryAssetKeys.filter(Boolean));
  if (duplicates.length) {
    violations.push("retry_must_not_duplicate_final_assets");
  }

  return Array.from(new Set(violations));
}

export function validateSupportModelInputFiles(modelInputFiles = []) {
  const violations = [];
  const files = Array.isArray(modelInputFiles) ? modelInputFiles : [];
  if (!files.length || files[0]?.source_role !== "approved_hero_anchor") {
    violations.push("support_first_model_input_must_be_approved_hero_anchor");
  }
  if (files[0]?.source_role === "approved_hero_anchor" && !files[0]?.local_path) {
    violations.push("approved_hero_anchor_requires_local_file");
  }
  files.slice(1).forEach((file, index) => {
    if (file?.source_role !== "product_reference") {
      violations.push(`support_reference_input_${index + 2}_must_follow_hero_anchor`);
    }
  });
  return violations;
}

function deriveBatchState({ batch, itemContracts, tasks }) {
  const internalState = mapInternalBatchStatus(batch.status || "");
  if (["cancelled", "failed", "ready_to_confirm", "waiting_batch_review", "draft_created"].includes(internalState)) {
    return internalState;
  }

  const states = itemContracts.map((item) => item.state);
  const activeStates = states.filter((state) => !["skipped"].includes(state));
  if (!activeStates.length) return internalState;
  if (activeStates.every((state) => state === "exported")) return "exported";
  if (activeStates.some((state) => FAILURE_STATES.has(state)) && activeStates.some((state) => !FAILURE_STATES.has(state))) {
    return "partially_failed";
  }
  if (activeStates.every((state) => FAILURE_STATES.has(state))) return "failed";
  if (activeStates.every((state) => state === "support_approved" || state === "exported")) return "export_ready";
  if (activeStates.some((state) => state === "support_approved")) return "support_approved";
  if (activeStates.some((state) => state === "support_waiting_review")) return "support_waiting_review";
  if (hasTask(tasks, { kind: "support", statuses: ["running"] })) return "support_generating";
  if (hasTask(tasks, { kind: "support", statuses: ["queued"] })) return "support_queued";
  if (activeStates.every((state) => state === "support_ready" || state === "support_waiting_review" || state === "support_approved" || state === "exported")) {
    return "support_ready";
  }
  if (activeStates.every((state) => state === "hero_approved" || state === "support_ready")) return "hero_approved";
  if (activeStates.some((state) => state === "hero_waiting_review")) return "hero_waiting_review";
  if (hasTask(tasks, { kind: "hero", statuses: ["running"] }) || activeStates.some((state) => state === "hero_generating")) {
    return "hero_generating";
  }
  if (hasTask(tasks, { kind: "hero", statuses: ["queued"] })) return "hero_queued";
  return internalState;
}

function deriveItemState({ item, tasks }) {
  const metadata = item.metadata || {};
  const internalState = mapInternalItemStatus(item.status || "");
  if (FINAL_STATES.has(internalState) || ["missing_reference", "hero_failed", "support_failed", "support_waiting_review", "support_approved"].includes(internalState)) {
    return internalState;
  }
  if (!hasReference(item)) return "missing_reference";
  if (hasExport(item)) return "exported";
  if (isSupportApproved(metadata)) return "support_approved";
  if (isSupportWaitingReview(item, metadata)) return "support_waiting_review";
  if (hasTask(tasks, { sku: item.sku, kind: "support", statuses: ["running"] })) return "support_generating";
  if (isHeroApproved(item, metadata)) {
    if (hasApprovedHeroAnchor(item, metadata)) return "support_ready";
    return "hero_approved";
  }
  if (hasHeroReviewAsset(item, metadata)) return "hero_waiting_review";
  if (hasTask(tasks, { sku: item.sku, kind: "hero", statuses: ["running"] })) return "hero_generating";
  if (hasTask(tasks, { sku: item.sku, kind: "hero", statuses: ["queued"] })) return "hero_pending";
  if (internalState === "selected") return "support_blocked_waiting_hero";
  return internalState;
}

function buildStateContract({ state, labelMap, scope }) {
  return {
    scope,
    state,
    label_th: labelMap[state] || state
  };
}

function buildNextAction({ state, scope, hrefs = {}, itemContracts = [], item = {} }) {
  const href = hrefs[state] || hrefs.review || item.review_href || item.href || "";
  const actions = {
    draft_created: ["review_batch", "ตรวจชุดงาน", hrefs.batch || ""],
    waiting_batch_review: ["open_batch_review", "เปิด Batch Review", hrefs.batch || ""],
    ready_to_confirm: ["confirm_batch", "ยืนยันชุด SKU", hrefs.batch || ""],
    hero_queued: ["wait_system", "รอระบบเริ่มสร้าง Hero", ""],
    hero_generating: ["wait_system", "รอระบบสร้าง Hero", ""],
    hero_waiting_review: ["open_review", "เปิดหน้าตรวจ Hero", href],
    hero_approved: ["wait_system", "รอระบบเตรียม Support", ""],
    support_ready: ["wait_system", "รอระบบสร้าง Support", ""],
    support_queued: ["wait_system", "รอคิวสร้าง Support", ""],
    support_generating: ["wait_system", "รอระบบสร้าง Support", ""],
    support_waiting_review: ["open_review", "เปิดหน้าตรวจ Support", href],
    support_approved: ["open_export_preflight", "เปิดหน้าตรวจไฟล์ก่อนส่งออก", hrefs.export || ""],
    export_ready: ["open_export_preflight", "เปิดหน้าตรวจไฟล์ก่อนส่งออก", hrefs.export || ""],
    exported: ["none", "ไม่ต้องทำอะไรต่อ", ""],
    partially_failed: ["inspect_failure", "ตรวจรายการที่ไม่สำเร็จ", hrefs.jobs || ""],
    failed: ["inspect_failure", "ตรวจงานที่ไม่สำเร็จ", hrefs.jobs || ""],
    cancelled: ["none", "ไม่ต้องทำอะไรต่อ", ""],
    selected: ["wait_system", "รอระบบสร้าง Hero", ""],
    skipped: ["none", "ไม่ต้องทำอะไรต่อ", ""],
    missing_reference: ["resolve_reference", "เพิ่มหรือตรวจภาพอ้างอิง", hrefs.reference || ""],
    hero_pending: ["wait_system", "รอระบบสร้าง Hero", ""],
    hero_failed: ["inspect_failure", "ตรวจงานสร้าง Hero ที่ไม่สำเร็จ", hrefs.jobs || ""],
    support_blocked_waiting_hero: ["open_review", "เปิดหน้าตรวจ Hero", href],
    support_failed: ["inspect_failure", "ตรวจงานสร้าง Support ที่ไม่สำเร็จ", hrefs.jobs || ""]
  };
  const [type, labelTh, actionHref] = actions[state] || ["inspect", "ตรวจสถานะ", hrefs.jobs || ""];
  return {
    type,
    label_th: scope === "batch" && state === "hero_waiting_review" && itemContracts.length > 1
      ? "เปิดรายการที่รอตรวจ Hero"
      : labelTh,
    href: actionHref
  };
}

function mapInternalErrorCode(value = "") {
  const normalized = normalizeToken(value);
  if ([
    "missing_reference_url",
    "reference_assets_need_resolution",
    "reference_assets_need_model_input_staging",
    "missing_model_input_files",
    "missing_staged_model_input_file",
    "candidate_manifest_not_ready_for_media_preflight"
  ].includes(normalized)) return "missing_reference_assets";
  if (["support_requires_approved_hero_anchor", "missing_approved_hero_anchor", "missing_hero_candidate"].includes(normalized)) {
    return "approved_hero_anchor_missing";
  }
  if (["approved_hero_anchor_requires_local_file"].includes(normalized)) return "approved_hero_anchor_requires_local_file";
  if (["provider_failed", "generation_provider_failed", "fal_failed", "image_generation_failed"].includes(normalized)) {
    return "generation_provider_failed";
  }
  if (["queue_timeout", "task_timeout", "stuck_queued"].includes(normalized)) return "queue_timeout";
  if (["export_failed", "drive_export_failed", "media_export_failed"].includes(normalized)) return "export_failed";
  if (["google_drive_disconnected", "missing_google_drive_oauth", "drive_not_ready"].includes(normalized)) return "google_drive_disconnected";
  if (["permission_denied", "unauthorized", "forbidden", "auth_required"].includes(normalized)) return "permission_denied";
  return STAFF_ERROR_CODES.includes(normalized) ? normalized : "";
}

function summarizeItemContracts(items) {
  const byState = {};
  for (const item of items) {
    byState[item.state] = (byState[item.state] || 0) + 1;
  }
  return {
    total: items.length,
    by_state: byState
  };
}

function hasReference(item = {}) {
  const metadata = item.metadata || {};
  return Boolean(
    item.reference_url ||
    item.reference_drive_id ||
    metadata.reference_url ||
    metadata.reference_drive_id ||
    metadata.reference_manifest?.source_url ||
    metadata.reference_manifest?.drive_file_id ||
    (Array.isArray(metadata.reference_assets) && metadata.reference_assets.length) ||
    (Array.isArray(metadata.selected_reference_assets) && metadata.selected_reference_assets.length)
  );
}

function hasExport(item = {}) {
  const metadata = item.metadata || {};
  return Boolean(
    item.export_url ||
    item.exported_at ||
    metadata.export_url ||
    metadata.exported_at ||
    metadata.wordpress_export?.status === "exported"
  );
}

function isHeroApproved(item = {}, metadata = {}) {
  const status = normalizeToken(item.status);
  const lineAction = normalizeToken(metadata.line_action?.last_action);
  const webAction = normalizeToken(metadata.web_review_action?.last_action);
  return status === "hero_approved" || lineAction === "approve_hero" || webAction === "approve_hero";
}

function hasApprovedHeroAnchor(item = {}, metadata = {}) {
  return Boolean(
    item.approved_hero_anchor ||
    metadata.approved_hero_anchor ||
    metadata.hero_review_hero_asset?.approved ||
    metadata.hero_review_hero_asset?.asset_id ||
    metadata.hero_asset?.approval_id
  );
}

function hasHeroReviewAsset(item = {}, metadata = {}) {
  return Boolean(
    item.hero_asset ||
    item.hero_generation_id ||
    metadata.hero_review_hero_asset ||
    metadata.latest_hero_asset ||
    metadata.hero_generation?.status === "hero_ready"
  );
}

function isSupportWaitingReview(item = {}, metadata = {}) {
  return Boolean(
    normalizeToken(item.status) === "support_ready_for_review" ||
    metadata.review_set_status === "awaiting_support_review" ||
    metadata.support_generation?.status === "support_ready_for_review" ||
    (Array.isArray(metadata.support_assets) && metadata.support_assets.length)
  );
}

function isSupportApproved(metadata = {}) {
  const decisionState = metadata.support_review_decision_state || {};
  return Boolean(
    decisionState.candidate_manifest_ready ||
    metadata.candidate_manifest_status === "ready_for_media_manifest_preflight" ||
    metadata.support_candidate_manifest?.manifest_status === "ready_for_media_manifest_preflight"
  );
}

function hasTask(tasks = [], { sku = "", kind = "", statuses = [] } = {}) {
  const statusSet = new Set(statuses.map(normalizeToken));
  return (tasks || []).some((task) => {
    const payload = task.payload || {};
    const taskStatus = normalizeToken(task.status);
    if (statusSet.size && !statusSet.has(taskStatus)) return false;
    if (sku && normalizeSku(payload.sku || task.sku) !== normalizeSku(sku)) return false;
    if (!kind) return true;
    const text = [
      task.task_type,
      payload.action,
      payload.generation_phase,
      payload.request_mode,
      payload.kind
    ].filter(Boolean).join(" ").toLowerCase();
    if (kind === "hero") return /hero/.test(text);
    if (kind === "support") return /support/.test(text);
    return false;
  });
}

function isWordPressLiveWriteEnabled(env = {}) {
  return ["1", "true", "yes", "on"].includes(String(env.WORDPRESS_LIVE_WRITES_ENABLED || "").trim().toLowerCase());
}

function normalizeKnownState(value, allowed, fallback) {
  const normalized = normalizeToken(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeToken(value = "") {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function normalizeSku(value = "") {
  return normalizeToken(value).replace(/\s+/g, "");
}

function findDuplicates(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates);
}
