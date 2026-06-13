import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrandMarkFidelityLinesV3,
  buildBrandMarkVisualFactClauseV3
} from "../../lib/automation/product-brand-mark-fidelity.mjs";

test("brand mark visual facts preserve visible real product marks without inventing logos", () => {
  const clause = buildBrandMarkVisualFactClauseV3({ productBrand: "The North Face" });

  assert.match(clause, /visible real The North Face logo/i);
  assert.match(clause, /placement, shape, size, orientation/i);
  assert.match(clause, /distance from seams\/zippers/i);
  assert.doesNotMatch(clause, /draw/i);
});

test("brand mark fidelity lines tell the model to preserve marks, not redraw them from memory", () => {
  const lines = buildBrandMarkFidelityLinesV3({
    reference_confidence: "medium"
  }, {
    productBrand: "Columbia"
  }).join(" ");

  assert.match(lines, /preserve only Columbia logos/i);
  assert.match(lines, /physically visible on the product/i);
  assert.match(lines, /same approximate size, angle, material/i);
  assert.match(lines, /Do not redraw Columbia branding from memory/i);
  assert.match(lines, /do not invent readable logo text/i);
  assert.match(lines, /keep it small, soft, partially obscured, or omit it/i);
  assert.match(lines, /Do not copy barcode cards, SKU cards, hang tags/i);
});

test("high-confidence references keep marks as product construction details", () => {
  const lines = buildBrandMarkFidelityLinesV3({
    reference_confidence: "high"
  }, {
    productBrand: "Moncler"
  }).join(" ");

  assert.match(lines, /reference confidence is high/i);
  assert.match(lines, /real product construction details/i);
  assert.match(lines, /not as decorative graphic design/i);
});
