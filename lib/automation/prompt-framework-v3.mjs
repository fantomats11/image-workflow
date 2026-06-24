import { getBrandProfile } from "./brand-profiles-v3.mjs";
import {
  buildBrandMarkFidelityLinesV3,
  buildBrandMarkVisualFactClauseV3
} from "./product-brand-mark-fidelity.mjs";
import {
  getSupportUseCaseShotsV3,
  resolveProductUseCaseV3
} from "./product-image-use-case-rules.mjs";

export const PROMPT_FRAMEWORK_V3_VERSION = "prompt-framework-v3.15-hero-led-product-marking-lock";

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

export function getSupportShotsV3(item = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const shotsByGroup = {
    upper_outerwear: ["side_fit_on_model", "back_fit_on_model", "material_or_lining_closeup"],
    long_outerwear: ["side_fit_on_model", "back_fit_on_model", "material_or_lining_closeup"],
    pants: ["side_thickness_length", "waistband_pocket", "hem_detail", "texture_closeup", "wearing_scale_cue"],
    footwear: ["side_profile", "sole_view", "texture_closeup", "wearing_scale_cue"],
    gloves: ["pair_front", "wearing_scale_cue", "texture_closeup", "palm_side"],
    hat: ["front_view", "wearing_scale_cue", "texture_closeup", "style_cue"],
    scarf_accessory: ["front_view", "wearing_scale_cue", "texture_closeup", "style_cue"],
    socks: ["front_pair", "wearing_scale_cue", "texture_closeup", "style_cue"],
    bag: ["front_view", "side_view", "open_interior", "texture_closeup", "scale_cue"],
    generic: ["front_back_side", "texture_construction_closeup", "style_cue", "optional_model_scale"]
  };
  return shotsByGroup[group] || shotsByGroup.generic;
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
  if (["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth", "material_or_lining_closeup"].includes(shotKey)) {
    presence = "detail_only_no_model";
  }
  if (isApparel && slotType === "support" && ["side_fit_on_model", "back_fit_on_model", "side_thickness_length", "back_hood_closure"].includes(shotKey)) {
    presence = "required";
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
  return buildLeanHeroVariation();
}

export function buildHeroPromptV3(item = {}) {
  return [
    buildLeanThaiHeroPromptBase(),
    buildHeroSmallProductCameraLine(item)
  ].filter(Boolean).join("\n\n");
}

export function buildSupportPromptV3(item = {}, shotKey, index, total) {
  const shotDescription = describeLeanThaiSupportShotV3(shotKey, item);
  const hasApprovedHeroAnchor = Boolean(item.approved_hero_anchor || item.approvedHeroAnchor);
  return [
    hasApprovedHeroAnchor ? "อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว" : "อ้างอิงภาพต้นฉบับ",
    buildLeanThaiSupportCreateLine(shotDescription),
    buildLeanThaiSupportTruthLine(shotKey),
    buildLeanThaiSupportPresentationLine(shotKey, hasApprovedHeroAnchor)
  ].filter(Boolean).join("\n");
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

function buildLeanThaiHeroPromptBase() {
  return [
    "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล สื่อถึงการใช้งานจริงของสินค้า ให้ความรู้สึกเข้าถึงง่าย น่าเชื่อถือ พร้อมจัดองค์ประกอบภาพให้ดึงดูดและเหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด",
    "",
    "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
    "ธุรกิจเช่า จำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย เน้นกลุ่มเป้าหมายระดับกลางถึงสูง"
  ].join("\n");
}

function buildHeroSmallProductCameraLine(item = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const lines = {
    gloves: "สำหรับถุงมือ ใช้มุมภาพระยะใกล้หรือครอปที่โฟกัสสินค้าเป็นหลัก ให้ถุงมือเด่นที่สุดในภาพ",
    hat: "สำหรับหมวก ใช้มุมภาพระยะใกล้หรือครอปช่วงศีรษะและไหล่ ให้หมวกเด่นที่สุดในภาพ",
    scarf_accessory: "สำหรับผ้าพันคอหรือผ้าคลุมคอ ใช้มุมภาพระยะใกล้จากคอถึงอกหรือช่วงลำตัวบน ให้สินค้าเด่นที่สุดในภาพ",
    socks: "สำหรับถุงเท้า ใช้มุมภาพระยะใกล้จากน่องถึงเท้าหรือครอปที่โฟกัสสินค้า ให้ถุงเท้าเด่นที่สุดในภาพ"
  };
  return lines[group] || "";
}

function describeLeanThaiSupportShotV3(shotKey = "", item = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const descriptions = {
    front_fit_shape: "สินค้ามุมด้านหน้า ให้เห็นรูปทรง สี รายละเอียดหลัก และการเข้าทรงอย่างชัดเจน โดยไม่ซ้ำองค์ประกอบกับภาพหลัก",
    side_fit_on_model: "คนจริงสวมสินค้าจากมุมด้านข้างหรือเฉียง 45 องศา ให้เห็นทรง ความหนา ความยาว การเข้ารูปจริง และโลโก้ แพตช์ ตัวเลข หรือข้อความเทคนิคจริงบนแขนถ้ามีในภาพต้นฉบับ",
    back_fit_on_model: "คนจริงสวมสินค้าจากมุมด้านหลัง ให้เห็นดีไซน์ด้านหลัง ฮู้ด ทรงไหล่ ความยาว ตะเข็บ โลโก้ แพตช์ ตัวเลข หรือข้อความเทคนิคจริงที่ภาพหลักไม่เห็น",
    material_or_lining_closeup: "ภาพ extreme close-up เดี่ยวจากสินค้าชุดเดียวกับภาพหลัก ให้เห็นวัสดุ ซิป ขอบคอ ปลายแขน ซับใน ขนเฟอร์ งานเย็บ หรือตัวเลข/ข้อความเทคนิคจริงถ้ามี",
    side_thickness_length: "สินค้ามุมด้านข้างหรือเฉียง 45 องศา ให้เห็นทรง ความหนา ความยาว และสัดส่วนการสวมใส่จริงอย่างชัดเจน",
    back_hood_closure: "สินค้ามุมด้านหลัง ให้เห็นดีไซน์ด้านหลัง ความยาว ทรงไหล่ ตะเข็บ ฮู้ด ปก หรือรายละเอียดที่ภาพด้านหน้าไม่เห็น",
    lining_warmth: "ภาพ close-up เดี่ยวของด้านใน ซับใน บุขน ความหนา งานเย็บ หรือเทคโนโลยีกันหนาวที่มีอยู่จริง",
    texture_closeup: "ภาพ close-up เดี่ยวของวัสดุ พื้นผิว งานเย็บ ขอบ ซิป ป้ายจริง หรือดีเทลสำคัญของสินค้า",
    wearing_scale_cue: "การใช้งานจริงของสินค้าในบริบทเมืองหนาว ให้เห็นสัดส่วน วิธีใช้ และให้ภาพแตกต่างจากภาพหลัก",
    side_profile: "รองเท้ามุมด้านข้าง ให้เห็นทรง ความสูง พื้นรองเท้า หัวรองเท้า เชือกหรือสายรัด และสัดส่วนเมื่อใช้งานจริง",
    sole_view: "พื้นรองเท้าแบบสินค้าเดี่ยว ให้เห็นลายพื้น ความหนา ส้น ขอบพื้น และรายละเอียดการยึดเกาะอย่างชัดเจน",
    top_view: "รองเท้ามุมด้านบน ให้เห็นช่องเปิด เชือกหรือสายรัด วัสดุด้านบน และรูปทรงหัวรองเท้า",
    front_pair: group === "socks"
      ? "ถุงเท้าคู่แบบสินค้าเด่น ให้เห็นความยาว ขอบถุงเท้า ความหนา เนื้อผ้า ส้น และปลายเท้า"
      : "สินค้าคู่มุมด้านหน้า ให้เห็นรูปทรงคู่ สี ขนาด และรายละเอียดหลักชัดเจน",
    pair_front: "ถุงมือคู่มุมด้านหน้า ให้เห็นรูปทรงนิ้ว ขอบปลาย ตะเข็บ วัสดุ และความหนาของสินค้า",
    palm_side: "ถุงมือด้านฝ่ามือ ให้เห็น grip ตะเข็บ โครงสร้างนิ้ว วัสดุ และขอบซับในถ้ามี",
    cuff_sleeve_fit: "ถุงมือขณะสวมกับแขนเสื้อกันหนาว ให้เห็นขอบปลายและการใช้งานจริงอย่างเป็นธรรมชาติ",
    front_view: buildAccessoryFrontViewLine(group),
    side_view: "สินค้ามุมด้านข้าง ให้เห็นความลึก โครงสร้าง ความหนา และสัดส่วนของสินค้าอย่างชัดเจน",
    open_interior: "มุมเปิดด้านในของสินค้า ให้เห็นซับใน ช่องเก็บของ บุนวม ซิป หรือโครงสร้างด้านในเท่าที่มีจริง",
    scale_cue: "ภาพบอกขนาดสินค้า ใช้คนหรือบริบทกลาง ๆ เท่าที่จำเป็นโดยไม่ให้แย่งความเด่นจากสินค้า",
    front_back_side: "มุมสินค้าที่อ่านรูปทรงได้ง่าย เห็นด้านสำคัญของสินค้าในภาพเดียวโดยไม่ทำเป็นกริดหรือ collage",
    texture_construction_closeup: "ภาพ close-up เดี่ยวของวัสดุ ตะเข็บ hardware ซับใน พื้นรองเท้า ผ้าถัก หรือโครงสร้างสำคัญ",
    style_cue: "สินค้าในลุคชุดกันหนาวหรือบริบทเดินทางที่เรียบง่าย ให้เห็นวิธีใช้จริงและไม่ซ้ำมุมกับภาพหลัก",
    optional_model_scale: "สินค้าแบบมีคนช่วยบอกขนาดเท่าที่จำเป็น ให้เห็นสัดส่วน การเข้าทรง และวิธีใช้อย่างสะอาดตา",
    waistband_pocket: "รายละเอียดเอว กระดุม drawcord กระเป๋า ตะเข็บ หูเข็มขัด หรือโครงสร้างช่วงบนของกางเกง",
    hem_detail: "รายละเอียดชายขา ขอบปลาย ตะเข็บ ความหนาผ้า และจุดที่กางเกงพบกับรองเท้าหรือร่างกาย"
  };
  return descriptions[shotKey] || "ภาพเสริมสินค้า ให้เห็นข้อมูลใหม่ที่ช่วยลูกค้าตัดสินใจ โดยไม่ซ้ำกับภาพหลัก";
}

function buildLeanThaiSupportCreateLine(description = "") {
  if (/^ภาพ/.test(description)) return `สร้าง${description}`;
  return `สร้างภาพ${description}`;
}

function buildAccessoryFrontViewLine(group = "") {
  if (group === "hat") return "หมวกแบบใส่จริงหรือวางเดี่ยว ให้เห็นทรง สี ขอบหมวก ความหนา และสัดส่วนชัดเจน";
  if (group === "scarf_accessory") return "ผ้าพันคอหรือผ้าคลุมคอแบบใช้งานจริง ให้เห็นการพัน ความหนา การทิ้งตัว และเนื้อผ้า";
  if (group === "bag") return "สินค้ามุมด้านหน้าตรง ให้เห็นรูปทรง หูจับ ซิป ช่องกระเป๋า วัสดุ และรายละเอียดหลักชัดเจน";
  return "สินค้ามุมด้านหน้าตรง ให้เห็นรูปทรง สี ขนาด และรายละเอียดหลักชัดเจน";
}

function buildLeanThaiSupportTruthLine(shotKey = "") {
  const isDetailShot = [
    "lining_warmth",
    "material_or_lining_closeup",
    "texture_closeup",
    "texture_construction_closeup",
    "sole_view",
    "open_interior",
    "waistband_pocket",
    "hem_detail"
  ].includes(shotKey);
  const truthLine = "สี ทรง วัสดุ โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่";
  return isDetailShot
    ? `${truthLine} ภาพต้องเป็นภาพเดียว ไม่ใช่ collage`
    : truthLine;
}

function buildLeanThaiSupportPresentationLine(shotKey = "", hasApprovedHeroAnchor = false) {
  const backShots = new Set(["back_fit_on_model", "back_hood_closure"]);
  const sideShots = new Set(["side_fit_on_model", "side_thickness_length", "side_view"]);
  if (backShots.has(shotKey)) {
    return "ใช้ฉาก studio ขาวหรือเทาอ่อนสะอาดแบบหน้าสินค้า ยึดภาพด้านหลังต้นฉบับเป็น visual truth ห้ามเปลี่ยนเป็นหุ่นโชว์ ดัมมี่ หรือ ghost mannequin เว้นแต่ภาพต้นฉบับเป็นหุ่นจริง";
  }
  if (sideShots.has(shotKey)) {
    return "ใช้ฉาก studio ขาวหรือเทาอ่อนสะอาดแบบหน้าสินค้า ไม่ต้องยกฉาก lifestyle ของ Hero มาใหม่ แต่คุมแสง สี และความสมจริงให้ต่อเนื่องกับภาพหลัก";
  }
  return hasApprovedHeroAnchor
    ? "ภาพต้องดูเป็นเซ็ตเดียวกับภาพหลัก สินค้าเป็นจุดเด่นหลัก ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง"
    : "สินค้าเป็นจุดเด่นหลัก ภาพสมจริง สะอาดตา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง";
}

function buildThaiReviewOutputDirection(item = {}, { slotType = "support", shotKey = "" } = {}) {
  const isHero = slotType === "hero";
  const coreDirection = isHero
    ? [
      "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล สื่อถึงการใช้งานจริงของสินค้า ให้ความรู้สึกเข้าถึงง่าย น่าเชื่อถือ พร้อมจัดองค์ประกอบภาพให้ดึงดูดและเหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด",
      "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
      "ธุรกิจเช่า จำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย เน้นกลุ่มเป้าหมายระดับกลางถึงสูง"
    ]
    : [
      "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวสินค้าที่ดูเรียล น่าเชื่อถือ และเหมาะสำหรับหน้าสินค้าบนเว็บไซต์ แสดงการใช้งานจริงในบริบทธรรมชาติ โดยให้สินค้าคือจุดเด่นหลักของภาพ ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง",
      "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
      "บริบทธุรกิจ: ธุรกิจเช่าและจำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย สำหรับลูกค้าระดับกลางถึงสูง"
    ];
  return [
    ...coreDirection,
    "ไม่ต้องสร้างป้ายแบรนด์ใหม่หรือเน้นชื่อแบรนด์เพิ่ม ใช้เฉพาะโลโก้ ป้าย หรือแพตช์จริงที่เห็นจากภาพต้นฉบับเท่านั้น",
    buildProductCameraFocusDirection(item, shotKey, { slotType })
  ].filter(Boolean);
}

function buildProductCameraFocusDirection(item = {}, shotKey = "", { slotType = "support" } = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const detailShot = ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth", "material_or_lining_closeup"].includes(shotKey);
  const smallAccessoryFocus = {
    gloves: "สำหรับถุงมือ ใช้ภาพระยะใกล้หรือครอปที่โฟกัสสินค้าเป็นหลัก เห็นมือ ข้อมือ หรือปลายแขนเท่าที่จำเป็น และให้ถุงมือกินพื้นที่หลักของเฟรม",
    hat: "สำหรับหมวก ใช้ภาพระยะใกล้หรือครอปช่วงศีรษะและไหล่เป็นหลัก เห็นใบหน้า คอ หรือไหล่เท่าที่จำเป็น และให้หมวกกินพื้นที่หลักของเฟรม",
    scarf_accessory: "สำหรับผ้าพันคอหรืออุปกรณ์คลุมคอ ใช้ภาพระยะใกล้จากคอถึงอกหรือช่วงลำตัวบนเป็นหลัก ให้ผ้าและการใช้งานจริงชัดที่สุด",
    socks: "สำหรับถุงเท้า ใช้ภาพระยะใกล้จากน่องถึงเท้าหรือครอปที่โฟกัสสินค้าเป็นหลัก อย่าให้กางเกง รองเท้า หรือฉากหลังแย่งความเด่นจากถุงเท้า"
  };
  if (smallAccessoryFocus[group]) {
    const suffix = detailShot ? " สำหรับภาพรายละเอียด ให้ครอปแน่นขึ้นบนพื้นผิว รอยเย็บ ขอบปลาย ขอบผ้า ผ้าถัก ซับใน หรือจุดประกอบจริงของสินค้า" : "";
    return `${smallAccessoryFocus[group]}${suffix}`;
  }
  if (["upper_outerwear", "long_outerwear", "pants", "footwear"].includes(group)) {
    if (slotType === "hero") {
      return "สำหรับสินค้าชิ้นใหญ่ เช่น เสื้อ กางเกง หรือรองเท้า ใช้มุมภาพธรรมชาติที่เห็นสินค้าเต็มพอให้เข้าใจการเข้าทรง สัดส่วนเมื่อใส่ รูปทรงภาพรวม และการใช้งานจริง โดยไม่จำเป็นต้องบังคับภาพระยะใกล้";
    }
    return "สำหรับสินค้าชิ้นใหญ่ เช่น เสื้อ กางเกง หรือรองเท้า ใช้มุมภาพธรรมชาติที่ช่วยอธิบายการเข้าทรง สัดส่วนเมื่อใส่ รูปทรงภาพรวม และรายละเอียดตามจุดประสงค์ของช็อต โดยไม่จำเป็นต้องบังคับภาพระยะใกล้ทุกภาพ";
  }
  return "";
}

function buildThaiProductTruthLines(item = {}, productIdentity = buildProductIdentity(item)) {
  return [
    "ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก หากคำสั่งอื่นขัดกับภาพต้นฉบับ ให้ยึดภาพต้นฉบับของรหัสสินค้านี้เป็นหลัก",
    `รักษา${buildThaiProductVisualFacts(item, productIdentity)}ให้ตรงกับภาพต้นฉบับ`,
    "ไม่เพิ่มโลโก้ ป้าย แพตช์ ข้อความ ตัวเลข ราคา คิวอาร์โค้ด วอเตอร์มาร์ก แท็ก หรือองค์ประกอบกราฟิกใหม่",
    "ไม่ต้องสร้างหรือทำให้โลโก้อ่านชัดขึ้นเอง ใช้เฉพาะโลโก้ ป้าย หรือแพตช์จริงที่เห็นในภาพต้นฉบับ และไม่ต้องเน้นชื่อแบรนด์"
  ];
}

function buildThaiProductVisualFacts(item = {}, productIdentity = buildProductIdentity(item)) {
  const category = String(item.category || "").trim();
  const brandFact = productIdentity.productBrand ? "โลโก้หรือแพตช์จริงที่มองเห็นได้ สี " : "สี ";
  if (category === "รองเท้า") {
    return `${brandFact}ทรงรองเท้า ความสูงของบูท วัสดุด้านนอก ลายเย็บ แผงข้าง ช่องเชือก เชือก รูปทรงหัวรองเท้า พื้นรองเท้า ขอบบุด้านใน พื้นผิว และสัดส่วน`;
  }
  if (category === "เสื้อ") {
    return `${brandFact}ทรงเสื้อ รูปทรงภาพรวม ความหนา วอลุ่ม ผ้า พื้นผิว ฮู้ด ปก ขนเฟอร์ ซิป กระดุม เข็มขัด ชายเสื้อ แขนเสื้อ ตะเข็บ ลายเย็บบุนวม ปริมาตรบุนวม ซับในที่เห็นจริง และสัดส่วน`;
  }
  if (["หมวกกันหนาว", "ถุงมือกันหนาว", "ผ้าพันคอ", "ถุงเท้า"].includes(category)) {
    return `${brandFact}รูปทรง พื้นผิว ผ้าถักหรือผ้าฟลีซ ความหนา ขอบปลาย ตะเข็บ ซับใน ป้ายจริงที่เห็นได้ และสัดส่วน`;
  }
  if (category === "กระเป๋า") {
    return `${brandFact}วัสดุ หูจับ ซิป ช่องกระเป๋า ตะเข็บ hardware ความลึก รูปทรง พื้นผิว และสัดส่วน`;
  }
  return `${brandFact}วัสดุ รูปทรงภาพรวม ตะเข็บ ขอบ ซิป ป้ายจริง พื้นผิว และสัดส่วน`;
}

function buildThaiHeroSubjectDirection(item = {}, modelPolicy = {}) {
  const { group } = resolveProductUseCaseV3(item);
  if (modelPolicy.presence === "detail_only_no_model") {
    return "จัดภาพให้สินค้าเป็นจุดเด่นหลักของเฟรม เห็นรายละเอียดจริงชัดเจน ไม่ต้องมีนายแบบหรือนางแบบ";
  }
  if (group === "footwear") {
    return "สำหรับรองเท้า ให้เห็นรองเท้าชัดพอทั้งทรง ความสูง พื้นรองเท้า เชือกหรือสายรัด และการใส่จริง อาจมีขาหรือกางเกงกันหนาวช่วยบอกสัดส่วน แต่ห้ามให้เสื้อผ้าหรือฉากหลังแย่งจุดเด่นจากรองเท้า";
  }
  if (["upper_outerwear", "long_outerwear", "pants"].includes(group)) {
    return "สำหรับเสื้อ กางเกง หรือสินค้าชิ้นใหญ่ ให้เห็นการใส่จริงบนคนอย่างเป็นธรรมชาติ เห็นการเข้าทรง สัดส่วนเมื่อใส่ รูปทรงภาพรวม ความยาว ความหนา และการตกของผ้า โดยให้สินค้ายังเป็นจุดเด่นหลัก";
  }
  if (["gloves", "hat", "scarf_accessory", "socks"].includes(group)) {
    return "สำหรับสินค้าชิ้นเล็ก ให้ครอปใกล้พอจนสินค้าเด่นที่สุดในภาพ เห็นวิธีใช้งานจริงและสัดส่วนชัดเจน โดยใช้ร่างกายหรือเสื้อผ้าประกอบเท่าที่จำเป็น";
  }
  return "จัดองค์ประกอบให้สินค้าเป็นจุดเด่นหลัก เห็นการใช้งานจริงและสัดส่วนชัดเจนในภาพเดียว";
}

function buildThaiSupportSubjectDirection(item = {}, shotKey = "", modelPolicy = {}) {
  if (modelPolicy.presence === "detail_only_no_model") {
    return "ช็อตนี้ควรเป็นภาพรายละเอียดสินค้าเป็นหลัก ไม่ต้องใส่นายแบบหรือนางแบบ และไม่ต้องสร้างฉาก lifestyle เพิ่ม";
  }
  if (modelPolicy.wearer_type === "unisex_pair") {
    return "ถ้าต้องมีคนในภาพสำหรับสินค้ายูนิเซ็กซ์ ให้ใช้คู่ชายหญิงธรรมชาติเท่าที่จำเป็นเพื่อบอกสัดส่วน และให้สินค้ายังเด่นกว่าคน";
  }
  if (["wearing_scale_cue", "optional_model_scale", "style_cue", "scale_cue"].includes(shotKey)) {
    return "ใช้คนหรือบริบทประกอบเท่าที่จำเป็นเพื่ออธิบายขนาด การเข้าทรง และการใช้งานจริง โดยให้สินค้ายังเป็นจุดเด่นหลัก";
  }
  return "จัดช็อตนี้ให้ช่วยอธิบายรายละเอียดสินค้าเพิ่มจากภาพหลัก ไม่ซ้ำมุมเดิม และยังดูเป็นภาพหน้าสินค้าที่สะอาดน่าเชื่อถือ";
}

function buildThaiApprovedHeroAnchorDirection(item = {}, shotKey = "", modelPolicy = {}) {
  const anchor = item.approved_hero_anchor || item.approvedHeroAnchor;
  if (!anchor) return "";
  const isDetailOnly = modelPolicy.presence === "detail_only_no_model" || ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth", "material_or_lining_closeup"].includes(shotKey);
  if (isDetailOnly) {
    return "ใช้ภาพหลักที่อนุมัติแล้วเป็นภาพอ้างอิงสำหรับอารมณ์ภาพ แสง สี สัดส่วน และความสมจริงของชุดภาพ แต่ช็อตนี้เป็นภาพรายละเอียดสินค้า จึงไม่ต้องเพิ่มนายแบบหรือนางแบบใหม่ เว้นแต่ช็อตนั้นต้องการบริบทการใส่จริงเล็กน้อย";
  }
  if (modelPolicy.wearer_type === "unisex_pair") {
    return "ใช้ภาพหลักที่อนุมัติแล้วเป็นภาพอ้างอิงสำหรับอารมณ์ภาพ นายแบบหรือนางแบบ การเข้าทรง แสง และความสมจริง ถ้ามีคนในภาพให้คงแนวคิดคู่ชายหญิงเดิม ไม่เพิ่มคนอื่น และถ้าขัดกับภาพต้นฉบับสินค้าให้ยึดภาพต้นฉบับสินค้าเป็นหลัก";
  }
  return "ใช้ภาพหลักที่อนุมัติแล้วเป็นภาพอ้างอิงสำหรับอารมณ์ภาพ นายแบบหรือนางแบบ การเข้าทรง แสง และความสมจริงของชุดภาพ แต่ถ้าขัดกับภาพต้นฉบับสินค้าให้ยึดภาพต้นฉบับสินค้าเป็นหลัก";
}

function buildThaiHumanRealismLines(modelPolicy = {}) {
  if (modelPolicy.presence === "detail_only_no_model") return [];
  return [
    "ถ้ามีคนในภาพ ให้เป็นนายแบบหรือนางแบบเอเชียหรือไทยที่ดูเป็นคนใช้งานจริง แต่งกายสุภาพเต็มตัว ไม่ดูเป็นแฟชั่นแคมเปญจัดฉากเกินไป",
    "ผิว มือ ท่าทาง แสงเงา และรอยยับของผ้าต้องดูธรรมชาติ ไม่รีทัชจนผิวพลาสติก ไม่หน้าวาว ไม่ซีดแบน และไม่เกลี่ยผิวแบบเอไอมากเกินไป"
  ];
}

function buildThaiSupportSafetyLines(item = {}, shotKey = "", modelPolicy = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const lines = [];
  if (["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "lining_warmth", "material_or_lining_closeup", "open_interior", "sole_view"].includes(shotKey)) {
    lines.push("สำหรับภาพรายละเอียด ให้ครอปเฉพาะหลักฐานจริงของวัสดุ งานเย็บ ซิป ซับใน พื้นรองเท้า ขอบปลาย หรือโครงสร้างที่เห็นได้ ห้ามประดิษฐ์ป้ายไซซ์ ป้ายวิธีดูแล ป้ายห้อย หรือข้อความใหม่");
  }
  if (group === "footwear") {
    lines.push("สำหรับรองเท้า ให้การแต่งช่วงขาดูใช้งานจริง เช่น กางเกงกันหนาว เลกกิ้ง หรือกางเกงสกี ห้ามให้ขาเปลือย ถุงเท้าหนาเทอะทะ หรือขอบผ้าฟู ๆ กลายเป็นจุดเด่นแทนรองเท้า");
  }
  if (group === "pants") {
    lines.push("สำหรับกางเกง ให้ styling สุภาพเหมาะกับหน้าสินค้าและท่องเที่ยวอากาศหนาว ห้ามให้รองเท้า เสื้อสั้น หรือองค์ประกอบอื่นแย่งความเด่นจากกางเกง");
  }
  if (group === "gloves") {
    lines.push("สำหรับถุงมือ ให้มีแขนเสื้อหรือขอบแขนเสื้อกันหนาวประกบอย่างเป็นธรรมชาติถ้าต้องเห็นมือ ไม่ให้แขนดูว่างหรือผิดสัดส่วน");
  }
  if (["hat", "scarf_accessory"].includes(group)) {
    lines.push("สำหรับหมวกและผ้าพันคอ ให้รักษาตำแหน่งโลโก้ ป้าย หรือแพตช์จริงเฉพาะด้านที่เห็นจากภาพอ้างอิงเท่านั้น");
  }
  if (modelPolicy.wearer_type === "unisex_pair") {
    lines.push("ถ้ามีคนในภาพสำหรับสินค้ายูนิเซ็กซ์ ให้คงแนวคิดคู่ชายหญิงเดิม สัดส่วนสมดุล อารมณ์ภาพเดียวกัน และไม่เพิ่มคนอื่น");
  }
  return lines;
}

function buildThaiNoAdLayoutConstraints() {
  return "ภาพต้องสะอาด สมจริง สินค้าเด่น คมชัด และไม่มีตัวอักษร ห้ามทำเป็นโปสเตอร์ โฆษณาพร้อมข้อความ ป้ายราคา ป้ายเน้น คำโปรย หน้าจอแอป คิวอาร์โค้ด ป้ายร้าน ของประกอบที่ไม่เกี่ยวข้อง ป้ายปลอม โลโก้ปลอม วอเตอร์มาร์ก หัวข้อโฆษณา หรือการจัดตัวอักษรตกแต่ง";
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
  return buildThaiApprovedHeroAnchorDirection(item, shotKey, modelPolicy);
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

function buildLeanHeroVariation() {
  return {
    variation_group: "lean_hero",
    composition: "natural_product_review_hero",
    background: "model_choice_from_reference_and_prompt",
    crop: "natural_product_hero",
    pose: "natural_usage_or_product_focus",
    lighting: "realistic_clean_light",
    variation_note: "Hero no longer rotates A/B/C/D; keep the Fal prompt output lean Thai and let the model choose a natural product-review hero."
  };
}

function buildSupportVariation({ group, shotKey, category, isRent }) {
  const detailShot = ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth", "material_or_lining_closeup"].includes(shotKey);
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

function describeThaiSupportShotV3(shotKey, item = {}) {
  const { group } = resolveProductUseCaseV3(item);
  if (shotKey === "front_pair" && group === "socks") {
    return "มุมถุงเท้าคู่ด้านหน้า เห็นขอบถุงเท้า ความยาว ลาย knit หรือพื้นผิว ความหนา ส้น ปลายเท้า และความสมมาตรของคู่ถุงเท้า";
  }
  if (shotKey === "front_pair" && group === "footwear") {
    return "มุมรองเท้าคู่ด้านหน้า เห็นรองเท้าทั้งคู่ชัดเจน ทั้งหัวรองเท้า ความสูง เชือกหรือสายรัด และทรงคู่";
  }

  const descriptions = {
    front_fit_shape: "มุมด้านหน้าที่ช่วยให้เห็นการเข้าทรง ความยาว รูปทรงภาพรวม จุดปิดเปิด และการอ่านรูปทรงสินค้าบนตัวคนหรือบนรูปทรงสินค้า",
    side_fit_on_model: "มุมด้านข้างหรือสามส่วนสี่บนตัวนางแบบ ให้เห็นความหนา ความยาว การเข้ารูป โลโก้ แพตช์ ตัวเลข หรือข้อความเทคนิคจริงบนแขนถ้ามี โดยยังดูเป็นชุดเดียวกับภาพหลัก",
    back_fit_on_model: "มุมด้านหลังบนตัวนางแบบ ให้เห็นฮู้ด โครงสร้างหลัง ชายเสื้อ ทรงไหล่ ความยาว โลโก้ แพตช์ ตัวเลข หรือข้อความเทคนิคจริงที่ภาพหลักไม่เห็น",
    material_or_lining_closeup: "ภาพ extreme close-up เดี่ยวของวัสดุ ซับใน ขนเฟอร์ ซิป ขอบคอ ปลายแขน งานเย็บ หรือตัวเลข/ข้อความเทคนิคจริง โดยคุมแสงและอารมณ์ภาพให้ต่อเนื่องกับภาพหลัก",
    side_thickness_length: "มุมด้านข้างหรือสามส่วนสี่ที่ช่วยให้เห็นความหนา ความอุ่น ความลึก ตะเข็บด้านข้าง ความยาว หรือความหนาของพื้นรองเท้าตามประเภทสินค้า",
    back_hood_closure: "มุมด้านหลังที่เห็นฮู้ด โครงสร้างหลัง ชายเสื้อ รูปทรง และรายละเอียดด้านหลังชัดเจน",
    hood_detail: "มุมรายละเอียดฮู้ดหรือปก เห็นทรงฮู้ด ความสัมพันธ์กับปก ขนเฟอร์ drawcord ถ้ามี และการคลุมช่วงศีรษะหรือช่วงบนของลำตัว",
    lining_warmth: "มุมซับในและความอุ่น เปิดหรือพับสินค้าอย่างสมจริงเพื่อเห็นซับใน ผ้าฟลีซ บุนวม ขนเฟอร์ งานเย็บ หรือโครงสร้างด้านในที่มีอยู่จริง",
    texture_closeup: "ภาพระยะใกล้ของวัสดุจริง เช่น ผ้าถัก ผ้าฟลีซ ขนเฟอร์ ซิป กระดุม ตะเข็บ แพตช์ ซับใน พื้นรองเท้า หรือรายละเอียดประกอบที่ช่วยให้ลูกค้าตัดสินใจ",
    fabric_fur_zip_patch_detail: "ภาพรายละเอียดเพื่อความน่าเชื่อถือ เห็นผ้า ขนเฟอร์ ซิป patch ขอบ งานเย็บ และสภาพสินค้าจริง",
    front_pair: "มุมสินค้าคู่ด้านหน้า ให้เห็นรูปทรงคู่และรายละเอียดสำคัญชัดเจน",
    side_profile: "มุมด้านข้างของรองเท้าหรือสินค้า เห็นรูปทรงด้านข้าง ความสูง พื้นรองเท้า หัวรองเท้า ช่องเปิด และรายละเอียดการยึดปิด",
    top_view: "มุมมองจากด้านบน เห็นช่องเปิด เชือกหรือสายรัด วัสดุด้านบน รูปทรงหัวรองเท้า และวิธีที่สินค้าเชื่อมกับการใส่จริง",
    sole_view: "มุมพื้นรองเท้าแบบสินค้าเดี่ยว เห็นลายพื้น ความหนา การยึดเกาะ ส้น และขอบพื้นรองเท้า โดยไม่ต้องเห็นขา",
    wearing_scale_cue: "มุมใส่จริงเพื่อบอกขนาดและสัดส่วน ใช้บริบทเท่าที่จำเป็นและให้สินค้ายังกินพื้นที่หลักของเฟรม",
    waistband_pocket: "ภาพรายละเอียดเอว กระดุม drawcord กระเป๋า ตะเข็บ หูเข็มขัด หรือโครงสร้างช่วงบนของกางเกง",
    hem_detail: "ภาพรายละเอียดชายขา ขอบปลาย ตะเข็บ ความหนาผ้า และจุดที่สินค้าพบกับรองเท้าหรือร่างกาย",
    front_view: "มุมด้านหน้าตรง ให้สินค้าใหญ่ อ่านรูปทรงและรายละเอียดหลักได้ง่าย",
    side_view: "มุมด้านข้าง ให้เห็นความลึก โครงสร้าง และสัดส่วนของสินค้า",
    open_interior: "มุมเปิดด้านในเฉพาะเมื่อสมจริง เห็นซับใน ช่องเก็บของ บุนวม ซิป หรือโครงสร้างด้านใน",
    pair_front: "มุมถุงมือคู่ด้านหน้า เห็นนิ้ว ขอบปลาย รูปทรง ตะเข็บ และความหนาของวัสดุ",
    palm_side: "มุมฝ่ามือ เห็น grip ตะเข็บ โครงสร้างนิ้ว วัสดุ และขอบซับในถ้ามี",
    cuff_sleeve_fit: "มุมถุงมือเมื่อเจอกับแขนเสื้อกันหนาว ให้เห็นขอบปลายและการสวมจริงอย่างเป็นธรรมชาติ",
    scale_cue: "มุมบอกขนาด ใช้คนหรือบริบทกลาง ๆ เพียงเล็กน้อยโดยไม่แย่งความเด่นจากสินค้า",
    front_back_side: "มุมหน้า หลัง และข้างที่อ่านรูปทรงสินค้าได้ง่ายสำหรับหน้าสินค้า โดยไม่ทำเป็นกริดหรือ collage",
    texture_construction_closeup: "ภาพระยะใกล้ของวัสดุ ตะเข็บ hardware ซับใน พื้นรองเท้า ผ้าถัก หรือโครงสร้างที่ช่วยยืนยันคุณภาพสินค้า",
    style_cue: "มุม styling เรียบง่ายให้ลูกค้าเห็นการจับคู่กับเสื้อผ้ากันหนาวจริง โดยให้สินค้ายังเด่นและตรงกับต้นฉบับ",
    optional_model_scale: "มุมใช้คนประกอบเท่าที่จำเป็นเพื่ออธิบายขนาด การเข้าทรง และสัดส่วนในภาพหน้าสินค้าที่สะอาด"
  };
  return descriptions[shotKey] || "ภาพเสริมสินค้า ให้เห็นรายละเอียดที่ลูกค้าต้องใช้ตัดสินใจ โดยรักษาสินค้าให้ตรงกับภาพต้นฉบับ";
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
    side_fit_on_model: "On-model side or three-quarter view. Show thickness, length, fit, and any real sleeve logo, patch, number, or technical marking as a continuation of the approved hero set.",
    back_fit_on_model: "On-model back view. Show hood, rear construction, hem, shoulder shape, length, and any real rear logo, patch, number, or technical marking as a continuation of the approved hero set.",
    material_or_lining_closeup: "Single extreme close-up of material, lining, fur, zipper, collar, cuff, stitching, or real technical marking, visually tied to the approved hero set.",
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
