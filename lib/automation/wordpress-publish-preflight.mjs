import { isDryRun } from "./env.mjs";
import {
  createWooCommerceClient,
  getWooCommerceConfigForBrand,
  runWooCommerceReadOnlyChecksForItem
} from "./woocommerce-client.mjs";

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
  const liveWritesEnabled = dryRun === false;
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
    live_write_allowed: liveWritesEnabled,
    live_writes_enabled: liveWritesEnabled,
    requires_final_confirmation: !liveWritesEnabled,
    proposed_write_scope: liveWritesEnabled ? "woocommerce_product_draft_with_taxonomy_creation" : "woocommerce_product_draft_or_media_attach",
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
      taxonomy_terms_proposed: items.reduce((total, item) => total + item.taxonomy_plan.categories.length + item.taxonomy_plan.tags.length, 0),
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
    dryRun: task.payload?.dry_run === undefined
      ? isDryRunFromEnv(env, "WORDPRESS_DRY_RUN", true)
      : task.payload.dry_run !== false,
    now
  });
}

export async function executeWooCommerceProductDraftPublish({
  item = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = new Date()
} = {}) {
  const seed = buildPreflightItem(item, null);
  if (seed.preflight_status !== "ready_for_proposal") {
    return {
      status: "blocked",
      sku: seed.sku,
      blockers: seed.blockers,
      created_at: now.toISOString()
    };
  }
  const config = getWooCommerceConfigForBrand(seed.brand_id, env);
  if (!config.configured) {
    return {
      status: "not_configured",
      sku: seed.sku,
      missing_config: config.missing,
      created_at: now.toISOString()
    };
  }
  const client = createWooCommerceClient({
    config,
    fetchImpl,
    timeoutMs: Number(env.WORDPRESS_HTTP_TIMEOUT_MS || 15000)
  });
  const categoryEntities = [];
  for (const categoryName of seed.taxonomy_plan.categories) {
    const category = await client.resolveOrCreateCategory(categoryName);
    if (category?.id) categoryEntities.push(category);
  }
  const tagEntities = [];
  for (const tagName of seed.taxonomy_plan.tags) {
    const tag = await client.resolveOrCreateTag(tagName);
    if (tag?.id) tagEntities.push(tag);
  }
  const product = await client.createProductDraft({
    ...seed.publish_payload,
    categories: categoryEntities.map((category) => ({ id: category.id })),
    tags: tagEntities.map((tag) => ({ id: tag.id }))
  });
  return {
    status: "draft_created",
    sku: seed.sku,
    product_id: product?.id ?? null,
    permalink: product?.permalink || "",
    created_at: now.toISOString(),
    categories: categoryEntities,
    tags: tagEntities,
    product
  };
}

function buildPreflightItem(item = {}, remoteChecks = null) {
  const metadata = isPlainObject(item.metadata) ? item.metadata : {};
  const status = String(item.status || "").trim();
  const wooStatus = String(item.woo_status || metadata.woo_status || "").trim();
  const sku = String(item.sku || "").trim();
  const brandId = String(metadata.brand_id || item.brand_id || "").trim();
  const targetSite = String(item.target_site || metadata.target_site || "").trim();
  const category = String(metadata.category || item.category || "").trim();
  const subcategory = String(metadata.subcategory || item.subcategory || "").trim();
  const productName = item.product_name || metadata.product_name || "";
  const taxonomyPlan = buildWordPressTaxonomyPlan({
    ...metadata,
    category,
    subcategory,
    product_name: productName,
    branch: targetSite,
    brand_id: brandId
  });
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
    product_name: productName,
    category,
    subcategory,
    status,
    woo_status: wooStatus,
    proposed_action: finalProposedAction,
    preflight_status: blockers.length ? "blocked" : "ready_for_proposal",
    blockers,
    taxonomy_plan: taxonomyPlan,
    publish_payload: buildWooCommerceDraftPayload({
      sku,
      productName,
      productType: item.product_type || metadata.product_type || "",
      metadata,
      taxonomyPlan
    }),
    remote_checks: normalizedRemoteChecks,
    remote_checks_required: isExistingSku
      ? ["fetch_product_by_sku", "confirm_no_media_change"]
      : ["fetch_product_by_sku", "fetch_categories", "fetch_tags", "fetch_attributes", "check_slug_conflict"],
    write_policy: isExistingSku
      ? "no_write_without_explicit_update_request"
      : "create_draft_only_after_final_confirmation"
  };
}

