# Web-first Single-SKU Pilot

Last updated: 2026-06-23

เอกสารนี้กำหนด pilot path ปัจจุบันของ `image-workflow` หลัง PR15: เริ่มจากเว็บ, เลือก SKU เดียว, ตรวจ reference, สร้าง Hero/Support, export ไป Drive และทำ WordPress/WooCommerce preflight proposal เท่านั้น

## Current pilot decision

Current recommended pilot path:

```text
Login web
-> เลือก SKU เดียวจาก clean/matched sheet หรือ catalog snapshot
-> ตรวจ reference
-> Generate Hero
-> QC / Approve Hero
-> Generate Support
-> QC / Approve Support
-> Export/Drive
-> WordPress/WooCommerce preflight proposal
-> admin-only staged publish ใน phase ถัดไป
```

LINE-first automation ยังอยู่ใน repo แต่ถูก defer เป็น phase ถัดไปจนกว่า dedicated worker service และ production smoke พร้อมกว่าเดิม

LINE role ชั่วคราว:

- notification surface
- review link delivery
- ไม่ใช่ editor หลัก
- ไม่ใช่ primary pilot path
- LINE webhook ห้ามทำ long-running generation

## Operating rules

- 1 active generation job ต่อ 1 SKU
- ห้าม multi-SKU execution ใน pilot นี้
- Staff เลือก SKU จาก source of truth ไม่ควรกรอกข้อมูลสินค้าเองยาว ๆ
- Clean/matched sheet หรือ catalog snapshot เป็น source of truth สำหรับ SKU/product data
- Product references ชนะ generated images ถ้าข้อมูลขัดกัน
- ห้ามใช้ tag, barcode, SKU card, care label หรือป้ายราคาเป็น visual truth ของสินค้า
- WordPress/WooCommerce live write ยังปิด
- WooCommerce publish เป็น future admin-only gate

## Current Web-first audit

จากโค้ดปัจจุบัน:

Implemented:

- Login/admin/staff ผ่าน Supabase session และ profile checks
- Web SKU picker แบบ read-only ใช้ `GET /api/catalog/sku-search?q=...`
- Reference detail แบบ read-only ใช้ `GET /api/catalog/sku/:sku/references`
- SKU picker โหลดจาก catalog snapshot และเลือกได้ 1 SKU ต่อครั้ง
- Selected SKU เติม `productSku`, branch/CI profile, category/subcategory, `imageReference` และ `feature_notes` เท่าที่ catalog มีจริง
- หน้า manual create แสดง reference readiness ก่อน Generate Hero
- หน้า manual create แสดง reference cards จาก catalog/Drive และ CTA `ใช้ reference ชุดนี้กับ Hero`
- ถ้า selected SKU มี reference readiness เป็น `blocked` และไม่มี manual upload/staged reference, Generate Hero ถูก block ด้วยข้อความ staff-safe
- Manual Hero generation สามารถใช้ staged catalog/Drive references โดยส่ง `catalogReferenceSku` + `catalogReferenceKeys` ให้ server resolve จาก catalog อีกชั้น
- Manual web form มี `productSku`, `brandName`, category, image type, product/model uploads
- Manual Hero generation ใช้ `/api/generate/start` และ `/api/generate/jobs/:jobId`
- Manual Hero approve/export เก่าใช้ `/api/approve`
- Review page ใช้ `#review?generation_id=...` และ `/api/review/hero`
- Web Hero approval ใช้ `/api/approvals`
- Support generation ใน manual UI ถูก block จนมี approved Hero และ QC ครบ
- Support prompt ใช้ approved Hero URL เป็น image input แรกใน manual UI
- Support Review ใหม่ใช้ `/api/review/support-decisions` สำหรับ batch-backed support assets
- Jobs และ Asset Library แสดง generated/approved/export assets
- WordPress/WooCommerce มี preflight modules และ live write guard

Not implemented / blocker:

- ถ้า Google Drive/OAuth/proxy config ไม่พร้อม หรือ reference card ไม่ `stage_available`, staff ยังต้อง upload product reference images เอง
- หน้า manual create ใช้ classifier/metadata เพื่อกัน tag/barcode/SKU card เท่าที่ระบบแยกได้ แต่ยังต้อง manual visual truth check ก่อน Generate Hero
- Support Review ใหม่ผูกกับ batch item metadata เป็นหลัก ไม่ใช่ standalone single-SKU job เต็มรูปแบบ
- WordPress/WooCommerce proposal ยังเหมาะกับ batch item/media manifest มากกว่า standalone single-SKU web job

Conclusion:

- Current web app ทำ manual Hero -> approve -> Support -> approve/export ได้
- Current web app มี SKU picker + canonical autofill + reference readiness + Drive/catalog reference cards แล้ว
- Current web app สามารถใช้ staged catalog/Drive reference กับ Generate Hero ได้เมื่อ reference card เป็น `stage_available`
- Manual product image upload ยังเป็น fallback เมื่อ Drive reference ยัง stage ไม่ได้

