# Worker Mode

Last updated: 2026-06-23

เอกสารนี้อธิบาย automation worker mode ของ `image-workflow` สำหรับ production pilot โดยไม่เปลี่ยน generation semantics และไม่เปิด WordPress/WooCommerce live write

## Current pilot decision

Production pilot ควรใช้ **dedicated worker mode** เป็น strategy เดียว:

- Web service: `AUTOMATION_EMBEDDED_WORKER=false`
- Worker service: `npm run worker`
- Worker service ตั้ง `AUTOMATION_DEDICATED_WORKER_EXPECTED=true`
- Web service ตั้ง `AUTOMATION_DEDICATED_WORKER_EXPECTED=true` เพื่อให้ `/api/health` รายงาน mode ได้ตรงกับ deployment

เหตุผล:

- แยก web request latency ออกจาก queue processing
- restart/scale worker ได้โดยไม่กระทบหน้าเว็บและ LINE webhook
- health ตรวจได้ชัดว่า queue ควรถูก process โดย service แยก
- ลดความเสี่ยงจาก web process ทำงานหนักระหว่าง live image generation

## Embedded Worker Mode

Embedded worker คือ web service เรียก `startEmbeddedAutomationWorker()` ตอน startup แล้ว process `automation_tasks` ใน process เดียวกับ Express app

ใช้ได้เมื่อ:

- local development
- temporary single-service deployment
- staging ที่ยังไม่มี worker service แยก

ข้อดี:

- setup ง่าย
- ไม่ต้อง provision worker service เพิ่ม

ข้อเสีย:

- worker ใช้ CPU/memory ร่วมกับ web request
- หาก web restart จะหยุด worker ไปด้วย
- หากเผลอเปิดคู่กับ dedicated worker จะมี worker มากกว่าหนึ่งตัวพยายาม claim queue

## Dedicated Worker Mode

Dedicated worker คือ Render worker service รัน:

```bash
npm run worker
```

ซึ่งเรียก `scripts/automation/worker.mjs` และ process queue ผ่าน `processAutomationTaskCore`

ใช้ใน production pilot:

- `render.yaml` มี service `image-workflow-worker`
- web service ปิด `AUTOMATION_EMBEDDED_WORKER`
- worker service ใช้ env เดียวกับ web เฉพาะค่าที่จำเป็น เช่น Supabase, LINE, FAL, WordPress read/preflight config

## Risk ถ้าเปิดทั้งสองพร้อมกัน

ถ้า `AUTOMATION_EMBEDDED_WORKER=true` และมี dedicated worker service รันพร้อมกัน:

- queue claim ปกติยังกัน task เดียวกันถูก claim ซ้ำด้วย `UPDATE ... WHERE status='queued'`
- แต่ throughput และ side effect จะคาดเดายากขึ้น
- task ที่สร้าง downstream ด้วย dedupe key ปลอดภัยในกรณีปกติ แต่ operator จะ debug ยากขึ้นว่า worker ตัวไหนทำอะไร
- live generation อาจเกิดเร็ว/ถี่กว่าที่ตั้งใจถ้ามีหลาย worker แย่ง queue หลาย task พร้อมกัน

ดังนั้น production pilot ห้ามเปิดทั้งสองพร้อมกัน เว้นแต่ตั้งใจทดสอบ concurrency และตั้ง:

```bash
ALLOW_MULTIPLE_WORKERS=true
```

เมื่อไม่ได้ตั้งค่านี้ ระบบจะ log startup warning ที่ไม่มี secret:

```text
[automation-worker] multiple_automation_workers_configured: ...
```

## `/api/health` fields

`/api/health` ต้องรายงาน field เหล่านี้แบบ safe ไม่เปิดเผย secrets:

- `worker_mode`
- `embedded_worker_enabled`
- `dedicated_worker_expected`
- `live_generation_enabled`
- `dry_run`
- `support_after_hero_approval_enabled`
- `wordpress_dry_run`
- `wordpress_live_writes_enabled`

ค่า `worker_mode` ที่เป็นไปได้:

| Mode | ความหมาย |
| --- | --- |
| `dedicated_worker` | production pilot target: web ไม่ process queue, worker service process queue |
| `embedded_worker` | web process queue เอง |
| `multiple_workers` | embedded และ dedicated ถูกตั้งพร้อมกัน ต้องตรวจทันที |
| `no_worker` | ไม่มี worker mode ถูกตั้ง งาน queue จะค้างจนกว่าจะเปิด worker |

## Queue claim and retry safety

สถานะปัจจุบันจาก schema และ worker code:

- `automation_tasks.dedupe_key` เป็น unique key สำหรับ enqueue idempotency
- worker claim task ด้วย conditional update: task ต้องยังเป็น `status='queued'`
- เมื่อ claim สำเร็จ task ถูก update เป็น `running`, set `locked_at`, `locked_by`, และเพิ่ม `attempts`
- ถ้า process fail:
  - หาก `attempts < max_attempts` จะกลับเป็น `queued` พร้อม backoff ใน `available_at`
  - หาก `attempts >= max_attempts` จะเป็น `failed`
- stuck task ตรวจได้จาก `status='running'`, `locked_at`, `locked_by`, `updated_at`, `last_error`

สิ่งที่ยังไม่ควรเปลี่ยนใน PR นี้:

- queue schema ใหญ่
- generation semantics
- Prompt Framework rules
- WordPress/WooCommerce live writes

## Manual production smoke

1. Deploy web + worker จาก `render.yaml`
2. เปิด `/api/health`
3. ตรวจ:
   - `worker_mode = dedicated_worker`
   - `embedded_worker_enabled = false`
   - `dedicated_worker_expected = true`
   - `live_generation_enabled = true`
   - `dry_run = false`
   - `support_after_hero_approval_enabled = true`
   - `wordpress_dry_run = true`
   - `wordpress_live_writes_enabled = false`
4. ส่ง LINE keyword batch ขนาดเล็ก เช่น `BATCH รองเท้า=1 เสื้อ=1`
5. เปิด Batch Review จาก LINE
6. Confirm batch
7. ตรวจ worker logs ว่า worker service เป็นตัว claim/process task
8. ตรวจว่า web logs ไม่มี embedded worker started

## Recovery notes

ถ้า queue ค้าง:

- ตรวจ `/api/health` ก่อนว่า worker mode ถูกต้อง
- ตรวจ Render worker service logs
- ตรวจ `automation_tasks` สำหรับ task ที่ `running` นานผิดปกติ
- ใช้ admin Monitoring/Recovery แทนการแก้ DB ตรงถ้ามีปุ่ม recovery พร้อม

ถ้าเห็น `multiple_workers` ใน production:

1. ปิด `AUTOMATION_EMBEDDED_WORKER` บน web service
2. redeploy/restart web service
3. ยืนยัน `/api/health` กลับเป็น `dedicated_worker`
4. ตรวจ queue ว่าไม่มี task running ซ้ำหรือ generation ซ้ำ
