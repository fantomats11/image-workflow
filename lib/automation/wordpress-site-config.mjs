import { BRAND_IDS } from "./brand-profiles-v3.mjs";

const SITE_CONFIGS = {
  [BRAND_IDS.RENT_A_COAT]: {
    brand_id: BRAND_IDS.RENT_A_COAT,
    target_site: "rentacoat",
    env_prefix: "RAC"
  },
  [BRAND_IDS.GO_MALL]: {
    brand_id: BRAND_IDS.GO_MALL,
    target_site: "gomall",
    env_prefix: "GOMALL"
  }
};

const SITE_ALIASES = {
  rent_a_coat: BRAND_IDS.RENT_A_COAT,
  rentacoat: BRAND_IDS.RENT_A_COAT,
  rac: BRAND_IDS.RENT_A_COAT,
  go_mall: BRAND_IDS.GO_MALL,
  gomall: BRAND_IDS.GO_MALL,
  go_mall_fashion: BRAND_IDS.GO_MALL
};

export function resolveWordPressSiteConfig(input = {}, env = process.env) {
  const brandId = normalizeSiteAlias(input.brand_id || input.brandId || input.target_site || input.targetSite);
  const base = SITE_CONFIGS[brandId] || null;
  const prefix = base?.env_prefix || "";
  const siteUrl = prefix ? cleanSiteUrl(env[`${prefix}_WP_SITE_URL`]) : "";
  const consumerKey = prefix ? String(env[`${prefix}_WOO_CONSUMER_KEY`] || "").trim() : "";
  const consumerSecret = prefix ? String(env[`${prefix}_WOO_CONSUMER_SECRET`] || "").trim() : "";
  const username = prefix ? String(env[`${prefix}_WP_USERNAME`] || "").trim() : "";
  const appPassword = prefix ? String(env[`${prefix}_WP_APP_PASSWORD`] || "").trim() : "";
  const missing = [
    !base ? "brand_id" : "",
    !siteUrl ? `${prefix || "BRAND"}_WP_SITE_URL` : "",
    !consumerKey ? `${prefix || "BRAND"}_WOO_CONSUMER_KEY` : "",
    !consumerSecret ? `${prefix || "BRAND"}_WOO_CONSUMER_SECRET` : ""
  ].filter(Boolean);

  return {
    brand_id: brandId,
    target_site: base?.target_site || "",
    env_prefix: prefix,
    site_url: siteUrl,
    configured: missing.length === 0,
    missing,
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    wp_username: username,
    wp_app_password: appPassword
  };
}

export function redactWordPressSiteConfig(config = {}) {
  return {
    brand_id: config.brand_id || "",
    target_site: config.target_site || "",
    env_prefix: config.env_prefix || "",
    site_url: config.site_url || "",
    configured: Boolean(config.configured),
    missing: Array.isArray(config.missing) ? [...config.missing] : [],
    consumer_key: redactSecret(config.consumer_key),
    consumer_secret: redactSecret(config.consumer_secret),
    wp_username: config.wp_username ? "[set]" : "",
    wp_app_password: redactSecret(config.wp_app_password)
  };
}

export function normalizeSiteAlias(value) {
  const key = String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return SITE_ALIASES[key] || "";
}

function cleanSiteUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function redactSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}...${text.slice(-2)}`;
}
