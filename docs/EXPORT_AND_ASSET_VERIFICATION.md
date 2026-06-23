# Export and Asset Verification

เอกสารนี้เป็น current smoke path สำหรับตรวจว่า approve/export path มองเห็นได้จาก Jobs, Asset Library, Google Drive และ Monitoring โดยยังไม่เปิด WordPress/WooCommerce live write

## Scope

Implemented:
- Hero approval จาก flow เก่า `อนุมัติและบันทึก` เรียก `/api/approve` เพื่อบันทึก `approved_export` แล้วบันทึก approval ผ่าน `/api/approvals`
- Hero approval จากหน้า `#review` เรียก `/api/approvals` เพื่อบันทึก approval และปลดล็อก Support generation
- Support approval จาก manual flow เก่าเรียก `/api/approve` ต่อภาพ Support แต่ละภาพ และบันทึกเป็น `approved_export`
- Support Review ใหม่บันทึก decision set ผ่าน `/api/review/support-decisions` และสร้าง `support_candidate_manifest` กับ `media_export_preflight_gate`
- Jobs อ่านสถานะจาก `jobs`, `generations`, `approvals`, `assets`, `audit_events`
- Asset Library อ่าน `assets` และรวม `hero_generated`, `support_generated`, `approved_export` เป็น output cards
- Retry Export เป็น admin-only route: `POST /api/admin/jobs/:jobId/retry-export`

Production verified manually:
- Google Drive link ที่ถูกบันทึกใน `approved_export.public_url` แสดงเป็น export link ใน Jobs และ Asset Library
- Supabase Storage warning ที่มี Google Drive export สำเร็จแล้วต้องถือเป็น warning ไม่ใช่ failure

Pending:
- หน้า `#review` ที่กด approve Hero ยังไม่ทำ Google Drive export ทันที เพราะ route นี้มีหน้าที่บันทึก approval และปลดล็อก Support เท่านั้น
- Support Review ใหม่ยังเป็น preflight/export gate ไม่ใช่ WordPress live write

Explicitly out of scope:
- WordPress/WooCommerce live create/update/publish
- Media upload/attach/replace เข้า WordPress
- เปลี่ยน Prompt Framework rules
- เปลี่ยน Google OAuth flow ใหญ่

## Manual Smoke Path

### 1. Hero approve จาก flow เก่า

1. เปิดหน้า workflow เดิม
2. กรอกข้อมูลสินค้าและสร้าง Hero
3. กด `อนุมัติและบันทึก`
4. คาดหวัง:
   - `/api/approve` สำเร็จ
   - ถ้า Google Drive พร้อม ต้องได้ `googleDriveFile.webViewLink`
   - `/api/approvals` บันทึก approval ซ้ำได้แบบ idempotent
   - Jobs แสดง `อนุมัติแล้ว`
   - Jobs แสดง `เปิดไฟล์ส่งออก` ถ้ามี Drive/export link
   - Asset Library filter `approved` เห็นภาพ `approved_export`

### 2. Hero approve จาก Batch Review / Hero Review

1. เปิด deep link `#review?batch_id=<batchId>&sku=<sku>&generation_id=<generationId>`
2. กด approve Hero
3. คาดหวัง:
   - `/api/approvals` สำเร็จ
   - Jobs เปลี่ยนเป็น `อนุมัติแล้ว`
   - Support generation ถูกปลดล็อกตาม gate rules
   - ยังไม่ต้องมี export link ถ้ายังไม่ได้เข้า export/preflight phase

### 3. Support approve

Manual flow เก่า:
1. สร้าง Support หลัง Hero approved
2. กด `อนุมัติภาพ Support`
3. คาดหวัง:
   - แต่ละภาพเรียก `/api/approve`
   - Asset Library เห็น `approved_export`
   - ถ้ามี Drive link ให้เปิดได้จาก Jobs/Asset Library

Batch/Support Review ใหม่:
1. เปิดหน้า `#review` ที่มี Support assets
2. เลือก `อนุมัติภาพนี้` สำหรับภาพที่ผ่าน
3. กดบันทึกผลตรวจ Support
4. คาดหวัง:
   - `/api/review/support-decisions` บันทึก decision set
   - batch item metadata มี `support_review_decision_state`
   - ถ้าครบเงื่อนไข จะมี `support_candidate_manifest`
   - จะมี `media_export_preflight_gate`
   - Monitoring เห็น preflight/gate event

### 4. Google Drive disconnected

1. ปิด/ถอด Google Drive token หรือใช้ env ที่ไม่มี root folder
2. กด approve/export
3. คาดหวัง:
   - UI แสดงข้อความปลอดภัย เช่น `Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน`
   - response ไม่แสดง OAuth token หรือ provider payload
   - Monitoring/Audit มี `google_drive_export_failed`
   - Admin แก้ด้วยการเชื่อม Google Drive ใหม่ แล้วค่อย Retry Export

### 5. Retry Export

1. ใช้ admin account เท่านั้น
2. เปิด Jobs งานที่ approved/generated แต่ไม่มี export link
3. กด `ส่งออกอีกครั้ง`
4. คาดหวัง:
   - staff account ต้องถูกปฏิเสธโดย server
   - admin สำเร็จเมื่อพบ source image
   - ถ้ามี `approved_export` ที่มี export link อยู่แล้ว route ต้อง skip และไม่สร้าง final asset ซ้ำ

## WordPress Guard Status

WordPress/WooCommerce ยังเป็น preflight only:
- `WORDPRESS_DRY_RUN=true` ควรเป็นค่า production pilot
- `WORDPRESS_LIVE_WRITES_ENABLED=false` ต้องคงไว้
- `wordpress_product_publish_preflight` และ `wordpress_media_mapping_preflight` ต้องคืน proposal/checklist เท่านั้น
- ห้ามมี `publish_now`, `attach_media`, `replace_media`, `live_write_allowed: true`

## Failure Handling

- `google_drive_disconnected`: ให้ admin reconnect Google Drive แล้ว Retry Export
- `export_failed`: ให้ admin ตรวจ Drive permission/folder แล้ว Retry Export
- Supabase Storage fail แต่ Google Drive export สำเร็จ: แสดง warning และให้ใช้ Drive link เป็น source of truth สำหรับ output
- `approved_export` ไม่มี public/export URL: ถือว่า retryable
- WordPress preflight blocked: แก้ media/reference/manifest ก่อน ห้ามเปิด live write เพื่อข้าม gate

## Monitoring Checklist

หลัง deploy ให้ monitor:
- จำนวน `google_drive_export_failed`
- จำนวน `export_retry_skipped` เพื่อดูว่ามีการกดซ้ำหรือ webhook/UI เรียกซ้ำหรือไม่
- จำนวน `storage_upload_failed` ที่ resolved by Drive
- งานที่ `approvalStatus=approved` แต่ `exportStatus=not_exported`
- WordPress preflight events ต้องยังไม่มี live write event
