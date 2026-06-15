import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildProductIdentityV3,
  buildSupportPromptV3,
  getSupportShotsV3,
  resolveModelPolicyV3,
  resolveVisualVariationV3
} from "../../lib/automation/prompt-framework-v3.mjs";

const OLD_PROVIDER_BRIEF_RE = /Create one clean|Use case:|Reference priority:|Product truth lock:|Human realism:|Constraints:|Brand mark fidelity|Actual product brand|Do not add poster layout|source of truth/i;

test("exports a v3 Thai provider-output version", () => {
  assert.match(PROMPT_FRAMEWORK_V3_VERSION, /v3\.11-thai-provider-output/);
});

test("hero prompt sends the user's Thai review output shape to the provider", () => {
  const prompt = buildHeroPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face White Cream Puffer Jacket, Down 600",
    category: "เสื้อ",
    reference_confidence: "high"
  });

  assert.match(prompt, /อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล/);
  assert.match(prompt, /สื่อถึงการใช้งานจริงของสินค้า/);
  assert.match(prompt, /เหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา/);
  assert.match(prompt, /กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ/);
  assert.match(prompt, /ธุรกิจเช่า จำหน่ายชุดกันหนาว/);
  assert.match(prompt, /ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด/);
  assert.match(prompt, /สำหรับสินค้าชิ้นใหญ่/);
  assert.match(prompt, /การเข้าทรง สัดส่วนเมื่อใส่ รูปทรงภาพรวม/);
  assert.match(prompt, /ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก/);
  assert.match(prompt, /รักษา.*สี.*ทรงเสื้อ.*ซิป.*ตะเข็บ.*สัดส่วน/);
  assert.match(prompt, /ไม่เพิ่มโลโก้ ป้าย แพตช์ ข้อความ/);
  assert.match(prompt, /ไม่เกลี่ยผิวแบบเอไอมากเกินไป/);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(prompt, /porcelain skin/i);
  assert.doesNotMatch(prompt, /GO Mall|Rent A Coat/i);
});

test("GO Mall hero prompt uses Thai product clarity without exposing branch labels", () => {
  const prompt = buildHeroPromptV3({
    sku: "2CT1600000",
    product_type: "rental",
    target_site: "rentacoat",
    reference_brand_id: "go_mall",
    product_name: "Trench Coat Fashion",
    category: "เสื้อ",
    reference_confidence: "medium"
  });

  assert.match(prompt, /สินค้าเด่น/);
  assert.match(prompt, /หน้าสินค้า|สื่อโซเชียลหรือโฆษณา/);
  assert.match(prompt, /ยึดภาพต้นฉบับ/);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(prompt, /GO Mall|Rent A Coat|Product type/i);
});

test("hero prompt uses close product focus for small accessories", () => {
  const hatPrompt = buildHeroPromptV3({
    sku: "GM-HAT-001",
    product_type: "sale",
    target_site: "gomall",
    product_name: "หมวกไหมพรมกันหนาว",
    category: "หมวกกันหนาว"
  });
  const glovePrompt = buildHeroPromptV3({
    sku: "RAC-GLOVE-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "ถุงมือกันหนาว",
    category: "ถุงมือกันหนาว"
  });

  assert.match(hatPrompt, /สำหรับหมวก/);
  assert.match(hatPrompt, /ภาพระยะใกล้หรือครอปช่วงศีรษะและไหล่/);
  assert.match(hatPrompt, /ให้หมวกกินพื้นที่หลักของเฟรม/);
  assert.match(glovePrompt, /สำหรับถุงมือ/);
  assert.match(glovePrompt, /ครอปที่โฟกัสสินค้าเป็นหลัก/);
  assert.match(glovePrompt, /ให้ถุงมือกินพื้นที่หลักของเฟรม/);
  assert.doesNotMatch(hatPrompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(glovePrompt, OLD_PROVIDER_BRIEF_RE);
});

test("support prompt stays Thai-only and uses approved hero as a soft anchor", () => {
  const prompt = buildSupportPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face white down jacket",
    category: "เสื้อ",
    approved_hero_anchor: {
      url: "https://cdn.example.com/hero.png"
    }
  }, "front_fit_shape", 1, 6);

  assert.match(prompt, /อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวสินค้าที่ดูเรียล/);
  assert.match(prompt, /เหมาะสำหรับหน้าสินค้าบนเว็บไซต์/);
  assert.match(prompt, /ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง/);
  assert.match(prompt, /ภาพเสริมช็อตที่ 1 จาก 6/);
  assert.match(prompt, /มุมด้านหน้าที่ช่วยให้เห็นการเข้าทรง/);
  assert.match(prompt, /ใช้ภาพหลักที่อนุมัติแล้วเป็นภาพอ้างอิง/);
  assert.match(prompt, /ถ้าขัดกับภาพต้นฉบับสินค้าให้ยึดภาพต้นฉบับสินค้าเป็นหลัก/);
  assert.match(prompt, /เปลี่ยนเฉพาะมุมภาพ ระยะครอป/);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(prompt, /approved hero image|Use-case guidance|Change only the angle/i);
});

