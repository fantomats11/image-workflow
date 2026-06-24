# Image Workflow Research Application

Source reviewed: `/Users/supatcharoenpot/Downloads/แนวทางพัฒนา Image Workflow.docx`

This note turns the research document into an implementation map for the current
`image-workflow` system. It is intentionally scoped to product-image workflow
work and keeps live WordPress/WooCommerce writes behind explicit confirmation.

## Useful Research Points

The document is most useful in five areas:

- Drive reference architecture: stop treating Google Drive URLs as direct model
  inputs. Resolve real image files, stream them with Drive API `alt=media`, and
  stage them into a stable CDN-backed store before AI generation.
- SKU workflow state: use optimistic concurrency rather than long database locks
  when multiple staff members can touch the same SKU.
- Frontend workflow design: keep the operator path simple, make status visible,
  and use modern responsive layout primitives for review/QC surfaces.
- AI generation integration: long-running image generation needs asynchronous
  progress, resumable state, and explicit Hero -> QC -> Support gates.
- Export gateway: approved images should flow to Google Drive archive and
  WooCommerce media/product preflight with a clear `Hero position 0` and ordered
  support gallery mapping.

## Already Aligned

- Auth and app readiness already rely on Supabase session/profile checks.
- The current create flow now uses exact SKU lookup first, shows product summary,
  and loads Drive references asynchronously.
- Google Drive reference listing now resolves direct images, nested folders,
  shortcuts, and public-folder fallback.
- Server code already uses Drive API `files.get(... alt: "media")` in the
  Drive media paths.
- Generated and approved images already have Supabase Storage persistence paths.
- Automation tasks already use `locked_by`, `locked_at`, attempts, and
  dedupe keys for worker-side claiming.
- WooCommerce work is already guarded by preflight/proposal paths rather than
  live write execution.
- Hero-first flow is already treated as a gate before Support generation.

## Highest-Value Next PRs

### PR 1: Drive Reference Staging To Supabase

Goal: make catalog Drive references usable by generation without user upload.

Scope:

- Add a backend staging service that takes resolved Drive file ids from the
  catalog reference resolver.
- Stream image bytes via Google Drive API `alt=media`.
- Upload to Supabase Storage bucket such as `product-references`.
- Return staged image records with `public_url` or signed URL, content type,
  file size, source Drive id, source SKU, and staging status.
- Make the web create flow prefer staged reference URLs when building Hero model
  inputs.
- Keep Drive folder URLs out of provider inputs.

Acceptance checks:

- A SKU with a Drive folder can generate Hero without manual upload.
- Label/tag/SKU-card files remain blocked as visual truth.
- Re-running staging is idempotent and does not duplicate storage objects.
- If staging fails, the UI says exactly which layer failed: Drive permission,
  no product images, Supabase Storage, or provider input readiness.

### PR 2: Product Summary And Reference Inspection UX

Goal: make staff understand what the system found before generation.

Scope:

- Add a compact product summary block after exact SKU selection.
- Show source fields: branch, category, product name, feature notes, Drive
  folder link, reference file count, stageable count, blocked count.
- Show staged reference cards before Hero creation.
- Move manual upload controls into an explicit fallback section.
- Remove or collapse fields that are already filled from catalog by default.

Acceptance checks:

- Staff can choose SKU and press Create Hero with no extra required selections
  when catalog references are staged.
- The screen clearly says whether references are ready, loading, blocked, or
  require manual fallback.

### PR 3: Optimistic SKU Work Claim

Goal: prevent two staff members from processing the same SKU at the same time.

Scope:

- Add workflow-state fields or a dedicated SKU work table with `version`,
  `locked_by`, `locked_at`, `status`, and optional `expires_at`.
- Add an API endpoint that claims a SKU only when submitted `version` matches.
- Return a graceful conflict response when another staff member already claimed
  the SKU.
- Surface claim status in `#create`, `#next`, and job center.

Acceptance checks:

- Two concurrent claim attempts for the same SKU result in one winner.
- The losing operator sees who/what is holding the work, without a hanging UI.
- Stale claims can expire or be released by an admin.

### PR 4: QC Review Layout Upgrade

Goal: make Hero and Support QC faster and less error-prone.

Scope:

- Use a comparison-first review surface: generated image, selected references,
  checklist, and action buttons in one stable layout.
- Keep Hero approval separate from Support approval.
- Add visible reason fields for reject/regenerate.
- Keep keyboard/tab flow and mobile/desktop behavior predictable.

Acceptance checks:

- Hero review cannot accidentally approve Support.
- Staff can compare product reference vs generated result without scrolling
  between far-apart panels.
- Regeneration decisions persist as structured review actions.

### PR 5: Dual Export Gateway Hardening

Goal: turn approved assets into a reliable Drive and WooCommerce handoff.

Scope:

- Keep Google Drive export as the archive path.
- Keep WooCommerce product/media mapping as preflight first.
- Map Hero to WooCommerce `images[0]` / `position: 0`.
- Map Support images to ordered gallery positions.
- Add retry/backoff around remote media fetch checks.
- Only allow live create/update/publish after a final explicit confirmation.

Acceptance checks:

- Preflight shows proposed main image and gallery order per SKU.
- Existing WooCommerce SKU/media conflicts are shown before any write.
- Live write flags remain off by default.

## Not Recommended Yet

- Do not introduce Render Postgres + FDW until there is a measured reason to
  split product data away from the current source-of-truth path.
- Do not enable WooCommerce write permissions or publish actions as part of the
  reference-staging PR.
- Do not use Google Drive direct-download URL rewriting as the primary path for
  provider inputs.
- Do not combine Drive staging, concurrency control, QC redesign, and
  WooCommerce writes into one PR.

## Suggested Build Order

1. Drive reference staging to Supabase.
2. Product summary and reference inspection UX cleanup.
3. Exact SKU work claim with optimistic concurrency.
4. QC review layout upgrade.
5. Export gateway hardening and final confirmation gates.

The first two PRs directly address the current operator pain: choose SKU, see
what the system found, and create Hero without manual upload when catalog Drive
references are valid.
