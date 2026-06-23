# Rollback And Incident Playbook

Last updated: 2026-06-23

เอกสารนี้ใช้เมื่อต้องหยุด pilot, rollback, หรือแก้ incident ของ `image-workflow` โดยไม่เดา flow เอง และไม่เปิด WordPress/WooCommerce live write

## First Response Rules

1. หยุดให้ staff กดซ้ำถ้ามีความเสี่ยง duplicate generation/export
2. Capture เวลา, user, SKU, batch id, job id, generation id, page URL, screenshot
3. เปิด `/api/health` และบันทึกเฉพาะ safe fields
4. ตรวจ Render web + worker logs โดยห้าม copy secret/token/key ลงเอกสาร
5. ตรวจ Jobs/Monitoring ก่อนแก้ DB ตรง
6. ถ้าเกี่ยวกับ live generation/cost ให้ปิดหรือหยุด worker ก่อน retry จำนวนมาก

## Rollback Decision

Rollback release ถ้าเจอข้อใดข้อหนึ่ง:

- Login/logout ใช้ไม่ได้ต่อเนื่อง
- Staff เห็น admin-only page/API
- LINE webhook รับไม่ได้หรือ signature guard ผิด
- Worker duplicate task หรือ generate ซ้ำหลายงาน
- Approve Hero ทำให้ Support unlock ผิด invariant
- `/api/health` leak secret หรือรายงาน worker/live guard ผิด
- WordPress/WooCommerce live write ถูกเปิดโดยไม่ได้ตั้งใจ

Rollback steps:

1. แจ้งทีมให้หยุดส่ง `BATCH` หรือกด approve/retry ชั่วคราว
2. ใน Render rollback ไป deploy ล่าสุดที่ผ่าน smoke
3. Restart web และ worker service
4. เปิด `/api/health` ตรวจ worker mode และ WordPress guard
5. รัน `npm run e2e:readiness` ใน environment ที่เหมาะสม
6. ทดสอบ login/admin/staff/LINE small batch อีกครั้ง
7. แจ้งทีมเมื่อกลับมาใช้งานได้

## Incident: Generation Fail หลายงาน

สัญญาณ:

- Jobs มี `failed` หลายรายการในช่วงสั้น
- Worker logs มี provider failure ซ้ำ
- `e2e:readiness` หรือ live gate มี fail

ทำทันที:

1. หยุดให้ staff กด confirm/retry เพิ่ม
2. ตรวจ `FAL_KEY` presence ใน `/api/health` เฉพาะ boolean `falConfigured`
3. ตรวจ `AI_GENERATION_LIVE_ENABLED`, `AI_GENERATION_DRY_RUN`
4. ตรวจ plan/gate:

```bash
npm run e2e:readiness
npm run gate:generation
```

Recovery:

- ถ้า provider down ให้รอและ retry เฉพาะงานเดียวก่อน
- ถ้า input/reference block ให้แก้ reference หรือ approve Hero anchor ก่อน
- ถ้า fail หลัง deploy ใหม่ ให้ rollback

ห้าม:

- ห้ามกด retry หลายงานพร้อมกัน
- ห้าม bypass approved Hero anchor
- ห้ามเปลี่ยน Prompt Framework เพื่อแก้เฉพาะหน้าโดยไม่มี test

## Incident: LINE Postback พัง

สัญญาณ:

- กด Batch Review/Cancel/Confirm จาก LINE แล้วไม่มีผล
- LINE ตอบ error หรือไม่ตอบ
- Invalid signature ไม่ถูก reject

ทำทันที:

1. ตรวจ LINE webhook URL ใน LINE Official Account Manager
2. ตรวจ `/api/health` field `line_configured`
3. ตรวจ logs เฉพาะ error code ไม่ copy token
4. ทดสอบ command เล็ก:

```text
BATCH รองเท้า=1
```

Recovery:

- ถ้า signature/env ผิด ให้แก้ Render env แล้ว restart web
- ถ้า postback duplicate ให้ตรวจ dedupe key และ batch/task status
- ถ้า LINE ใช้ไม่ได้ชั่วคราว ให้เปิด Batch Review จาก URL ใน Jobs/Admin แทน

Rollback:

- Rollback ถ้า release ใหม่ทำให้ LINE webhook 4xx/5xx ต่อเนื่องหรือ postback ไม่ persist action

## Incident: Worker Duplicate/Stuck

