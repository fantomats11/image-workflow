# Production Launch Gate

Last updated: 2026-06-23

เอกสารนี้ใช้เป็น go/no-go gate สำหรับ production pilot ของ `image-workflow` โดยอิง current truth จาก `docs/CURRENT_TRUTH.md`, `docs/E2E_WORKFLOW_CONTRACT.md`, `docs/E2E_PRODUCTION_SMOKE.md`, `docs/WORKER_MODE.md`, โค้ดจริง และ test ล่าสุด

คำว่า `launch` ในเอกสารนี้หมายถึง pilot ภายในสำหรับ staff/admin ไม่ใช่ public customer UX และไม่ใช่ WordPress/WooCommerce live write

เอกสารประกอบหลัง deploy:

- `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md` สำหรับลำดับตรวจหลัง Render deploy
- `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md` สำหรับบันทึกหลักฐาน manual production smoke
- `docs/FINAL_E2E_REVIEW.md` สำหรับผล review หลัง PR12/PR13 readiness cleanup

## Launch Gate Status

**Recommendation PR17: Ready for controlled Web-first Single-SKU smoke, not wider rollout.**

เหตุผล:

- Owner เลือก Web-first Single-SKU เป็น primary pilot path แทน LINE-first batch
- Current web app มี SKU picker จาก clean/matched catalog และ Drive/catalog reference cards
- Staff สามารถ stage reference ที่ `stage_available` เข้า Generate Hero ได้ หรือใช้ manual upload fallback ถ้า Drive reference ยัง stage ไม่ได้
- WordPress/WooCommerce live write ยังถูกปิดโดยตั้งใจ
- LINE-first automation path ถูก defer จนกว่า dedicated worker service จะพร้อม

Manual Web-first smoke record is required before pilot. ห้ามเปลี่ยน gate ที่ยังเป็น `Must verify manually` เป็น pass จนกว่าจะมีหลักฐานจาก production smoke จริงอย่างน้อย 1 SKU

อ่านเพิ่ม:

- `docs/WEB_FIRST_SINGLE_SKU_PILOT.md`
- `docs/WEB_FIRST_SINGLE_SKU_SMOKE_TEST.md`

## Must Pass Before Pilot

