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

test("exports a v3 version", () => {
  assert.match(PROMPT_FRAMEWORK_V3_VERSION, /v3/);
});

test("Rent A Coat hero compiles to a natural provider brief for rental trust", () => {
  const prompt = buildHeroPromptV3({
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ",
    reference_confidence: "high"
  });
  assert.match(prompt, /clean photorealistic ecommerce product photo/i);
  assert.match(prompt, /Use case:/i);
  assert.match(prompt, /Reference priority:/i);
  assert.match(prompt, /Product truth lock:/i);
  assert.match(prompt, /source of truth/i);
  assert.match(prompt, /ready for a winter trip/i);
  assert.match(prompt, /Thai\/East Asian everyday model/i);
  assert.match(prompt, /Southeast Asian everyday model/i);
  assert.match(prompt, /natural fabric fall/i);
  assert.match(prompt, /fit, size, warmth, scale, and wearability/i);
  assert.match(prompt, /unnaturally pale flat skin/i);
  assert.doesNotMatch(prompt, /porcelain skin/i);
  assert.match(prompt, /Do not add poster layout/i);
  assert.match(prompt, /price text/i);
  assert.match(prompt, /Only preserve real product labels/i);
  assert.match(prompt, /Brand mark fidelity/i);
  assert.match(prompt, /Do not copy barcode cards, SKU cards, hang tags/i);
  assert.doesNotMatch(prompt, /Prompt Framework/i);
  assert.doesNotMatch(prompt, /Model fit companion policy/i);
  assert.doesNotMatch(prompt, /Visual variation plan/i);
  assert.doesNotMatch(prompt, /Brand image job/i);
});

test("GO Mall hero compiles to product clarity without store-channel labels", () => {
  const prompt = buildHeroPromptV3({
    sku: "GM-SWEATER-001",
    product_type: "sale",
    target_site: "gomall",
    product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    category: "เสื้อ",
    reference_confidence: "high"
  });
  assert.match(prompt, /dominant subject/i);
  assert.match(prompt, /easy to inspect in a product grid/i);
  assert.match(prompt, /faithful color, fabric, construction, and styling/i);
  assert.match(prompt, /ordinary catalog photograph/i);
  assert.match(prompt, /not look like a fashion campaign celebrity/i);
  assert.match(prompt, /natural Thai\/Southeast Asian skin tone/i);
  assert.match(prompt, /subtle pores/i);
  assert.doesNotMatch(prompt, /GO Mall/i);
  assert.doesNotMatch(prompt, /Rent A Coat/i);
  assert.doesNotMatch(prompt, /purchase clarity/i);
  assert.doesNotMatch(prompt, /Model fit companion policy/i);
});

test("GO Mall prompt context uses branch logic without exposing legacy product type", () => {
  const prompt = buildHeroPromptV3({
    sku: "2CT1600000",
    product_type: "rental",
    target_site: "rentacoat",
    reference_brand_id: "go_mall",
    product_name: "Trench Coat Fashion",
    category: "เสื้อ",
    reference_confidence: "medium"
  });

  assert.match(prompt, /dominant subject/i);
  assert.match(prompt, /easy to inspect in a product grid/i);
  assert.doesNotMatch(prompt, /Brand: GO Mall/);
  assert.doesNotMatch(prompt, /GO Mall/);
  assert.doesNotMatch(prompt, /Product type: sale/);
  assert.doesNotMatch(prompt, /Product type: rental/);
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

test("support prompt keeps real product references as source of truth", () => {
  const prompt = buildSupportPromptV3({
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ"
  }, "texture_closeup", 4, 5);
  assert.match(prompt, /support photo \(4 of 5\)/i);
  assert.match(prompt, /Use the reference images as the source of truth/i);
  assert.match(prompt, /Do not redraw the product brand branding from memory/i);
  assert.match(prompt, /do not invent readable logo text/i);
  assert.match(prompt, /Close-up of real material/i);
  assert.match(prompt, /Show a product-only detail crop/i);
  assert.match(prompt, /Change only the angle, crop, pose, or detail emphasis/i);
  assert.match(prompt, /Do not add poster layout/i);
  assert.match(prompt, /If a generated candidate, styling idea, or model choice conflicts with the real product references/i);
  assert.doesNotMatch(prompt, /Visual variation plan/i);
  assert.doesNotMatch(prompt, /Model fit companion policy/i);
});

test("support prompt with a model keeps Thai/East Asian naturalism requirements", () => {
  const prompt = buildSupportPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face white down jacket",
    category: "เสื้อ"
  }, "front_fit_shape", 1, 5);

  assert.match(prompt, /Thai\/East Asian everyday model/i);
  assert.match(prompt, /Southeast Asian everyday model/i);
  assert.match(prompt, /natural, fully clothed/i);
  assert.match(prompt, /not look like a fashion campaign celebrity/i);
  assert.match(prompt, /avoid plastic-perfect retouching/i);
  assert.match(prompt, /unnaturally pale flat skin/i);
  assert.doesNotMatch(prompt, /porcelain skin/i);
});

