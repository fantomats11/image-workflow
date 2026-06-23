# Image Workflow Handoff

Last updated: 2026-06-12

> Status note, 2026-06-18: this handoff is historical context. For the current production truth, read `docs/CURRENT_TRUTH.md` first. In particular, the current MVP path is LINE keyword batch -> web Hero Review -> approved Hero unlocks Support -> Support Review -> export/preflight. WordPress/WooCommerce live writes are still out of scope.

Use this file to resume the Rent A Coat / GO Mall image workflow project without rereading the full conversation thread.

## Start Here

Canonical repo:

`/Users/supatcharoenpot/Documents/Codex/2026-06-10/files-mentioned-by-the-user-function/work/image-workflow`

Remote:

`https://github.com/fantomats11/image-workflow.git`

Use this Codex skill before changing automation logic:

`~/.codex/skills/rent-a-coat-go-mall-automation/SKILL.md`

Important: do not use this unrelated path for this project:

`/Users/supatcharoenpot/Documents/Codex/2026-06-09/build-template-hr-build-google-sheet`

## Current Product Scope

The active project is still the product image workflow for:

- Rent A Coat
- GO Mall
- Product Catalog Google Sheet reference mapping
- Google Drive product reference assets
- Prompt Framework v3
- FAL / `openai/gpt-image-2/edit`
- LINE human review loop
- Supabase-backed queue/audit/monitoring foundation
- WooCommerce / WordPress preflight only, no live writes

Future but separate lane:

- WordPress content/post/blog copilot
- Design system and admin expansion

Keep blog/content work separate from product image automation, but reuse the same governance pattern:

Source -> Map/Dedupe -> Proposal/Draft -> Human Approval -> Controlled Execution -> Audit/Monitoring

## Safety And Production Rules

- Do not put secrets, OAuth tokens, Supabase service keys, LINE tokens, WordPress credentials, or API keys into docs.
- Prefer dry-run, proposal, and review before any production action.
- Do not perform WordPress/WooCommerce live writes without explicit final confirmation.
- Keep `WORDPRESS_LIVE_WRITES_ENABLED=false` unless a future final-confirmed write phase is implemented.
- Keep support generation blocked until an approved hero exists.
- For support generation, the approved hero anchor must be the first attached model input, followed by real product reference inputs. This matches Prompt Framework wording: the first generated image is the approved hero anchor.
- Product references always outrank generated hero/support images if there is conflict.
- Do not use label/tag/SKU card/barcode images as visual product truth.
- Do not revert unrelated dirty worktree files.

## Environment Notes

Current local `.env` has real values and must not be copied into docs.

Important public/non-secret settings and behavior:

- App default port: `8765`
- Local OAuth callback: `http://127.0.0.1:8765/api/google/oauth/callback`
- Render OAuth callback: `https://image-workflow.onrender.com/api/google/oauth/callback`
- Google OAuth start route requires app authentication; directly visiting `/api/google/oauth/start` without app auth returns `auth_required`.
- Supabase MCP is optional. The system can currently work from local env/API logic, but Supabase MCP may help for direct schema/query work later if installed and authenticated.
- FAL image generation currently supports:
  - `FAL_KEY`
  - `FAL_IMAGE_MODEL` or default `openai/gpt-image-2/edit`
  - `FAL_IMAGE_SIZE`
  - `FAL_IMAGE_QUALITY`
  - `AI_GENERATION_DEFAULT_QUALITY`

Quality guidance:

- Cheap prompt/flow tests can use `AI_GENERATION_DEFAULT_QUALITY=low`.
- Final or logo-sensitive hero/support review should explicitly use `FAL_IMAGE_QUALITY=high`.
- Low quality can degrade small embroidered/printed brand marks, but prompt logic must still prevent invented logos.

## Current Prompt Framework State

Current prompt version:

`prompt-framework-v3.7-brand-mark-fidelity`

Main file:

`lib/automation/prompt-framework-v3.mjs`

Supporting modules:

- `lib/automation/product-image-use-case-rules.mjs`
- `lib/automation/product-brand-mark-fidelity.mjs`
- `lib/automation/brand-profiles-v3.mjs`

Prompt design rules:

- Prompt should read like a natural ecommerce photography brief, not internal architecture notes.
- Do not expose channel labels like GO Mall or Rent A Coat in generated image prompts.
- Mention actual product brands detected from product names when relevant, e.g. Columbia, The North Face, Discovery, MLB, Moncler, Canada Goose.
- Do not say “for GO Mall” or “for Rent A Coat” inside the provider prompt.
- Hero/support images must be ecommerce product images, not campaign posters or ad layouts.
- No poster layout, price text, badges, callouts, UI elements, QR codes, store signs, unrelated props, fake labels, or extra logos.

Brand mark fidelity rules:

- Preserve only logos, labels, patches, embroidery, printed marks, zipper pulls, or woven tags physically visible on the product in real references.
- Keep visible marks in the same product area with the same approximate size, angle, material, stitching/print style, contrast, and relationship to seams, zippers, pockets, hood, cuffs, sole, or hem.
- Do not redraw brand logos from memory.
- Do not invent readable logo text.
- If the mark is small, blurred, partly hidden, or not clearly readable, keep it small/soft/partly hidden or omit it rather than creating a sharp fake logo.
- Never copy barcode cards, SKU cards, hang tags, care labels, store signs, watermarks, or reference-sheet text into the final ecommerce image.

## Model And Human Realism Rules

User preference:

- Models are allowed and preferred where they help fit/size/wearability.
- Model faces should look Thai / Southeast Asian / East Asian, fresh, cheerful, approachable.
- No plastic-perfect AI skin.
- Natural skin texture, subtle pores, real complexion variation, realistic hands/posture.
- Model should support product fit/scale, not look like a fashion campaign celebrity.

Current policy:

- Rent A Coat apparel hero: model required.
- GO Mall apparel hero: model preferred.
- Footwear hero: model/lower-body scale cue preferred for Rent A Coat, optional scale model for GO Mall.
- Detail shots such as texture, sole, lining, interior: product-only, no model.
- Unisex support scale cue: man + woman pair when appropriate.
- Child products: child wearer logic exists in model policy.

## Product Use Case Rules

The old working flow's use cases have been preserved in `product-image-use-case-rules.mjs`.

Critical rules:

- Footwear/boots: lower-leg or product-only crops. Show shaft height, opening, laces/straps, toe shape, side profile, sole. Winter pants can be tucked inside boot shaft or cropped just above it. Avoid bare legs, bulky socks, slouch socks, leg warmers, vague fuzzy hems.
- Long coats/parkas: near full-body crops for fit/shape, roughly head-to-ankle or head-to-mid-calf. Show full length, hem, closure, sleeves, hood/collar, silhouette.
- Upper jackets/tops: upper-body crops, roughly head/neck-to-hip or upper thigh. Exclude shoes and most legs unless scale is needed.
- Pants: waist-to-feet crops. Show waistband, hips, leg shape, length, pockets, hem. Avoid exposed stomach, crop tops, summer styling.
- Gloves: hands-and-forearms crops. Show palm, cuff, grip, lining, seam, material. Winter sleeve/cuff should meet glove naturally.
- Hats: head-and-shoulders crops. Hat dominant. Preserve real logo/label/patch only when visible in reference/approved hero.
- Scarves/small accessories: crop only body area needed to show use. Accessory stays dominant.
- Socks: lower-calf-to-feet crops. Socks are main product and should not be hidden by pants/slippers/boots.

Reference doc:

`docs/PRODUCT_IMAGE_USE_CASE_CONTRACT.md`

## Hero-First Human Loop

Current intended flow:

1. Generate hero first.
2. Send reference + hero to LINE/Admin for review.
3. Human approves or regenerates hero.
4. Support generation starts only after approved hero exists.
5. Support generation uses both real references and approved hero.
6. If real reference and hero conflict, real reference wins.

Implemented pieces:

- `lib/automation/pilot-generation-execution-plan.mjs`
- `lib/automation/live-pilot-generation-gate.mjs`
- `lib/automation/live-pilot-smoke-test.mjs`
- `lib/automation/line-client.mjs`
- `scripts/automation/send-line-hero-review.mjs`
- `server.mjs` postback handling for hero approval/regenerate paths

Important operational note:

- If LINE webhook points to Render/live service, deploy backend changes before expecting LINE postback buttons to work live.

## Current Generation Plan Snapshot

Latest dry-run plan artifact:

`/Users/supatcharoenpot/Documents/Codex/2026-06-10/files-mentioned-by-the-user-function/outputs/pilot-generation-execution-plan.json`

Latest summary:

```json
{
  "sku_count": 4,
  "ready_for_live_generation": 0,
  "needs_reference_asset_resolution": 0,
  "needs_model_input_staging": 0,
  "model_inputs_staged": 4,
  "blocked": 4,
  "planned_generation_requests": 24,
  "hero_requests": 0,
  "support_requests": 24,
  "priority_generation_requests": 8,
  "priority_support_requests": 8,
  "blocked_generation_requests": 24,
  "pending_hero_approval_for_support": 24,
  "existing_assets_matched": 12,
  "skipped_existing_slots": 4
}
```

Interpretation:

- No request is currently ready for live generation.
- Support requests are correctly blocked by `pending_hero_approval_for_support`.
- The current plan is support-only because hero assets already exist or were matched, but support cannot continue until approved hero anchors are recorded.

Example item from current plan:

```json
{
  "sku": "2BT0158000",
  "product_name": "Columbia Women's LOVELAND MID OMNI-HEAT Snow Boot",
  "brand_id": "rent_a_coat",
  "category": "รองเท้า",
  "subcategory": "รองเท้าลุยหิมะ",
  "support_shots": [
    "front_pair",
    "side_profile",
    "sole_view",
    "texture_closeup",
    "wearing_scale_cue",
    "front_fit_shape"
  ],
  "approved_hero_anchor": false
}
```

## Current LINE Status

A LINE hero review was sent earlier for 4 hero items.

Artifact:

`/Users/supatcharoenpot/Documents/Codex/2026-06-10/files-mentioned-by-the-user-function/outputs/line-hero-review-payload.json`

Current review behavior:

- Flex card has been de-emphasized for detailed QC because images can crop and hide reference detail.
- Hero review now sends LINE messages in this order per SKU:
  1. Text summary with brand/SKU/product/ref count.
  2. First reference as a full LINE image message.
  3. Hero candidate as a full LINE image message.
  4. Text action message with Quick Reply buttons.
- Quick Reply buttons:
  - `Approve hero`
  - `Regenerate`
  - `Open review page`
- `Needs review` is intentionally not part of the new hero quick flow because it does not advance the automation state clearly.
- Quick Reply buttons disappear after use in LINE, but the durable signal is saved through postback handling into Supabase/audit/automation tasks.
- `Open review page` routes to `/#review?...` in the app, where the user can compare reference images and hero with `object-fit: contain` instead of cropped Flex previews.
- The review page still requires app auth; this is intentional for now because approval/regeneration signals should be tied to an authenticated user.
- User reviews ref + hero before support.
- Buttons include approve/regenerate/review paths.
- Approving hero should create or select an approved hero anchor for later support generation.
- Support requests now attach `approved_hero_anchor` first in `model_input_files`, then `product_reference` inputs. If the approved hero exists only as a remote URL and has no local/staged file, the plan blocks with `approved_hero_anchor_requires_local_file`.

Implementation files:

- `lib/automation/line-client.mjs`
- `scripts/automation/send-line-hero-review.mjs`
- `server.mjs`
- `app.js`
- `index.html`
- `styles.css`
- `test/automation/line-client-v3.test.mjs`

Important caveat:

- The local dry-run payload may link the review page with a local `asset_id` such as `SKU:hero:local:1`; live/Supabase-backed assets should include a real `generation_id` for approval/regenerate actions to resolve cleanly.

## Google / Product Catalog State

Google Sheet source of truth:

Product Catalog sheet with columns:

- `Timestamp`
- `Staff Name`
- `SKU ID`
- product photo columns
- `Link`
- `สาขา (Branch)`
- `Process`

Important rule:

- `สาขา (Branch)` is stronger than old `target_site` or `product_type`.
- If Product Catalog says GO Mall, treat as GO Mall even if older data says rental.
- If Product Catalog says Rent A Coat, treat as Rent A Coat.
- Do not infer branch from SKU prefix alone when sheet branch exists.

Google Sheet API is enabled.

OAuth client has redirect URIs:

- `http://127.0.0.1:8765/api/google/oauth/callback`
- `https://image-workflow.onrender.com/api/google/oauth/callback`

## Reference Asset Handling

Relevant files:

- `lib/automation/reference-asset-resolution.mjs`
- `lib/automation/model-input-staging.mjs`
- `lib/automation/asset-classifier.mjs`
- `lib/automation/reference-matcher.mjs`
- `scripts/automation/resolve-reference-assets.mjs`
- `scripts/automation/stage-model-inputs.mjs`

Rules:

- Product reference images are visual truth.
- Label/tag/barcode/SKU card images can support matching but must not become visual truth.
- Generated candidates are style hints only unless specifically approved as hero anchor.
- Model input staging records local path/hash/size and keeps live generation blocked when model inputs are missing.

## WooCommerce / WordPress State

Current state: preflight foundation only.

Implemented:

- Read-only remote checks when enabled.
- Product publish preflight.
- Media manifest.
- Media mapping preflight.
- Monitoring summaries.
- LINE/Admin preflight summaries.

No live create/update/upload/attach/publish should happen yet.

Relevant files:

- `lib/automation/wordpress-site-config.mjs`
- `lib/automation/woocommerce-client.mjs`
- `lib/automation/wordpress-publish-preflight.mjs`
- `lib/automation/wordpress-media-preflight.mjs`
- `lib/automation/wordpress-preflight-monitoring.mjs`
- `lib/automation/media-asset-manifest.mjs`
- `scripts/automation/run-wordpress-product-preflight.mjs`
- `scripts/automation/run-wordpress-media-preflight.mjs`
- `scripts/automation/build-media-asset-manifest.mjs`

