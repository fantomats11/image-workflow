import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildProductIdentityV3,
  buildStudioMasterPromptV3,
  buildSupportPromptV3,
  getSupportShotsV3,
  resolveModelPolicyV3,
  resolveVisualVariationV3
} from "../../lib/automation/prompt-framework-v3.mjs";

const OLD_PROVIDER_BRIEF_RE = /Create one clean|Use case:|Reference priority:|Product truth lock:|Human realism:|Constraints:|Brand mark fidelity|Actual product brand|Do not add poster layout/i;
const LEAN_HERO_PROMPT = [
  "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล สื่อถึงการใช้งานจริงของสินค้า ให้ความรู้สึกเข้าถึงง่าย น่าเชื่อถือ พร้อมจัดองค์ประกอบภาพให้ดึงดูดและเหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด",
  "",
  "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
  "ธุรกิจเช่า จำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย เน้นกลุ่มเป้าหมายระดับกลางถึงสูง"
].join("\n");

test("exports a v3 hero-led product marking lock version", () => {
  assert.match(PROMPT_FRAMEWORK_V3_VERSION, /v3\.15-hero-led-product-marking-lock/);
});

test("hero prompt for large products sends only the user's lean Thai output", () => {
  const prompt = buildHeroPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face White Cream Puffer Jacket, Down 600",
    category: "เสื้อ",
    reference_confidence: "high"
  });

  assert.equal(prompt, LEAN_HERO_PROMPT);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(prompt, /สำหรับสินค้าชิ้นใหญ่|ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก|รักษา.*สี|ไม่เพิ่มโลโก้|ภาพต้องสะอาด|เอไอ/);
  assert.doesNotMatch(prompt, /porcelain skin/i);
  assert.doesNotMatch(prompt, /GO Mall|Rent A Coat/i);
});

test("GO Mall hero prompt uses the same lean Thai output without branch labels", () => {
  const prompt = buildHeroPromptV3({
    sku: "2CT1600000",
    product_type: "rental",
    target_site: "rentacoat",
    reference_brand_id: "go_mall",
    product_name: "Trench Coat Fashion",
    category: "เสื้อ",
    reference_confidence: "medium"
  });

  assert.equal(prompt, LEAN_HERO_PROMPT);
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

  assert.match(hatPrompt, new RegExp(escapeRegExp(LEAN_HERO_PROMPT)));
  assert.match(hatPrompt, /สำหรับหมวก/);
  assert.match(hatPrompt, /ภาพระยะใกล้หรือครอปช่วงศีรษะและไหล่/);
  assert.match(hatPrompt, /ให้หมวกเด่นที่สุดในภาพ/);
  assert.match(glovePrompt, new RegExp(escapeRegExp(LEAN_HERO_PROMPT)));
  assert.match(glovePrompt, /สำหรับถุงมือ/);
  assert.match(glovePrompt, /ครอปที่โฟกัสสินค้าเป็นหลัก/);
  assert.match(glovePrompt, /ให้ถุงมือเด่นที่สุดในภาพ/);
  assert.doesNotMatch(hatPrompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(glovePrompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(hatPrompt, /ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก|ภาพต้องสะอาด|ไม่เพิ่มโลโก้/);
  assert.doesNotMatch(glovePrompt, /ยึดภาพต้นฉบับเป็นแหล่งอ้างอิงหลัก|ภาพต้องสะอาด|ไม่เพิ่มโลโก้/);
});

test("support prompt uses PDP studio variables with hero and product truth refs", () => {
  const prompt = buildSupportPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face white down jacket",
    category: "เสื้อ",
    approved_hero_anchor: {
      url: "https://cdn.example.com/hero.png"
    }
  }, "side_fit_on_model", 1, 3);

  assert.match(prompt, /^อ้างอิงภาพหลักที่อนุมัติแล้วและภาพสินค้าจริงจาก catalog\/Drive/);
  assert.match(prompt, /\[SPECIFIC_ANGLE\] = ด้านข้างแบบสตูดิโอ \(Studio Side View\)/);
  assert.match(prompt, /\[PRODUCT_CATEGORY\] = เสื้อโค้ทกันหนาวขนเป็ด/);
  assert.match(prompt, /\[KEY_DETAIL\] = ทรงด้านข้าง ความหนา ความยาว/);
  assert.match(prompt, /สร้างภาพสนับสนุนหน้า PDP/);
  assert.match(prompt, /พื้นผิวสตูดิโอสีเทาอ่อนที่เรียบมินิมอล/);
  assert.match(prompt, /ไม่ดูเป็นภาพโฆษณาแฟชั่นที่รีทัชจนเนียนกริบ/);
  assert.match(prompt, /สี ทรง วัสดุ โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่/);
  assert.match(prompt, /Reference Image 1 คือภาพหลักที่อนุมัติแล้ว/);
  assert.match(prompt, /รูปจริงจาก catalog\/Drive ใช้เป็น source of truth ของสินค้าเท่านั้น ไม่ใช้เป็น output โดยตรง/);
  assert.match(prompt, /Strictly a single unified photograph/);
  assert.doesNotMatch(prompt, /approved hero|hero anchor/i);
  assert.ok(prompt.length < 1700);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
  assert.doesNotMatch(prompt, /Use-case guidance|Change only the angle|กลุ่มเป้าหมาย|บริบทธุรกิจ/i);
});