test("support prompt uses approved hero as model and styling anchor when available", () => {
  const prompt = buildSupportPromptV3({
    sku: "2CT1600000",
    product_type: "sale",
    target_site: "gomall",
    product_name: "Discovery Expedition trench coat",
    category: "เสื้อ",
    approved_hero_anchor: {
      local_path: "/tmp/2CT1600000/hero.png",
      url: "https://cdn.example.com/hero.png"
    }
  }, "front_fit_shape", 1, 2);

  assert.match(prompt, /approved hero image as the model, styling, fit, lighting, and realism anchor/i);
  assert.match(prompt, /first attached generated image is the approved hero/i);
  assert.match(prompt, /Do not redraw Discovery Expedition branding from memory/i);
  assert.match(prompt, /real product references conflict, follow the real product references/i);
  assert.match(prompt, /Use the reference images as the source of truth/i);
});

test("support prompt includes Thai review direction for product-page realism", () => {
  const prompt = buildSupportPromptV3({
    sku: "2DJ0493000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face white down jacket",
    category: "เสื้อ"
  }, "front_fit_shape", 1, 6);

  assert.match(prompt, /Thai review output direction:/i);
  assert.match(prompt, /อ้างอิงภาพต้นฉบับ/);
  assert.match(prompt, /หน้าสินค้าบนเว็บไซต์/);
  assert.match(prompt, /ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ/);
  assert.match(prompt, /ธุรกิจเช่าและจำหน่ายชุดกันหนาว/);
  assert.match(prompt, /ไม่ต้องใส่ข้อความ/);
  assert.match(prompt, /ไม่ต้องแบ่งกริด/);
  assert.match(prompt, /ไม่ต้องแบ่งช่อง/);
  assert.match(prompt, /ไม่ต้องสร้างป้ายแบรนด์ใหม่/);
  assert.match(prompt, /สินค้าชิ้นใหญ่/);
  assert.match(prompt, /ไม่จำเป็นต้องบังคับ close-up ทุกภาพ/);
});

test("small accessory support prompts force close-up product focus", () => {
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
  assert.match(glovePrompt, /close-up หรือ tight product-focused crop/);
  assert.match(glovePrompt, /crop แน่นขึ้นบน texture/);
  assert.match(scarfPrompt, /สำหรับผ้าพันคอหรืออุปกรณ์คลุมคอ/);
  assert.match(scarfPrompt, /คอถึงอก/);
  assert.match(sockPrompt, /สำหรับถุงเท้า/);
  assert.match(sockPrompt, /น่องถึงเท้า/);
  assert.match(sockPrompt, /อย่าให้กางเกง รองเท้า หรือฉากหลังแย่งความเด่น/);
  assert.match(sockPrompt, /Show both socks clearly/);
  assert.doesNotMatch(sockPrompt, /Show both shoes\/boots clearly/);
});

test("support prompt includes preserved footwear use-case crop guidance", () => {
  const prompt = buildSupportPromptV3({
    sku: "2BT0158000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
    category: "รองเท้า"
  }, "side_profile", 2, 6);

  assert.match(prompt, /Use-case guidance:/i);
  assert.match(prompt, /lower-leg or product side profile/i);
  assert.match(prompt, /shaft height/i);
  assert.match(prompt, /boot opening/i);
  assert.match(prompt, /winter pant hem or cuff meets the boot/i);
  assert.match(prompt, /bare legs/i);
  assert.match(prompt, /bulky slouch socks/i);
});