สัญญาณ:

- `/api/health.worker_mode = multiple_workers`
- งาน `running` ค้างนาน
- task เดียวมีผลลัพธ์ duplicate

ทำทันที:

1. เปิด `/api/health`
2. ตรวจ:
   - `worker_mode`
   - `embedded_worker_enabled`
   - `dedicated_worker_expected`
   - `automationWorker.queueSafety`
3. ถ้าเห็น `multiple_workers` ให้ปิด `AUTOMATION_EMBEDDED_WORKER` บน web และ restart web
4. ตรวจ Render worker service ว่ารัน `npm run worker`

Recovery:

- ใช้ admin Monitoring/Recovery ถ้ามี action พร้อม
- ถ้างาน stuck ให้ mark failed/retry ตามคู่มือ admin หลังตรวจว่าไม่มี worker กำลังทำอยู่
- ถ้ามี duplicate final asset ให้หยุด retry แล้วให้ dev ตรวจ dedupe key และ provider request id

## Incident: Google Drive Export Fail

สัญญาณ:

- Approve แล้วไม่มี Open Drive
- Monitoring ขึ้น `google_drive_disconnected` หรือ `google_drive_export_failed`
- `/api/health.google_drive_connected=false`

ทำทันที:

1. Admin เข้า Settings แล้ว reconnect Google Drive OAuth
2. ตรวจ folder permission ของ `GOOGLE_DRIVE_ROOT_FOLDER_ID`
3. ตรวจว่า `GOOGLE_DRIVE_AUTH_MODE=oauth`
4. ตรวจ Asset Library ว่ามี preview/local fallback หรือไม่

Recovery:

- ถ้า approved/generated source ยังอยู่ ให้ admin ใช้ Retry Export
- ถ้า Supabase Storage fail แต่ Drive สำเร็จ ให้ถือเป็น warning ไม่ใช่ failure
- ถ้า Drive disconnected ให้หยุดนับงานนั้นว่า exported จนกว่าจะมี Drive link หรือ warning ชัดเจน

Rollback:

- Rollback เฉพาะเมื่อ release ใหม่ทำให้ export fail ทั้งระบบหรือ UI แสดง export success ทั้งที่ไม่มีไฟล์

## Incident: Staff เห็น Admin Page

สัญญาณ:

- Staff เห็นเมนู Settings/Monitoring/Costs
- Staff เปิด direct hash `#settings`, `#monitoring`, `#costs` ได้
- Staff เรียก admin API แล้วได้ข้อมูลแทน 403

ทำทันที:

1. ปิด user หรือแก้ role เป็น `staff`
2. Capture screenshot และ user email
3. ตรวจ Supabase profile role/is_active
4. ทดสอบ staff direct hash ใหม่

Recovery:

- ถ้าเป็น client UI เท่านั้นแต่ API ยัง 403 ให้ deploy UI fix ก่อน rollout กว้าง
- ถ้า server API leak ให้ rollback ทันที

## Incident: Cost Spike

สัญญาณ:

- Cost dashboard estimated cost เพิ่มผิดปกติ
- Retry/generation หลายงานในช่วงสั้น
- Provider logs แสดง request มากกว่าที่ตั้งใจ

ทำทันที:

1. หยุด staff จากการ confirm/retry เพิ่ม
2. ตรวจ worker count และ queue
3. ตรวจ `AI_GENERATION_LIVE_ENABLED`, `AI_GENERATION_DRY_RUN`
4. ตรวจ Jobs ว่ามี duplicate generation หรือไม่

Recovery:

- จำกัด pilot เหลือ SKU เดียว
- ใช้ `npm run e2e:pilot-smoke -- --sku <SKU> --readiness-only` ก่อน live
- Live smoke ต้องใช้ `E2E_PILOT_CONFIRM=true` และ request เดียวเท่านั้น

Rollback:

- Rollback ถ้า cost spike เกิดหลัง deploy และเกี่ยวกับ duplicate queue/gate

## After Incident Review

หลังแก้ incident ให้บันทึก:

- วันที่/เวลา
- SKU/batch/job/generation ที่กระทบ
- Root cause ที่ยืนยันแล้ว
- Action ที่ทำ
- สิ่งที่ต้องเพิ่มใน test/docs/monitoring
- ยืนยันว่าไม่มี secret/token/key ถูก copy ไปใน incident note