## SKU Picker contract

Source of truth:

- Primary: clean/matched sheet หรือ catalog snapshot ที่ derive จาก Product Catalog sheet
- Current packaged snapshot: `data/automation/line-keyword-generation-catalog.csv`
- Current Web API: `GET /api/catalog/sku-search?q=<query>&limit=20`
- Current Reference API: `GET /api/catalog/sku/:sku/references`
- Current helper: `lib/automation/web-sku-picker-catalog.mjs`
- Existing runtime reader: `lib/automation/line-keyword-batch-intake.mjs`
- Existing refresh scripts:
  - `scripts/automation/refresh-product-catalog-sheet-references.mjs`
  - `scripts/automation/refresh-reference-folder-lookup.mjs`

Required search:

- search by SKU
- search by product name
- search by brand
- filter by branch/source: Rent A Coat / GO Mall
- filter by category

Selected SKU must return canonical product data:

| Field | Source status |
| --- | --- |
| `sku` | ready from catalog snapshot |
| `product_name` | ready from catalog snapshot |
| `category` | ready from catalog snapshot |
| `subcategory` | ready from catalog snapshot |
| `feature_notes` | ready from catalog snapshot |
| `reference_url` | ready from catalog snapshot |
| `reference_drive_id` | ready from catalog snapshot |
| `reference_lookup_strategy` | ready from catalog snapshot |
| `reference_verified` | ready from catalog snapshot |
| `generation_status` | ready from catalog snapshot |
| `reference_branch` | ready from catalog snapshot |
| `reference_brand_id` | ready from catalog snapshot |
| `reference_target_site` | ready from catalog snapshot |
| `source_file` / `source_row` | ready from catalog snapshot |
| product brand display name | `needs_mapping` |
| product color | `needs_mapping` |
| price | `needs_mapping` |
| stock/status | `needs_mapping` |
| Woo product id/status | `needs_mapping` unless remote read/check exists |
| Drive/export status | `needs_mapping` from Jobs/Assets/export state |

Fields staff should not edit if they came from clean sheet:

- SKU
- product title/name
- branch/source
- category/subcategory
- reference Drive folder/file id
- reference lookup strategy
- Woo product id/status when present

Staff may add operational notes only:

- QC note
- generation note
- support shot preference
- manual blocker note

Reference readiness contract:

```json
{
  "sku": "R24CBF0013",
  "reference_readiness": {
    "status": "ready",
    "label_th": "มีภาพอ้างอิงพร้อมใช้",
    "source": "product_catalog_sheet",
    "drive_folder_id": "...",
    "blockers": []
  }
}
```

Missing reference message:

```text
SKU นี้ยังไม่มีภาพอ้างอิงสินค้าที่ใช้สร้างได้ กรุณาเพิ่ม/ตรวจ reference ก่อน Generate Hero
```

Tag/barcode/SKU card warning:

```text
ภาพ tag, barcode, SKU card หรือป้ายข้อมูลใช้ตรวจ metadata ได้เท่านั้น ห้ามใช้เป็น visual truth ของตัวสินค้า
```

## Reference review requirement

ก่อน Generate Hero, staff/admin ต้องเห็น:

- product reference images
- reference readiness
- missing reference blocker
- warning ถ้า reference set มี tag/barcode/SKU card
- ข้อความว่า product references ชนะ generated images ถ้าข้อมูลขัดกัน

Current status:

- Review page แสดง reference images สำหรับ batch-backed review แล้ว
- Manual create page แสดง reference readiness จาก SKU picker และ reference cards จาก catalog/Drive
- Manual create page ให้ staff กดใช้ stageable Drive/catalog references กับ Hero ได้ โดย browser ส่งเฉพาะ `catalogReferenceKeys`
- Server resolve reference keys จาก catalog/Drive อีกครั้งก่อนแนบเป็น generation input; ไม่ใช้ arbitrary URL จาก user input เป็น product reference

Blocker before Web-first smoke:

- ต้องมี manual smoke ยืนยันว่า staff เห็น reference cards, ตรวจภาพจริง และ stage reference ที่ถูกต้องก่อน Generate Hero
- ถ้า reference card ไม่ `stage_available` ต้องใช้ manual upload fallback และบันทึกใน smoke evidence

## Hero approval gate

Required invariant:

- Hero ต้องผ่าน QC/Approve ก่อน Support
- approve ต้อง persist `approved_hero_anchor`
- duplicate approve ต้องไม่สร้าง duplicate approval/anchor
- ถ้า approved Hero มีแต่ remote URL และไม่มี local/staged file สำหรับ support pipeline ที่ต้องใช้ local file ต้อง block ด้วย safe error

Current status:

- Batch/review path มี `/api/approvals` และ approved hero anchor logic
- Manual UI ใช้ `approvedHeroImageUrl` เป็น in-browser state หลัง `/api/approve`
- Manual support generation ใช้ approved Hero URL เป็น image input แรก แต่ยังไม่เท่ากับ persisted automation anchor contract ทั้งหมด

