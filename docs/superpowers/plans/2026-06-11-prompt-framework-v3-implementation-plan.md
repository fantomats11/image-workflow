# Prompt Framework v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dry-run Prompt Framework v3 pilot for Rent A Coat and GO Mall with 2 SKU per brand, brand-aware prompts, asset classification, SKU-first reference matching, LINE review cards, and no live image generation or WordPress publishing.

**Architecture:** Add focused automation modules under `lib/automation/` for brand profiles, asset classification, reference matching, pilot selection, and prompt building. Keep the existing queue and LINE webhook behavior, but enrich batch payloads and cards with reference/QC data. The system remains dry-run by default and produces inspectable JSON/CSV manifests before any live generation path is enabled.

**Tech Stack:** Node.js ESM, built-in `node:test`, Supabase service-role backend tables, existing LINE Messaging API helpers, existing CSV helpers.

---

## File Structure

- Create: `lib/automation/brand-profiles-v3.mjs`
  - Owns brand IDs, visual mix, image jobs, realism policy, and brand-specific support priorities.
- Create: `lib/automation/asset-classifier.mjs`
  - Classifies reference assets into `product_reference`, `label_or_tag`, `generated_candidate`, `staff_noise`, or `ambiguous`.
- Create: `lib/automation/reference-matcher.mjs`
  - Matches SKU to reference folders/assets using exact SKU, OCR SKU, catalog data, and confidence thresholds.
- Create: `lib/automation/prompt-framework-v3.mjs`
  - Builds hero/support prompts from brand profile, category, reference confidence, and variation budget.
- Create: `lib/automation/pilot-selector-v3.mjs`
  - Selects exactly 2 SKU per brand for the pilot and attaches brand/category/reference metadata.
- Modify: `lib/automation/line-client.mjs`
  - Add v3 Flex card builders for batch summary, reference match review, and classification warnings.
- Modify: `lib/automation/batch-registry.mjs`
  - Persist v3 manifest metadata into `automation_batches` and `automation_batch_items`.
- Modify: `scripts/automation/create-pilot-batch.mjs`
  - Switch to v3 selector and prompt framework while preserving dry-run output files.
- Modify: `scripts/automation/send-line-dry-run.mjs`
  - Send v3 LINE cards when v3 fields exist.
- Create: `test/automation/*.test.mjs`
  - Unit tests for new modules and integration tests for the v3 pilot JSON payload.
- Modify: `package.json`
  - Add `test` and `test:automation` scripts.
- Modify: `.env.example`
  - Add v3 pilot defaults: `PILOT_SKU_PER_BRAND=2`, `PROMPT_FRAMEWORK_VERSION=v3`, reference matching thresholds.

---

### Task 1: Add Test Harness And Fixtures

**Files:**
- Modify: `package.json`
- Create: `test/automation/fixtures/catalog-rows.mjs`
- Create: `test/automation/fixtures/reference-assets.mjs`
- Create: `test/automation/smoke.test.mjs`

- [ ] **Step 1: Add test scripts**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "start": "node server.mjs",
    "dev": "node server.mjs",
    "worker": "node scripts/automation/worker.mjs",
    "test": "node --test",
    "test:automation": "node --test test/automation/*.test.mjs"
  }
}
```

- [ ] **Step 2: Create catalog fixture**

Create `test/automation/fixtures/catalog-rows.mjs`:

```js
export const catalogAuditRows = [
  {
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    wp_product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    wp_category: "เสื้อ",
    wp_subcategory: "โค้ท",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "RAC-GLOVE-001",
    product_type: "rental",
    target_site: "rentacoat",
    wp_product_name: "ถุงมือกันหนาวบุขน",
    wp_category: "ถุงมือกันหนาว",
    wp_subcategory: "ถุงมือ",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-SWEATER-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    wp_category: "เสื้อ",
    wp_subcategory: "สเวตเตอร์",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-HAT-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "หมวกไหมพรมกันหนาว",
    wp_category: "หมวกกันหนาว",
    wp_subcategory: "หมวก",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-EXIST-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "สินค้าที่มีอยู่แล้ว",
    wp_category: "เสื้อ",
    wp_subcategory: "แจ็กเก็ต",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "found",
    woo_product_ids: "123"
  }
];

