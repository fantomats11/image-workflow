# Prompt Framework v3 Design

## Goal

Build the next dry-run pilot around a brand-aware prompt framework for Rent A Coat and GO Mall only. The pilot scope is 2 SKU per brand, 4 SKU total, with no real image generation and no WordPress publishing until the user explicitly approves live mode.

## Business Context

Rent A Coat and GO Mall share the same winter product domain, but the image job is different.

Rent A Coat is a rental brand. Images must reduce hesitation around fit, warmth, cleanliness, condition, and trip readiness. Customers need to believe the product is real, clean, and suitable for their travel context.

GO Mall is a purchase brand. Images must make browsing fast, keep products clear in a grid, communicate style/value, and help customers feel confident buying the exact item.

The framework should not optimize for a single image viewed alone. It must optimize for product grids, product detail pages, and LINE approval cards.

## Scope

In scope:
- Brand profiles for Rent A Coat and GO Mall.
- Prompt decision tree for hero and support images.
- Asset classification for mixed reference folders.
- SKU-first reference matching with approval for low-confidence matches.
- Pilot batch sizing of 2 SKU per brand.
- LINE Flex card and admin control-room design rules.
- QC criteria and approval gates.

Out of scope for this phase:
- Other brands.
- Live image generation.
- WordPress product creation or media upload.
- Full admin frontend redesign.
- Paid Render background worker migration.

## Brand Profiles

### Rent A Coat

Primary image job: make the customer trust that the item can be rented and worn on a real trip.

Recommended visual mix:
- Studio with controlled variation: 45%.
- Soft lifestyle context: 45%.
- Editorial realism texture: 10%.

Hero direction:
- Product or model must dominate the frame.
- Prefer wearing context for apparel when reference confidence is high.
- Use clean winter-trip hints only when they do not distract from the product.
- The image should feel realistic, clean, and usable, not campaign-heavy.

Support direction:
- Front fit and overall shape.
- Side thickness, length, and construction.
- Back/hood/closure view where applicable.
- Lining, fabric, fur, zipper, patch, sole, or material detail.
- Wearing/scale cue for apparel and accessories.

Realism guardrail:
- Natural skin texture is allowed.
- Subtle pores, undertones, and tiny natural marks are allowed.
- Do not prompt for visible blemishes as a default feature.
- Avoid plastic skin, over-smoothed models, fake luxury, and unrealistic product condition.

### GO Mall

Primary image job: make the customer quickly understand and want to buy the item.

Recommended visual mix:
- Studio with controlled variation: 65%.
- Soft lifestyle context: 25%.
- Editorial realism texture: 10%.

Hero direction:
- Product-dominant and grid-readable.
- Use controlled variation in crop, pose, lighting, and background tint.
- Add model or context only when it helps style, scale, or fit.
- The image should feel new, clear, and worth buying.

Support direction:
- Front, back, side, and detail shots.
- Texture and construction closeups.
- Optional model scale shot for apparel and accessories.
- Styling cue when useful, but not at the cost of product clarity.

Realism guardrail:
- Keep product color/material faithful to references.
- Do not invent premium details, labels, or logos.
- Do not over-style the product until it feels like a different item.

## Prompt Decision Tree

Every SKU should pass through this sequence:

1. Brand profile:
   - `rent_a_coat`
   - `go_mall`

2. Product category:
   - apparel: coats, jackets, sweaters, pants.
   - footwear: boots, shoes.
   - accessories: gloves, hats, bags, scarves.

3. Reference confidence:
   - High: multiple clear product references, SKU evidence, and product details visible.
   - Medium: product visible but some angle/detail gaps.
   - Low: weak references, ambiguous folder, generated images dominate, or SKU evidence is uncertain.

4. Hero style:
   - `studio_controlled_variation`
   - `soft_lifestyle_context`
   - `studio_safe_fallback`

5. Support shot pack:
   - Category-specific shot keys.
   - Brand-specific priorities.
   - Reference-confidence limits.

6. Variation budget:
   - Hero images should vary 10-25% across SKU in crop, angle, pose, lighting, background tint, or context.
   - Product identity, color, silhouette, and construction must remain stable.

## Asset Classification

Before matching references to SKU or building prompts, every file from a reference folder must be classified.

Asset types:
- `product_reference`: real staff/product photo that can anchor product truth.
- `label_or_tag`: barcode, SKU card, product tag, or label photo. Use for OCR/SKU evidence only.
- `generated_candidate`: previously generated output. Use as optional style hint only after approval.
- `staff_noise`: hand, floor, shelf, bag, blurry image, duplicate, unrelated item, or accidental surrounding object.
- `ambiguous`: not enough confidence. Requires review.

Classification output:
- `asset_type`
- `sku_detected`
- `confidence`
- `use_as_reference`
- `reason`
- `needs_review`

Rules:
- `label_or_tag` must never be used as product image reference.
- `generated_candidate` must never override real product reference details.
- `ambiguous` assets must not be used automatically.
- If a folder contains both real photos and generated images, real photos define product truth and generated images can only guide style if approved.

## Reference Matching

Matching priority:

1. Exact SKU in folder path or filename.
2. OCR SKU from `label_or_tag`.
3. Product code, product name, color, size, or category from catalog data.
4. Folder-level visual grouping.
5. Human approval for low-confidence matches.

Confidence handling:
- `>= 0.90`: auto-match allowed for dry-run manifest.
- `0.70-0.89`: proposed match, requires approval before generation.
- `< 0.70`: no auto-match; ask for manual mapping or skip.

The system should create a persistent reference manifest:
- `brand`
- `sku`
- `source_folder_id`
- `source_path`
- `file_ids`
- `match_method`
- `confidence`
- `approved_by`
- `approved_at`
- `asset_manifest`

The manifest becomes the source of truth for future runs.

## Pilot Batch

Pilot size:
- Rent A Coat: 2 SKU.
- GO Mall: 2 SKU.
- Total: 4 SKU.

Recommended pilot composition:
- Rent A Coat apparel SKU: coat/jacket/sweater.
- Rent A Coat accessory SKU: glove/hat/boot.
- GO Mall apparel SKU: sweater/jacket/top.
- GO Mall accessory or different category SKU.

Pilot mode:
- Dry-run only.
- No image generation.
- No WordPress publishing.
- Prepare prompts, reference mapping, classification summary, and QC cards.

Pilot success criteria:
- Every SKU has a clear brand profile and support shot pack.
- Reference assets are classified and risky assets are excluded.
- Product grid preview does not look like one repeated template.
- LINE approval card is readable and does not hide key risk information.
- Low-confidence matching is surfaced for review instead of being silently used.

## LINE Flex Mini Design System

LINE is the primary approval surface for fast decisions.

Required card types:
- Batch summary card.
- SKU reference match card.
- Asset classification warning card.
- Prompt preview card.
- QC result card.

Required fields:
- Brand.
- SKU.
- Product name.
- Category.
- Match confidence.
- Asset counts by type.
- Dry-run/live state.
- Next action.

Status colors:
- Dry-run: neutral blue/gray.
- Approved: green.
- Needs review: amber.
- Rejected/blocked: red.
- Existing SKU / duplicate: slate.

Button hierarchy:
- Primary: Approve.
- Secondary: Needs review.
- Destructive: Reject.

Copy style:
- Thai-first.
- Short and operational.
- Mention risk directly.
- Avoid decorative copy.

## Frontend/Admin Role

The frontend/admin is a control room, not the main operator surface.

Admin should be used for:
- Batch history.
- SKU status.
- Reference folder and asset classification review.
- Grid preview.
- QC comparison.
- Rerun/problem inspection.
- Audit trail.

Admin does not need a full redesign in this phase. It only needs lightweight component patterns:
- status badge.
- SKU card.
- batch table.
- asset classification chip.
- match-confidence label.
- before/after or reference/generated viewer.

## QC Criteria

Each SKU should be scored or reviewed across five axes:

1. Product fidelity:
   - Product matches reference identity, color, silhouette, material, labels, trims, and proportions.

2. Grid distinctiveness:
   - Hero does not look too similar to nearby SKU cards.
   - Variation stays within product truth.

3. Trust:
   - Image looks clean, usable, and credible for the brand.
   - Rent A Coat emphasizes rental confidence.
   - GO Mall emphasizes purchase clarity and value.

4. Emotion:
   - Image helps the customer imagine wearing or owning the item.
   - Context does not distract from product truth.

5. Realism:
   - Natural skin, fabric, light, and shadow.
   - No plastic skin, fake texture, or fake product condition.

## Error Handling

If reference confidence is low:
- Do not generate.
- Send LINE review card.
- Store the item as `needs_reference_review`.

If folder contains mostly labels/noise:
- Use labels for SKU evidence only.
- Mark product reference as missing.
- Ask for replacement images or skip.

If generated candidates conflict with real references:
- Prefer real reference.
- Mark generated candidate as style-only or exclude it.

If SKU already exists in WooCommerce:
- Do not create or update product during dry-run.
- Mark as `sku_exists`.
- Store completion note.

## Testing Strategy

The implementation should include fixtures for:
- Folder with product photos and label image.
- Folder with only label/noise.
- Folder with real photos plus generated candidate.
- Folder with ambiguous product references.
- Rent A Coat apparel SKU.
- Rent A Coat accessory SKU.
- GO Mall apparel SKU.
- GO Mall accessory SKU.

Expected tests:
- Asset classifier assigns correct asset types.
- Reference matcher uses SKU-first priority.
- Low-confidence matches require review.
- Brand prompt builder produces different hero/support guidance for Rent A Coat vs GO Mall.
- Pilot batch selector limits to 2 SKU per brand.
- LINE card payload contains required fields and actions.
- Dry-run approval creates completed queue task without generation or WordPress publish.

## Implementation Boundary

The next implementation phase should be split into small tasks:

1. Data model and manifest shape.
2. Asset classification module.
3. Reference matching module.
4. Brand profile prompt framework v3.
5. Pilot batch selector for 2 SKU per brand.
6. LINE Flex card updates.
7. Admin/control-room read views only if needed for inspection.
8. End-to-end dry-run verification.

No task should enable real generation or WordPress publishing by default.
