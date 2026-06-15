import { getBrandProfile } from "./brand-profiles-v3.mjs";
import {
  buildBrandMarkFidelityLinesV3,
  buildBrandMarkVisualFactClauseV3
} from "./product-brand-mark-fidelity.mjs";
import {
  buildApprovedHeroIdentityLockV3,
  buildSupportUseCaseSafetyLinesV3,
  describeUseCaseSupportShotV3,
  getSupportUseCaseShotsV3,
  resolveProductUseCaseV3
} from "./product-image-use-case-rules.mjs";

export const PROMPT_FRAMEWORK_V3_VERSION = "prompt-framework-v3.9-thai-review-support";

const KNOWN_PRODUCT_BRANDS = [
  "The North Face",
  "Discovery Expedition",
  "National Geographic",
  "Canada Goose",
  "Moose Knuckles",
  "Black Yak",
  "Kolon Sport",
  "Snow Peak",
  "Dr. Martens",
  "New Balance",
  "Tommy Hilfiger",
  "Polo Ralph Lauren",
  "Columbia",
  "Patagonia",
  "Montbell",
  "Moon Boot",
  "Uniqlo",
  "Arc'teryx",
  "Moncler",
  "Marmot",
  "Helly Hansen",
  "Salomon",
  "Timberland",
  "Sorel",
  "Quechua",
  "Decathlon",
  "Karrimor",
  "Discovery",
  "Descente",
  "Beanpole",
  "Eider",
  "Nepa",
  "TSLA",
  "Danton",
  "Fjallraven",
  "Lafuma",
  "Millet",
  "Mammut",
  "Merrell",
  "Ecco",
  "Skechers",
  "Converse",
  "Vans",
  "Fila",
  "Puma",
  "Asics",
  "Keen",
  "Crocs",
  "MLB",
  "UGG",
  "K2",
  "Nike",
  "Adidas",
  "Gucci",
  "Louis Vuitton",
  "Christian Dior",
  "Dior",
  "Fendi",
  "Prada",
  "Burberry",
  "Celine",
  "Supreme",
  "Superdry",
  "Zara",
  "H&M"
];

const PRODUCT_BRAND_ALIASES = new Map([
  ["blackyak", "Black Yak"],
  ["canada goose", "Canada Goose"],
  ["christian dior", "Christian Dior"],
  ["decathlon", "Decathlon"],
  ["descente", "Descente"],
  ["discovery", "Discovery"],
  ["discovery expedition", "Discovery Expedition"],
  ["ecco", "Ecco"],
  ["gucci", "Gucci"],
  ["louis vuitton", "Louis Vuitton"],
  ["moncler", "Moncler"],
  ["mont bell", "Montbell"],
  ["montbell", "Montbell"],
  ["moon boot", "Moon Boot"],
  ["moonboot", "Moon Boot"],
  ["moose knuckles", "Moose Knuckles"],
  ["mooseknuckles", "Moose Knuckles"],
  ["nepa", "Nepa"],
  ["new balance", "New Balance"],
  ["prada", "Prada"],
  ["the north face", "The North Face"],
  ["tnf", "The North Face"],
  ["uniqlo", "Uniqlo"]
]);

const PRODUCT_BRAND_ALIAS_MATCHERS = Array.from(PRODUCT_BRAND_ALIASES.entries()).sort((a, b) => b[0].length - a[0].length);

const GENERIC_PRODUCT_BRANDS = new Set([
  "certificate",
  "fashion",
  "fashion =fs",
  "fashion=fs",
  "no brand",
  "none",
  "unknown"
]);

const SUPPORT_SHOTS_BY_CATEGORY = {
  "เสื้อ": ["front_fit_shape", "side_thickness_length", "back_hood_closure", "texture_closeup", "wearing_scale_cue"],
  "รองเท้า": ["front_pair", "side_profile", "sole_view", "texture_closeup", "wearing_scale_cue"],
  "กระเป๋า": ["front_view", "side_view", "open_interior", "texture_closeup", "scale_cue"],
  "ถุงมือกันหนาว": ["pair_front", "palm_side", "wearing_scale_cue", "texture_closeup"],
  "หมวกกันหนาว": ["front_view", "side_view", "wearing_scale_cue", "texture_closeup"]
};

