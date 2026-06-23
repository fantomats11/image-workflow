# E2E Production Smoke

เอกสารนี้คือคู่มือรัน smoke สำหรับ production readiness ของ `image-workflow` โดยแยก safe/dry-run และ live-gated pilot smoke ออกจากกันชัดเจน

## หลักการ

- `npm run e2e:readiness` เป็น pre-deploy/post-deploy safe check เท่านั้น ไม่ generate ภาพจริง
- `npm run e2e:pilot-smoke` เป็น gated mode ต้องตั้ง `E2E_PILOT_CONFIRM=true` และระบุ SKU
- การ generate ภาพจริงต้องเพิ่ม `--live --confirm-live-generation` และต้องมี `AI_GENERATION_LIVE_ENABLED=true` พร้อม `FAL_KEY`
- ทั้งสอง command ห้ามเปิด WordPress/WooCommerce live write
- Output ต้องไม่ print secret/token/key เต็ม
- Manual production smoke หลัง deploy เป็นหลักฐานคนละส่วนกับ automated readiness และต้องบันทึกใน `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`

## Who should run

| ช่วงเวลา | ผู้รัน |
| --- | --- |
| ก่อน deploy | dev/admin ที่ดูแล release |
| หลัง deploy | admin หรือ production engineer |
| ก่อน pilot live generation | production engineer เท่านั้น |
| หลังพบ warning/failed หลายงาน | admin + dev |

## Pre-deploy

รัน:

```bash
npm run test:automation
npm run e2e:readiness
npm run gate:generation
```

Expected result:

- `test:automation` ผ่าน
- `e2e:readiness` ไม่มี `FAIL`
- `gate:generation` ยังไม่ arm live generation ถ้าไม่มี explicit confirmation
- `WORDPRESS_LIVE_WRITES_ENABLED` ต้องไม่เป็น `true`

ถ้า `e2e:readiness` มี `WARN` ให้ตรวจว่าเป็น warning ที่ยอมรับได้หรือไม่ เช่น env บางตัวไม่ครบในเครื่อง local แต่ production Render ตั้งไว้แล้ว

## Post-deploy

รันบน environment ที่ชี้ production config:

```bash
npm run e2e:readiness
```

ตรวจ:

- Supabase reachable ถ้า env ครบ
- Google Drive config พร้อมหรือมี warning ที่ admin ต้องแก้
- LINE config presence ถูก masked
- WordPress live write ปิด
- Support ยังถูก block ถ้ายังไม่มี approved Hero
- Approved Hero fixture ผ่าน invariant ว่า Support unlock ได้และ model input order ถูก

หลัง automated readiness ให้ไล่ manual checklist:

- `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`
- บันทึกผลใน `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`

ห้ามถือว่า production pilot ผ่านจาก `e2e:readiness` เพียงอย่างเดียว เพราะ command นี้ไม่ทดสอบ LINE OA จริง, Render worker logs จริง, Google Drive OAuth/export จริง หรือ UI ของ staff/admin แบบ end-to-end

## Pilot smoke แบบไม่ generate ภาพจริง

ใช้เมื่อต้องตรวจ path ของ SKU เดียวก่อนยิง provider:

```bash
E2E_PILOT_CONFIRM=true npm run e2e:pilot-smoke -- --sku R23CBT0048 --readiness-only
```

Expected result:

- ต้องเห็น `Pilot smoke จำกัดไว้ที่ request เดียว`
- ถ้า SKU ยังไม่พร้อม จะเป็น `WARN` หรือ `FAIL` ตาม blocker ที่เจอ
- ยังไม่เรียก FAL/provider

## Pilot smoke แบบ live-gated

ใช้เฉพาะเมื่อ operator ตั้งใจให้ยิงภาพจริง 1 request:

```bash
E2E_PILOT_CONFIRM=true \
AI_GENERATION_LIVE_ENABLED=true \
AI_GENERATION_DRY_RUN=false \
npm run e2e:pilot-smoke -- --sku R23CBT0048 --live --confirm-live-generation
```

ต้องมี env เพิ่ม:

- `FAL_KEY`
- `PUBLIC_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- Google Drive config ตาม deployment จริง ถ้าต้อง export หลัง approve

ห้ามตั้ง:

- `WORDPRESS_LIVE_WRITES_ENABLED=true`

ข้อจำกัด:

- `e2e:pilot-smoke` ต้องจำกัด SKU เดียว/request เดียวใน controlled pilot
- ต้องมี `E2E_PILOT_CONFIRM=true`
- ต้องไม่ใช้แทน manual support review/export QA

## Expected output แบบ masked

ตัวอย่าง console:

```text
E2E readiness wrote: /path/to/outputs/e2e-readiness-check.json
สถานะรวม: warn
Summary: pass=7 warn=3 fail=0
[PASS] WordPress/WooCommerce live write ปิดอยู่
[WARN] FAL_KEY ยังไม่ได้ตั้งค่า
[PASS] LINE_CHANNEL_SECRET ถูกตั้งค่าแล้ว
```

ตัวอย่าง JSON details:

```json
{
  "id": "env_LINE_CHANNEL_SECRET",
  "level": "pass",
  "details": {
    "env": "LINE_CHANNEL_SECRET",
    "present": true,
    "value": "[set:32]"
  }
}
```

## Rollback signal

ให้หยุด pilot หรือ rollback release ถ้าเจอ:

- `e2e:readiness` มี `FAIL`
- Supabase probe fail บน production env
- `WORDPRESS_LIVE_WRITES_ENABLED=true`
- live gate arm โดยไม่ได้ตั้ง explicit confirmation
- Support request พร้อมทั้งที่ไม่มี approved Hero
- `model_input_files[0].source_role` ไม่ใช่ `approved_hero_anchor`
- LINE webhook live endpoint ตอบผิดหรือ postback ไม่ persist approval
- smoke live สร้าง duplicate final assets หรือเกิด provider failure ซ้ำ

## Artifacts

Default output อยู่ที่ `../../outputs` จาก repo root:

- `e2e-readiness-check.json`
- `e2e-pilot-smoke.json`
- `live-pilot-generation-gate.json`

Artifact เหล่านี้ห้ามมี secret/token/key เต็ม หากต้องแนบให้ dev ให้ตรวจว่าค่า env ถูก masked ก่อนเสมอ

## Current limitations

- `e2e:readiness` อ่าน generation plan จาก local artifacts เช่น `pilot-batch-dry-run.json` ถ้าไม่มี artifact จะ `FAIL` และบอก path ที่หาย
- Google Drive check ใน command นี้เป็น config/status check ไม่ใช่ OAuth reconnect
- Pilot smoke ไม่บันทึก asset เข้า WordPress/WooCommerce และไม่แทน manual QA หลังภาพออก
