const CATEGORY_ALIASES = {
  footwear: ["รองเท้า", "รองเท้า / บูท"],
  upper_outerwear: ["เสื้อ", "เสื้อแจ็คเก็ต / เสื้อท่อนบน"],
  long_outerwear: ["เสื้อโค้ทยาว / พาร์กา"],
  pants: ["กางเกง"],
  gloves: ["ถุงมือ", "ถุงมือกันหนาว"],
  hat: ["หมวก", "หมวกกันหนาว"],
  scarf_accessory: ["ผ้าพันคอ", "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก"],
  socks: ["ถุงเท้า"],
  bag: ["กระเป๋า"]
};

const USE_CASE_SUPPORT_SHOTS = {
  footwear: ["front_pair", "side_profile", "top_view", "sole_view", "wearing_scale_cue", "texture_closeup"],
  long_outerwear: ["front_fit_shape", "side_thickness_length", "back_hood_closure", "hood_detail", "lining_warmth", "texture_closeup"],
  upper_outerwear: ["front_fit_shape", "side_thickness_length", "back_hood_closure", "hood_detail", "lining_warmth", "texture_closeup"],
  pants: ["front_fit_shape", "side_thickness_length", "waistband_pocket", "hem_detail", "lining_warmth", "texture_closeup"],
  gloves: ["pair_front", "palm_side", "cuff_sleeve_fit", "texture_closeup"],
  hat: ["front_view", "side_view", "wearing_scale_cue", "texture_closeup"],
  scarf_accessory: ["front_view", "wearing_scale_cue", "style_cue", "texture_closeup"],
  socks: ["front_pair", "wearing_scale_cue", "texture_closeup"],
  bag: ["front_view", "side_view", "open_interior", "texture_closeup", "scale_cue"]
};

export function resolveProductUseCaseV3(item = {}) {
  const text = normalize([
    item.category,
    item.subcategory,
    item.product_name,
    item.productName,
    item.audience,
    item.gender
  ].filter(Boolean).join(" "));
  const category = normalize(item.category || "");
  const subcategory = normalize(item.subcategory || "");
  const productName = normalize(item.product_name || item.productName || "");

  if (matchesAlias(category, "footwear") || /\b(boot|boots|shoe|shoes|sneaker|sneakers|sorel|timberland|dr\.?\s*martens|ugg)\b|รองเท้า|บูท|ลุยหิมะ/.test(text)) {
    return { group: "footwear", subtype: resolveFootwearSubtype(text) };
  }
  if (matchesAlias(category, "gloves") || /glove|ถุงมือ/.test(text)) {
    return { group: "gloves", subtype: "winter_gloves" };
  }
  if (matchesAlias(category, "hat") || /hat|beanie|cap|หมวก/.test(text)) {
    return { group: "hat", subtype: "winter_hat" };
  }
  if (matchesAlias(category, "scarf_accessory") || /scarf|neck warmer|ผ้าพันคอ|อุปกรณ์/.test(text)) {
    return { group: "scarf_accessory", subtype: "scarf_or_small_accessory" };
  }
  if (matchesAlias(category, "socks") || /sock|ถุงเท้า/.test(text)) {
    return { group: "socks", subtype: "winter_socks" };
  }
  if (matchesAlias(category, "pants") || /pants|trousers|legging|กางเกง/.test(text)) {
    return { group: "pants", subtype: "winter_pants" };
  }
  if (matchesAlias(category, "bag") || /bag|backpack|กระเป๋า/.test(text)) {
    return { group: "bag", subtype: "bag" };
  }

  if (matchesAlias(category, "long_outerwear") || isLongOuterwearText([subcategory, productName].join(" "))) {
    return { group: "long_outerwear", subtype: resolveOuterwearSubtype(text) };
  }
  if (matchesAlias(category, "upper_outerwear") || /jacket|coat|parka|down|puffer|trench|hoodie|fleece|sweater|cardigan|vest|เสื้อ|แจ็คเก็ต|โค้ท|พาร์กา|เทรนช์|ไหมพรม/.test(text)) {
    const group = isLongOuterwearText([subcategory, productName].join(" ")) ? "long_outerwear" : "upper_outerwear";
    return { group, subtype: resolveOuterwearSubtype(text) };
  }

  return { group: "generic", subtype: "generic" };
}