## Supabase State

Supabase is used as a production OS / queue / audit foundation.

Do not store Supabase keys in docs.

Supabase MCP is available as an option from the dashboard, but it is not required for normal local code changes. It can be useful later for direct database inspection/migrations if authenticated.

## Important Commands

Run tests:

```bash
npm run test:automation
```

Build generation plan:

```bash
npm run plan:generation
```

Build live generation gate:

```bash
npm run gate:generation
```

Run one generation smoke test:

```bash
npm run smoke:generation
```

Run live generation executor only when gates and confirmations are intentionally set:

```bash
npm run execute:generation
```

Send LINE hero review:

```bash
npm run send:line-hero-review
```

Build media manifest:

```bash
npm run build:media-manifest -- --assets /Users/supatcharoenpot/Documents/Codex/2026-06-10/files-mentioned-by-the-user-function/outputs/live-generation-local-assets.json
```

Note: running `npm run build:media-manifest` with no source rows creates an empty local manifest. Use `--assets` for the existing local live-test artifacts, or `--from-supabase` only when generated assets have actually been persisted to Supabase.

Run WooCommerce product preflight:

```bash
npm run preflight:wordpress
```

Run WooCommerce media mapping preflight:

```bash
npm run preflight:wordpress-media
```

## Latest Verification

Last known passing test command:

```bash
npm run test:automation
```

Result:

`128/128` automation tests passed.

Latest plan command:

```bash
npm run plan:generation
```

Result:

- Wrote `outputs/pilot-generation-execution-plan.json`
- `ready_for_live_generation: 0`
- `pending_hero_approval_for_support: 24`
- Prompt framework version in plan sample: `prompt-framework-v3.7-brand-mark-fidelity`
- Latest local media manifest source: `outputs/live-generation-local-assets.json`
- Latest media manifest summary: `asset_count: 12`, `hero_generated: 4`, `support_generated: 8`

Latest phase completed:

- `lib/automation/pilot-generation-execution-plan.mjs` now orders support `model_input_files` as approved hero first, then real product references.
- Model inputs include `source_role` values: `approved_hero_anchor` and `product_reference`.
- Added regression coverage for approved hero anchor order and remote-only approved hero blocking.
- `lib/automation/automation-worker-core.mjs` can hydrate a missing media manifest through a read-only callback when processing `generate_batch`.
- `scripts/automation/worker.mjs` now uses a Supabase SELECT-only media manifest reader so LINE `approve_hero` planning can see persisted hero/generated/approval assets when present.
- `lib/automation/supabase-media-asset-manifest.mjs` centralizes the Supabase media row reader for worker and CLI use.

## Current Worktree Note

The worktree is dirty and contains many modified/untracked files from this active multi-phase build.

Do not run destructive reset/checkout commands unless the user explicitly asks.

New/important files from recent phases include:

- `docs/HANDOFF_CURRENT.md`
- `docs/PRODUCT_IMAGE_USE_CASE_CONTRACT.md`
- `lib/automation/product-image-use-case-rules.mjs`
- `lib/automation/product-brand-mark-fidelity.mjs`
- `test/automation/product-image-use-case-rules.test.mjs`
- `test/automation/product-brand-mark-fidelity.test.mjs`
- `lib/automation/pilot-generation-execution-plan.mjs`
- `lib/automation/live-pilot-generation-gate.mjs`
- `lib/automation/live-pilot-smoke-test.mjs`
- `lib/automation/fal-image-provider.mjs`
- `scripts/automation/send-line-hero-review.mjs`

## Next Recommended Phase

Recommended next phase:

Connect the real LINE/Admin hero approval result to support generation release against live/local queue state.

Specifically:

1. Confirm approved hero anchors are persisted in the same source used by `buildPilotGenerationExecutionPlan`.
2. After hero approval, rebuild the generation plan for that SKU.
3. Confirm support requests move from `blocked_before_live_generation` to ready/gated state.
4. Ensure support `model_input_files` include:
   - approved hero as the first generated/model anchor
   - real product references after the hero anchor
5. Run one support smoke generation for a single approved SKU, ideally logo-sensitive and high quality:

```bash
FAL_IMAGE_QUALITY=high npm run smoke:generation -- --sku <SKU> --kind support --execute
```

Only do live execution after checking current script flags and environment gates. If unsure, run readiness-only first.

## How To Start A New Thread

If this thread becomes heavy, start a new thread and say:

```text
อ่าน docs/HANDOFF_CURRENT.md ใน repo image-workflow ก่อน แล้วทำ phase ถัดไปตาม Next Recommended Phase
```

Also mention the repo path:

```text
/Users/supatcharoenpot/Documents/Codex/2026-06-10/files-mentioned-by-the-user-function/work/image-workflow
```

This file is intended to replace rereading the full old conversation.