test("support prompt includes long coat and upper jacket crop differences", () => {
  const longCoatPrompt = buildSupportPromptV3({
    sku: "GM-LONG-001",
    product_type: "sale",
    target_site: "gomall",
    product_name: "Canada Goose Expedition Parka",
    category: "เสื้อ",
    subcategory: "พาร์กา"
  }, "front_fit_shape", 1, 6);
  const upperJacketPrompt = buildSupportPromptV3({
    sku: "RAC-JACKET-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "The North Face fleece jacket",
    category: "เสื้อ",
    subcategory: "แจ็คเก็ต"
  }, "side_thickness_length", 2, 6);

  assert.match(longCoatPrompt, /near full-body catalog crop/i);
  assert.match(longCoatPrompt, /full length, hem, closure, sleeves, hood or collar, and silhouette/i);
  assert.match(upperJacketPrompt, /upper-body side or three-quarter crop/i);
  assert.match(upperJacketPrompt, /Exclude shoes and most legs/i);
});

test("support prompt keeps same unisex pair after hero approval when scale cue is requested", () => {
  const prompt = buildSupportPromptV3({
    sku: "RAC-UNISEX-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Unisex winter jacket",
    category: "เสื้อ",
    approved_hero_anchor: { url: "https://cdn.example.com/hero.png" }
  }, "wearing_scale_cue", 5, 6);

  assert.match(prompt, /same two-person unisex casting/i);
  assert.match(prompt, /one man and one woman/i);
  assert.match(prompt, /same approved man-and-woman unisex fit cue/i);
  assert.match(prompt, /no extra people/i);
});

