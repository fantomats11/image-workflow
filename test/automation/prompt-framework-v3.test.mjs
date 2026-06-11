import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildSupportPromptV3,
  getSupportShotsV3
} from "../../lib/automation/prompt-framework-v3.mjs";

test("exports a v3 version", () => {
  assert.match(PROMPT_FRAMEWORK_V3_VERSION, /v3/);
});

test("Rent A Coat hero includes rental trust and clean trip readiness", () => {
  const prompt = buildHeroPromptV3({
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ",
    reference_confidence: "high"
  });
  assert.match(prompt, /rental trust/i);
  assert.match(prompt, /trip readiness/i);
  assert.match(prompt, /natural skin texture/i);
});

test("GO Mall hero includes grid-readable product clarity", () => {
  const prompt = buildHeroPromptV3({
    sku: "GM-SWEATER-001",
    product_type: "sale",
    target_site: "gomall",
    product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    category: "เสื้อ",
    reference_confidence: "high"
  });
  assert.match(prompt, /grid-readable/i);
  assert.match(prompt, /purchase clarity/i);
});

test("support shots differ by category and brand priorities", () => {
  const coatShots = getSupportShotsV3({ category: "เสื้อ", target_site: "rentacoat", product_type: "rental" });
  assert.deepEqual(coatShots.slice(0, 3), ["front_fit_shape", "side_thickness_length", "back_hood_closure"]);
  const hatShots = getSupportShotsV3({ category: "หมวกกันหนาว", target_site: "gomall", product_type: "sale" });
  assert.equal(hatShots.includes("wearing_scale_cue"), true);
});

test("support prompt forbids generated candidates overriding real product references", () => {
  const prompt = buildSupportPromptV3({
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ"
  }, "texture_closeup", 4, 5);
  assert.match(prompt, /generated candidate/i);
  assert.match(prompt, /real product reference/i);
});