export const generationRows = [
  {
    sku: "RAC-COAT-001",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ",
    subcategory: "โค้ท",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-rac",
    reference_lookup_key: "RAC-COAT-001"
  },
  {
    sku: "RAC-GLOVE-001",
    product_name: "ถุงมือกันหนาวบุขน",
    category: "ถุงมือกันหนาว",
    subcategory: "ถุงมือ",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-rac",
    reference_lookup_key: "RAC-GLOVE-001"
  },
  {
    sku: "GM-SWEATER-001",
    product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    category: "เสื้อ",
    subcategory: "สเวตเตอร์",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-gomall",
    reference_lookup_key: "GM-SWEATER-001"
  },
  {
    sku: "GM-HAT-001",
    product_name: "หมวกไหมพรมกันหนาว",
    category: "หมวกกันหนาว",
    subcategory: "หมวก",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-gomall",
    reference_lookup_key: "GM-HAT-001"
  }
];
```

- [ ] **Step 3: Create reference asset fixture**

Create `test/automation/fixtures/reference-assets.mjs`:

```js
export const referenceAssets = [
  {
    id: "asset-product-front",
    path: "Rent-A-Coat/RAC-COAT-001/front.jpg",
    name: "RAC-COAT-001_front.jpg",
    mimeType: "image/jpeg",
    ocrText: "",
    width: 1600,
    height: 2000
  },
  {
    id: "asset-label",
    path: "Rent-A-Coat/RAC-COAT-001/label.jpg",
    name: "scan_label.jpg",
    mimeType: "image/jpeg",
    ocrText: "SKU RAC-COAT-001 ราคา 590",
    width: 1200,
    height: 800
  },
  {
    id: "asset-generated",
    path: "Rent-A-Coat/RAC-COAT-001/generated/hero-output.png",
    name: "hero-output-generated.png",
    mimeType: "image/png",
    ocrText: "",
    width: 1024,
    height: 1024
  },
  {
    id: "asset-noise",
    path: "Rent-A-Coat/RAC-COAT-001/floor_blur.jpg",
    name: "floor_blur.jpg",
    mimeType: "image/jpeg",
    ocrText: "",
    width: 480,
    height: 360
  }
];
```

- [ ] **Step 4: Create smoke test**

Create `test/automation/smoke.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("automation test harness is active", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 5: Run smoke test**

Run:

```bash
npm run test:automation
```

Expected:

```text
# pass 1
# fail 0
```

- [ ] **Step 6: Commit**

```bash
git add package.json test/automation
git commit -m "Add automation test harness"
```

---

### Task 2: Add Brand Profiles

**Files:**
- Create: `lib/automation/brand-profiles-v3.mjs`
- Create: `test/automation/brand-profiles-v3.test.mjs`

- [ ] **Step 1: Write brand profile tests**

Create `test/automation/brand-profiles-v3.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_IDS,
  getBrandProfile,
  inferBrandIdFromItem
} from "../../lib/automation/brand-profiles-v3.mjs";

test("infers Rent A Coat from rental product type and site", () => {
  assert.equal(inferBrandIdFromItem({ product_type: "rental", target_site: "rentacoat" }), BRAND_IDS.RENT_A_COAT);
});

test("infers GO Mall from sale product type and site", () => {
  assert.equal(inferBrandIdFromItem({ product_type: "sale", target_site: "gomall" }), BRAND_IDS.GO_MALL);
});

test("Rent A Coat profile emphasizes rental trust", () => {
  const profile = getBrandProfile(BRAND_IDS.RENT_A_COAT);
  assert.equal(profile.brandId, "rent_a_coat");
  assert.equal(profile.primaryImageJob.includes("rent"), true);
  assert.equal(profile.visualMix.soft_lifestyle_context, 45);
});

test("GO Mall profile emphasizes grid clarity", () => {
  const profile = getBrandProfile(BRAND_IDS.GO_MALL);
  assert.equal(profile.brandId, "go_mall");
  assert.equal(profile.visualMix.studio_controlled_variation, 65);
  assert.equal(profile.heroBias, "product_dominant");
});
```

- [ ] **Step 2: Run tests to verify missing module fails**

Run:

```bash
npm run test:automation
```

Expected: fail with module not found for `brand-profiles-v3.mjs`.

- [ ] **Step 3: Implement brand profiles**

Create `lib/automation/brand-profiles-v3.mjs`:

```js
export const BRAND_IDS = {
  RENT_A_COAT: "rent_a_coat",
  GO_MALL: "go_mall"
};

export const BRAND_PROFILES = {
  [BRAND_IDS.RENT_A_COAT]: {
    brandId: BRAND_IDS.RENT_A_COAT,
    label: "Rent A Coat",
    targetSite: "rentacoat",
    productType: "rental",
    primaryImageJob: "Build rental trust: fit confidence, warmth, clean condition, and trip readiness.",
    heroBias: "model_or_product_dominant",
    visualMix: {
      studio_controlled_variation: 45,
      soft_lifestyle_context: 45,
      editorial_realism_texture: 10
    },
    supportPriorities: [
      "front_fit_shape",
      "side_thickness_length",
      "back_hood_closure",
      "lining_warmth",
      "fabric_fur_zip_patch_detail",
      "wearing_scale_cue"
    ],
    realismPolicy: [
      "natural skin texture",
      "subtle pores and undertones",
      "clean but not plastic-perfect rental condition",
      "no fake luxury details"
    ]
  },
  [BRAND_IDS.GO_MALL]: {
    brandId: BRAND_IDS.GO_MALL,
    label: "GO Mall",
    targetSite: "gomall",
    productType: "sale",
    primaryImageJob: "Build purchase clarity: fast browsing, style appeal, value, and ownership confidence.",
    heroBias: "product_dominant",
    visualMix: {
      studio_controlled_variation: 65,
      soft_lifestyle_context: 25,
      editorial_realism_texture: 10
    },
    supportPriorities: [
      "front_back_side",
      "texture_construction_closeup",
      "style_cue",
      "optional_model_scale"
    ],
    realismPolicy: [
      "faithful color and material",
      "new and worth buying",
      "no invented premium labels",
      "no over-styling beyond product truth"
    ]
  }
};

export function inferBrandIdFromItem(item = {}) {
  const site = String(item.target_site || item.site || "").toLowerCase();
  const type = String(item.product_type || "").toLowerCase();
  if (site.includes("rentacoat") || type === "rental") return BRAND_IDS.RENT_A_COAT;
  if (site.includes("gomall") || type === "sale") return BRAND_IDS.GO_MALL;
  return "";
}

export function getBrandProfile(brandIdOrItem) {
  const brandId = typeof brandIdOrItem === "string" ? brandIdOrItem : inferBrandIdFromItem(brandIdOrItem);
  const profile = BRAND_PROFILES[brandId];
  if (!profile) throw new Error(`Unsupported brand for Prompt Framework v3: ${brandId || "unknown"}`);
  return profile;
}
```

- [ ] **Step 4: Run brand tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/brand-profiles-v3.mjs test/automation/brand-profiles-v3.test.mjs
git commit -m "Add prompt framework v3 brand profiles"
```

---

### Task 3: Add Asset Classifier

**Files:**
- Create: `lib/automation/asset-classifier.mjs`
- Create: `test/automation/asset-classifier.test.mjs`

- [ ] **Step 1: Write asset classifier tests**

Create `test/automation/asset-classifier.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyReferenceAsset, classifyReferenceAssets } from "../../lib/automation/asset-classifier.mjs";
import { referenceAssets } from "./fixtures/reference-assets.mjs";

