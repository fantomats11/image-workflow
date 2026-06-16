# Product Image Use Case Contract

This contract preserves the legacy product-image use cases while Prompt Framework v3 moves into automated, hero-first generation.

## Flow Contract

1. Generate hero first.
2. Send reference + hero for human review.
3. Support images may start only after an approved hero anchor exists.
4. Support prompts must receive the approved hero as the first generated/model anchor, plus real product references.
5. If the approved hero conflicts with real product references, product references win.

## Product Use Cases

- Footwear and boots: lower-leg or product-only crops. Keep shaft height, opening, laces/straps, toe shape, side profile, and sole readable. Winter pants may be tucked into the boot shaft or cropped above it. Avoid bare legs, bulky socks, leg warmers, and vague fuzzy hems.
- Long coats and parkas: near full-body crops for fit/shape, roughly head-to-ankle or head-to-mid-calf. Show length, hem, closure, sleeves, hood/collar, and silhouette.
- Upper jackets and tops: upper-body crops, roughly head/neck-to-hip or upper thigh. Exclude shoes and most legs unless the shot explicitly needs scale.
- Pants: waist-to-feet crops. Show waistband, hips, leg shape, length, pockets, and hem. Avoid exposed stomach or summer styling.
- Gloves: hands-and-forearms crops. Show palm, cuff, grip, lining, seam, and material. A winter sleeve/cuff should meet the glove naturally.
- Hats: head-and-shoulders crops. Keep the hat dominant and preserve real logo/label/patch only when visible in the reference or approved hero.
- Scarves and small accessories: crop only the body area needed to show how the item is worn. The accessory stays dominant.
- Socks: lower-calf-to-feet crops. Socks stay the main product and should not be hidden by pants, slippers, or boots.

## Implementation

- Use-case resolution lives in `lib/automation/product-image-use-case-rules.mjs`.
- Prompt Framework v3 merges category defaults, use-case shots, and brand priorities through `getSupportShotsV3`.
- Support prompts add natural-language use-case guidance through `describeUseCaseSupportShotV3`.
- Hero identity locking is handled by `buildApprovedHeroIdentityLockV3`.

## Prompt Style

Prompts should read like natural ecommerce photography briefs, not internal architecture notes. They should mention the actual product brand when detected from product name, such as Columbia, The North Face, Discovery, MLB, Moncler, or Canada Goose, but should not expose channel labels such as GO Mall or Rent A Coat in the generated prompt.

## Brand Mark Fidelity

- Preserve only logos, labels, patches, embroidery, printed marks, zipper pulls, or woven tags that are physically visible on the product in real reference images.
- Keep visible marks in the same product area with the same approximate size, angle, material, stitching/print style, contrast, and relationship to seams, zippers, pockets, hood, cuffs, sole, or hem.
- Do not ask the model to redraw a brand logo from memory. If the mark is small, blurred, partly hidden, or not clearly readable, keep it small/soft/partly hidden or omit it rather than fabricating a sharp logo.
- Never copy barcode cards, SKU cards, hang tags, care labels, store signs, watermarks, or reference-sheet text into the generated ecommerce image.
- For logo-sensitive final pilots, prefer high-quality generation settings after the hero prompt is approved, because low-quality tests can degrade small embroidered or printed marks.