export function buildWordPressTaxonomyPlan(metadata = {}) {
  const category = String(metadata.category || "").trim();
  const subcategory = String(metadata.subcategory || "").trim();
  const mappedCategory = mapCatalogCategoryToWooCategory(category);
  const categories = [mappedCategory, subcategory && subcategory !== category ? subcategory : ""]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const tags = generateSeoTagNames({
    ...metadata,
    category,
    subcategory
  });
  return {
    categories: [...new Set(categories)],
    tags
  };
}

function buildWooCommerceDraftPayload({ sku = "", productName = "", productType = "", metadata = {}, taxonomyPlan = {} } = {}) {
  const name = productName || metadata.product_name || sku;
  return {
    name,
    sku,
    type: "simple",
    status: "draft",
    catalog_visibility: "visible",
    short_description: metadata.short_description || metadata.feature_notes || metadata.notes || "",
    description: metadata.description || metadata.feature_notes || "",
    meta_data: [
      { key: "_image_workflow_sku", value: sku },
      { key: "_image_workflow_product_type", value: productType || metadata.product_type || "" },
      { key: "_image_workflow_taxonomy_categories", value: taxonomyPlan.categories || [] },
      { key: "_image_workflow_taxonomy_tags", value: taxonomyPlan.tags || [] }
    ]
  };
}

function mapCatalogCategoryToWooCategory(category = "") {
  const text = String(category || "").trim();
  const lower = text.toLowerCase();
  if (!text) return "";
  if (lower.includes("โค้ท") || lower.includes("coat") || lower.includes("jacket") || lower.includes("กันหนาว") || lower.includes("เสื้อ")) {
    return "เสื้อกันหนาว & เสื้อโค้ท";
  }
  if (lower.includes("กางเกง") || lower.includes("pant") || lower.includes("trouser")) return "กางเกง";
  if (lower.includes("รองเท้า") || lower.includes("shoe") || lower.includes("boot")) return "รองเท้า";
  if (lower.includes("เอี๊ยม") || lower.includes("overall") || lower.includes("bib")) return "เอี๊ยม";
  if (lower.includes("ลองจอน") || lower.includes("long john") || lower.includes("longjohn")) return "ลองจอน";
  if (lower.includes("สกี") || lower.includes("ski")) return "ชุดสกี";
  return text;
}