test("studio master prompt creates a visible gallery anchor from approved Hero and product truth", () => {
  const prompt = buildStudioMasterPromptV3({
    sku: "2AF0015000",
    product_name: "Fur Coat Fashion",
    category: "เสื้อ",
    approved_hero_anchor: { url: "https://cdn.example.com/hero.png" }
  });

  assert.match(prompt, /^อ้างอิงภาพหลักที่อนุมัติแล้วและภาพสินค้าจริง/);
  assert.match(prompt, /Reference Image 1 คือภาพหลักที่อนุมัติแล้ว/);
  assert.match(prompt, /Reference Image 2 เป็นต้นไปคือภาพสินค้าจริง/);
  assert.match(prompt, /สร้างภาพ Studio Master สำหรับหน้าสินค้า/);
  assert.match(prompt, /สวยพอใช้ใน gallery เว็บไซต์/);
  assert.match(prompt, /ใช้คนเดิมจากภาพหลัก/);
  assert.match(prompt, /ห้ามเปลี่ยนคนเป็นคนใหม่/);
  assert.match(prompt, /ไม่ต้องทำ collage/);
  assert.doesNotMatch(prompt, OLD_PROVIDER_BRIEF_RE);
});

test("back support prompt keeps PDP back-view intent and product truth", () => {
  const prompt = buildSupportPromptV3({
    sku: "FSTR260021",
    product_type: "sale",
    target_site: "gomall",
    product_name: "FSTR260021",
    category: "เสื้อ",
    approved_hero_anchor: {
      url: "https://cdn.example.com/hero.png"
    }
  }, "back_fit_on_model", 2, 3);

  assert.match(prompt, /\[SPECIFIC_ANGLE\] = ด้านหลังแบบสตูดิโอ \(Studio Back View\)/);
  assert.match(prompt, /\[KEY_DETAIL\] = ดีไซน์ด้านหลัง ฮู้ด ทรงไหล่ ความยาว ตะเข็บ/);
  assert.match(prompt, /สร้างภาพสนับสนุนหน้า PDP/);
  assert.match(prompt, /Reference Image 1 คือภาพหลักที่อนุมัติแล้ว/);
  assert.match(prompt, /source of truth/);
  assert.match(prompt, /ภาพสินค้า studio สำหรับ gallery เว็บไซต์/);
  assert.ok(prompt.length < 1700);
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

  assert.match(glovePrompt, /\[SPECIFIC_ANGLE\] = เจาะลึกรายละเอียดอุปกรณ์ \(Close-up Detailed View\)/);
  assert.match(glovePrompt, /\[KEY_DETAIL\] = พื้นผิวกันลื่นตรงฝ่ามือ \(Grip Texture\) และสายรัดข้อมือ/);
  assert.match(glovePrompt, /ภาพต้องเป็นภาพเดียว ไม่ใช่ collage/);
  assert.match(scarfPrompt, /\[PRODUCT_CATEGORY\] = ผ้าพันคอหรือผ้าคลุมคอกันหนาว/);
  assert.match(scarfPrompt, /เนื้อผ้า ลายถัก ขอบผ้า ความหนา/);
  assert.match(sockPrompt, /\[PRODUCT_CATEGORY\] = ถุงเท้ากันหนาว/);
  assert.match(sockPrompt, /ขอบถุงเท้า เนื้อผ้า ความหนา ส้น ปลายเท้า/);
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
  }, "material_or_lining_closeup", 3, 3);

  assert.match(footwearPrompt, /\[SPECIFIC_ANGLE\] = ด้านข้างแบบสตูดิโอ \(Studio Side View\)/);
  assert.match(footwearPrompt, /ทรงรองเท้า ความสูง วัสดุ เชือกหรือสายรัด ป้ายจริง พื้นรองเท้า และงานเย็บ/);
  assert.doesNotMatch(footwearPrompt, /lower-leg|shaft height|bare legs/i);
  assert.match(coatPrompt, /\[SPECIFIC_ANGLE\] = ซูมรายละเอียดด้านใน \(Interior View\)/);
  assert.match(coatPrompt, /ตัวอักษรบนป้ายแคร์ลาเบล \(Care Label\) และความสะอาดของเนื้อผ้าซับในด้านใน/);
  assert.match(coatPrompt, /ภาพต้องเป็นภาพเดียว ไม่ใช่ collage/);
  assert.match(coatPrompt, /product-only หรือ detail crop/);
  assert.match(coatPrompt, /ไม่ต้องยกฉาก lifestyle ของ Hero มาใหม่/);
  assert.doesNotMatch(coatPrompt, /Lining and warmth evidence/i);
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

test("visual variation planner keeps hero canonical lean across adjacent SKUs", () => {
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

  assert.deepEqual(variations.map((variation) => variation.variation_group), ["lean_hero", "lean_hero", "lean_hero", "lean_hero"]);
  assert.equal(new Set(variations.map((variation) => variation.composition)).size, 1);
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

test("hero visual variation skips A/B/C/D canonical rotation", () => {
  const variation = resolveVisualVariationV3({
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face White Cream Puffer Jacket",
    category: "เสื้อ"
  }, {
    slotType: "hero",
    itemIndex: 2,
    sequence: 1
  });

  assert.equal(variation.variation_group, "lean_hero");
  assert.equal(variation.composition, "natural_product_review_hero");
  assert.doesNotMatch(variation.variation_group, /^[ABCD]$/);
});

test("support shots differ by category and brand priorities", () => {
  const coatShots = getSupportShotsV3({ category: "เสื้อ", target_site: "rentacoat", product_type: "rental" });
  assert.deepEqual(coatShots, ["side_fit_on_model", "back_fit_on_model", "material_or_lining_closeup"]);
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

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
