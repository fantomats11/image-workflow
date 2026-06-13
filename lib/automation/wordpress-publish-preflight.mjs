import { isDryRun } from "./env.mjs";
import { runWooCommerceReadOnlyChecksForItem } from "./woocommerce-client.mjs";

export const WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK = "wordpress_product_publish_preflight";

export function buildWordPressProductPublishPreflight({
  task = {},
  batchItems = [],
  remoteChecksBySku = {},
  dryRun = true,
  now = new Date()
} = {}) {
  const items = batchItems.map((item) => buildPreflightItem(item, remoteChecksBySku[item.sku]));
  const readyItems = items.filter((item) => item.preflight_status === "ready_for_proposal");
  const blockedItems = items.filter((item) => item.preflight_status !== "ready_for_proposal");
  const existingSkuItems = items.filter((item) => item.proposed_action === "skip_existing_sku");
  const createDraftItems = items.filter((item) => item.proposed_action === "create_draft_product");
  const remoteCheckedItems = items.filter((item) => item.remote_checks?.status === "checked");
  const remoteNotConfiguredItems = items.filter((item) => item.remote_checks?.status === "not_configured");
  const remoteErrorItems = items.filter((item) => item.remote_checks?.status === "error");
  const remoteSkuExistsItems = items.filter((item) => item.blockers.includes("remote_sku_exists"));

  return {
    task_type: WORDPRESS_PRODUCT_PUBLISH_PREFLIGHT_TASK,
    task_id: task.id || null,
    batch_id: task.batch_id || null,
    dry_run: dryRun !== false,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    requires_final_confirmation: true,
    proposed_write_scope: "woocommerce_product_draft_or_media_attach",
    guardrails: [
      "fetch_current_remote_state_before_write",
      "reuse_existing_category_tag_attribute",
      "check_duplicate_sku_and_slug",
      "create_draft_before_publish",
      "log_every_remote_write"
    ],
    summary: {
      item_count: items.length,
      ready_for_proposal: readyItems.length,
      blocked: blockedItems.length,
      create_draft_product: createDraftItems.length,
      skip_existing_sku: existingSkuItems.length,
      remote_checked: remoteCheckedItems.length,
      remote_not_configured: remoteNotConfiguredItems.length,
      remote_errors: remoteErrorItems.length,
      remote_sku_exists: remoteSkuExistsItems.length
    },
    items
  };
}

export async function buildWordPressProductPublishPreflightWithRemoteChecks({
  task = {},
  batchItems = [],
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = new Date()
} = {}) {
  const shouldRunRemoteChecks = isDryRunFromEnv(env, "WORDPRESS_REMOTE_READS_ENABLED", false);
  const remoteChecksBySku = shouldRunRemoteChecks
    ? Object.fromEntries(await Promise.all(batchItems.map(async (item) => [
      item.sku,
      await runWooCommerceReadOnlyChecksForItem({
        item: batchItemToPreflightSeed(item),
        env,
        fetchImpl
      })
    ])))
    : {};

  return buildWordPressProductPublishPreflight({
    task,
    batchItems,
    remoteChecksBySku,
    dryRun: task.payload?.dry_run !== false || isDryRunFromEnv(env, "WORDPRESS_DRY_RUN", true),
    now
  });
}

function buildPreflightItem(item = {}, remoteChecks = null) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const status = String(item.status || "").trim();
  const wooStatus = String(item.woo_status || metadata.woo_status || "").trim();
  const sku = String(item.sku || "").trim();
  const brandId = String(metadata.brand_id || item.brand_id || "").trim();
  const targetSite = String(item.target_site || metadata.target_site || "").trim();
  const approved = status === "approved" || status === "awaiting_approval";
  const hasSku = Boolean(sku);
  const isExistingSku = status === "sku_exists" || wooStatus === "found" || wooStatus === "already_exists";
  const proposedAction = isExistingSku ? "skip_existing_sku" : "create_draft_product";
  const blockers = [];

  if (!hasSku) blockers.push("missing_sku");
  if (!brandId) blockers.push("missing_brand_id");
  if (!targetSite) blockers.push("missing_target_site");
  if (!approved && !isExistingSku) blockers.push("not_approved");
  const normalizedRemoteChecks = normalizeRemoteChecks(remoteChecks);
  const remoteSkuStatus = normalizedRemoteChecks?.product_by_sku?.status || "";
  let finalProposedAction = proposedAction;

  if (remoteSkuStatus === "found" && proposedAction === "create_draft_product") {
    blockers.push("remote_sku_exists");
    finalProposedAction = "review_existing_product";
  }
  if (remoteSkuStatus === "ambiguous") {
    blockers.push("remote_duplicate_sku");
    finalProposedAction = "review_existing_product";
  }
  if (normalizedRemoteChecks?.status === "error") {
    blockers.push("remote_check_failed");
  }

  return {
    batch_item_id: item.id || null,
    sku,
    brand_id: brandId,
    target_site: targetSite,
    product_type: item.product_type || metadata.product_type || "",
    product_name: item.product_name || metadata.product_name || "",
    status,
    woo_status: wooStatus,
    proposed_action: finalProposedAction,
    preflight_status: blockers.length ? "blocked" : "ready_for_proposal",
    blockers,
    remote_checks: normalizedRemoteChecks,
    remote_checks_required: isExistingSku
      ? ["fetch_product_by_sku", "confirm_no_media_change"]
      : ["fetch_product_by_sku", "fetch_categories", "fetch_tags", "fetch_attributes", "check_slug_conflict"],
    write_policy: isExistingSku
      ? "no_write_without_explicit_update_request"
      : "create_draft_only_after_final_confirmation"
  };
}

function batchItemToPreflightSeed(item = {}) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  return {
    sku: item.sku || "",
    brand_id: metadata.brand_id || item.brand_id || "",
    target_site: item.target_site || metadata.target_site || "",
    product_type: item.product_type || metadata.product_type || "",
    product_name: item.product_name || metadata.product_name || "",
    category: metadata.category || "",
    subcategory: metadata.subcategory || ""
  };
}

function normalizeRemoteChecks(remoteChecks) {
  if (!isPlainObject(remoteChecks)) return null;
  return remoteChecks;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDryRunFromEnv(env, name, fallback = true) {
  if (env === process.env) return isDryRun(name, fallback);
  const value = env?.[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}
