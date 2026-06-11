export const PROMPT_FRAMEWORK_VERSION = "prompt-framework-v2.0-dry-run";

const SUPPORT_SHOTS_BY_CATEGORY = {
  "เสื้อ": ["front_view", "back_view", "side_view", "detail_closeup", "inner_lining"],
  "รองเท้า": ["front_pair", "side_profile", "sole_view", "detail_closeup"],
  "กระเป๋า": ["front_view", "side_view", "open_interior", "detail_closeup"],
  "ถุงมือกันหนาว": ["pair_front", "palm_side", "wearing_context", "detail_closeup"],
  "หมวกกันหนาว": ["front_view", "side_view", "wearing_context", "texture_closeup"]
};

export function getSupportShots(item) {
  return SUPPORT_SHOTS_BY_CATEGORY[item.category] || ["front_view", "back_view", "side_view", "detail_closeup"];
}

export function buildHeroPromptV2(item) {
  const productContext = [
    `SKU: ${item.sku}`,
    `Product type: ${item.product_type}`,
    `Product name: ${item.product_name || "unknown"}`,
    `Category: ${item.category || "unknown"}`,
    `Subtype: ${item.subcategory || "unknown"}`
  ].join("\n");

  return [
    "Create one catalog hero product image for ecommerce.",
    productContext,
    "",
    "Reference role rules:",
    "- Treat attached SKU folder images as product_reference only.",
    "- Preserve the exact product identity, silhouette, color, material, visible logo/label/patch, zipper, stitching, trim, texture, and proportions from the product_reference images.",
    "- Ignore unrelated background, hanger, floor, shelf, barcode card, staff hand, room, camera angle, and accidental surrounding objects.",
    "- If multiple references conflict, prioritize the clearest full-product reference and do not invent missing details.",
    "- Do not copy a barcode, SKU card, watermark, store sign, unrelated person, or other product into the generated image.",
    "",
    "Output direction:",
    "- Clean warm-white ecommerce catalog style.",
    "- Product must be large, centered, sharp, readable, and ready for a product page.",
    "- Use realistic lighting and shadow; no dramatic campaign scene.",
    "- No fake brand marks. Preserve real marks only when clearly visible on the product reference.",
    "- Generate only one final image."
  ].join("\n");
}

export function buildSupportPromptV2(item, shotKey, index, total) {
  return [
    `Create support image ${index} of ${total} for the same SKU ${item.sku}.`,
    `Shot key: ${shotKey}`,
    "",
    "Reference role rules:",
    "- Use the approved hero as the primary identity anchor when available.",
    "- Use SKU folder product_reference images only to verify product details.",
    "- Change only the camera angle/crop/detail required by the shot key.",
    "- Keep product identity, color, material, logos/labels/patches, proportions, and construction consistent with the hero/reference.",
    "- Do not introduce new props, extra products, fake labels, fake logos, model identity changes, or unrelated design elements.",
    "",
    "Support shot direction:",
    describeShot(shotKey),
    "",
    "Keep the output ecommerce-ready, sharp, clean, and visually consistent with the hero."
  ].join("\n");
}

function describeShot(shotKey) {
  const descriptions = {
    front_view: "Straight front view. Show the whole product clearly.",
    back_view: "Straight back view. Show back construction and shape clearly.",
    side_view: "Side view. Preserve thickness, seams, pockets, sole, or handle depth as applicable.",
    detail_closeup: "Close-up of the most important real product detail: fabric, lining, fur, zipper, sole, logo patch, texture, or construction.",
    inner_lining: "Open/interior view for lining, padding, fleece, inner construction, or warmth technology only. Do not invent printed labels.",
    front_pair: "Front view of the pair. Show both shoes/boots clearly.",
    side_profile: "Side profile. Show sole thickness, upper material, shape, and fastening details.",
    sole_view: "Sole view. Show tread/sole pattern clearly without changing the shoe identity.",
    open_interior: "Open view showing interior/storage/lining only if physically plausible from the reference.",
    pair_front: "Front view of the glove pair. Show shape and cuff clearly.",
    palm_side: "Palm-side view. Show grip, seams, or construction if present.",
    wearing_context: "Minimal wearing context only when helpful. Keep the product dominant and avoid lifestyle clutter.",
    texture_closeup: "Close-up on knit/material texture and real label/patch only if visible in references."
  };
  return descriptions[shotKey] || "Product support shot. Keep the requested product details clear and consistent.";
}
