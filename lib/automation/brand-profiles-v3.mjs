export const BRAND_IDS = {
  RENT_A_COAT: "rent_a_coat",
  GO_MALL: "go_mall"
};

export const BRAND_PROFILES = {
  [BRAND_IDS.RENT_A_COAT]: {
    brandId: BRAND_IDS.RENT_A_COAT,
    label: "Rent A Coat",
    targetSite: "rentacoat",
    productType: "rental",
    primaryImageJob: "Build rental trust: fit confidence, warmth, clean condition, and trip readiness.",
    heroBias: "model_or_product_dominant",
    visualMix: {
      studio_controlled_variation: 45,
      soft_lifestyle_context: 45,
      editorial_realism_texture: 10
    },
    supportPriorities: [
      "front_fit_shape",
      "side_thickness_length",
      "back_hood_closure",
      "lining_warmth",
      "fabric_fur_zip_patch_detail",
      "wearing_scale_cue"
    ],
    realismPolicy: [
      "natural skin texture",
      "subtle pores and undertones",
      "clean but not plastic-perfect rental condition",
      "no fake luxury details"
    ]
  },
  [BRAND_IDS.GO_MALL]: {
    brandId: BRAND_IDS.GO_MALL,
    label: "GO Mall",
    targetSite: "gomall",
    productType: "sale",
    primaryImageJob: "Build purchase clarity: fast browsing, style appeal, value, and ownership confidence.",
    heroBias: "product_dominant",
    visualMix: {
      studio_controlled_variation: 65,
      soft_lifestyle_context: 25,
      editorial_realism_texture: 10
    },
    supportPriorities: [
      "front_back_side",
      "texture_construction_closeup",
      "style_cue",
      "optional_model_scale"
    ],
    realismPolicy: [
      "faithful color and material",
      "new and worth buying",
      "no invented premium labels",
      "no over-styling beyond product truth"
    ]
  }
};

export function inferBrandIdFromBranch(value) {
  const normalized = String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.includes("go mall") || normalized.includes("gomall")) return BRAND_IDS.GO_MALL;
  if (normalized.includes("rent a coat") || normalized.includes("rentacoat") || normalized === "rac") {
    return BRAND_IDS.RENT_A_COAT;
  }
  return "";
}

export function inferBrandIdFromItem(item = {}) {
  const branchBrand = inferBrandIdFromBranch(item.reference_branch || item.branch || item.store_branch);
  if (branchBrand) return branchBrand;
  const explicitBrand = String(item.reference_brand_id || item.brand_id || "").toLowerCase();
  if (explicitBrand === BRAND_IDS.RENT_A_COAT || explicitBrand === BRAND_IDS.GO_MALL) return explicitBrand;
  const site = String(item.target_site || item.site || "").toLowerCase();
  const type = String(item.product_type || "").toLowerCase();
  if (site.includes("rentacoat") || type === "rental") return BRAND_IDS.RENT_A_COAT;
  if (site.includes("gomall") || type === "sale") return BRAND_IDS.GO_MALL;
  return "";
}

function cloneBrandProfile(profile) {
  return {
    ...profile,
    visualMix: { ...profile.visualMix },
    supportPriorities: [...profile.supportPriorities],
    realismPolicy: [...profile.realismPolicy]
  };
}

export function getBrandProfile(brandIdOrItem) {
  const brandId = typeof brandIdOrItem === "string" ? brandIdOrItem : inferBrandIdFromItem(brandIdOrItem);
  const profile = BRAND_PROFILES[brandId];
  if (!profile) throw new Error(`Unsupported brand for Prompt Framework v3: ${brandId || "unknown"}`);
  return cloneBrandProfile(profile);
}
