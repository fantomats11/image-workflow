# Web-first Single-SKU Smoke Test

Last updated: 2026-06-23

ใช้ checklist นี้สำหรับ smoke แบบ Web-first 1 SKU หลังมี SKU picker/reference readiness path แล้ว ห้ามใช้ checklist นี้เป็นหลักฐาน production-ready ถ้ายังไม่ได้รันบน production จริง

## Preconditions

- `WORDPRESS_DRY_RUN=true`
- `WORDPRESS_LIVE_WRITES_ENABLED=false`
- ไม่มีการเปิด WooCommerce live publish
- ใช้ 1 SKU เท่านั้น
- ห้ามส่ง LINE batch
- ห้าม confirm batch
- ห้าม multi-SKU execution
- Staff/admin ต้อง login web ก่อน

## Smoke metadata

| Field | Value |
| --- | --- |
| Date/time | |
| Tester | |
| Role | |
| Production URL | |
| Commit/version | |
| SKU | |
| Branch/source | |
| Category | |

## Checklist

### 1. Login

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Admin login works | |
| Staff login works | |
| Staff does not see admin-only controls | |

### 2. Select SKU from picker

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| `GET /api/catalog/sku-search?q=<sku>` requires login | |
| Empty query does not return the whole catalog | |
| Search by SKU works | |
| Search by product name works | |
| Search by branch/source works from catalog data | |
| Filter by branch/source works | |
| Filter by category works | |
| Only one SKU selected | |
| Canonical product data appears | |
| Selected SKU fills existing form fields | |
| `reference_readiness` appears before Generate Hero | |
| `GET /api/catalog/sku/:sku/references` requires login | |

Expected:

- Staff selects one SKU, not a batch
- Staff does not need to type long product data manually
- Locked fields from clean/matched catalog are not casually editable
- Product brand/color may remain manual or `needs_mapping` if not present in catalog snapshot

### 3. Verify canonical product data

| Field | Result | Evidence / Notes |
| --- | --- | --- |
| SKU | |
| product name | |
| branch/source | |
| category/subcategory | |
| reference URL/Drive id | |
| Woo status if available | |
| Drive/export status if available | |

No-Go:

- SKU/product data is blank after selecting SKU
- Branch/source conflicts with catalog data
- Staff must manually guess brand/category/reference

### 4. Inspect references

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Product reference images visible or link opens | |
| Reference cards load from catalog/Drive | |
| Reference cards do not expose secret/token/provider payload | |
| Stageable cards show “ใช้กับ Hero ได้” | |
| Reference readiness visible | |
| Missing reference blocker visible when applicable | |
| Tag/barcode/SKU card warning visible | |
| Staff can identify which images are visual truth | |
| Staff can click `ใช้ reference ชุดนี้กับ Hero` | |
| UI shows staged reference count | |
| If selected SKU is blocked, Generate Hero is disabled/blocked | |

Expected:

- Product photos are the visual truth
- Tag/barcode/SKU card can support metadata only
- If references are missing, Generate Hero is blocked or clearly marked No-Go
- Current PR17 path shows catalog/Drive reference cards and can stage `stage_available` references into Generate Hero
- If no card is `stage_available`, staff must use manual product image upload fallback

### 5. Generate Hero

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Generate Hero clicked once | |
| Request uses one SKU metadata | |
| Reference inputs are present | |
| If staged catalog references are used, request sends `catalogReferenceSku` + `catalogReferenceKeys`, not raw arbitrary URL | |
| Request handler returns/polls normally | |
| Hero generated | |

No-Go:

- Live generation starts for more than one SKU
- Generate uses tag/barcode/SKU card as visual truth
- Prompt/source data includes invented product facts

### 6. Open Hero review

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Hero review opens | |
| Hero candidate visible | |
| Product references visible | |
| Staff can compare Hero against references | |

### 7. Approve Hero

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Hero approved once | |
| Duplicate approve avoided | |
| `approved_hero_anchor` persisted | |
| Jobs/Asset Library reflects Hero status | |

No-Go:

- Support unlocks before Hero approval
- Approval does not persist anchor/evidence

### 8. Generate Support

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Support blocked before Hero approval | |
| Support unlocks after Hero approval | |
| Support uses approved Hero first if pipeline exposes input order | |
| Product references follow approved Hero if pipeline exposes input order | |
| Support generated for selected shot set only | |

No-Go:

- Support generates without approved Hero
- Input first item is not approved Hero when using support pipeline
- More than one SKU generates

### 9. Review / approve Support

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Support review opens | |
| Support assets visible | |
| Approve/regenerate/reject decision works | |
| Support approval saved | |
| Candidate/media manifest or export gate created if applicable | |

### 10. Export / Drive

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Export attempted | |
| Google Drive link created or safe failure shown | |
| Jobs reflects final state | |
| Asset Library reflects final state | |
| Retry export duplicate guard if tested | |

Expected:

- Drive is the first pilot output
- Failed export must show recovery path
- Failed export must not look like success

### 11. WordPress/WooCommerce preflight proposal

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Product preflight proposal generated or blocker shown | |
| Media mapping proposal generated or blocker shown | |
| SEO filename proposal visible | |
| Alt text proposal visible | |
| Duplicate guard key visible in debug/admin evidence only | |
| No WordPress/WooCommerce live write | |
| No WooCommerce product publish | |

Expected:

- Preflight/proposal only
- No media upload/attach
- No create/update/publish product

### 12. SEO metadata proposal

| Field | Result | Evidence / Notes |
| --- | --- | --- |
| sanitized filename | |
| media title | |
| `alt_text` | |
| caption | |
| description | |
| source SKU | |
| image role | |
| duplicate guard key | |

Expected filename:

```text
<sku>-<brand>-<product-name>-<color>-<image-role>.webp
```

Expected alt text:

```text
<Brand> <color> <product type> with <key feature>, <view/role>
```

No-Go:

- Keyword stuffing
- Metadata includes facts not present in sheet/reference
- Filename includes secret/private ids

## Final decision

| Field | Value |
| --- | --- |
| Go / Soft Go / No-Go | |
| Decision maker | |
| Timestamp | |
| Notes | |

## Hard No-Go

- Staff cannot select one SKU from source-of-truth picker
- Selected SKU does not carry canonical product data
- Reference readiness is missing or unclear
- Hero can generate without usable product reference
- Support can generate without approved Hero
- Support input order violates approved Hero anchor requirement
- WordPress/WooCommerce live write occurs
- WooCommerce product publish occurs
- Multi-SKU generation occurs
- Operator cannot tell next action from the UI
