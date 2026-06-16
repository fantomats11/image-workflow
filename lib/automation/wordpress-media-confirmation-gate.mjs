export const WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK = "wordpress_media_attach_confirmation_gate";

export function buildWordPressMediaAttachConfirmationGate({
  task = {},
  mediaPreflight = null,
  dryRun = true,
  now = new Date()
} = {}) {
  const batchId = task.batch_id || mediaPreflight?.batch_id || task.payload?.batch_id || null;
  const items = (Array.isArray(mediaPreflight?.items) ? mediaPreflight.items : [])
    .map((item) => buildConfirmationItem({ item, batchId }));
  const readyItems = items.filter((item) => item.confirmation_status === "ready_for_final_confirmation");
  const blockedItems = items.filter((item) => item.confirmation_status === "blocked_before_final_confirmation");
  const proposedOperations = items.flatMap((item) => item.proposed_operations);

  return {
    task_type: WORDPRESS_MEDIA_ATTACH_CONFIRMATION_GATE_TASK,
    task_id: task.id || null,
    batch_id: batchId,
    dry_run: dryRun !== false,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    media_attach_allowed: false,
    requires_final_confirmation: true,
    proposed_write_scope: "wordpress_media_attach_after_final_confirmation",
    gate_status: blockedItems.length ? "blocked_before_final_confirmation" : "awaiting_final_confirmation",
    guardrails: [
      "final_confirmation_required_before_media_attach",
      "no_media_upload_or_attach_in_confirmation_gate",
      "main_image_before_gallery_image",
      "reuse_existing_remote_media_when_confirmed",
      "idempotency_key_required_for_every_future_operation",
      "log_every_remote_media_write"
    ],
    source_preflight: {
      task_type: mediaPreflight?.task_type || "",
      task_id: mediaPreflight?.task_id || null,
      batch_id: mediaPreflight?.batch_id || null,
      created_at: mediaPreflight?.created_at || ""
    },
    summary: {
      item_count: items.length,
      ready_for_confirmation: readyItems.length,
      blocked: blockedItems.length,
      proposed_operations: proposedOperations.length,
      proposed_main_image_updates: proposedOperations.filter((operation) => operation.role === "main_image").length,
      proposed_gallery_image_updates: proposedOperations.filter((operation) => operation.role === "gallery_image").length
    },
    items
  };
}

function buildConfirmationItem({ item = {}, batchId = "" } = {}) {
  const sku = String(item.sku || "").trim();
  const blockers = [];
  if (item.media_status !== "ready_for_media_proposal") blockers.push("media_preflight_not_ready");
  for (const blocker of Array.isArray(item.blockers) ? item.blockers : []) {
    if (blocker && !blockers.includes(blocker)) blockers.push(blocker);
  }

  const proposedOperations = blockers.length ? [] : buildProposedOperations({ item, batchId });
  return {
    batch_item_id: item.batch_item_id || null,
    sku,
    brand_id: item.brand_id || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    media_status: item.media_status || "",
    confirmation_status: blockers.length ? "blocked_before_final_confirmation" : "ready_for_final_confirmation",
    blockers,
    requires_final_confirmation: true,
    media_attach_allowed: false,
    proposed_main_image: item.proposed_main_image ? compactAsset(item.proposed_main_image) : null,
    proposed_gallery_images: (Array.isArray(item.proposed_gallery_images) ? item.proposed_gallery_images : []).map(compactAsset),
    proposed_operations: proposedOperations,
    write_policy: "no_media_attach_until_final_confirmation"
  };
}

function buildProposedOperations({ item = {}, batchId = "" } = {}) {
  const sku = String(item.sku || "").trim();
  const operations = [];
  if (item.proposed_main_image) {
    operations.push({
      operation_type: "set_product_main_image",
      role: "main_image",
      sku,
      target_site: item.target_site || "",
      source_asset: compactAsset(item.proposed_main_image),
      idempotency_key: buildOperationKey({ sku, batchId, role: "main_image" })
    });
  }

  const galleryImages = Array.isArray(item.proposed_gallery_images) ? item.proposed_gallery_images : [];
  galleryImages.forEach((asset, index) => {
    const slot = asset.shot_key || asset.slot || asset.type || `gallery_${index + 1}`;
    operations.push({
      operation_type: "append_gallery_image",
      role: "gallery_image",
      sku,
      target_site: item.target_site || "",
      gallery_index: index + 1,
      slot,
      source_asset: compactAsset(asset),
      idempotency_key: buildOperationKey({ sku, batchId, role: "gallery", slot, index })
    });
  });

  return operations;
}

function compactAsset(asset = {}) {
  return {
    id: asset.id || asset.asset_id || null,
    sku: asset.sku || "",
    type: asset.type || asset.kind || asset.asset_type || "",
    shot_key: asset.shot_key || asset.slot || asset.shotType || asset.shot_type || "",
    status: asset.status || asset.approval_status || "",
    url: asset.url || asset.public_url || asset.image_url || asset.approved_url || "",
    storage_key: asset.storage_key || "",
    local_path: asset.local_path || asset.path || "",
    source: asset.source || ""
  };
}

function buildOperationKey({ sku = "", batchId = "", role = "", slot = "", index = 0 } = {}) {
  if (role === "main_image") {
    return `media_attach:${normalizeSegment(sku)}:${normalizeSegment(batchId)}:main_image`;
  }
  return `media_attach:${normalizeSegment(sku)}:${normalizeSegment(batchId)}:gallery:${normalizeSegment(slot || index + 1)}`;
}

function normalizeSegment(value) {
  return String(value || "unknown")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "_");
}
