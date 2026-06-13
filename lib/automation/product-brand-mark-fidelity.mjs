export function buildBrandMarkVisualFactClauseV3(productIdentity = {}) {
  const productBrand = normalizeSpaces(productIdentity.productBrand || "");
  if (productBrand) {
    return `visible real ${productBrand} logo, label, patch, embroidery, print, or brand mark placement, shape, size, orientation, material, stitching, contrast, and distance from seams/zippers if clearly visible in the reference`;
  }
  return "visible real logo, label, patch, embroidery, print, or brand mark placement, shape, size, orientation, material, stitching, contrast, and distance from seams/zippers if clearly visible in the reference";
}

export function buildBrandMarkFidelityLinesV3(item = {}, productIdentity = {}) {
  const productBrand = normalizeSpaces(productIdentity.productBrand || "");
  const brandName = productBrand || "the product brand";
  const referenceConfidence = normalizeSpaces(item.reference_confidence || item.referenceConfidence || "medium").toLowerCase();
  const confidenceLine = referenceConfidence === "high"
    ? "Because the reference confidence is high, preserve visible brand marks as real product construction details, not as decorative graphic design."
    : "If the brand mark is small, blurred, partly hidden, or not clearly readable in the references, keep it small, soft, partially obscured, or omit it rather than inventing a sharp readable logo.";

  return [
    `Brand mark fidelity: preserve only ${brandName} logos, labels, patches, embroidery, printed marks, zipper pulls, or woven tags that are physically visible on the product in the real reference images.`,
    "Keep each visible mark in the same product area with the same approximate size, angle, material, stitching/print style, contrast, and relationship to seams, zipper, pocket, hood, cuff, sole, or hem.",
    `Do not redraw ${brandName} branding from memory, do not invent readable logo text, do not replace it with a similar-looking mark, and do not add new brand marks to blank areas.`,
    "Do not copy barcode cards, SKU cards, hang tags, care labels, store signs, watermarks, or reference-sheet text into the final image.",
    confidenceLine
  ];
}

function normalizeSpaces(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}