| Gate | Required evidence | Current status | Go/no-go note |
| --- | --- | --- | --- |
| Login/logout works | Admin/staff login/logout ผ่าน production URL | Must verify manually | ห้ามเริ่ม pilot ถ้า login/logout พัง |
| Staff/admin permissions correct | Staff เปิด `#settings`, `#monitoring`, `#costs` ไม่ได้ และ admin เปิดได้ | Implemented, must verify manually | ถ้า staff เห็น admin page ให้ no-go |
| Web SKU picker exists | Staff เลือก 1 SKU จาก clean/matched source ได้ | Implemented, must verify manually | PR16 เพิ่ม `GET /api/catalog/sku-search` และ picker ใน web create flow |
| Selected SKU carries canonical data | SKU selection เติม product data/reference readiness | Implemented, must verify manually | ต้อง smoke ว่า field ที่เติมตรงกับ catalog จริง |
| Reference review before Hero | Staff เห็น product references และ blocker ถ้าขาด reference | Implemented, must verify manually | PR17 เพิ่ม Drive/catalog reference cards และ server-side staging; smoke ต้องยืนยันว่าภาพที่ stage เป็น visual truth |
| LINE webhook verified | Invalid signature ถูก reject, valid flow ยังทำงาน | Implemented/tested by automation, deferred for pilot | LINE ไม่ใช่ primary pilot path |
| LINE batch creates Batch Review link | `BATCH รองเท้า=1 เสื้อ=1` ส่ง link `#batch?batch_id=...` | Implemented/tested by automation, deferred | ไม่ใช่ smoke หลักของ PR15 |
| Batch Review confirm works | Confirm idempotent และ enqueue Hero ตาม existing rules | Implemented/tested by automation, deferred | ห้ามใช้เป็น primary pilot จน worker พร้อม |
| Hero generation queued/gated correctly | Confirm batch แล้ว Hero เข้า queue/worker ไม่ทำใน webhook | Implemented/tested by automation | ตรวจ worker logs หลัง deploy |
| Hero approval persists approved anchor | Approve Hero บันทึก approval และ anchor | Implemented/tested by automation | Anchor ต้องใช้ต่อ Support ได้ |
| Support unlock after approval works | ก่อน approve ถูก block, หลัง approve unlock ตาม gate | Implemented/tested by automation | ถ้า Hero remote-only ต้อง block ด้วย safe error |
| Support generation gated correctly | Support ใช้ `approved_hero_anchor` เป็น model input แรก | Implemented/tested by automation | Product references ต้องตามหลัง anchor |
| Support approval/export path works | Support approved แล้วเข้า manifest/export/preflight | Implemented/tested by automation, verify UI manually | WordPress ยังเป็น preflight only |
| Google Drive connected or clear warning | `/api/health` และ Monitoring บอก configured/connected หรือ warning ชัด | Implemented, must verify production config | ถ้า Drive disconnected ให้ pilot ได้เฉพาะ generation/review ไม่ควรใช้ export เป็น success |
| `/api/health` safe | มี `status`, worker mode, dry-run/live booleans, Drive/storage booleans และไม่มี secret | Implemented | แชร์ screenshot ได้ถ้าไม่มี token/key |
| Worker mode explicit | Production ใช้ dedicated worker: web `AUTOMATION_EMBEDDED_WORKER=false`, worker `npm run worker` | Implemented in `render.yaml` | ถ้า `worker_mode=multiple_workers` ให้ no-go |
| No WordPress live write | `WORDPRESS_DRY_RUN=true`, `WORDPRESS_LIVE_WRITES_ENABLED=false` | Implemented in docs/config | ถ้า live writes true ให้ no-go ทันที |
| No secrets in logs/docs | Docs/test fixtures/log output ต้องไม่มี token/key/password เต็ม | Must verify each PR | ใช้ masked output เท่านั้น |
| Rollback plan exists | `docs/ROLLBACK_AND_INCIDENT_PLAYBOOK.md` พร้อมใช้งาน | Implemented | Admin ต้องอ่านก่อน pilot |

## Should Pass Before Wider Rollout

| Gate | Why it matters | Current status |
| --- | --- | --- |
| Staff training on LINE-first flow | ลดการกดผิด/ถามซ้ำ | Pending training |
| Jobs/Review copy เป็นภาษาไทยครบ | ลด cognitive load ของ staff | Partially implemented |
| Export/preflight UX อ่านง่าย | ลดความสับสนระหว่าง Drive export กับ WordPress preflight | Pending polish |
| Reference diagnostics ชัด | Staff เห็นว่า reference ไหนใช้จริง/ถูกตัดออก | Partially implemented |
| Cost spike alert/manual threshold | Pilot live generation มีต้นทุนจริง | Pending operating routine |
| Google Drive recovery rehearsal | Export เป็น path หลักหลัง approve | Pending manual rehearsal |
| Browser/mobile smoke | Staff บางคนอาจใช้จอเล็ก | Pending manual smoke |
| Runbook rehearsal | Admin ต้องซ้อม LINE fail, worker stuck, Drive fail | Pending |

## Known Accepted Risks

- UX ยังไม่ใช่ final production polish ทั้งหมด โดยเฉพาะ Jobs/Review/export chain
- Staff SOP ยังมี manual fallback จากระบบเก่า ต้องใช้ร่วมกับ `CURRENT_TRUTH` และ training
- Google Drive export ขึ้นกับ OAuth/folder permission ถ้า disconnected ต้องถือเป็น warning/blocker ตามสถานการณ์
- Provider/FAL failure อาจเกิดได้ ต้องหยุด retry ซ้ำถ้า fail หลายงาน
- Cost dashboard เป็น estimated cost ไม่ใช่ provider invoice
- `e2e:readiness` ใช้ local artifacts สำหรับ generation plan ถ้า artifacts หายจะ fail เพื่อบอกว่าต้อง rebuild plan
- LINE duplicate guard เป็น basic guard; idempotency หลักต้องอยู่ที่ batch/task dedupe keys