test("classifies product references from SKU filename and normal photo dimensions", () => {
  const result = classifyReferenceAsset(referenceAssets[0], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "product_reference");
  assert.equal(result.use_as_reference, true);
  assert.equal(result.sku_detected, "RAC-COAT-001");
});

test("classifies label/tag images from OCR evidence", () => {
  const result = classifyReferenceAsset(referenceAssets[1], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "label_or_tag");
  assert.equal(result.use_as_reference, false);
  assert.equal(result.sku_detected, "RAC-COAT-001");
});

test("classifies generated candidates from path/name hints", () => {
  const result = classifyReferenceAsset(referenceAssets[2], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "generated_candidate");
  assert.equal(result.use_as_reference, false);
});

test("classifies likely staff noise from blur/floor hints and small dimensions", () => {
  const result = classifyReferenceAsset(referenceAssets[3], { sku: "RAC-COAT-001" });
  assert.equal(result.asset_type, "staff_noise");
  assert.equal(result.use_as_reference, false);
});

test("summarizes asset counts for a folder", () => {
  const result = classifyReferenceAssets(referenceAssets, { sku: "RAC-COAT-001" });
  assert.equal(result.summary.product_reference, 1);
  assert.equal(result.summary.label_or_tag, 1);
  assert.equal(result.summary.generated_candidate, 1);
  assert.equal(result.summary.staff_noise, 1);
});
```

- [ ] **Step 2: Run tests to verify missing module fails**

Run:

```bash
npm run test:automation
```

Expected: fail with module not found for `asset-classifier.mjs`.

- [ ] **Step 3: Implement deterministic classifier**

Create `lib/automation/asset-classifier.mjs`:

```js
const GENERATED_HINT = /\b(generated|output|hero|support|edited|ai|render)\b/i;
const LABEL_HINT = /\b(label|tag|barcode|sku|scan|ป้าย|บาร์โค้ด)\b/i;
const NOISE_HINT = /\b(floor|blur|hand|shelf|bag|noise|พื้น|มือ|ถุง|เบลอ)\b/i;

export function classifyReferenceAsset(asset = {}, { sku = "" } = {}) {
  const text = [asset.path, asset.name, asset.ocrText].filter(Boolean).join(" ");
  const detectedSku = detectSku(text, sku);
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const lowResolution = Boolean(width && height && (width < 600 || height < 600));

  if (GENERATED_HINT.test(text)) {
    return buildClassification(asset, "generated_candidate", detectedSku, 0.9, false, "Generated/output filename or path hint.");
  }

  if (LABEL_HINT.test(text) || looksLikeSkuLabelOnly(asset.ocrText || "")) {
    return buildClassification(asset, "label_or_tag", detectedSku, detectedSku ? 0.95 : 0.8, false, "Label, tag, barcode, or SKU scan evidence.");
  }

  if (NOISE_HINT.test(text) || lowResolution) {
    return buildClassification(asset, "staff_noise", detectedSku, 0.85, false, "Likely staff noise, blurry/small image, or unrelated environment.");
  }

  if (detectedSku || isLikelyPhoto(asset)) {
    return buildClassification(asset, "product_reference", detectedSku, detectedSku ? 0.9 : 0.75, true, "Likely real product photo suitable for product truth.");
  }

  return buildClassification(asset, "ambiguous", detectedSku, 0.5, false, "Insufficient evidence for automatic reference use.");
}

