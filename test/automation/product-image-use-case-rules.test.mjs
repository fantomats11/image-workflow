import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApprovedHeroIdentityLockV3,
  buildSupportUseCaseSafetyLinesV3,
  describeUseCaseSupportShotV3,
  getSupportUseCaseShotsV3,
  resolveProductUseCaseV3
} from "../../lib/automation/product-image-use-case-rules.mjs";

test("resolves broad sheet categories into legacy product image use cases", () => {
  assert.deepEqual(resolveProductUseCaseV3({
    category: "เสื้อ",
    subcategory: "เทรนช์โค้ท",
    product_name: "Trench Coat Fashion"
  }), {
    group: "long_outerwear",
    subtype: "trench_coat"
  });

  assert.deepEqual(resolveProductUseCaseV3({
    category: "รองเท้า",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot"
  }), {
    group: "footwear",
    subtype: "winter_boot"
  });

  assert.equal(resolveProductUseCaseV3({
    category: "ถุงมือกันหนาว",
    product_name: "winter gloves"
  }).group, "gloves");
});

test("footwear use case keeps the old boot readability and lower-leg rules", () => {
  const item = {
    category: "รองเท้า",
    product_name: "Columbia Women's Loveland Mid Omni-Heat Snow Boot"
  };

  assert.deepEqual(getSupportUseCaseShotsV3(item).slice(0, 4), ["front_pair", "side_profile", "top_view", "sole_view"]);
  assert.match(describeUseCaseSupportShotV3(item, "side_profile"), /lower-leg/i);
  assert.match(describeUseCaseSupportShotV3(item, "side_profile"), /shaft height/i);
  assert.match(describeUseCaseSupportShotV3(item, "side_profile"), /boot opening/i);
  assert.match(describeUseCaseSupportShotV3(item, "top_view"), /top opening/i);
  assert.match(buildSupportUseCaseSafetyLinesV3(item, "side_profile").join(" "), /bare legs/i);
  assert.match(buildSupportUseCaseSafetyLinesV3(item, "side_profile").join(" "), /bulky slouch socks/i);
});

test("outerwear use cases preserve different crops for long coats and upper jackets", () => {
  const longCoat = {
    category: "เสื้อ",
    subcategory: "พาร์กา",
    product_name: "Canada Goose Expedition Parka"
  };
  const upperJacket = {
    category: "เสื้อ",
    subcategory: "แจ็คเก็ต",
    product_name: "The North Face fleece jacket"
  };

  assert.equal(resolveProductUseCaseV3(longCoat).group, "long_outerwear");
  assert.match(describeUseCaseSupportShotV3(longCoat, "front_fit_shape"), /near full-body catalog crop/i);
  assert.match(describeUseCaseSupportShotV3(longCoat, "front_fit_shape"), /full length/i);
  assert.match(describeUseCaseSupportShotV3(longCoat, "hood_detail"), /head to knee or head to thigh/i);

  assert.equal(resolveProductUseCaseV3(upperJacket).group, "upper_outerwear");
  assert.match(describeUseCaseSupportShotV3(upperJacket, "front_fit_shape"), /upper-body catalog crop/i);
  assert.match(describeUseCaseSupportShotV3(upperJacket, "side_thickness_length"), /Exclude shoes and most legs/i);
});

test("glove, hat, pants, and scarf rules preserve old support crop intent", () => {
  assert.match(describeUseCaseSupportShotV3({ category: "ถุงมือกันหนาว" }, "palm_side"), /palm-side grip/i);
  assert.match(buildSupportUseCaseSafetyLinesV3({ category: "ถุงมือกันหนาว" }, "palm_side").join(" "), /winter sleeve or cuff/i);

  assert.match(describeUseCaseSupportShotV3({ category: "หมวกกันหนาว" }, "front_view"), /head-and-shoulders crop/i);
  assert.match(buildSupportUseCaseSafetyLinesV3({ category: "หมวกกันหนาว" }, "front_view").join(" "), /real logo, label, or patch/i);

  assert.match(describeUseCaseSupportShotV3({ category: "กางเกง" }, "front_fit_shape"), /waist-to-feet crop/i);
  assert.match(buildSupportUseCaseSafetyLinesV3({ category: "กางเกง" }, "front_fit_shape").join(" "), /Avoid exposed stomach/i);

  assert.match(describeUseCaseSupportShotV3({ category: "ผ้าพันคอ" }, "front_view"), /body area needed/i);
});

test("approved hero identity lock keeps the old hero-first support flow", () => {
  const item = {
    approved_hero_anchor: { url: "https://cdn.example.com/hero.png" }
  };

  const singleModel = buildApprovedHeroIdentityLockV3(item, "front_fit_shape", {
    presence: "required",
    wearer_type: "female"
  });
  assert.match(singleModel, /first attached generated image is the approved hero/i);
  assert.match(singleModel, /approved hero image as the model, styling, fit, lighting, and realism anchor/i);
  assert.match(singleModel, /real product references conflict, follow the real product references/i);

  const unisexPair = buildApprovedHeroIdentityLockV3(item, "wearing_scale_cue", {
    presence: "required",
    wearer_type: "unisex_pair"
  });
  assert.match(unisexPair, /same two-person unisex casting/i);
  assert.match(unisexPair, /one man and one woman/i);

  const detailOnly = buildApprovedHeroIdentityLockV3(item, "texture_closeup", {
    presence: "detail_only_no_model",
    wearer_type: "female"
  });
  assert.match(detailOnly, /product-detail shot/i);
  assert.match(detailOnly, /do not add a new model/i);
});
