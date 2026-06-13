import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_IDS,
  getBrandProfile,
  inferBrandIdFromItem
} from "../../lib/automation/brand-profiles-v3.mjs";

test("infers Rent A Coat from rental product type and site", () => {
  assert.equal(inferBrandIdFromItem({ product_type: "rental", target_site: "rentacoat" }), BRAND_IDS.RENT_A_COAT);
});

test("infers GO Mall from sale product type and site", () => {
  assert.equal(inferBrandIdFromItem({ product_type: "sale", target_site: "gomall" }), BRAND_IDS.GO_MALL);
});

test("uses Product Catalog branch before legacy target site and product type", () => {
  assert.equal(
    inferBrandIdFromItem({ reference_branch: "GO Mall", product_type: "rental", target_site: "rentacoat" }),
    BRAND_IDS.GO_MALL
  );
});

test("Rent A Coat profile emphasizes rental trust", () => {
  const profile = getBrandProfile(BRAND_IDS.RENT_A_COAT);
  assert.equal(profile.brandId, "rent_a_coat");
  assert.equal(profile.primaryImageJob.includes("rent"), true);
  assert.equal(profile.visualMix.soft_lifestyle_context, 45);
});

test("GO Mall profile emphasizes grid clarity", () => {
  const profile = getBrandProfile(BRAND_IDS.GO_MALL);
  assert.equal(profile.brandId, "go_mall");
  assert.equal(profile.visualMix.studio_controlled_variation, 65);
  assert.equal(profile.heroBias, "product_dominant");
});

test("returned profile mutation does not affect subsequent profile calls", () => {
  const profile = getBrandProfile(BRAND_IDS.RENT_A_COAT);
  profile.visualMix.soft_lifestyle_context = 0;
  profile.supportPriorities.push("per_sku_annotation");
  profile.realismPolicy.push("temporary composition note");

  const nextProfile = getBrandProfile(BRAND_IDS.RENT_A_COAT);
  assert.equal(nextProfile.visualMix.soft_lifestyle_context, 45);
  assert.equal(nextProfile.supportPriorities.includes("per_sku_annotation"), false);
  assert.equal(nextProfile.realismPolicy.includes("temporary composition note"), false);
});