export function classifyReferenceAssets(assets = [], context = {}) {
  const assetsWithClassification = assets.map((asset) => ({
    ...asset,
    classification: classifyReferenceAsset(asset, context)
  }));
  const summary = assetsWithClassification.reduce((counts, asset) => {
    const type = asset.classification.asset_type;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {
    product_reference: 0,
    label_or_tag: 0,
    generated_candidate: 0,
    staff_noise: 0,
    ambiguous: 0
  });
  return { assets: assetsWithClassification, summary };
}

export function detectSku(text = "", expectedSku = "") {
  const normalizedText = String(text || "");
  if (expectedSku && normalizedText.toLowerCase().includes(String(expectedSku).toLowerCase())) return expectedSku;
  const match = normalizedText.match(/\b[A-Z]{1,4}[0-9]{2}[A-Z0-9-]{3,}\b/i);
  return match ? match[0].toUpperCase() : "";
}

function looksLikeSkuLabelOnly(ocrText = "") {
  const normalized = String(ocrText || "").toLowerCase();
  return Boolean(normalized.match(/\bsku\b|barcode|ราคา|size|ไซซ์|รหัส/));
}

function isLikelyPhoto(asset = {}) {
  const mimeType = String(asset.mimeType || "").toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  return mimeType.startsWith("image/") && (!width || width >= 600) && (!height || height >= 600);
}

function buildClassification(asset, assetType, skuDetected, confidence, useAsReference, reason) {
  return {
    asset_id: asset.id || "",
    asset_type: assetType,
    sku_detected: skuDetected || "",
    confidence,
    use_as_reference: useAsReference,
    reason,
    needs_review: assetType === "ambiguous" || confidence < 0.7
  };
}
```

- [ ] **Step 4: Run asset classifier tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/asset-classifier.mjs test/automation/asset-classifier.test.mjs
git commit -m "Add reference asset classifier"
```

---

### Task 4: Add Reference Matcher

**Files:**
- Create: `lib/automation/reference-matcher.mjs`
- Create: `test/automation/reference-matcher.test.mjs`

- [ ] **Step 1: Write reference matcher tests**

Create `test/automation/reference-matcher.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyReferenceAssets } from "../../lib/automation/asset-classifier.mjs";
import { matchReferenceFolderToSku } from "../../lib/automation/reference-matcher.mjs";
import { referenceAssets } from "./fixtures/reference-assets.mjs";

test("exact SKU in path creates high-confidence auto match", () => {
  const classified = classifyReferenceAssets(referenceAssets, { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-1",
    folderPath: "Rent-A-Coat/RAC-COAT-001",
    classifiedAssets: classified.assets
  });
  assert.equal(match.match_method, "exact_sku_path_or_filename");
  assert.equal(match.confidence >= 0.9, true);
  assert.equal(match.needs_review, false);
  assert.equal(match.asset_manifest.length, 4);
});

test("label OCR evidence can support a proposed match", () => {
  const classified = classifyReferenceAssets([referenceAssets[1]], { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-2",
    folderPath: "unmapped-folder",
    classifiedAssets: classified.assets
  });
  assert.equal(match.match_method, "ocr_sku_label");
  assert.equal(match.confidence >= 0.8, true);
  assert.equal(match.needs_review, true);
});

test("weak evidence requires review", () => {
  const classified = classifyReferenceAssets([{ id: "x", name: "image.jpg", path: "unknown/image.jpg", mimeType: "image/jpeg" }], { sku: "RAC-COAT-001" });
  const match = matchReferenceFolderToSku({
    sku: "RAC-COAT-001",
    productName: "เสื้อโค้ทกันหนาวขนเฟอร์",
    folderId: "folder-3",
    folderPath: "unknown",
    classifiedAssets: classified.assets
  });
  assert.equal(match.needs_review, true);
  assert.equal(match.confidence < 0.7, true);
});
```

- [ ] **Step 2: Run tests to verify missing module fails**

Run:

```bash
npm run test:automation
```

Expected: fail with module not found for `reference-matcher.mjs`.

- [ ] **Step 3: Implement matcher**

Create `lib/automation/reference-matcher.mjs`:

```js
export const MATCH_THRESHOLDS = {
  auto: 0.9,
  review: 0.7
};

export function matchReferenceFolderToSku({
  sku,
  productName = "",
  folderId = "",
  folderPath = "",
  classifiedAssets = []
} = {}) {
  const normalizedSku = String(sku || "").trim();
  const evidenceText = [
    folderPath,
    ...classifiedAssets.map((asset) => [asset.path, asset.name, asset.classification?.sku_detected].filter(Boolean).join(" "))
  ].join(" ").toLowerCase();

  let matchMethod = "weak_folder_grouping";
  let confidence = 0.5;

  if (normalizedSku && evidenceText.includes(normalizedSku.toLowerCase())) {
    matchMethod = "exact_sku_path_or_filename";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.95 : 0.9;
  } else if (classifiedAssets.some((asset) => asset.classification?.asset_type === "label_or_tag" && asset.classification?.sku_detected === normalizedSku)) {
    matchMethod = "ocr_sku_label";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.88 : 0.82;
  } else if (productName && evidenceText.includes(String(productName).toLowerCase())) {
    matchMethod = "product_name_path";
    confidence = hasUsableProductReference(classifiedAssets) ? 0.76 : 0.65;
  }

  const needsReview = confidence < MATCH_THRESHOLDS.auto;
  return {
    brand: "",
    sku: normalizedSku,
    source_folder_id: folderId,
    source_path: folderPath,
    file_ids: classifiedAssets.map((asset) => asset.id || "").filter(Boolean),
    match_method: matchMethod,
    confidence,
    needs_review: needsReview,
    approved_by: "",
    approved_at: "",
    asset_manifest: classifiedAssets.map((asset) => asset.classification)
  };
}

function hasUsableProductReference(classifiedAssets = []) {
  return classifiedAssets.some((asset) => asset.classification?.asset_type === "product_reference" && asset.classification?.use_as_reference === true);
}
```

- [ ] **Step 4: Run matcher tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/reference-matcher.mjs test/automation/reference-matcher.test.mjs
git commit -m "Add SKU-first reference matcher"
```

---

### Task 5: Add Prompt Framework v3

**Files:**
- Create: `lib/automation/prompt-framework-v3.mjs`
- Create: `test/automation/prompt-framework-v3.test.mjs`

- [ ] **Step 1: Write v3 prompt tests**

Create `test/automation/prompt-framework-v3.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify missing module fails**

Run:

```bash
npm run test:automation
```

Expected: fail with module not found for `prompt-framework-v3.mjs`.

- [ ] **Step 3: Implement v3 prompt framework**

Create `lib/automation/prompt-framework-v3.mjs`:

```js
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
    "- Keep the product or model dominant and readable in a product grid.",
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
    buildProductContext(item, profile, item.reference_confidence || "medium"),
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
    front_pair: "Front view of the pair. Show both shoes/boots clearly.",
    side_profile: "Side profile. Show sole thickness, upper material, shape, and fastening details.",
    sole_view: "Sole view. Show tread/sole pattern clearly without changing identity.",
    front_view: "Straight front product view. Keep product large and readable.",
    side_view: "Side product view. Preserve depth, construction, and scale.",
    open_interior: "Open/interior view for lining, storage, padding, or inner construction only if physically plausible.",
    pair_front: "Front view of the glove pair. Show shape, cuff, and construction.",
    palm_side: "Palm-side view. Show grip, seams, or material if present.",
    scale_cue: "Minimal context showing scale relative to a human or simple neutral prop."
  };
  return descriptions[shotKey] || "Product support shot. Keep requested product details clear and consistent.";
}
```

- [ ] **Step 4: Run v3 prompt tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/prompt-framework-v3.mjs test/automation/prompt-framework-v3.test.mjs
git commit -m "Add prompt framework v3 builder"
```

---

### Task 6: Add Pilot Selector For 2 SKU Per Brand

**Files:**
- Create: `lib/automation/pilot-selector-v3.mjs`
- Create: `test/automation/pilot-selector-v3.test.mjs`

- [ ] **Step 1: Write selector tests**

Create `test/automation/pilot-selector-v3.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { selectPilotItemsV3 } from "../../lib/automation/pilot-selector-v3.mjs";
import { catalogAuditRows, generationRows } from "./fixtures/catalog-rows.mjs";

test("selects exactly 2 SKU per brand when enough candidates exist", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows,
    generationRows,
    skuPerBrand: 2,
    now: new Date("2026-06-11T00:00:00Z")
  });
  assert.equal(batch.items.length, 4);
  assert.equal(batch.items.filter((item) => item.brand_id === "rent_a_coat").length, 2);
  assert.equal(batch.items.filter((item) => item.brand_id === "go_mall").length, 2);
});