## Explicitly Disabled

- WordPress/WooCommerce live writes
- Public customer UX
- Full workflow editor
- Prompt editor
- Multi-tenant billing
- Large frontend redesign
- Natural language intake เต็มรูปแบบแทน keyword batch
- LINE webhook long-running generation

## Required Commands Before Pilot

รันจาก repo root:

```bash
npm run test:automation
npm test
npm run e2e:readiness
npm run gate:generation
```

Expected:

- `test:automation` และ `npm test` ผ่าน
- `e2e:readiness` ไม่มี `FAIL`
- `gate:generation` ไม่ execute live generation โดยไม่มี explicit confirmation
- ไม่มี output ที่เปิดเผย secret/token/key/password

## Manual Pilot Smoke

ก่อนเริ่ม Web-first smoke ให้เปิด `docs/WEB_FIRST_SINGLE_SKU_SMOKE_TEST.md` และบันทึกผลทุกข้อที่สำคัญ

LINE batch smoke ด้านล่างยังใช้ได้สำหรับ deferred automation path แต่ไม่ใช่ primary pilot path รอบนี้

1. เปิด production URL แล้ว login admin
2. ตรวจ `/api/health`
   - `status = ok`
   - `worker_mode = dedicated_worker`
   - `embedded_worker_enabled = false`
   - `dedicated_worker_expected = true`
   - `live_generation_enabled = true`
   - `dry_run = false`
   - `support_after_hero_approval_enabled = true`
   - `wordpress_dry_run = true`
   - `wordpress_live_writes_enabled = false`
3. Login staff แล้วตรวจว่า direct hash ไป `#settings`, `#monitoring`, `#costs` ถูก redirect/blocked
4. ส่ง LINE: `BATCH รองเท้า=1 เสื้อ=1`
5. เปิด Batch Review จาก LINE
6. Confirm batch
7. ตรวจ Jobs ว่า Hero อยู่ใน queue/generating/review
8. Approve Hero หนึ่ง SKU
9. ตรวจว่า Support unlock/generate ตาม worker gate
10. Review/approve Support
11. ตรวจ Jobs, Asset Library, Google Drive link หรือ warning ที่ชัดเจน
12. ยืนยันว่าไม่มี WordPress/WooCommerce live write
13. บันทึก final decision เป็น Go / Soft Go / No-Go ใน smoke record

## No-Go Signals

- Staff เลือก SKU เดียวจาก source-of-truth picker ไม่ได้
- Selected SKU ไม่ carry canonical product data/reference readiness
- Hero generate ได้โดยไม่มี usable product reference
- Staff เห็นหรือเรียก admin page/API ได้
- `/api/health` แสดง secret, token, provider payload หรือ service role detail
- `WORDPRESS_LIVE_WRITES_ENABLED=true`
- `worker_mode=multiple_workers` โดยไม่มี incident test ที่ตั้งใจ
- LINE webhook invalid signature ไม่ถูก reject
- Batch confirm ซ้ำแล้วสร้าง duplicate final assets
- Support ready ทั้งที่ยังไม่มี approved Hero
- Support input แรกไม่ใช่ `approved_hero_anchor`
- Google Drive disconnected แล้ว UI แสดงเหมือน export success
- Generation fail หลายงานติดกันหรือ cost spike โดยไม่มี admin เฝ้าดู

## Go/No-Go Decision

สำหรับสถานะ repo ปัจจุบัน: **Go แบบ controlled pilot**

เงื่อนไขก่อนเริ่มจริง:

- Admin ต้องรัน required commands ผ่านใน environment ล่าสุด
- Admin ต้องตรวจ `/api/health` บน production หลัง deploy
- Staff pilot ควรจำกัด 1-2 คน และเริ่มจาก batch เล็ก เช่น `BATCH รองเท้า=1 เสื้อ=1`
- ถ้ามี no-go signal ให้หยุด pilot และใช้ `docs/ROLLBACK_AND_INCIDENT_PLAYBOOK.md`
