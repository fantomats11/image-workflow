# Automation Copilot Architecture

This note captures the reusable architecture for Rent A Coat / GO Mall product-image automation and future WordPress content/blog automation.

## Principle

Use one governance pattern across automation lanes:

Source -> Map/Dedupe -> Proposal/Draft -> Human Approval -> Controlled Execution -> Audit/Monitoring

The product-image lane and blog/content lane should share queue, approval, audit, and publishing guardrails, but keep schemas and prompts separate.

## Product Image Lane

Current scope:

- Rent A Coat
- GO Mall
- Product Catalog sheet
- Prompt Framework v3
- LINE/Admin approval
- WooCommerce publishing later

Source priority:

1. Product Catalog sheet row with `SKU ID`, `Link`, `สาขา (Branch)`, and `Process`.
2. Verified exact SKU folder match.
3. Manual reference.

Important mapping rule:

- Product Catalog branch overrides legacy audit `target_site` and `product_type`.
- `GO Mall` branch means GO Mall even when the audit row looks rental.
- `Rent A Coat` branch means Rent A Coat.

Default pilot selection:

- 2 SKU per brand.
- Prefer Product Catalog sheet rows.
- Prefer rows with branch metadata.
- Prefer `Process = FALSE`.

## Content / Blog Lane

Future scope:

- Topic intake
- Outline/draft
- SEO title/meta/slug
- Category/tag reuse
- WordPress draft/schedule/publish

Blog flow:

1. Gather topic, audience, tone, length, keyword.
2. Draft structured HTML.
3. Propose SEO metadata.
4. Confirm before WordPress draft creation.
5. Confirm again before schedule/publish.
6. Audit every write.

## Shared Guardrails

Never perform production writes without explicit approval.

Before WordPress/WooCommerce writes:

- Fetch current remote state.
- Check duplicate SKU/slug/category/tag/media.
- Reuse existing taxonomy when possible.
- Produce a change summary.
- Use idempotency/dedupe keys.
- Log remote ids and write result.

## Phase: WordPress / WooCommerce Publish Preflight

Current phase starts with preflight only. It does not create, update, attach media, schedule, or publish anything on WordPress/WooCommerce.

When a LINE batch approval is recorded, the system queues:

1. `generate_batch` for the existing dry-run generation path.
2. `wordpress_product_publish_preflight` for a guarded WooCommerce proposal.

The preflight task produces:

- item count and blocked count
- proposed action per SKU, such as `create_draft_product` or `skip_existing_sku`
- required remote checks before any real write
- optional read-only WooCommerce remote checks when `WORDPRESS_REMOTE_READS_ENABLED=true`
- explicit `live_write_allowed: false`
- explicit `requires_final_confirmation: true`

This keeps the architecture aligned with Draft -> Confirm -> Write -> Audit while still preventing accidental live publishing.

Review surfaces:

- LINE receives a WooCommerce Preflight flex summary after the embedded worker completes a preflight task, when LINE is configured.
- Admin Monitoring exposes `wordpressPreflights`, sourced from completed `automation_tasks.payload.preflight`.
- Both surfaces are read-only summaries. They must not add publish/create/update actions in this phase.

Manual runner:

```bash
npm run preflight:wordpress
```

Optional read-only remote checks:

```bash
WORDPRESS_REMOTE_READS_ENABLED=true npm run preflight:wordpress -- --remote-checks
```

Live writes remain disabled unless a future phase adds a separate final-confirmation write task and `WORDPRESS_LIVE_WRITES_ENABLED=true`.

## Phase: WordPress Media Mapping Preflight

Current media phase creates a proposal/gap report only. It does not upload media, attach media, replace galleries, or update WooCommerce products.

Before media mapping, build a generated/approved media manifest:

```bash
npm run build:media-manifest
```

Read-only Supabase source mode:

```bash
npm run build:media-manifest -- --from-supabase
```

The manifest output is `outputs/generation-approval-media-manifest.json`. It normalizes `assets`, `jobs`, `generations`, and `approvals` into SKU-level hero/support media candidates.

The media mapping preflight produces:

- expected hero and support/gallery slots per SKU
- matched generated/approved media assets when a media manifest is supplied
- missing hero/support gaps when assets are not available yet
- product-preflight blockers carried forward from the WooCommerce product preflight
- explicit `live_write_allowed: false`
- explicit `requires_final_confirmation: true`

Manual runner:

```bash
npm run preflight:wordpress-media
```

Optional media manifest:

```bash
npm run preflight:wordpress-media -- --media-manifest /path/to/media-assets.json
```

The embedded worker can queue `wordpress_media_mapping_preflight` after `wordpress_product_publish_preflight` completes. This is still a dry-run proposal and should be treated as a checklist before any future media upload/attach phase.

## Current Implementation Touchpoints

- `lib/automation/product-catalog-sheet-refresh.mjs`
- `lib/automation/wordpress-site-config.mjs`
- `lib/automation/woocommerce-client.mjs`
- `lib/automation/automation-worker-core.mjs`
- `lib/automation/wordpress-media-preflight.mjs`
- `lib/automation/wordpress-publish-preflight.mjs`
- `lib/automation/wordpress-preflight-monitoring.mjs`
- `lib/automation/pilot-selector-v3.mjs`
- `lib/automation/brand-profiles-v3.mjs`
- `lib/automation/prompt-framework-v3.mjs`
- `lib/automation/batch-registry.mjs`
- `lib/automation/line-client.mjs`
- `lib/automation/media-asset-manifest.mjs`
- `scripts/automation/create-pilot-batch.mjs`
- `scripts/automation/build-media-asset-manifest.mjs`
- `scripts/automation/refresh-product-catalog-sheet-references.mjs`
- `scripts/automation/run-wordpress-product-preflight.mjs`
- `scripts/automation/worker.mjs`

## Agent Skill

The companion Codex skill lives at:

`~/.codex/skills/rent-a-coat-go-mall-automation/SKILL.md`

Use that skill when starting new automation work so agents preserve the branch mapping, approval, and publishing guardrails.