test("attaches v3 prompt fields and dry-run actions", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows,
    generationRows,
    skuPerBrand: 2,
    now: new Date("2026-06-11T00:00:00Z")
  });
  const first = batch.items[0];
  assert.match(first.prompt_framework_version, /v3/);
  assert.equal(first.dry_run_action.includes("dry-run"), true);
  assert.ok(first.hero_prompt);
  assert.ok(first.support_prompt_preview);
});

test("marks existing WooCommerce SKU as skip completed candidate when selected explicitly", () => {
  const batch = selectPilotItemsV3({
    auditRows: catalogAuditRows.filter((row) => row.sku === "GM-EXIST-001"),
    generationRows: [{ sku: "GM-EXIST-001", generation_status: "ready_via_drive_folder_lookup", reference_parent_folder_id: "x", reference_lookup_key: "GM-EXIST-001" }],
    skuPerBrand: 2,
    includeExistingSku: true,
    now: new Date("2026-06-11T00:00:00Z")
  });
  assert.equal(batch.items[0].woo_status, "found");
  assert.match(batch.items[0].dry_run_action, /mark completed/);
});
```

- [ ] **Step 2: Run tests to verify missing module fails**

Run:

```bash
npm run test:automation
```

Expected: fail with module not found for `pilot-selector-v3.mjs`.

- [ ] **Step 3: Implement selector**

Create `lib/automation/pilot-selector-v3.mjs`:

```js
import { BRAND_IDS, getBrandProfile, inferBrandIdFromItem } from "./brand-profiles-v3.mjs";
import {
  PROMPT_FRAMEWORK_V3_VERSION,
  buildHeroPromptV3,
  buildSupportPromptV3,
  getSupportShotsV3
} from "./prompt-framework-v3.mjs";

