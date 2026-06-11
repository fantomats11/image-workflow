import { getBrandProfile } from "./brand-profiles-v3.mjs";

export const PROMPT_FRAMEWORK_V3_VERSION = "prompt-framework-v3.0-dry-run";

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
  return Array.from(new Set([...base, ...profile.supportPriorities])).slice(0, 6);
}

export function buildHeroPromptV3(item = {}) {
  const profile = getBrandProfile(item);
  const referenceConfidence = item.reference_confidence || item.referenceConfidence || "medium";
  const productContext = buildProductContext(item, profile, referenceConfidence);

  return [
    "Create one ecommerce hero image using Prompt Framework v3.",
    productContext,
    "",
    "Brand image job:",
    `- ${profile.primaryImageJob}`,
    `- Hero bias: ${profile.heroBias}.`,
    "- Keep the product or model dominant, grid-readable, and readable in a product grid.",
    "- Use controlled variation across SKU: 10-25% difference in crop, pose, lighting, background tint, or context.",
    "",
    "Reference truth rules:",
    "- Real product_reference assets define product identity, silhouette, color, material, visible label/patch, zipper, stitching, trim, texture, and proportions.",
    "- label_or_tag assets may be used only for SKU evidence, never as visual product reference.",
    "- generated_candidate assets are style hints only and must never override real product reference details.",
    "- If reference confidence is low, use studio_safe_fallback and do not invent missing details.",
    "",
    "Realism policy:",
    ...profile.realismPolicy.map((rule) => `- ${rule}.`),
    "- Natural skin texture is preferred over plastic-perfect retouching when a model is present.",
    "- Do not add fake logos, fake labels, fake luxury details, unrelated props, barcode cards, or store signs.",
    "",
    "Output:",
    "- One final image only.",
    "- Ecommerce-ready, sharp, clean, realistic, and brand-appropriate."
  ].join("\n");
}

export function buildSupportPromptV3(item = {}, shotKey, index, total) {
  const profile = getBrandProfile(item);
  return [
    `Create support image ${index} of ${total} for SKU ${item.sku} using Prompt Framework v3.`,
    buildProductContext(item, profile, item.reference_confidence || item.referenceConfidence || "medium"),
    `Shot key: ${shotKey}`,
    "",
    "Support job:",
    describeShotV3(shotKey),
    "",
    "Brand priority:",
    `- ${profile.primaryImageJob}`,
    "- Use support images to handle customer objections: fit, warmth, condition, texture, scale, style, and detail.",
    "",
    "Consistency rules:",
    "- Use the approved hero as a style anchor when available.",
    "- Real product reference remains the source of truth.",
    "- Do not let any generated candidate override real product reference details.",
    "- Change only angle, crop, pose, or detail emphasis required by this shot.",
    "- Keep colors, materials, trims, labels, proportions, and construction consistent.",
    "",
    "Realism rules:",
    "- Keep skin, fabric, light, and shadows natural.",
    "- Avoid plastic-perfect model skin and fake product condition.",
    "- Keep the output ecommerce-ready and product-dominant."
  ].join("\n");
}

function buildProductContext(item, profile, referenceConfidence) {
  return [
    `Brand: ${profile.label}`,
    `SKU: ${item.sku}`,
    `Product type: ${item.product_type || ""}`,
    `Product name: ${item.product_name || "unknown"}`,
    `Category: ${item.category || "unknown"}`,
    `Subtype: ${item.subcategory || "unknown"}`,
    `Reference confidence: ${referenceConfidence}`
  ].join("\n");
}

function describeShotV3(shotKey) {
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
    sole_view: "Sole view. Show tread/sole pattern clearly without changing identity.",
    front_view: "Straight front product view. Keep product large and readable.",
    side_view: "Side product view. Preserve depth, construction, and scale.",
    open_interior: "Open/interior view for lining, storage, padding, or inner construction only if physically plausible.",
    pair_front: "Front view of the glove pair. Show shape, cuff, and construction.",
    palm_side: "Palm-side view. Show grip, seams, or material if present.",
    scale_cue: "Minimal context showing scale relative to a human or simple neutral prop.",
    front_back_side: "Grid-readable front, back, and side clarity. Show the sellable shape, key construction, and browsing-ready product angles without clutter.",
    texture_construction_closeup: "Purchase clarity close-up. Show faithful material, knit, seam, sole, hardware, lining, or construction details that support ownership confidence.",
    style_cue: "Simple style cue. Show how the item pairs with neutral wardrobe context while keeping the product dominant and truthful.",
    optional_model_scale: "Optional model or human scale cue. Use only enough body context to explain size, fit, and proportion in a clean ecommerce frame."
  };
  return descriptions[shotKey] || "Product support shot. Keep requested product details clear and consistent.";
}
