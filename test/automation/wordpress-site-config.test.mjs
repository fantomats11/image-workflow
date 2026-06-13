import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSiteAlias,
  redactWordPressSiteConfig,
  resolveWordPressSiteConfig
} from "../../lib/automation/wordpress-site-config.mjs";

test("resolves WordPress site config from brand aliases", () => {
  const config = resolveWordPressSiteConfig({ brand_id: "go_mall" }, {
    GOMALL_WP_SITE_URL: "https://gomall.example.com/",
    GOMALL_WOO_CONSUMER_KEY: "ck_test",
    GOMALL_WOO_CONSUMER_SECRET: "cs_test"
  });

  assert.equal(config.configured, true);
  assert.equal(config.brand_id, "go_mall");
  assert.equal(config.target_site, "gomall");
  assert.equal(config.env_prefix, "GOMALL");
  assert.equal(config.site_url, "https://gomall.example.com");
});

test("normalizes site aliases", () => {
  assert.equal(normalizeSiteAlias("Rent A Coat"), "rent_a_coat");
  assert.equal(normalizeSiteAlias("gomall"), "go_mall");
});

test("redacts credentials from site config output", () => {
  const redacted = redactWordPressSiteConfig({
    brand_id: "rent_a_coat",
    site_url: "https://example.com",
    configured: true,
    consumer_key: "ck_123456",
    consumer_secret: "cs_abcdef",
    wp_username: "admin",
    wp_app_password: "secret-password"
  });

  assert.equal(redacted.consumer_key, "ck...56");
  assert.equal(redacted.consumer_secret, "cs...ef");
  assert.equal(redacted.wp_username, "[set]");
  assert.equal(redacted.wp_app_password, "se...rd");
});
