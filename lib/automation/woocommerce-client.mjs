import { resolveWordPressSiteConfig } from "./wordpress-site-config.mjs";

export function getWooCommerceConfigForBrand(brandId, env = process.env) {
  return resolveWordPressSiteConfig({ brand_id: brandId }, env);
}

export function createWooCommerceClient({
  config,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(process.env.WORDPRESS_HTTP_TIMEOUT_MS || 15000)
} = {}) {
  if (!config?.configured) {
    throw new Error(`WooCommerce client is not configured for ${config?.brand_id || "unknown brand"}.`);
  }
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required.");

  const authHeader = `Basic ${Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString("base64")}`;

  async function request(endpoint, params = {}) {
    return requestJson(endpoint, { params });
  }

  async function requestJson(endpoint, { method = "GET", params = {}, body = null } = {}) {
    const url = buildWooCommerceUrl(config.site_url, endpoint, params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 15000));
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          "Accept": "application/json",
          "Authorization": authHeader,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
      const text = await response.text();
      const parsedBody = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(`WooCommerce ${method} ${endpoint} failed ${response.status}: ${safeErrorBody(parsedBody)}`);
      }
      return parsedBody;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    brand_id: config.brand_id,
    site_url: config.site_url,
    async getProductsBySku(sku) {
      return request("products", { sku, per_page: "20" });
    },
    async searchCategories(search) {
      if (!search) return [];
      return request("products/categories", { search, per_page: "20" });
    },
    async searchTags(search) {
      if (!search) return [];
      return request("products/tags", { search, per_page: "20" });
    },
    async resolveOrCreateCategory(name) {
      return resolveOrCreateEntity({
        name,
        search: (value) => request("products/categories", { search: value, per_page: "20" }),
        create: (value) => requestJson("products/categories", { method: "POST", body: { name: value } })
      });
    },
    async resolveOrCreateTag(name) {
      return resolveOrCreateEntity({
        name,
        search: (value) => request("products/tags", { search: value, per_page: "20" }),
        create: (value) => requestJson("products/tags", { method: "POST", body: { name: value } })
      });
    },
    async createProductDraft(payload = {}) {
      return requestJson("products", {
        method: "POST",
        body: {
          status: "draft",
          type: "simple",
          manage_stock: false,
          ...payload,
          status: payload.status || "draft"
        }
      });
    }
  };
}

async function resolveOrCreateEntity({ name, search, create }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  const existing = normalizeWooList(await search(cleanName));
  const match = existing.find((entity) => String(entity.name || "").trim().toLowerCase() === cleanName.toLowerCase());
  if (match?.id) return compactWooEntity(match);
  const created = await create(cleanName);
  return compactWooEntity(created);
}

export async function runWooCommerceReadOnlyChecksForItem({
  item,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const config = getWooCommerceConfigForBrand(item?.brand_id, env);
  const base = {
    configured: config.configured,
    brand_id: item?.brand_id || "",
    site_url: config.site_url || "",
    missing_config: config.configured ? [] : config.missing,
    product_by_sku: { status: "skipped", product_ids: [] },
    categories: { status: "skipped", search: "", matches: [] },
    tags: { status: "skipped", search: "", matches: [] }
  };

  if (!config.configured) {
    return {
      ...base,
      status: "not_configured"
    };
  }

  try {
    const client = createWooCommerceClient({ config, fetchImpl, timeoutMs: Number(env.WORDPRESS_HTTP_TIMEOUT_MS || 15000) });
    const products = await client.getProductsBySku(item.sku);
    const productMatches = normalizeWooList(products).map(compactWooEntity);
    const categorySearch = item.category || item.product_type || "";
    const tagSearch = item.subcategory || item.product_name || "";
    const categoryMatches = normalizeWooList(await client.searchCategories(categorySearch)).map(compactWooEntity);
    const tagMatches = normalizeWooList(await client.searchTags(tagSearch)).map(compactWooEntity);

    return {
      ...base,
      status: "checked",
      product_by_sku: {
        status: productMatches.length === 0 ? "not_found" : productMatches.length === 1 ? "found" : "ambiguous",
        product_ids: productMatches.map((product) => product.id).filter(Boolean),
        matches: productMatches
      },
      categories: {
        status: categorySearch ? "checked" : "skipped",
        search: categorySearch,
        matches: categoryMatches
      },
      tags: {
        status: tagSearch ? "checked" : "skipped",
        search: tagSearch,
        matches: tagMatches
      }
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: error?.message || String(error)
    };
  }
}

function buildWooCommerceUrl(siteUrl, endpoint, params = {}) {
  const base = new URL(`/wp-json/wc/v3/${String(endpoint || "").replace(/^\/+/, "")}`, `${siteUrl}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") base.searchParams.set(key, String(value));
  }
  return base.toString();
}

function normalizeWooList(value) {
  return Array.isArray(value) ? value : [];
}

function compactWooEntity(entity = {}) {
  const images = Array.isArray(entity.images) ? entity.images : [];
  return {
    id: entity.id ?? null,
    name: entity.name || "",
    slug: entity.slug || "",
    sku: entity.sku || "",
    status: entity.status || "",
    permalink: entity.permalink || "",
    current_main_image_id: images[0]?.id ?? null,
    current_gallery_image_ids: images.slice(1).map((image) => image.id).filter((id) => id !== undefined && id !== null),
    images: images.map((image) => ({
      id: image.id ?? null,
      src: image.src || "",
      name: image.name || "",
      alt: image.alt || ""
    }))
  };
}

function safeErrorBody(body) {
  if (!body) return "";
  if (typeof body === "string") return body.slice(0, 300);
  return JSON.stringify({
    code: body.code || "",
    message: body.message || ""
  }).slice(0, 300);
}