export function getSupportShotsV3(item = {}) {
  const profile = getBrandProfile(item);
  const base = SUPPORT_SHOTS_BY_CATEGORY[item.category] || ["front_fit_shape", "side_thickness_length", "texture_closeup", "wearing_scale_cue"];
  const useCaseShots = getSupportUseCaseShotsV3(item);
  return Array.from(new Set([...useCaseShots, ...base, ...profile.supportPriorities])).slice(0, 6);
}

export function resolveModelPolicyV3(item = {}, { slotType = "hero", shotKey = "" } = {}) {
  const profile = getBrandProfile(item);
  const category = String(item.category || "").trim();
  const audienceText = [
    item.audience,
    item.gender,
    item.product_name,
    item.subcategory,
    item.category
  ].filter(Boolean).join(" ").toLowerCase();
  const isApparel = category === "เสื้อ";
  const isFootwear = category === "รองเท้า";
  const isAccessory = ["ถุงมือกันหนาว", "หมวกกันหนาว"].includes(category);
  const isChild = /เด็ก|kids?|child|junior|youth|boy|girl/.test(audienceText);
  const isUnisex = /unisex|ยูนิเซ็กซ์|ชายหญิง|男女|men women/.test(audienceText);
  const isFemale = !isUnisex && /(ผู้หญิง|หญิง|\bwomen'?s\b|\bwomens\b|\bfemale\b|\blady\b|\bladies\b)/.test(audienceText);
  const isMale = !isUnisex && !isFemale && /(ผู้ชาย|ชาย|\bmen'?s\b|\bmens\b|\bmale\b|\bman\b)/.test(audienceText);
  const wearerType = isChild
    ? "child"
    : isUnisex
    ? slotType === "support" && ["wearing_scale_cue", "optional_model_scale", "style_cue"].includes(shotKey)
      ? "unisex_pair"
      : "unisex_single"
    : isMale
    ? "male"
    : isFemale
    ? "female"
    : "thai_asian_adult";

  let presence = "preferred";
  if (profile.brandId === "rent_a_coat" && isApparel && slotType === "hero") presence = "required";
  else if (profile.brandId === "go_mall" && isApparel && slotType === "hero") presence = "preferred";
  else if (isFootwear && slotType === "hero") presence = profile.brandId === "rent_a_coat" ? "preferred" : "optional_scale_model";
  else if (isAccessory && slotType === "hero") presence = "optional_scale_model";
  if (["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth"].includes(shotKey)) {
    presence = "detail_only_no_model";
  }
  if (["wearing_scale_cue", "optional_model_scale", "style_cue"].includes(shotKey)) {
    presence = "required";
  }

  const framing = isFootwear
    ? slotType === "hero"
      ? "lower_body_or_on_foot"
      : "lower_body_on_foot_or_detail"
    : isApparel
    ? "full_body_or_three_quarter"
    : isAccessory
    ? "hands_head_or_close_scale"
    : "product_first_with_scale_context";
  const appearance = isFootwear
    ? "Thai / Southeast Asian / East Asian friendly everyday adult wearer in modest winter styling"
    : "Thai / Southeast Asian / East Asian friendly everyday model";
  const realism = isFootwear
    ? "realistic footwear stance, natural clothing proportions, clean winter socks or pants, no bare-skin emphasis"
    : "natural skin texture, subtle pores, real complexion, realistic hands and posture, not plastic-perfect";

  return {
    source: "generated_no_reference_required",
    presence,
    wearer_type: wearerType,
    framing,
    role: "fit_size_scale_companion",
    appearance,
    expression: "fresh, cheerful, approachable, natural",
    realism,
    product_truth_boundary: "model may be generated, but product identity must follow real product references"
  };
}

export function resolveVisualVariationV3(item = {}, { slotType = "hero", shotKey = "", itemIndex = 0, sequence = 1 } = {}) {
  const profile = getBrandProfile(item);
  const category = String(item.category || "").trim();
  const variationGroups = ["A", "B", "C", "D"];
  const groupIndex = slotType === "hero"
    ? Math.abs(Number(itemIndex || 0)) % variationGroups.length
    : Math.abs(Number(itemIndex || 0) + Number(sequence || 0)) % variationGroups.length;
  const group = variationGroups[groupIndex];
  const isRent = profile.brandId === "rent_a_coat";

  if (slotType === "support") {
    return buildSupportVariation({ group, shotKey, category, isRent });
  }
  return buildHeroVariation({ group, category, isRent });
}

export function buildHeroPromptV3(item = {}) {
  const profile = getBrandProfile(item);
  const modelPolicy = resolveModelPolicyV3(item, { slotType: "hero" });
  const visualVariation = item.visual_variation || resolveVisualVariationV3(item, {
    slotType: "hero",
    itemIndex: item.item_index || item.index || 0,
    sequence: 1
  });
  const productIdentity = buildProductIdentity(item);

  return [
    "Create one clean photorealistic ecommerce product photo.",
    "",
    "Use case:",
    "Ecommerce hero image for a product grid and product detail page. This is product photography, not campaign advertising.",
    "",
    ...buildReferencePriorityLines(item, { slotType: "hero" }),
    "",
    "Product truth lock:",
    `Product: ${productIdentity.displayName}.`,
    buildProductBrandCue(productIdentity),
    `Preserve ${buildProductVisualFacts(item, productIdentity)}.`,
    ...buildBrandMarkFidelityLinesV3(item, productIdentity),
    buildChannelVisualJob(profile, item),
    "",
    "Subject and fit:",
    buildHeroSubjectDirection(item, modelPolicy, visualVariation),
    "",
    `Scene: ${buildProviderSceneDirection(profile, visualVariation)}`,
    `Lighting and camera: ${buildProviderLightingDirection(visualVariation)}`,
    "",
    "Human realism:",
    ...buildProviderNaturalismLines(profile, item, modelPolicy),
    "",
    "Constraints:",
    buildNoAdLayoutConstraints(),
    "Only preserve real product labels or marks visible in the references."
  ].join("\n");
}

export function buildSupportPromptV3(item = {}, shotKey, index, total) {
  const profile = getBrandProfile(item);
  const modelPolicy = resolveModelPolicyV3(item, { slotType: "support", shotKey });
  const visualVariation = item.visual_variation || resolveVisualVariationV3(item, {
    slotType: "support",
    shotKey,
    itemIndex: item.item_index || item.index || 0,
    sequence: index
  });
  const productIdentity = buildProductIdentity(item);
  return [
    `Create one clean photorealistic ecommerce support photo (${index} of ${total}).`,
    "",
    "Use case:",
    "Ecommerce support image for product inspection. The shot must add new evidence, not repeat the hero.",
    "",
    ...buildReferencePriorityLines(item, { slotType: "support" }),
    "",
    "Product truth lock:",
    `Product: ${productIdentity.displayName}.`,
    buildProductBrandCue(productIdentity),
    `Preserve ${buildProductVisualFacts(item, productIdentity)}.`,
    ...buildBrandMarkFidelityLinesV3(item, productIdentity),
    "",
    ...buildThaiReviewUsageDirection(item, shotKey),
    "",
    "Shot:",
    `Shot purpose: ${describeShotV3(shotKey, item)}`,
    describeUseCaseSupportShotV3(item, shotKey),
    buildApprovedHeroAnchorDirection(item, shotKey, modelPolicy),
    buildSupportSubjectDirection(item, shotKey, modelPolicy, visualVariation),
    "",
    `Scene: ${buildProviderSceneDirection(profile, visualVariation)}`,
    `Lighting and camera: ${buildProviderLightingDirection(visualVariation)}`,
    "",
    "Human realism:",
    ...buildProviderNaturalismLines(profile, item, modelPolicy),
    ...buildSupportUseCaseSafetyLinesV3(item, shotKey, modelPolicy),
    "",
    "Constraints:",
    "Change only the angle, crop, pose, or detail emphasis required for this support shot. Keep color, material, trim, labels, proportions, and construction consistent with the references.",
    buildNoAdLayoutConstraints()
  ].join("\n");
}

export function buildProductIdentityV3(item = {}) {
  return buildProductIdentity(item);
}

export { resolveProductUseCaseV3 };

function buildProductIdentity(item = {}) {
  const productName = normalizeSpaces(item.product_name || item.productName || "");
  const category = normalizeSpaces(item.category || "");
  const subcategory = normalizeSpaces(item.subcategory || "");
  const productBrand = normalizeProductBrandInput(item.brand || item.product_brand || item.productBrand) || extractProductBrand(productName);
  const displayName = productName || [productBrand, subcategory, category].filter(Boolean).join(" ") || "the product";
  return {
    productBrand,
    productName,
    category,
    subcategory,
    displayName
  };
}

function extractProductBrand(productName = "") {
  const normalizedName = normalizeSpaces(productName);
  for (const [alias, canonicalBrand] of PRODUCT_BRAND_ALIAS_MATCHERS) {
    if (brandMatchesProductName(alias, normalizedName)) return canonicalBrand;
  }
  return KNOWN_PRODUCT_BRANDS.find((brand) => brandMatchesProductName(brand, normalizedName)) || "";
}

function normalizeProductBrandInput(brandName = "") {
  const normalizedBrand = normalizeSpaces(brandName);
  if (!normalizedBrand) return "";
  const aliasKey = normalizedBrand.toLowerCase();
  if (GENERIC_PRODUCT_BRANDS.has(aliasKey)) return "";
  if (PRODUCT_BRAND_ALIASES.has(aliasKey)) return PRODUCT_BRAND_ALIASES.get(aliasKey);
  const knownBrand = KNOWN_PRODUCT_BRANDS.find((brand) => brandMatchesProductName(brand, normalizedBrand));
  return knownBrand || "";
}

function brandMatchesProductName(brand, productName) {
  if (!brand || !productName) return false;
  const pattern = brand
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, "i").test(productName);
}

function buildProductVisualFacts(item = {}, productIdentity = buildProductIdentity(item)) {
  const category = String(item.category || "").trim();
  const brandClause = `${buildBrandMarkVisualFactClauseV3(productIdentity)}, `;
  if (category === "รองเท้า") {
    return `${brandClause}original color, boot height, upper material, quilting or panel shape, collar or lining, lace path, eyelets, side panel, toe shape, outsole, trim, stitching, texture, and proportions`;
  }
  if (category === "เสื้อ") {
    return `${brandClause}original color, fabric texture, silhouette, collar or hood shape, lapels, zipper or button placement, belt or waist shape, sleeve length, hem length, seams, quilting or padding volume, lining if visible, and proportions`;
  }
  if (["หมวกกันหนาว", "ถุงมือกันหนาว", "ผ้าพันคอ"].includes(category)) {
    return `${brandClause}original color, knit or fabric texture, shape, cuff or edge construction, seams, thickness, scale, and proportions`;
  }
  if (category === "กระเป๋า") {
    return `${brandClause}original color, material, handles, zipper, pockets, seams, hardware, depth, shape, texture, and proportions`;
  }
  return `${brandClause}original color, material, silhouette, seams, trims, fastening details, texture, and proportions`;
}

function buildThaiReviewUsageDirection(item = {}, shotKey = "") {
  return [
    "Thai review output direction:",
    "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวสินค้าที่ดูเรียล น่าเชื่อถือ และเหมาะสำหรับหน้าสินค้าบนเว็บไซต์ แสดงการใช้งานจริงในบริบทธรรมชาติ โดยให้สินค้าคือจุดเด่นหลักของภาพ ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง",
    "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
    "บริบทธุรกิจ: ธุรกิจเช่าและจำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย สำหรับลูกค้าระดับกลางถึงสูง",
    "ไม่ต้องสร้างป้ายแบรนด์ใหม่หรือเน้นชื่อแบรนด์เพิ่ม ใช้เฉพาะโลโก้ ป้าย หรือแพตช์จริงที่เห็นจากภาพต้นฉบับเท่านั้น",
    buildSupportCameraFocusDirection(item, shotKey)
  ].filter(Boolean);
}

function buildSupportCameraFocusDirection(item = {}, shotKey = "") {
  const { group } = resolveProductUseCaseV3(item);
  const detailShot = ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth"].includes(shotKey);
  const smallAccessoryFocus = {
    gloves: "Camera focus: สำหรับถุงมือ ใช้ close-up หรือ tight product-focused crop เป็นหลัก เห็นมือ ข้อมือ หรือปลายแขนเท่าที่จำเป็น และให้ถุงมือกินพื้นที่หลักของเฟรม",
    hat: "Camera focus: สำหรับหมวก ใช้ close-up หรือ head-and-shoulders crop เป็นหลัก เห็นศีรษะ ใบหน้า หรือไหล่เท่าที่จำเป็น และให้หมวกกินพื้นที่หลักของเฟรม",
    scarf_accessory: "Camera focus: สำหรับผ้าพันคอหรืออุปกรณ์คลุมคอ ใช้ close-up จากคอถึงอกหรือช่วงลำตัวบนเป็นหลัก ให้ผ้าและการใช้งานจริงชัดที่สุด",
    socks: "Camera focus: สำหรับถุงเท้า ใช้ close-up จากน่องถึงเท้าหรือ product-focused crop เป็นหลัก อย่าให้กางเกง รองเท้า หรือฉากหลังแย่งความเด่นจากถุงเท้า"
  };
  if (smallAccessoryFocus[group]) {
    const suffix = detailShot ? " สำหรับภาพ detail ให้ crop แน่นขึ้นบน texture, seam, cuff, edge, knit, lining หรือจุดประกอบจริงของสินค้า" : "";
    return `${smallAccessoryFocus[group]}${suffix}`;
  }
  if (["upper_outerwear", "long_outerwear", "pants", "footwear"].includes(group)) {
    return "Camera focus: สำหรับสินค้าชิ้นใหญ่ เช่น เสื้อ กางเกง หรือรองเท้า ใช้มุมภาพธรรมชาติที่ช่วยอธิบาย fit, scale, silhouette และรายละเอียดตาม shot purpose โดยไม่จำเป็นต้องบังคับ close-up ทุกภาพ";
  }
  return "";
}

function buildProductBrandCue(productIdentity = {}) {
  const productBrand = normalizeSpaces(productIdentity.productBrand || "");
  if (!productBrand) {
    return "Actual product brand: not confirmed from the product name. Do not invent a brand identity, logo, patch, or readable label.";
  }
  return `Actual product brand: ${productBrand}. Use this only as product identity metadata; preserve only ${productBrand} marks physically visible in the real reference images.`;
}

function buildReferencePriorityLines(item = {}, { slotType = "hero" } = {}) {
  const lines = [
    "Reference priority:",
    "Use the reference images as the source of truth.",
    "Attached real product reference images are the source of truth for the SKU. If a generated candidate, styling idea, or model choice conflicts with the real product references, follow the real product references."
  ];
  if (slotType === "support") {
    lines.push("For support images, use the approved hero only as a model, fit, lighting, crop, and catalog-realism anchor. The real product references still outrank the approved hero for product identity and brand marks.");
  }
  if (item.reference_confidence || item.referenceConfidence) {
    lines.push(`Reference confidence: ${normalizeSpaces(item.reference_confidence || item.referenceConfidence)}.`);
  }
  return lines;
}

function buildChannelVisualJob(profile, item = {}) {
  if (profile.brandId === "rent_a_coat") {
    return "The item should look clean, well-maintained, warm, easy to fit, and ready for a winter trip.";
  }
  if (profile.brandId === "go_mall") {
    return "The product should be the dominant subject, easy to inspect in a product grid, with faithful color, fabric, construction, and styling.";
  }
  return "The product should be the dominant subject, easy to inspect, and faithful to the reference images.";
}

function buildHeroSubjectDirection(item = {}, modelPolicy = {}, visualVariation = {}) {
  const category = String(item.category || "").trim();
  const composition = providerSafeVisualLabel(visualVariation.composition);
  const crop = providerSafeVisualLabel(visualVariation.crop);
  const pose = describeProviderPose(visualVariation.pose);
  if (modelPolicy.presence === "detail_only_no_model") {
    return `Show the product only in a ${composition || "clean product composition"} with a ${crop || "product-first crop"}. No model.`;
  }
  if (category === "รองเท้า") {
    return [
      `Show the boots worn by an adult wearer in a clean studio ${crop || "footwear crop"} with ${pose || "a relaxed natural stance"}.`,
      "Winter pants should be tucked neatly inside the boot shaft or cropped just above it so the collar, laces, side panel, toe shape, and sole remain visible."
    ].join(" ");
  }
  if (category === "เสื้อ") {
    return [
      `Show an everyday Thai/East Asian adult model wearing the garment in a relaxed catalog pose (${composition || "front or three-quarter view"}) with a ${crop || "three-quarter"} crop.`,
      "The garment should show natural fabric fall, shoulder line, sleeve length, waist or belt shape, hem length, and believable wrinkles."
    ].join(" ");
  }
  if (["หมวกกันหนาว", "ถุงมือกันหนาว", "ผ้าพันคอ"].includes(category)) {
    return "Show the item worn or held just enough to communicate fit, scale, and use while keeping the product dominant.";
  }
  return `Show the product in a clean ${composition || "catalog"} composition with a ${crop || "product-first"} crop.`;
}

function buildSupportSubjectDirection(item = {}, shotKey = "", modelPolicy = {}, visualVariation = {}) {
  if (modelPolicy.presence === "detail_only_no_model") {
    return "Show a product-only detail crop. No model, no lifestyle scene.";
  }
  const category = String(item.category || "").trim();
  if (modelPolicy.wearer_type === "unisex_pair") {
    return "Use the same approved man-and-woman unisex fit cue when people appear. Keep both models secondary to the product and balanced in scale, lighting, and product readability.";
  }
  if (["wearing_scale_cue", "optional_model_scale", "style_cue"].includes(shotKey)) {
    return "Use a simple adult wearer or scale cue only to explain fit, size, and proportion. Keep the product dominant.";
  }
  if (category === "รองเท้า") {
    return "Use a footwear crop or clean product angle that makes the relevant boot details easy to inspect.";
  }
  if (category === "เสื้อ") {
    return "Use a clean catalog pose or product angle that makes fit, construction, and the requested detail easy to inspect.";
  }
  return "Use a clean product-first composition that makes the requested detail easy to inspect.";
}

function buildApprovedHeroAnchorDirection(item = {}, shotKey = "", modelPolicy = {}) {
  const anchor = item.approved_hero_anchor || item.approvedHeroAnchor;
  if (!anchor) return "";
  return buildApprovedHeroIdentityLockV3(item, shotKey, modelPolicy);
}

function buildProviderSceneDirection(profile, visualVariation = {}) {
  const background = providerSafeVisualLabel(visualVariation.background) || "plain studio background";
  if (profile.brandId === "go_mall") {
    return `${background}; plain warm wall or simple studio floor, no decorative furniture, no lamps, no plants, no lifestyle props competing with the product.`;
  }
  return `${background}; clean studio or very subtle winter context, uncluttered and product-first.`;
}

function buildProviderLightingDirection(visualVariation = {}) {
  return `${providerSafeVisualLabel(visualVariation.lighting) || "soft catalog light"}, eye-level ecommerce camera feel, natural contact shadows, realistic fabric texture, no cinematic glamour grading.`;
}

function buildProviderNaturalismLines(profile, item = {}, modelPolicy = {}) {
  const category = String(item.category || "").trim();
  if (modelPolicy.presence === "detail_only_no_model") return [];
  const lines = [
    "Use a natural, fully clothed Thai/East Asian everyday model, or Southeast Asian everyday model, when a person appears. The model should help explain fit, size, warmth, scale, and wearability, not look like a fashion campaign celebrity."
  ];
  if (profile.brandId === "go_mall" && ["เสื้อ", "รองเท้า"].includes(category)) {
    lines.push("Human rendering should feel like an ordinary catalog photograph: relaxed posture, natural hand placement, approachable expression, natural Thai/Southeast Asian skin tone, normal complexion variation, subtle pores, fine facial texture, realistic facial transitions, and no wax-like AI smoothness.");
  } else {
    lines.push("Keep posture, hands, skin, fabric, light, and shadows natural; use subtle pores, fine facial texture, natural undertones, and realistic skin transitions. Avoid plastic-perfect retouching, waxy faces, unnaturally pale flat skin, or over-smoothed AI skin.");
  }
  return lines;
}

function buildNoAdLayoutConstraints() {
  return "Keep the image product-first, realistic, sharp, and text-free. Do not add poster layout, price text, badges, callouts, UI elements, QR codes, store signs, unrelated props, fake labels, fake logos, watermarks, campaign headlines, or decorative typography.";
}

function normalizeSpaces(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function describeProviderPose(pose = "") {
  const value = String(pose || "").trim();
  const mapped = {
    standing_relaxed: "a relaxed standing pose",
    single_walking_step: "one natural walking step",
    natural_step_crop: "one small natural step",
    natural_small_step: "one small natural step",
    neutral_pair_angle: "a neutral product angle",
    gentle_turn_showing_fit: "a gentle turn that shows fit",
    casual_weight_shift_for_length: "a casual weight shift that shows length",
    natural_wearing_pose: "a natural wearing pose",
    neutral_product_scale: "a neutral scale cue"
  };
  return mapped[value] || providerSafeVisualLabel(value);
}

function buildHeroVariation({ group, category, isRent }) {
  const backgrounds = isRent
    ? {
      A: "clean_light_gray_studio",
      B: "soft_winter_context_no_graphics",
      C: "warm_neutral_studio",
      D: "cool_daylight_catalog"
    }
    : {
      A: "clean_off_white_catalog",
      B: "light_gray_catalog",
      C: "plain_warm_wall_and_floor_catalog",
      D: "soft_daylight_minimal_studio"
    };
  const lighting = {
    A: "soft_daylight",
    B: isRent ? "cool_winter_daylight" : "clean_catalog_light",
    C: "warm_softbox",
    D: "balanced_shadow_soft_light"
  };

  if (category === "รองเท้า") {
    return {
      variation_group: group,
      composition: group === "A" ? "on_foot_lower_body_front" : group === "B" ? "on_foot_side_step" : group === "C" ? "product_pair_three_quarter" : "lower_body_walking_crop",
      background: backgrounds[group],
      crop: group === "C" ? "product_pair_full" : "lower_body_or_on_foot",
      pose: group === "A" ? "standing_relaxed" : group === "B" ? "single_walking_step" : group === "C" ? "neutral_pair_angle" : "natural_step_crop",
      lighting: lighting[group],
      variation_note: "Footwear hero variation must show fit/scale while keeping the boot shaft, collar, laces, trim, sole, and pair shape visible."
    };
  }
  if (category === "เสื้อ") {
    return {
      variation_group: group,
      composition: group === "A" ? "model_full_body_front" : group === "B" ? "model_three_quarter_turn" : group === "C" ? "model_relaxed_side_angle" : "model_subtle_walking_step",
      background: backgrounds[group],
      crop: group === "A" ? "full_body" : "three_quarter",
      pose: group === "A" ? "standing_relaxed" : group === "B" ? "gentle_turn_showing_fit" : group === "C" ? "casual_weight_shift_for_length" : "natural_small_step",
      lighting: lighting[group],
      variation_note: "Apparel hero variation must clarify fit, length, fabric fall, sleeve shape, and volume without becoming editorial or mannequin-stiff."
    };
  }
  if (["หมวกกันหนาว", "ถุงมือกันหนาว", "ผ้าพันคอ"].includes(category)) {
    return {
      variation_group: group,
      composition: group === "A" ? "worn_clean_front" : group === "B" ? "worn_three_quarter" : group === "C" ? "product_plus_minimal_scale" : "clean_product_angle",
      background: backgrounds[group],
      crop: "upper_body_hands_head_or_product_crop",
      pose: group === "C" ? "neutral_product_scale" : "natural_wearing_pose",
      lighting: lighting[group],
      variation_note: "Accessory hero variation should show scale/use clearly without crowding the product slot."
    };
  }
  return {
    variation_group: group,
    composition: group === "A" ? "product_clean_front" : group === "B" ? "product_three_quarter" : group === "C" ? "minimal_scale_context" : "product_soft_context",
    background: backgrounds[group],
    crop: "product_first",
    pose: "neutral_product_angle",
    lighting: lighting[group],
    variation_note: "Generic hero variation should keep browsing clarity and avoid repeated grid rhythm."
  };
}

function buildSupportVariation({ group, shotKey, category, isRent }) {
  const detailShot = ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth"].includes(shotKey);
  const backgrounds = isRent
    ? ["clean_light_gray_studio", "warm_neutral_studio", "soft_winter_context_no_graphics", "cool_daylight_catalog"]
    : ["clean_off_white_catalog", "light_gray_catalog", "warm_neutral_room_context", "soft_daylight_studio"];
  const index = ["A", "B", "C", "D"].indexOf(group);
  return {
    variation_group: group,
    composition: detailShot ? "detail_macro_product_truth" : shotKey.includes("scale") || shotKey.includes("style") ? "model_scale_cue_clean" : "product_angle_evidence",
    background: backgrounds[Math.max(0, index)],
    crop: detailShot ? "close_detail" : category === "รองเท้า" ? "lower_body_or_product_angle" : "product_or_model_support_crop",
    pose: detailShot ? "no_model_static_detail" : "natural_support_pose",
    lighting: detailShot ? "even_detail_light" : "soft_catalog_light",
    variation_note: "Support variation must explain this shot's purpose and avoid duplicating the hero composition."
  };
}

function providerSafeVisualLabel(value = "") {
  return String(value || "")
    .replace(/on_foot_lower_body_front/g, "worn_boot_front_fit_crop")
    .replace(/lower_body_walking_crop/g, "worn_boot_natural_step_crop")
    .replace(/lower_body_on_foot_or_detail/g, "footwear_fit_or_product_detail")
    .replace(/lower_body_or_on_foot/g, "footwear_fit_crop")
    .replace(/model_full_body_front/g, "front-facing full-body catalog view")
    .replace(/model_three_quarter_turn/g, "three-quarter turn showing fit")
    .replace(/model_relaxed_side_angle/g, "relaxed side angle showing length")
    .replace(/model_subtle_walking_step/g, "subtle walking step")
    .replace(/plain_warm_wall_and_floor_catalog/g, "plain warm wall and floor catalog setting")
    .replace(/soft_daylight_minimal_studio/g, "soft daylight minimal studio")
    .replace(/_/g, " ");
}

function describeShotV3(shotKey, item = {}) {
  const { group } = resolveProductUseCaseV3(item);
  if (shotKey === "front_pair" && group === "socks") {
    return "Front pair view. Show both socks clearly, including cuff shape, length, knit or fabric texture, thickness, heel, toe, and pair symmetry.";
  }
  if (shotKey === "front_pair" && group === "footwear") {
    return "Front view of the pair. Show both shoes or boots clearly.";
  }
  const descriptions = {
    front_fit_shape: "Front fit/shape view. Show whole product, length, silhouette, closure, and how it reads on body or product form.",
    side_thickness_length: "Side view. Show thickness, warmth, depth, side seam, sole thickness, or handle depth as applicable.",
    back_hood_closure: "Back view. Show hood, back construction, hem, silhouette, and rear details clearly.",
    texture_closeup: "Close-up of real material, fur, knit, lining, zipper, patch, sole, stitching, or construction.",
    wearing_scale_cue: "Minimal wearing/scale context. Help the customer understand size, fit, and use without turning it into a campaign scene.",
    lining_warmth: "Lining and warmth evidence. Show inner lining, insulation thickness, hood warmth, cuff coverage, or closure protection without inventing construction.",
    fabric_fur_zip_patch_detail: "Rental-trust detail close-up. Show real fabric, fur, zipper, patch, trim, stitching, and condition cues from the product reference.",
    front_pair: "Front view of the pair. Show both shoes/boots clearly.",
    side_profile: "Side profile. Show sole thickness, upper material, shape, and fastening details.",
    top_view: "Top view. Show the opening, laces, straps, toe shape, upper material, and how the product is worn or constructed from above.",
    sole_view: "Sole view. Show tread/sole pattern clearly without changing identity.",
    hood_detail: "Hood detail. Show hood shape, collar relationship, fur trim if present, drawcord, warmth coverage, and fit around the head or upper body.",
    waistband_pocket: "Waistband and pocket detail. Show waistband, button, drawcord, pocket, seam, belt loop, or upper construction clearly.",
    hem_detail: "Hem detail. Show lower opening, cuff, seam, fabric thickness, and how the product meets winter footwear or the body.",
    front_view: "Straight front product view. Keep product large and readable.",
    side_view: "Side product view. Preserve depth, construction, and scale.",
    open_interior: "Open/interior view for lining, storage, padding, or inner construction only if physically plausible.",
    pair_front: "Front view of the glove pair. Show shape, cuff, and construction.",
    palm_side: "Palm-side view. Show grip, seams, or material if present.",
    cuff_sleeve_fit: "Cuff and sleeve fit view. Show how the glove cuff meets a winter sleeve or coat cuff naturally while keeping glove construction readable.",
    scale_cue: "Minimal context showing scale relative to a human or simple neutral prop.",
    front_back_side: "Grid-readable front, back, and side clarity. Show the sellable shape, key construction, and browsing-ready product angles without clutter.",
    texture_construction_closeup: "Purchase clarity close-up. Show faithful material, knit, seam, sole, hardware, lining, or construction details that support ownership confidence.",
    style_cue: "Simple style cue. Show how the item pairs with neutral wardrobe context while keeping the product dominant and truthful.",
    optional_model_scale: "Optional model or human scale cue. Use only enough body context to explain size, fit, and proportion in a clean ecommerce frame."
  };
  return descriptions[shotKey] || "Product support shot. Keep requested product details clear and consistent.";
}