export function selectPilotItemsV3({
  auditRows = [],
  generationRows = [],
  skuPerBrand = 2,
  includeExistingSku = false,
  now = new Date()
} = {}) {
  const generationBySku = new Map(generationRows.map((row) => [row.sku, row]));
  const candidates = auditRows
    .filter((row) => isActionable(row, generationBySku, includeExistingSku))
    .map((row) => buildPilotItem(row, generationBySku.get(row.sku) || {}));

  const brandOrder = [BRAND_IDS.RENT_A_COAT, BRAND_IDS.GO_MALL];
  const items = brandOrder.flatMap((brandId) => candidates.filter((item) => item.brand_id === brandId).slice(0, skuPerBrand));

  return {
    batch_id: `dry-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
    dry_run: true,
    created_at: now.toISOString(),
    batch_size: items.length,
    prompt_framework_version: PROMPT_FRAMEWORK_V3_VERSION,
    selection: {
      sku_per_brand: skuPerBrand,
      rent_a_coat_candidates: candidates.filter((item) => item.brand_id === BRAND_IDS.RENT_A_COAT).length,
      go_mall_candidates: candidates.filter((item) => item.brand_id === BRAND_IDS.GO_MALL).length,
      note: "Prompt Framework v3 pilot selects up to 2 SKU per brand for Rent A Coat and GO Mall only."
    },
    items
  };
}

function isActionable(row, generationBySku, includeExistingSku) {
  if (!row.sku) return false;
  if (row.automation_action !== "generate_then_publish_or_attach_after_review") return false;
  if (!includeExistingSku && row.woo_status === "found") return false;
  const brandId = inferBrandIdFromItem(row);
  if (![BRAND_IDS.RENT_A_COAT, BRAND_IDS.GO_MALL].includes(brandId)) return false;
  const generation = generationBySku.get(row.sku);
  if (!generation) return false;
  return generation.generation_status === "ready_via_drive_folder_lookup"
    ? Boolean(generation.reference_parent_folder_id && generation.reference_lookup_key)
    : /^https?:\/\//i.test(String(generation.reference_url || ""));
}

function buildPilotItem(row, generation) {
  const brandId = inferBrandIdFromItem(row);
  const profile = getBrandProfile(brandId);
  const shouldCreateDraft = row.woo_status === "not_found";
  const base = {
    sku: row.sku,
    brand_id: brandId,
    brand_label: profile.label,
    product_type: row.product_type,
    target_site: row.target_site,
    product_name: row.wp_product_name || generation.product_name || "",
    category: row.wp_category || generation.category || "",
    subcategory: row.wp_subcategory || generation.subcategory || "",
    reference_strategy: generation.reference_lookup_strategy || "",
    reference_url: generation.reference_url || "",
    reference_parent_folder_id: generation.reference_parent_folder_id || "",
    reference_lookup_key: generation.reference_lookup_key || "",
    reference_confidence: "medium",
    generation_status: generation.generation_status || "",
    woo_status: row.woo_status,
    woo_product_ids: row.woo_product_ids || "",
    dry_run_action: shouldCreateDraft
      ? "dry-run: prepare brand-aware hero/support prompts and wait for LINE QC before any live action"
      : "dry-run: skip generation/publish and mark completed because SKU exists",
    prompt_quality: process.env.AI_GENERATION_DEFAULT_QUALITY || "low",
    model: process.env.AI_IMAGE_MODEL || "openai/gpt-image-2/edit",
    prompt_framework_version: PROMPT_FRAMEWORK_V3_VERSION
  };
  const supportShots = getSupportShotsV3(base);
  return {
    ...base,
    support_shots: supportShots.join("|"),
    hero_prompt: buildHeroPromptV3(base),
    support_prompt_preview: buildSupportPromptV3(base, supportShots[0], 1, supportShots.length)
  };
}
```

- [ ] **Step 4: Run selector tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/pilot-selector-v3.mjs test/automation/pilot-selector-v3.test.mjs
git commit -m "Add v3 pilot selector"
```

---

### Task 7: Update Pilot Batch Script

**Files:**
- Modify: `scripts/automation/create-pilot-batch.mjs`
- Create: `test/automation/create-pilot-batch-v3.test.mjs`

- [ ] **Step 1: Extract script runner for testability**

Modify `scripts/automation/create-pilot-batch.mjs` so the selection logic delegates to `selectPilotItemsV3`.

Replace imports from `prompt-framework-v2.mjs` with:

```js
import { selectPilotItemsV3 } from "../../lib/automation/pilot-selector-v3.mjs";
```

Replace item construction and alternating selection logic with:

```js
const skuPerBrand = Number(process.env.PILOT_SKU_PER_BRAND || 2);
const batch = selectPilotItemsV3({
  auditRows,
  generationRows,
  skuPerBrand,
  includeExistingSku: process.env.PILOT_INCLUDE_EXISTING_SKU === "true"
});
```

Keep existing output writes:

```js
fs.mkdirSync(outputsDir, { recursive: true });
fs.writeFileSync(path.join(outputsDir, "pilot-batch-dry-run.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
writeCsvObjects(path.join(outputsDir, "pilot-batch-dry-run.csv"), batch.items);

console.log(`Created ${batch.batch_id}`);
console.log(`Items: ${batch.items.length}`);
console.log(`Rent A Coat candidates: ${batch.selection.rent_a_coat_candidates}`);
console.log(`GO Mall candidates: ${batch.selection.go_mall_candidates}`);
console.log(path.join(outputsDir, "pilot-batch-dry-run.json"));
```

- [ ] **Step 2: Add env example defaults**

Modify `.env.example`:

```dotenv
PROMPT_FRAMEWORK_VERSION=v3
PILOT_SKU_PER_BRAND=2
PILOT_INCLUDE_EXISTING_SKU=false
REFERENCE_MATCH_AUTO_THRESHOLD=0.90
REFERENCE_MATCH_REVIEW_THRESHOLD=0.70
```

- [ ] **Step 3: Run script syntax check**

Run:

```bash
node --check scripts/automation/create-pilot-batch.mjs
```

Expected: no output and exit 0.

- [ ] **Step 4: Run automation tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Run batch script locally**

Run:

```bash
node scripts/automation/create-pilot-batch.mjs
```

Expected:

```text
Items: 4
Rent A Coat candidates: <number>
GO Mall candidates: <number>
```

Open `../../outputs/pilot-batch-dry-run.json` and verify:

```json
{
  "prompt_framework_version": "prompt-framework-v3.0-dry-run",
  "selection": {
    "sku_per_brand": 2
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add .env.example scripts/automation/create-pilot-batch.mjs
git commit -m "Switch pilot batch creation to framework v3"
```

---

### Task 8: Persist V3 Manifest Metadata

**Files:**
- Modify: `lib/automation/batch-registry.mjs`
- Create: `test/automation/batch-registry-manifest.test.mjs`

- [ ] **Step 1: Write pure metadata builder test**

Before touching Supabase calls, add a pure exported helper to test.

Create `test/automation/batch-registry-manifest.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildAutomationBatchMetadata, buildAutomationBatchItemPayload } from "../../lib/automation/batch-registry.mjs";

test("batch metadata preserves v3 manifest fields", () => {
  const metadata = buildAutomationBatchMetadata({
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    selection: { sku_per_brand: 2 },
    created_at: "2026-06-11T00:00:00Z"
  });
  assert.equal(metadata.prompt_framework_version, "prompt-framework-v3.0-dry-run");
  assert.equal(metadata.selection.sku_per_brand, 2);
});

test("item payload stores brand and reference manifest metadata", () => {
  const payload = buildAutomationBatchItemPayload("batch-id", {
    sku: "RAC-COAT-001",
    brand_id: "rent_a_coat",
    brand_label: "Rent A Coat",
    target_site: "rentacoat",
    product_name: "เสื้อโค้ท",
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    reference_manifest: { confidence: 0.95 },
    asset_classification_summary: { product_reference: 2 }
  });
  assert.equal(payload.batch_id, "batch-id");
  assert.equal(payload.metadata.brand_id, "rent_a_coat");
  assert.equal(payload.metadata.reference_manifest.confidence, 0.95);
});
```

- [ ] **Step 2: Run tests to verify exports fail**

Run:

```bash
npm run test:automation
```

Expected: fail because helper exports do not exist.

- [ ] **Step 3: Add exported helpers**

Modify `lib/automation/batch-registry.mjs`:

```js
export function buildAutomationBatchMetadata(batch = {}) {
  return {
    prompt_framework_version: batch.prompt_framework_version || batch.items?.[0]?.prompt_framework_version || "",
    selection: batch.selection || {},
    created_at: batch.created_at || null,
    brand_scope: ["rent_a_coat", "go_mall"],
    dry_run: batch.dry_run !== false
  };
}

export function buildAutomationBatchItemPayload(batchId, item = {}) {
  return {
    batch_id: batchId,
    sku: String(item.sku || "").trim(),
    product_type: item.product_type || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    status: item.woo_status === "found" ? "sku_exists" : "awaiting_approval",
    woo_status: item.woo_status || "",
    prompt_framework_version: item.prompt_framework_version || "",
    prompt_json: {
      hero_prompt: item.hero_prompt || "",
      support_prompt_preview: item.support_prompt_preview || "",
      support_shots: item.support_shots || ""
    },
    metadata: {
      ...item,
      brand_id: item.brand_id || "",
      brand_label: item.brand_label || "",
      reference_manifest: item.reference_manifest || null,
      asset_classification_summary: item.asset_classification_summary || null
    }
  };
}
```

Then update `registerAutomationBatch()` to use:

```js
metadata: buildAutomationBatchMetadata(batch)
```

and:

```js
const items = (batch.items || [])
  .map((item) => buildAutomationBatchItemPayload(automationBatch.id, item))
  .filter((item) => item.sku);
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/batch-registry.mjs test/automation/batch-registry-manifest.test.mjs
git commit -m "Persist framework v3 batch metadata"
```

---

### Task 9: Update LINE Flex Cards For V3 Review

**Files:**
- Modify: `lib/automation/line-client.mjs`
- Create: `test/automation/line-client-v3.test.mjs`

- [ ] **Step 1: Write LINE card tests**

Create `test/automation/line-client-v3.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildPilotBatchFlex, buildReferenceMatchFlex } from "../../lib/automation/line-client.mjs";

test("pilot batch flex includes brand scope and dry-run state", () => {
  const flex = buildPilotBatchFlex({
    batch_id: "dry-test",
    dry_run: true,
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    items: [
      { sku: "RAC-COAT-001", brand_label: "Rent A Coat", asset_classification_summary: { product_reference: 2, label_or_tag: 1 } },
      { sku: "GM-HAT-001", brand_label: "GO Mall", asset_classification_summary: { product_reference: 1, label_or_tag: 0 } }
    ]
  });
  const text = JSON.stringify(flex);
  assert.match(text, /Rent A Coat/);
  assert.match(text, /GO Mall/);
  assert.match(text, /dry-test/);
  assert.match(text, /Approve batch/);
});

test("reference match flex exposes confidence and review action", () => {
  const flex = buildReferenceMatchFlex({
    batch_id: "dry-test",
    sku: "RAC-COAT-001",
    brand_label: "Rent A Coat",
    product_name: "เสื้อโค้ท",
    reference_manifest: {
      confidence: 0.82,
      match_method: "ocr_sku_label",
      needs_review: true
    },
    asset_classification_summary: {
      product_reference: 1,
      label_or_tag: 1,
      generated_candidate: 1,
      staff_noise: 0,
      ambiguous: 0
    }
  });
  const text = JSON.stringify(flex);
  assert.match(text, /0.82/);
  assert.match(text, /Needs review/);
  assert.match(text, /ocr_sku_label/);
});
```

- [ ] **Step 2: Run tests to verify reference card export fails**

Run:

```bash
npm run test:automation
```

Expected: fail because `buildReferenceMatchFlex` does not exist or v3 text is missing.

- [ ] **Step 3: Add v3 card helpers**

Modify `lib/automation/line-client.mjs` by adding:

```js
export function buildReferenceMatchFlex(item = {}) {
  const manifest = item.reference_manifest || {};
  const summary = item.asset_classification_summary || {};
  return {
    type: "flex",
    altText: `Reference review: ${item.sku}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          textNode(`${item.brand_label || "Brand"} / ${item.sku}`, "lg", "bold"),
          textNode(item.product_name || "-", "sm", "regular", "#64748B"),
          separatorNode(),
          textNode(`Match: ${manifest.match_method || "unknown"}`, "sm"),
          textNode(`Confidence: ${formatConfidence(manifest.confidence)}`, "sm"),
          textNode(`Assets: product ${summary.product_reference || 0}, label ${summary.label_or_tag || 0}, generated ${summary.generated_candidate || 0}, noise ${summary.staff_noise || 0}, ambiguous ${summary.ambiguous || 0}`, "xs", "regular", "#64748B")
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          postbackButton("Approve match", `action=approve_reference&batch_id=${item.batch_id}&sku=${item.sku}`, "primary"),
          postbackButton("Needs review", `action=needs_review&batch_id=${item.batch_id}&sku=${item.sku}`, "secondary"),
          postbackButton("Reject", `action=reject_sku&batch_id=${item.batch_id}&sku=${item.sku}`, "secondary")
        ]
      }
    }
  };
}

function textNode(text, size = "sm", weight = "regular", color = "#111827") {
  return { type: "text", text: String(text || "-").slice(0, 300), size, weight, color, wrap: true };
}

function separatorNode() {
  return { type: "separator", margin: "md" };
}

function postbackButton(label, data, style) {
  return {
    type: "button",
    style,
    action: {
      type: "postback",
      label,
      data
    }
  };
}

function formatConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "-";
}
```

Update `buildPilotBatchFlex()` body content to include brand counts:

```js
const brandCounts = countBy(batch.items || [], (item) => item.brand_label || item.brand_id || "Unknown");
```

and render lines:

```js
...Object.entries(brandCounts).map(([brand, count]) => textNode(`${brand}: ${count} SKU`, "sm"))
```

Add helper:

```js
function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}
```

- [ ] **Step 4: Run LINE card tests**

Run:

```bash
npm run test:automation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/line-client.mjs test/automation/line-client-v3.test.mjs
git commit -m "Add v3 LINE review cards"
```

---

### Task 10: End-To-End Dry-Run Verification

**Files:**
- Modify only if tests reveal bugs.
- Outputs generated under ignored `outputs/`.

- [ ] **Step 1: Run full static checks**

Run:

```bash
node --check server.mjs
node --check scripts/automation/create-pilot-batch.mjs
node --check scripts/automation/send-line-dry-run.mjs
node --check scripts/automation/worker.mjs
npm run test:automation
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Generate v3 pilot batch**

Run:

```bash
PILOT_SKU_PER_BRAND=2 node scripts/automation/create-pilot-batch.mjs
```

Expected:

```text
Items: 4
```

Verify:

```bash
node --input-type=module - <<'NODE'
import fs from "node:fs";
const batch = JSON.parse(fs.readFileSync("../../outputs/pilot-batch-dry-run.json", "utf8"));
console.log(batch.prompt_framework_version);
console.log(batch.items.map((item) => `${item.brand_id}:${item.sku}`).join("\n"));
if (batch.items.length !== 4) process.exit(1);
if (batch.items.filter((item) => item.brand_id === "rent_a_coat").length > 2) process.exit(1);
if (batch.items.filter((item) => item.brand_id === "go_mall").length > 2) process.exit(1);
NODE
```

Expected first line:

```text
prompt-framework-v3.0-dry-run
```

- [ ] **Step 3: Register and send LINE dry-run**

Run:

```bash
node scripts/automation/send-line-dry-run.mjs
```

Expected:

```text
Registered automation batch <batch-id> (4 items)
LINE dry-run message sent
```

If local Supabase env is incomplete, use Render env values locally without printing them:

```bash
node scripts/automation/send-line-dry-run.mjs
```

Expected fallback:

```text
Automation batch registration skipped: Supabase automation env is incomplete.
LINE dry-run message sent
```

If skipped, run the existing Render-env registration helper from the previous production dry-run procedure before asking the user to approve.

- [ ] **Step 4: Test production webhook still verifies**

Run:

```bash
node scripts/automation/set-line-webhook.mjs https://image-workflow.onrender.com
```

Expected:

```text
test 200 {"success":true
```

- [ ] **Step 5: Confirm dry-run approval remains non-destructive**

Send a signed synthetic postback to production with the new batch id:

```bash
node --input-type=module - <<'NODE'
import fs from "node:fs";
import crypto from "node:crypto";
import { loadLocalEnv, getRequiredEnv } from "./lib/automation/env.mjs";

loadLocalEnv("./.env");
const batch = JSON.parse(fs.readFileSync("../../outputs/pilot-batch-dry-run.json", "utf8"));
const body = Buffer.from(JSON.stringify({
  destination: "codex-dry-run",
  events: [{
    type: "postback",
    mode: "active",
    timestamp: Date.now(),
    source: { type: "user", userId: getRequiredEnv("LINE_TARGET_USER_ID") },
    webhookEventId: `codex-${Date.now()}`,
    deliveryContext: { isRedelivery: false },
    postback: { data: `action=approve_batch&batch_id=${batch.batch_id}` }
  }]
}));
const signature = crypto.createHmac("sha256", getRequiredEnv("LINE_CHANNEL_SECRET")).update(body).digest("base64");
const response = await fetch("https://image-workflow.onrender.com/api/line/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-line-signature": signature },
  body
});
console.log(response.status, await response.text());
NODE
```

Expected:

```text
200 {"ok":true}
```

- [ ] **Step 6: Confirm worker completed task**

Run:

```bash
curl -fsS https://image-workflow.onrender.com/api/health | python3 -m json.tool
```

Expected:

```json
"automationWorker": {
  "embedded": true,
  "running": true,
  "lastError": null
}
```

Then query Supabase through the same local helper pattern used earlier and confirm:
- `automation_batches.status` is `approved`.
- `automation_batch_items` count is `4`.
- `automation_tasks.task_type` is `generate_batch`.
- `automation_tasks.status` is `completed`.
- `payload.dry_run` is `true`.
- No image generation or WordPress publish occurred.

- [ ] **Step 7: Commit verification fixes if any**

If fixes were needed:

```bash
git status --short
git add package.json .env.example lib/automation scripts/automation test/automation
git commit -m "Verify prompt framework v3 dry run"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:
- Brand profiles: Task 2.
- Asset classification: Task 3.
- SKU-first reference matching: Task 4.
- Prompt Framework v3 hero/support logic: Task 5.
- Pilot batch size 2 SKU per brand: Tasks 6 and 7.
- LINE mini design system: Task 9.
- Dry-run/no publish safety: Tasks 7, 8, and 10.

Placeholder scan:
- This plan intentionally contains no open-ended implementation placeholders and no unbounded test-writing instructions.

Type consistency:
- Brand IDs use `rent_a_coat` and `go_mall` across all modules.
- Prompt version uses `prompt-framework-v3.0-dry-run`.
- Asset classification field names use `asset_type`, `confidence`, `use_as_reference`, and `needs_review`.
- Reference manifest field names match the design spec.