test("hero prompt separates ecommerce product images from ad creative layouts", () => {
  const prompt = buildHeroPromptV3({
    sku: "2BT0158000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Columbia snow boots",
    category: "รองเท้า",
    reference_confidence: "high"
  });

  assert.match(prompt, /photorealistic ecommerce product photo/i);
  assert.match(prompt, /text-free/i);
  assert.match(prompt, /Do not add poster layout/i);
  assert.match(prompt, /price text/i);
  assert.match(prompt, /badges/i);
  assert.match(prompt, /callouts/i);
  assert.match(prompt, /UI elements/i);
  assert.match(prompt, /QR codes/i);
  assert.match(prompt, /Only preserve real product labels/i);
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

test("product identity prefers verified brand field from product master rows", () => {
  const examples = [
    ["MOOSEKNUCKLES", "Fashion winter coat", "Moose Knuckles"],
    ["Moonboot", "ICON NYLON SNOW BOOTS", "Moon Boot"],
    ["Mont Bell", "Women's Windstopper Insulated Shell Parka", "Montbell"],
    ["BLACK YAK", "KIDS winter jacket", "Black Yak"]
  ];

  for (const [brand, productName, expectedBrand] of examples) {
    const identity = buildProductIdentityV3({
      brand,
      product_name: productName,
      category: "เสื้อ"
    });
    assert.equal(identity.productBrand, expectedBrand);
  }
});

test("product identity ignores generic master brand labels", () => {
  const identity = buildProductIdentityV3({
    brand: "Fashion",
    product_name: "snug winter gloves",
    category: "ถุงมือกันหนาว"
  });

  assert.equal(identity.productBrand, "");
});

test("product brand matching avoids short-brand false positives inside normal words", () => {
  const identity = buildProductIdentityV3({
    product_name: "snug winter gloves",
    category: "ถุงมือกันหนาว"
  });

  assert.equal(identity.productBrand, "");
});

test("footwear hero prompt uses actual product brand and provider-safe model wording", () => {
  const prompt = buildHeroPromptV3({
    sku: "2BT0158000",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot",
    category: "รองเท้า",
    reference_confidence: "medium"
  });

  assert.match(prompt, /Product: Columbia Women's Loveland Mid Omni-Heat Snow Boot/i);
  assert.match(prompt, /visible real Columbia logo, label, patch, embroidery, print, or brand mark placement/i);
  assert.match(prompt, /Do not redraw Columbia branding from memory/i);
  assert.match(prompt, /keep it small, soft, partially obscured, or omit it/i);
  assert.match(prompt, /boot height/i);
  assert.match(prompt, /lace path/i);
  assert.match(prompt, /adult wearer/i);
  assert.match(prompt, /fully clothed/i);
  assert.match(prompt, /Winter pants should be tucked neatly inside the boot shaft/i);
  assert.match(prompt, /collar, laces, side panel, toe shape, and sole remain visible/i);
  assert.doesNotMatch(prompt, /Wearer type: female/i);
  assert.doesNotMatch(prompt, /lower_body/i);
  assert.doesNotMatch(prompt, /lower body/i);
  assert.doesNotMatch(prompt, /child products/i);
  assert.doesNotMatch(prompt, /Rent A Coat/i);
});

test("GO Mall apparel hero prompt uses natural catalog naturalism instead of staged AI polish", () => {
  const prompt = buildHeroPromptV3({
    sku: "2CT1600000",
    product_type: "sale",
    target_site: "gomall",
    product_name: "Trench Coat Fashion",
    category: "เสื้อ",
    item_index: 2,
    reference_confidence: "high"
  });

  assert.match(prompt, /Scene:/);
  assert.match(prompt, /Use case:/i);
  assert.match(prompt, /Reference priority:/i);
  assert.match(prompt, /Product truth lock:/i);
  assert.match(prompt, /Subject and fit:/i);
  assert.match(prompt, /Human realism:/i);
  assert.match(prompt, /Constraints:/i);
  assert.match(prompt, /Product: Trench Coat Fashion/i);
  assert.match(prompt, /dominant subject/i);
  assert.match(prompt, /Brand mark fidelity/i);
  assert.match(prompt, /do not invent readable logo text/i);
  assert.match(prompt, /relaxed catalog pose/i);
  assert.match(prompt, /ordinary catalog photograph/i);
  assert.match(prompt, /relaxed posture/i);
  assert.match(prompt, /natural hand placement/i);
  assert.match(prompt, /natural Thai\/Southeast Asian skin tone/i);
  assert.match(prompt, /subtle pores/i);
  assert.match(prompt, /fine facial texture/i);
  assert.match(prompt, /no wax-like AI smoothness/i);
  assert.match(prompt, /believable wrinkles/i);
  assert.match(prompt, /plain warm wall and floor catalog setting/i);
  assert.match(prompt, /no decorative furniture/i);
  assert.doesNotMatch(prompt, /GO Mall naturalism calibration/i);
  assert.doesNotMatch(prompt, /GO Mall/i);
});

test("brand support shot priorities have explicit prompt descriptions", () => {
  const genericFallback = "Product support shot. Keep requested product details clear and consistent.";
  const representativeItems = [
    {
      sku: "RAC-GLOVE-001",
      product_type: "rental",
      target_site: "rentacoat",
      product_name: "ถุงมือกันหนาว",
      category: "ถุงมือกันหนาว"
    },
    {
      sku: "GM-HAT-001",
      product_type: "sale",
      target_site: "gomall",
      product_name: "หมวกไหมพรมกันหนาว",
      category: "หมวกกันหนาว"
    }
  ];

  for (const item of representativeItems) {
    const shotKeys = getSupportShotsV3(item);
    for (const [index, shotKey] of shotKeys.entries()) {
      const prompt = buildSupportPromptV3(item, shotKey, index + 1, shotKeys.length);
      assert.doesNotMatch(prompt, new RegExp(genericFallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }

  const brandPriorityKeys = [
    "lining_warmth",
    "fabric_fur_zip_patch_detail",
    "front_back_side",
    "texture_construction_closeup",
    "style_cue",
    "optional_model_scale"
  ];
  for (const [index, shotKey] of brandPriorityKeys.entries()) {
    const prompt = buildSupportPromptV3(representativeItems[0], shotKey, index + 1, brandPriorityKeys.length);
    assert.doesNotMatch(prompt, new RegExp(genericFallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