test("small accessory support prompts force tight product-focused crops", () => {
  const glovePrompt = buildSupportPromptV3({
    sku: "RAC-GLOVE-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "ถุงมือกันหนาว",
    category: "ถุงมือกันหนาว"
  }, "texture_closeup", 4, 4);
  const scarfPrompt = buildSupportPromptV3({
    sku: "RAC-SCARF-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "ผ้าพันคอ fleece neck warmer",
    category: "ผ้าพันคอ"
  }, "wearing_scale_cue", 2, 4);
  const sockPrompt = buildSupportPromptV3({
    sku: "RAC-SOCK-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "ถุงเท้ากันหนาว",
    category: "ถุงเท้า"
  }, "front_pair", 1, 3);

  assert.match(glovePrompt, /สำหรับถุงมือ/);
  assert.match(glovePrompt, /ภาพระยะใกล้/);
  assert.match(glovePrompt, /ครอปแน่นขึ้นบนพื้นผิว รอยเย็บ/);
  assert.match(scarfPrompt, /สำหรับผ้าพันคอหรืออุปกรณ์คลุมคอ/);
  assert.match(scarfPrompt, /คอถึงอก/);
  assert.match(sockPrompt, /สำหรับถุงเท้า/);
  assert.match(sockPrompt, /น่องถึงเท้า/);
  assert.match(sockPrompt, /อย่าให้กางเกง รองเท้า หรือฉากหลังแย่งความเด่น/);
  assert.match(sockPrompt, /มุมถุงเท้าคู่ด้านหน้า/);
  assert.doesNotMatch(sockPrompt, /Show both socks clearly/i);
});

test("support prompt includes Thai footwear and outerwear shot guidance", () => {
  const footwearPrompt = buildSupportPromptV3({
    sku: "2BT0158000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
    category: "รองเท้า"
  }, "side_profile", 2, 6);
  const coatPrompt = buildSupportPromptV3({
    sku: "GM-LONG-001",
    product_type: "sale",
    target_site: "gomall",
    product_name: "Canada Goose Expedition Parka",
    category: "เสื้อ",
    subcategory: "พาร์กา"
  }, "lining_warmth", 5, 6);

  assert.match(footwearPrompt, /มุมด้านข้างของรองเท้า/);
  assert.match(footwearPrompt, /ความสูง พื้นรองเท้า หัวรองเท้า/);
  assert.match(footwearPrompt, /กางเกงกันหนาว เลกกิ้ง หรือกางเกงสกี/);
  assert.doesNotMatch(footwearPrompt, /lower-leg|shaft height|bare legs/i);
  assert.match(coatPrompt, /มุมซับในและความอุ่น/);
  assert.match(coatPrompt, /ซับใน ผ้าฟลีซ บุนวม ขนเฟอร์/);
  assert.match(coatPrompt, /ห้ามประดิษฐ์ป้ายไซซ์/);
  assert.doesNotMatch(coatPrompt, /Lining and warmth evidence|care labels/i);
});

test("model policy requires Rent A Coat apparel hero model and prefers GO Mall apparel model", () => {
  const rentHero = resolveModelPolicyV3({
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาว",
    category: "เสื้อ"
  }, { slotType: "hero" });
  const goMallHero = resolveModelPolicyV3({
    product_type: "sale",
    target_site: "gomall",
    product_name: "สเวตเตอร์ไหมพรม",
    category: "เสื้อ"
  }, { slotType: "hero" });

  assert.equal(rentHero.presence, "required");
  assert.equal(rentHero.role, "fit_size_scale_companion");
  assert.equal(goMallHero.presence, "preferred");
});

test("model policy supports unisex pair comparison and child products", () => {
  const unisexSupport = resolveModelPolicyV3({
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Unisex winter jacket",
    category: "เสื้อ"
  }, { slotType: "support", shotKey: "wearing_scale_cue" });
  const childHero = resolveModelPolicyV3({
    product_type: "sale",
    target_site: "gomall",
    product_name: "เสื้อกันหนาวเด็ก",
    category: "เสื้อ"
  }, { slotType: "hero" });

  assert.equal(unisexSupport.presence, "required");
  assert.equal(unisexSupport.wearer_type, "unisex_pair");
  assert.equal(childHero.wearer_type, "child");
});