## Support approval gate

Required invariant:

- Support ต้องรอ Hero approved
- Support model input index 0 ต้องเป็น `approved_hero_anchor`
- Product references ต้องตามหลัง approved Hero
- ถ้า Hero/reference conflict ให้ product references ชนะ

Current status:

- Manual UI block support จน `approvedHeroImageUrl` และ QC ครบ
- Manual UI ส่ง approved Hero URL เป็น first extra image input
- Automation pipeline มี tests สำหรับ `approved_hero_anchor` เป็น input แรก

Risk:

- Manual single-SKU support path ยังไม่ใช้ persisted `approved_hero_anchor` contract เต็มรูปแบบเหมือน automation support plan

## Export/Drive gate

Recommended pilot output:

```text
Approve Support
-> Export approved assets to Google Drive
-> Store asset/job/export evidence
-> Build WordPress/WooCommerce preflight proposal
```

Why Drive first:

- rollback ง่ายกว่า WordPress media/library
- ตรวจด้วยคนง่ายกว่า
- เป็นหลักฐานกลางว่า asset ใด approved แล้ว
- ลด risk duplicate media/product write ใน WordPress

Current status:

- `/api/approve` export path บันทึก approved/export asset และ Drive link ได้
- Support Review ใหม่สร้าง candidate/media export preflight gate
- WordPress media mapping preflight ยังไม่ upload/attach จริง

## WordPress/WooCommerce staged gates

Stages:

| Stage | Meaning | PR15 default |
| --- | --- | --- |
| `wordpress_preflight_only` | read/proposal only | enabled |
| `wordpress_media_upload_enabled` | upload media to WordPress | disabled |
| `woocommerce_draft_update_enabled` | create/update draft product | disabled |
| `woocommerce_publish_requires_admin_confirm` | publish requires admin final confirm | future |
| `woocommerce_live_publish_enabled` | publish live product | disabled |

Existing env/config:

- `WORDPRESS_DRY_RUN=true`
- `WORDPRESS_REMOTE_READS_ENABLED=false` by default
- `WORDPRESS_LIVE_WRITES_ENABLED=false`
- Woo credentials are configured through brand-prefixed env vars, but PR15 must not print or write them

PR15 policy:

- preflight only
- media upload disabled
- Woo product create/update disabled
- live publish disabled
- WordPress/WooCommerce live writes disabled

## SEO media metadata contract

For each approved image, generate a proposal only:

Required fields:

- sanitized filename
- media title
- `alt_text`
- caption
- description
- source SKU
- image role: hero, back, side, detail, lifestyle, support
- product ID/SKU mapping
- duplicate guard key

Filename pattern:

```text
<sku>-<brand>-<product-name>-<color>-<image-role>.webp
```

Alt text pattern:

```text
<Brand> <color> <product type> with <key feature>, <view/role>
```

Rules:

- ห้าม keyword stuffing
- ห้ามใส่ข้อมูลที่ไม่มีใน sheet/reference จริง
- ถ้า brand/color/key feature ไม่มี source ชัด ให้ mark `needs_mapping`
- sanitize filename เป็น lowercase, hyphenated, no credential/private id

Duplicate guard key:

```text
<sku>:<image-role>:<approved-asset-id-or-hash>
```

## WooCommerce field mapping contract

| Woo field | Current mapping status |
| --- | --- |
| SKU | ready from catalog snapshot |
| product title | ready from `product_name` |
| slug | `needs_mapping` from title/SKU sanitizer |
| short description | `needs_mapping` |
| description | `needs_mapping` |
| category | partial from `category` / `subcategory`; taxonomy id needs mapping |
| tags | `needs_mapping` |
| attributes | `needs_mapping` |
| price | `needs_mapping` |
| stock/status | `needs_mapping` |
| brand | partial from `reference_brand_id`; display brand needs mapping |
| branch/source | ready from `reference_branch` / `reference_target_site` |
| featured image | blocked until approved Hero export/media mapping |
| gallery images | blocked until approved Support export/media mapping |
| product status: draft/pending/publish | `needs_mapping`; publish disabled |

## Idempotency / duplicate guard contract

Before any future live write:

- find Woo product by SKU before create
- media upload duplicate key = SKU + image role + approved asset id/hash
- retry media upload must not duplicate
- retry product draft update must not create duplicate product
- publish repeated twice must be safe
- rollback/unpublish path must exist before live write phase
- every remote write must create audit event

## Do not open before smoke

- WordPress/WooCommerce live writes
- Woo product create/update
- Woo publish
- WordPress media upload/attach/replace
- multi-SKU generation
- LINE-first production pilot
- batch execution as primary pilot path

## Recommended next PR

Smallest useful runtime PR:

1. Add read-only SKU picker API from `data/automation/line-keyword-generation-catalog.csv`
2. Add single-SKU picker UI on web create page
3. Show reference readiness and Drive reference link/previews
4. Carry canonical product data into manual generation metadata
5. Keep generation one SKU at a time

Do not implement WordPress live writes in that PR.
