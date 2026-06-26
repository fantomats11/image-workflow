import test from "node:test";
import assert from "node:assert/strict";
import {
  createWooCommerceClient,
  runWooCommerceReadOnlyChecksForItem
} from "../../lib/automation/woocommerce-client.mjs";

test("WooCommerce client uses GET-only requests with Basic auth", async () => {
  const calls = [];
  const client = createWooCommerceClient({
    config: {
      brand_id: "go_mall",
      configured: true,
      site_url: "https://shop.example.com",
      consumer_key: "ck_test",
      consumer_secret: "cs_test"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse([]);
    }
  });

  await client.getProductsBySku("SKU001");
  await client.searchCategories("เสื้อ");
  await client.searchTags("โค้ท");

  assert.equal(calls.length, 3);
  assert.equal(calls.every((call) => call.options.method === "GET"), true);
  assert.match(calls[0].url, /\/wp-json\/wc\/v3\/products\?sku=SKU001/);
  assert.match(calls[0].options.headers.Authorization, /^Basic /);
});

test("runWooCommerceReadOnlyChecksForItem reports product/category/tag matches", async () => {
  const checks = await runWooCommerceReadOnlyChecksForItem({
    item: {
      sku: "SKU001",
      brand_id: "go_mall",
      category: "เสื้อ",
      subcategory: "โค้ท"
    },
    env: {
      GOMALL_WP_SITE_URL: "https://shop.example.com",
      GOMALL_WOO_CONSUMER_KEY: "ck_test",
      GOMALL_WOO_CONSUMER_SECRET: "cs_test"
    },
    fetchImpl: async (url) => {
      if (String(url).includes("/products?")) {
        return jsonResponse([{ id: 10, sku: "SKU001", name: "Existing Product", status: "draft" }]);
      }
      if (String(url).includes("/products/categories")) {
        return jsonResponse([{ id: 20, name: "เสื้อ", slug: "coat" }]);
      }
      return jsonResponse([{ id: 30, name: "โค้ท", slug: "coat-tag" }]);
    }
  });

  assert.equal(checks.status, "checked");
  assert.equal(checks.product_by_sku.status, "found");
  assert.deepEqual(checks.product_by_sku.product_ids, [10]);
  assert.equal(checks.categories.matches[0].id, 20);
  assert.equal(checks.tags.matches[0].id, 30);
});

test("runWooCommerceReadOnlyChecksForItem returns not_configured without network calls", async () => {
  let called = false;
  const checks = await runWooCommerceReadOnlyChecksForItem({
    item: { sku: "SKU001", brand_id: "go_mall" },
    env: {},
    fetchImpl: async () => {
      called = true;
      return jsonResponse([]);
    }
  });

  assert.equal(called, false);
  assert.equal(checks.status, "not_configured");
  assert.ok(checks.missing_config.includes("GOMALL_WP_SITE_URL"));
});

test("WooCommerce client can create taxonomy terms and product drafts", async () => {
  const calls = [];
  const client = createWooCommerceClient({
    config: {
      brand_id: "go_mall",
      configured: true,
      site_url: "https://shop.example.com",
      consumer_key: "ck_test",
      consumer_secret: "cs_test"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/products/categories") && options.method === "GET") return jsonResponse([]);
      if (String(url).includes("/products/categories") && options.method === "POST") return jsonResponse({ id: 20, name: "เสื้อกันหนาว & เสื้อโค้ท" });
      if (String(url).includes("/products/tags") && options.method === "GET") return jsonResponse([]);
      if (String(url).includes("/products/tags") && options.method === "POST") return jsonResponse({ id: 30, name: "เสื้อกันหนาว" });
      return jsonResponse({ id: 100, sku: "SKU001", name: "Fashion coat", status: "draft", permalink: "https://shop.example.com/product/sku001" });
    }
  });

  const category = await client.resolveOrCreateCategory("เสื้อกันหนาว & เสื้อโค้ท");
  const tag = await client.resolveOrCreateTag("เสื้อกันหนาว");
  const product = await client.createProductDraft({
    name: "Fashion coat",
    sku: "SKU001",
    categories: [{ id: category.id }],
    tags: [{ id: tag.id }]
  });

  assert.equal(category.id, 20);
  assert.equal(tag.id, 30);
  assert.equal(product.id, 100);
  assert.equal(JSON.parse(calls.at(-1).options.body).status, "draft");
  assert.equal(calls.some((call) => call.options.method === "POST" && call.url.includes("/products/categories")), true);
  assert.equal(calls.some((call) => call.options.method === "POST" && call.url.includes("/products/tags")), true);
  assert.equal(calls.some((call) => call.options.method === "POST" && call.url.includes("/products")), true);
});

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}