export function getSupportUseCaseShotsV3(item = {}) {
  const useCase = resolveProductUseCaseV3(item);
  const shots = USE_CASE_SUPPORT_SHOTS[useCase.group] || [];
  return shots.filter((shotKey) => shouldKeepShotForItem(shotKey, item, useCase));
}

export function describeUseCaseSupportShotV3(item = {}, shotKey = "") {
  const { group } = resolveProductUseCaseV3(item);
  const text = SUPPORT_SHOT_DETAILS[group]?.[shotKey] || SUPPORT_SHOT_DETAILS.generic?.[shotKey] || "";
  return text ? `Use-case guidance: ${text}` : "";
}

export function buildSupportUseCaseSafetyLinesV3(item = {}, shotKey = "", modelPolicy = {}) {
  const { group } = resolveProductUseCaseV3(item);
  const lines = [];

  if (["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "lining_warmth", "open_interior"].includes(shotKey)) {
    lines.push("For detail or interior shots, crop tightly on real construction evidence only. Do not invent care labels, size tags, hang tags, printed text, hidden badges, or interior branding that is not visible in the references.");
  }
  if (group === "footwear") {
    lines.push("For footwear, keep the lower-body styling practical: winter pants, leggings, ski pants, or a clean opaque layer may frame the product, but bare legs, bulky slouch socks, leg warmers, and vague fuzzy hems should not become the styling focus.");
  }
  if (group === "pants") {
    lines.push("For pants, keep the styling winter-appropriate and modest. Avoid exposed stomach, crop tops, bras, bikini tops, summer styling, or shoes becoming the visual focus.");
  }
  if (group === "gloves") {
    lines.push("For gloves, a winter sleeve or cuff should meet the glove naturally so the arm does not look empty.");
  }
  if (["hat", "scarf_accessory"].includes(group)) {
    lines.push("Preserve any real logo, label, or patch only when it is visible in the reference or approved hero and physically belongs on that exact side of the product.");
  }
  if (modelPolicy.wearer_type === "unisex_pair") {
    lines.push("When people appear for a unisex product, keep the approved two-person pairing logic: one man and one woman, balanced scale, same catalog mood, and no extra people.");
  }

  return lines;
}

export function buildApprovedHeroIdentityLockV3(item = {}, shotKey = "", modelPolicy = {}) {
  const anchor = item.approved_hero_anchor || item.approvedHeroAnchor;
  if (!anchor) return "";
  const isDetailOnly = modelPolicy.presence === "detail_only_no_model" || ["texture_closeup", "fabric_fur_zip_patch_detail", "texture_construction_closeup", "sole_view", "open_interior", "lining_warmth"].includes(shotKey);

  if (modelPolicy.wearer_type === "unisex_pair" && !isDetailOnly) {
    return "The first attached generated image is the approved hero. Use the approved hero image as the model, styling, fit, lighting, and realism anchor. Keep the same two-person unisex casting whenever people are visible: one man and one woman, same age range, body proportion, skin tone impression, hair impression, styling energy, and catalog mood. If the approved hero and real product references conflict, follow the real product references.";
  }
  if (!isDetailOnly && modelPolicy.presence !== "detail_only_no_model") {
    return "The first attached generated image is the approved hero. Use the approved hero image as the model, styling, fit, lighting, and realism anchor whenever a person is visible. Keep the same believable wearer identity, age range, skin tone impression, body proportion, hair impression, styling energy, and catalog mood. If the approved hero and real product references conflict, follow the real product references.";
  }
  return "The first attached generated image is the approved hero. Use the approved hero image as the product presentation, lighting, color, scale, and catalog realism anchor for this support set. This is a product-detail shot, so do not add a new model unless the requested shot explicitly needs minimal wearing context. If the approved hero and real product references conflict, follow the real product references.";
}

function shouldKeepShotForItem(shotKey, item = {}, useCase = resolveProductUseCaseV3(item)) {
  const text = normalize([item.category, item.subcategory, item.product_name, item.productName].filter(Boolean).join(" "));
  if (shotKey === "hood_detail") return /hood|ฮู้ด|ขนเฟอร์|fur|parka|พาร์กา/.test(text);
  if (shotKey === "lining_warmth") return /lining|interior|fleece|fleece-lined|sherpa|fur|down|puffer|padding|ซับ|บุ|ขน|เฟอร์|ฮู้ด|หนา|กันหนาว|parka|พาร์กา/.test(text) || ["long_outerwear", "upper_outerwear", "pants"].includes(useCase.group);
  return true;
}

function resolveFootwearSubtype(text = "") {
  if (/snow|ลุยหิมะ|winter|boot|บูท|sorel|ugg|timberland|dr\.?\s*martens/.test(text)) return "winter_boot";
  if (/sneaker|รองเท้าผ้าใบ/.test(text)) return "sneaker";
  return "footwear";
}

function resolveOuterwearSubtype(text = "") {
  if (/trench|เทรนช์/.test(text)) return "trench_coat";
  if (/parka|พาร์กา/.test(text)) return "parka";
  if (/down|puffer|goose|padding|ขนเป็ด|ขนห่าน/.test(text)) return "down_or_puffer";
  if (/fleece|sherpa|ไหมพรม|sweater|cardigan/.test(text)) return "knit_or_fleece";
  if (/coat|โค้ท/.test(text)) return "coat";
  return "outerwear";
}

function isLongOuterwearText(value = "") {
  const text = normalize(value);
  return /long coat|parka|trench|overcoat|เสื้อโค้ทยาว|โค้ทยาว|พาร์กา|เทรนช์|กันหนาวยาว/.test(text);
}

function matchesAlias(category = "", group = "") {
  return (CATEGORY_ALIASES[group] || []).some((alias) => normalize(alias) === category);
}

function normalize(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

const SUPPORT_SHOT_DETAILS = {
  footwear: {
    front_pair: "Show both boots or shoes clearly from the front. Keep pair shape, toe box, opening, laces or straps, shaft height, collar or lining, and sole readable.",
    side_profile: "Use a lower-leg or product side profile that shows side silhouette, shaft height, boot opening, sole thickness, toe shape, fastening details, and how the winter pant hem or cuff meets the boot.",
    top_view: "Show the top opening, laces or straps, upper material, toe shape, and how the winter bottom layer meets the boot. Keep the opening clean and readable.",
    sole_view: "Product-only outsole evidence. Show tread pattern, thickness, grip, heel shape, and side edge clearly without model legs.",
    wearing_scale_cue: "Use only lower legs from just below the knee to the feet. Boots should fill most of the frame, with winter pants tucked inside the shaft or cropped just above it so the product remains readable.",
    texture_closeup: "Crop tightly on real upper material, quilting, stitching, eyelets, lace path, collar lining, logo band, side panel, outsole edge, or toe construction."
  },
  long_outerwear: {
    front_fit_shape: "Use a near full-body catalog crop, roughly head to ankle or head to mid-calf. The long coat or parka should fill most of the frame and show full length, hem, closure, sleeves, hood or collar, and silhouette.",
    side_thickness_length: "Use a side or three-quarter angle that clarifies garment thickness, warmth, side seam, sleeve profile, body volume, length, and hem. Shoes may appear only as a quiet scale cue.",
    back_hood_closure: "Show the rear construction, hood, back seams, waist or belt shape, rear hem, and silhouette clearly.",
    hood_detail: "Crop from head to knee or head to thigh. Show hood shape, fur trim if present, drawcord, collar relationship, shoulders, sleeves, and upper coat length.",
    lining_warmth: "Open or fold the coat naturally to show real lining, fleece, padding, fur, stitching, or inner warmth construction without inventing tags.",
    texture_closeup: "Tight crop on real shell fabric, padding volume, stitching, zipper or button, belt, cuff, fur trim, label or patch if visible, and clean rental condition."
  },
  upper_outerwear: {
    front_fit_shape: "Use an upper-body catalog crop, roughly head or neck to hip or upper thigh. Keep the jacket large and show shoulders, sleeves, zipper or buttons, collar or hood, hem, and fit.",
    side_thickness_length: "Use an upper-body side or three-quarter crop that shows warmth thickness, sleeve shape, side seam, collar/hood volume, and hem. Exclude shoes and most legs.",
    back_hood_closure: "Show the back construction, hood or collar, rear seams, sleeve shape, and rear hem in an upper-body crop.",
    hood_detail: "Crop from head to upper thigh or head to hip. Show hood, collar, shoulders, chest, sleeves, and jacket hem clearly.",
    lining_warmth: "Open or fold the jacket naturally to show real lining, fleece, padding, inner material, or closure protection without inventing tags.",
    texture_closeup: "Tight crop on real fabric, knit, fleece, fur, zipper, button, seam, patch, trim, cuff, lining, or construction evidence."
  },
  pants: {
    front_fit_shape: "Use a waist-to-feet crop. Pants should fill most of the frame and show waistband, hips, leg shape, length, pockets, and hem.",
    side_thickness_length: "Use a side crop from waist to feet to show thickness, leg shape, seam, pocket depth, hem, and how the pants sit over winter footwear.",
    waistband_pocket: "Tight crop on waistband, button, drawcord, pocket, seam, belt loop, or upper construction.",
    hem_detail: "Tight crop on hem, cuff, leg opening, lower seam, fabric thickness, and interaction with winter shoes.",
    lining_warmth: "Open or turn the fabric only if plausible to show fleece lining, padding, inner texture, or warmth construction.",
    texture_closeup: "Tight crop on fabric texture, weave, fleece, seam, pocket, zipper, label or patch if real and visible."
  },
  gloves: {
    pair_front: "Show the glove pair front-facing with fingers, cuff, shape, seams, and material thickness clear.",
    palm_side: "Show palm-side grip, seam placement, finger construction, lining edge, and cuff clearly. A natural hand or forearm crop is allowed if needed.",
    cuff_sleeve_fit: "Show the gloves worn with a winter sleeve, coat cuff, knit cuff, or fleece sleeve meeting the glove naturally.",
    texture_closeup: "Tight crop on real palm grip, outer fabric, knit, leather, seam, lining, cuff, label or patch if visible."
  },
  hat: {
    front_view: "Use a head-and-shoulders crop with the hat dominant. Include only enough winter collar, scarf, knit, or jacket shoulder detail to make scale natural.",
    side_view: "Show side shape, cuff fold, pom-pom, ear coverage, thickness, knit structure, and fit around the head.",
    wearing_scale_cue: "Use a cheerful Thai/East Asian everyday wearer only to clarify scale and fit. Keep the hat centered and dominant.",
    texture_closeup: "Tight crop on knit texture, pom-pom, folded cuff, real logo, label, patch, lining, or shape."
  },
  scarf_accessory: {
    front_view: "Show only the body area needed to explain how the scarf or small accessory is worn. Use a suitable coat, knit, or jacket collar while keeping the accessory dominant.",
    wearing_scale_cue: "Use a clean head-to-torso or torso crop to show scale, drape, thickness, and practical winter use.",
    style_cue: "Show a simple winter outfit pairing that helps customers understand use, but keep the accessory visually dominant.",
    texture_closeup: "Tight crop on fabric, weave, edge, tassel, label if real and visible, fold, fastening detail, or thickness."
  },
  socks: {
    front_pair: "Show the socks as the main product from lower calf to feet. Do not let pants, slippers, or boots hide the cuff or knit texture.",
    wearing_scale_cue: "Use cropped winter pants, leggings, indoor slippers, or boots only if they frame the socks and keep cuff, thickness, pattern, and texture visible.",
    texture_closeup: "Tight crop on cuff, knit texture, thickness, pattern, label if real and visible, heel, toe, or seam."
  },
  bag: {
    front_view: "Straight front product view with handles, zipper, pockets, shape, and material readable.",
    side_view: "Side view showing depth, straps, hardware, pocket shape, seams, and structure.",
    open_interior: "Open the bag naturally only if plausible to show lining, storage, padding, zipper, and inner construction.",
    texture_closeup: "Tight crop on real material, stitching, zipper, hardware, pocket, logo or patch if visible.",
    scale_cue: "Use minimal human or neutral scale context only to clarify size without distracting props."
  },
  generic: {
    front_back_side: "Show grid-readable front, back, and side clarity for sellable shape and key construction without clutter.",
    texture_construction_closeup: "Show faithful material, seam, hardware, lining, outsole, knit, or construction details that help the customer decide.",
    style_cue: "Use a clean practical styling cue while keeping the product dominant and truthful.",
    optional_model_scale: "Use only enough body context to explain size, fit, and proportion in a clean ecommerce frame."
  }
};