test("model policy does not misread Women's as men's", () => {
  const policy = resolveModelPolicyV3({
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
    category: "รองเท้า"
  }, { slotType: "hero" });

  assert.equal(policy.wearer_type, "female");
  assert.equal(policy.framing, "lower_body_or_on_foot");
});

test("visual variation planner assigns different hero patterns across adjacent SKUs", () => {
  const item = {
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาว",
    category: "เสื้อ"
  };
  const variations = [0, 1, 2, 3].map((itemIndex) => resolveVisualVariationV3(item, {
    slotType: "hero",
    itemIndex
  }));

  assert.deepEqual(variations.map((variation) => variation.variation_group), ["A", "B", "C", "D"]);
  assert.equal(new Set(variations.map((variation) => variation.composition)).size, 4);
  assert.equal(variations.every((variation) => variation.background), true);
});

test("visual variation planner keeps detail support shots product-only", () => {
  const variation = resolveVisualVariationV3({
    product_type: "sale",
    target_site: "gomall",
    product_name: "Snow boot",
    category: "รองเท้า"
  }, {
    slotType: "support",
    shotKey: "sole_view",
    itemIndex: 1,
    sequence: 3
  });

  assert.equal(variation.composition, "detail_macro_product_truth");
  assert.equal(variation.pose, "no_model_static_detail");
  assert.equal(variation.crop, "close_detail");
});

test("support shots differ by category and brand priorities", () => {
  const coatShots = getSupportShotsV3({ category: "เสื้อ", target_site: "rentacoat", product_type: "rental" });
  assert.deepEqual(coatShots.slice(0, 3), ["front_fit_shape", "side_thickness_length", "back_hood_closure"]);
  const hatShots = getSupportShotsV3({ category: "หมวกกันหนาว", target_site: "gomall", product_type: "sale" });
  assert.equal(hatShots.includes("wearing_scale_cue"), true);
});

test("product identity extracts actual product brand from product name", () => {
  const identity = buildProductIdentityV3({
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
    category: "รองเท้า"
  });

  assert.equal(identity.productBrand, "Columbia");
  assert.equal(identity.displayName, "Columbia Women's Loveland Mid Omni-Heat Snow Boot");
});

test("product identity recognizes broader winter and fashion product brands", () => {
  const examples = [
    ["Discovery Expedition goose down parka", "Discovery Expedition"],
    ["MLB fleece varsity jacket", "MLB"],
    ["Moncler Grenoble padded jacket", "Moncler"],
    ["Canada Goose Expedition Parka", "Canada Goose"],
    ["The North Face Nuptse jacket", "The North Face"],
    ["MOON BOOT ICON NYLON SNOW BOOTS", "Moon Boot"],
    ["MOOSEKNUCKLES Women's Coat", "Moose Knuckles"],
    ["Ecco Noir winter boot", "Ecco"],
    ["Louis Vuitton Monogram Stripy Eclipse Bonnet", "Louis Vuitton"]
  ];

  for (const [productName, expectedBrand] of examples) {
    const identity = buildProductIdentityV3({ product_name: productName, category: "เสื้อ" });
    assert.equal(identity.productBrand, expectedBrand);
  }
});

test("product identity prefers verified brand field and ignores generic labels", () => {
  assert.equal(buildProductIdentityV3({
    brand: "MOOSEKNUCKLES",
    product_name: "Fashion winter coat",
    category: "เสื้อ"
  }).productBrand, "Moose Knuckles");
  assert.equal(buildProductIdentityV3({
    brand: "Fashion",
    product_name: "snug winter gloves",
    category: "ถุงมือกันหนาว"
  }).productBrand, "");
});

test("representative provider prompts do not include the old English framework", () => {
  const items = [
    {
      sku: "2DJ0493000",
      product_type: "rental",
      target_site: "rentacoat",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      category: "เสื้อ"
    },
    {
      sku: "2BT0158000",
      product_type: "rental",
      target_site: "rentacoat",
      product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
      category: "รองเท้า"
    },
    {
      sku: "GM-HAT-001",
      product_type: "sale",
      target_site: "gomall",
      product_name: "หมวกไหมพรมกันหนาว",
      category: "หมวกกันหนาว"
    }
  ];

  for (const item of items) {
    assert.doesNotMatch(buildHeroPromptV3(item), OLD_PROVIDER_BRIEF_RE);
    assert.doesNotMatch(buildSupportPromptV3(item, getSupportShotsV3(item)[0], 1, 3), OLD_PROVIDER_BRIEF_RE);
  }
});
