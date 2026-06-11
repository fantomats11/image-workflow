import { isDryRun } from "./env.mjs";

export function canUseSupabaseAutomation() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function buildAutomationBatchMetadata(batch = {}) {
  return {
    prompt_framework_version: batch.prompt_framework_version || batch.items?.[0]?.prompt_framework_version || "",
    selection: batch.selection || {},
    created_at: batch.created_at || null,
    brand_scope: ["rent_a_coat", "go_mall"],
    dry_run: batch.dry_run !== false
  };
}

export function buildAutomationBatchItemPayload(batchId, item = {}) {
  return {
    batch_id: batchId,
    sku: String(item.sku || "").trim(),
    product_type: item.product_type || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    status: item.woo_status === "found" ? "sku_exists" : "awaiting_approval",
    woo_status: item.woo_status || "",
    prompt_framework_version: item.prompt_framework_version || "",
    prompt_json: {
      hero_prompt: item.hero_prompt || "",
      support_prompt_preview: item.support_prompt_preview || "",
      support_shots: item.support_shots || ""
    },
    metadata: {
      ...item,
      brand_id: item.brand_id || "",
      brand_label: item.brand_label || "",
      reference_manifest: item.reference_manifest || null,
      asset_classification_summary: item.asset_classification_summary || null
    }
  };
}

export async function registerAutomationBatch(batch, { source = "script", lineUserId = "" } = {}) {
  if (!canUseSupabaseAutomation()) {
    return { ok: false, skipped: true, reason: "Supabase automation env is incomplete." };
  }

  const { supabaseAdmin } = await import("../supabase-admin.mjs");
  const batchKey = String(batch.batch_id || "").trim();
  if (!batchKey) throw new Error("Cannot register automation batch without batch.batch_id.");

  const dryRun = batch.dry_run !== false || isDryRun("AI_GENERATION_DRY_RUN", true) || isDryRun("WORDPRESS_DRY_RUN", true);
  const { data: automationBatch, error: batchError } = await supabaseAdmin
    .from("automation_batches")
    .upsert(
      {
        batch_key: batchKey,
        source,
        status: "awaiting_approval",
        dry_run: dryRun,
        requested_by_line_user_id: lineUserId || process.env.LINE_TARGET_USER_ID || null,
        requested_size: Number(batch.selection?.requested_size || batch.batch_size || batch.items?.length || 0),
        item_count: Number(batch.items?.length || 0),
        metadata: buildAutomationBatchMetadata(batch)
      },
      { onConflict: "batch_key" }
    )
    .select("*")
    .single();

  if (batchError) throw batchError;

  const items = (batch.items || [])
    .map((item) => buildAutomationBatchItemPayload(automationBatch.id, item))
    .filter((item) => item.sku);

  if (items.length) {
    const { error: itemsError } = await supabaseAdmin
      .from("automation_batch_items")
      .upsert(items, { onConflict: "batch_id,sku" });
    if (itemsError) throw itemsError;
  }

  await supabaseAdmin.from("audit_events").insert({
    actor_id: null,
    event_type: "automation_batch_registered",
    event_json: {
      source,
      batch_id: batchKey,
      automation_batch_id: automationBatch.id,
      item_count: items.length,
      dry_run: dryRun
    }
  });

  return { ok: true, batch: automationBatch, itemCount: items.length };
}