export function generateSeoTagNames(metadata = {}) {
  const tags = [];
  const brand = String(metadata.brand || metadata.product_brand || metadata.productBrand || "").trim();
  const color = String(metadata.color || metadata.color_name || metadata.colorName || "").trim();
  const gender = String(metadata.gender || metadata.gender_name || metadata.genderName || "").trim();
  const branch = String(metadata.branch || metadata.target_site || metadata.targetSite || "").trim();
  const category = String(metadata.category || "").trim();
  const subcategory = String(metadata.subcategory || "").trim();
  const combined = `${category} ${subcategory}`.toLowerCase();
  const isRent = /rent|เช่า|rent_a_coat|rentacoat/i.test(branch);

  if (brand && brand !== "-") {
    tags.push(brand);
    if (isRent) tags.push(`เช่า ${brand}`);
  }
  if (color && color !== "-") tags.push(color.startsWith("สี") ? color : `สี${color}`);
  const genderThai = normalizeGenderTag(gender);
  if (genderThai) tags.push(genderThai);

  const isOuterwear = (combined.includes("เสื้อ") || combined.includes("โค้ท") || combined.includes("coat") || combined.includes("jacket") || combined.includes("กันหนาว") || combined.includes("ขนเป็ด")) &&
    !/(กางเกง|ถุงมือ|ถุงเท้า|หมวก|ผ้าพันคอ|รองเท้า|ลองจอน|เอี๊ยม)/.test(combined);
  if (isOuterwear) {
    tags.push("เสื้อกันหนาว", "เสื้อโค้ท");
    if (combined.includes("ขนเป็ด") || combined.includes("down")) tags.push("เสื้อโค้ทขนเป็ด", "เสื้อกันหนาวขนเป็ด");
    if (isRent) tags.push("เช่าเสื้อกันหนาว", "เช่าเสื้อโค้ท");
  }
  if (/กางเกง|pant|trouser|jean/.test(combined)) {
    tags.push("กางเกงกันหนาว");
    if (/สกี|ski/.test(combined)) tags.push("กางเกงสกี");
    if (isRent) tags.push("เช่ากางเกงกันหนาว");
  }
  if (/รองเท้า|shoe|boot|บูท/.test(combined)) {
    tags.push("รองเท้ากันหนาว", "รองเท้าลุยหิมะ");
    if (/บูท|boot/.test(combined)) tags.push("รองเท้าบูท");
    if (isRent) tags.push("เช่ารองเท้ากันหนาว");
  }
  if (/เอี๊ยม|overall|bib|salopette/.test(combined)) {
    tags.push("เอี๊ยมกันหนาว", "เอี๊ยมสกี");
    if (isRent) tags.push("เช่าเอี๊ยมกันหนาว");
  }
  if (/ลองจอน|long john|longjohn|ชั้นใน/.test(combined)) tags.push("ลองจอน", "ชุดลองจอน", "ลองจอนกันหนาว", "ชุดชั้นในกันหนาว");
  if (/คอเต่า|turtleneck|turtle/.test(combined)) tags.push("เสื้อคอเต่า", "คอเต่ากันหนาว");
  if (/คอปีน|mock neck|mockneck/.test(combined)) tags.push("เสื้อคอปีน", "คอปีนกันหนาว");
  if (/สกี|ski/.test(combined)) {
    tags.push("ชุดสกี", "ชุดเล่นหิมะ");
    if (isRent) tags.push("เช่าชุดสกี");
  }
  if (/หมวก|hat|beanie|cap|บีนนี่/.test(combined)) tags.push("หมวกกันหนาว", "หมวกไหมพรม", ...(combined.includes("beanie") || combined.includes("บีนนี่") ? ["หมวกบีนนี่"] : []));
  if (/ถุงมือ|glove|mitten/.test(combined)) tags.push("ถุงมือกันหนาว", ...(combined.includes("หนัง") || combined.includes("leather") ? ["ถุงมือหนัง"] : []), ...(combined.includes("สกี") || combined.includes("ski") ? ["ถุงมือสกี"] : []));
  if (/ถุงเท้า|sock/.test(combined)) tags.push("ถุงเท้ากันหนาว", "ถุงเท้าไหมพรม", "ถุงเท้าวูล");
  if (/ผ้าพันคอ|scarf|muffler/.test(combined)) tags.push("ผ้าพันคอ", "ผ้าพันคอกันหนาว", "ผ้าพันคอไหมพรม");

  if (genderThai) {
    if (tags.includes("เสื้อกันหนาว")) tags.push(`เสื้อกันหนาว${genderThai}`);
    if (tags.includes("เสื้อโค้ท")) tags.push(`เสื้อโค้ท${genderThai}`);
    if (tags.includes("กางเกงกันหนาว")) tags.push(`กางเกงกันหนาว${genderThai}`);
    if (tags.includes("ชุดสกี")) tags.push(`ชุดสกี${genderThai}`);
    if (tags.includes("ลองจอน")) tags.push(`ลองจอน${genderThai}`);
  }

  return [...new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean))];
}

function normalizeGenderTag(gender = "") {
  const text = String(gender || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("หญิง") || text === "female" || text === "f") return "ผู้หญิง";
  if (text.includes("ชาย") || text === "male" || text === "m") return "ผู้ชาย";
  if (text.includes("unisex") || text.includes("ทั้งสอง") || text === "u") return "Unisex";
  return "";
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
