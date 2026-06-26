# Current Truth

Last updated: 2026-06-23

เอกสารนี้คือ source of truth ปัจจุบันสำหรับ repo `image-workflow` ก่อนเริ่ม feature production ถัดไป ถ้าเอกสารเก่าขัดกับไฟล์นี้ ให้ถือว่าไฟล์นี้ใหม่กว่า และให้ตรวจโค้ดจริงก่อนแก้ production logic

## One-line product truth

`image-workflow` คือระบบ production workflow สำหรับสร้างภาพสินค้า Rent A Coat / GO Mall โดย current pilot decision คือ Web-first Single-SKU: staff/admin login เว็บ, เลือก SKU เดียวจาก clean/matched catalog, ตรวจ reference, สร้าง/approve Hero, สร้าง/approve Support, export ไป Drive แล้วทำ WordPress/WooCommerce preflight proposal โดยยังไม่ live write

## Current pilot path

1. Staff/Admin login web
2. Staff/Admin เลือก SKU เดียวจาก clean/matched sheet หรือ catalog snapshot
3. ระบบต้องแสดง canonical product data และ reference readiness
4. Human ตรวจ product references ก่อน Generate Hero
5. Human กด Generate Hero สำหรับ SKU เดียว
6. Human ตรวจ Hero เทียบกับ real product references
7. ถ้า Hero ใช้ได้ ให้กด approve Hero
8. ถ้า Hero ใช้ไม่ได้ ให้ regenerate Hero
9. Approve Hero ต้อง persist approved hero anchor
10. Human กด Generate Support หลัง Hero approved เท่านั้น
11. Support ต้องใช้ approved Hero เป็น input แรก แล้วตามด้วย real product references
12. Human ตรวจ/approve Support
13. Export/Drive เป็น output หลักของ pilot
14. WordPress/WooCommerce ทำได้เฉพาะ preflight proposal ยังไม่ live write

อ่าน contract ล่าสุดที่ `docs/WEB_FIRST_SINGLE_SKU_PILOT.md`

## Deferred automation path

LINE keyword batch path ยัง implemented อยู่ แต่ไม่ใช่ primary pilot path รอบนี้:

```text
LINE keyword batch
-> Batch Review
-> confirm selected SKUs
-> generate Hero
-> review Hero
-> approve Hero
-> unlock Support
-> generate Support
-> review Support
-> approve/export
```

เหตุผลที่ defer: production ยังไม่มี dedicated worker service running และ owner ต้องการ flow ที่สะอาดกว่าโดยเริ่มจาก 1 SKU ต่อ 1 งานก่อน

## Implemented

- LINE webhook รับ message และ postback ที่ `/api/line/webhook`
- LINE keyword batch intake ผ่าน `handleLineKeywordBatchMessage`
- Batch registration เข้า Supabase automation registry
- LINE batch approval enqueue automation tasks ผ่าน `recordLineAutomationAction`
- Live Hero generation สามารถเริ่มหลัง `approve_batch` ถ้า env พร้อม
- Embedded automation worker claim/process queue จาก `automation_tasks`
- Hero generation handoff ส่งลิงก์ Review กลับ LINE
- Web Hero Review ผ่าน `/api/review/hero`
- Web Hero approval ผ่าน `/api/approvals`
- Web Hero regenerate request ผ่าน `/api/review/hero/regenerate`
- Web-first SKU picker อ่าน catalog snapshot แบบ read-only ผ่าน `GET /api/catalog/sku-search?q=...`
- Web-first reference detail อ่านแบบ read-only ผ่าน `GET /api/catalog/sku/:sku/references`
- SKU picker เติม canonical SKU/product/category/branch/reference metadata เข้า manual create form เท่าที่ catalog มีจริง
- หน้า manual create แสดง reference readiness, reference cards จาก catalog/Drive และให้ staff กดใช้ stageable reference กับ Hero ได้
- `/api/generate/start` resolve `catalogReferenceSku` + `catalogReferenceKeys` ฝั่ง server เท่านั้นก่อนแนบเป็น generation input
- หน้า manual create block Generate Hero เมื่อ selected SKU ไม่มี usable reference และไม่มี manual upload/staged catalog reference
- LINE `approve_hero` และ `regenerate_hero` ถูก disable แล้ว เพื่อกันปุ่มเก่า/ผิดลำดับ
- Support generation handoff ส่งลิงก์ Review กลับ LINE
- Support Review decisions ผ่าน `/api/review/support-decisions`
- Jobs UI แสดง stage: รับชุดงาน, ตรวจ Hero, สร้าง Support, ตรวจ Support, ตรวจไฟล์ก่อนส่งออก, ส่งออก WordPress
- Reference image loading ใน Review ใช้ signed public proxy `/api/public/line-image/:fileId`
- LINE webhook ต้องผ่าน signature verification และมี basic duplicate event guard
- Upload/generation routes รับเฉพาะไฟล์รูปภาพ `JPG`, `PNG`, `WebP` ขนาดไม่เกิน 20MB ต่อไฟล์
- Staff ถูกกันออกจาก admin-only operational API เช่น `/api/admin/monitoring`, `/api/admin/costs`, `/api/ops`
- WordPress product publish preflight มี LINE summary
- WordPress media mapping preflight มี LINE summary
- Media attach confirmation/execution plan ยังอยู่ในกลุ่ม dry-run/preflight

## Production verified

ยืนยันจาก production UI และ config ล่าสุด:

- Production app เปิดที่ `https://image-workflow.onrender.com`
- Render config มี web service และ dedicated worker service โดย production pilot ใช้ dedicated worker mode ตาม `docs/WORKER_MODE.md`
- `AI_GENERATION_LIVE_ENABLED=true`
- `AI_GENERATION_DRY_RUN=false`
- `AI_GENERATION_CONFIRM_SUPPORT_AFTER_HERO_APPROVAL=true`
- `WORDPRESS_DRY_RUN=true`
- Web service ตั้ง `AUTOMATION_EMBEDDED_WORKER=false`
- Worker service รัน `npm run worker`
- Jobs page แสดงงานจริงจาก batch ล่าสุด
- ตัวอย่าง batch ล่าสุดมี Hero และ Support สำหรับ SKU ที่อนุมัติ Hero แล้ว
- หน้า Review แสดง reference images จาก Google Drive ผ่าน signed proxy
- หน้า `#next` เป็น production home สำหรับ staff/admin เมื่อไม่มี deep link เฉพาะ
- หน้า Jobs/Next Actions แยก next action เช่น ตรวจ Hero, รอสร้าง Support, ตรวจ Support, ตรวจไฟล์ก่อนส่งต่อ, พร้อมเตรียมลง WordPress
- UI ใช้ภาษาคนทำงานเป็นหลัก และซ่อนศัพท์เชิงระบบไว้ใน diagnostics/monitoring

Production verified ในที่นี้ไม่ได้แปลว่า WordPress live write ผ่านแล้ว เพราะ live writes ยัง intentionally disabled/out of scope

## Pending

- ทำ Web-first production smoke 1 SKU ผ่าน picker ใหม่
- ทำ Web-first production smoke 1 SKU ที่ใช้ Drive/catalog reference staging จริง
- ทำ production smoke ให้ครบถึง Support approval -> Drive/export evidence -> WordPress preflight/proposal readiness
- เก็บ visual QA evidence desktop/mobile หลัง deploy production
- ปรับ Batch Review ให้บอกชัดว่า SKU มาจาก source ไหน และทำไมถูกเลือก
- เพิ่ม visibility ว่า approved Hero ใดถูกใช้เป็น support anchor
- เพิ่ม browser/manual evidence ว่า reference image ใดถูกใช้/ถูกตัดออก และเพราะอะไร
- เพิ่ม route-level tests สำหรับ reference preview/staging auth และ unknown reference key ถ้า test harness พร้อม
- เพิ่ม test ครอบคลุม post-approval task enqueue และ support unlock
- ปรับ Staff SOP ให้ตรงกับ LINE-first production path ทั้งเล่ม

## Explicitly out of scope

- WordPress/WooCommerce live writes
- Multi-SKU batch execution เป็น primary pilot path รอบนี้
- LINE-first production pilot จนกว่า dedicated worker service พร้อม
- Public customer UX
- Full workflow editor
- Prompt editor
- Multi-tenant billing
- Large frontend redesign
- เปลี่ยน Prompt Framework rules โดยไม่มี test หรือ requirement ใหม่
- สร้างระบบ natural language intake เต็มรูปแบบแทน keyword batch

## Hard guardrails

- WordPress/WooCommerce live writes ยังปิด
- ห้ามเปิด `WORDPRESS_LIVE_WRITES_ENABLED` ใน phase นี้
- Support generation ต้อง blocked จนกว่า Hero จะ approved
- Approved Hero anchor ต้องเป็น model input แรกของ support
- Real product references ต้องตามหลัง approved Hero anchor
- Product references ชนะ generated images ถ้าข้อมูลขัดกัน
- ห้ามใช้ tag/barcode/SKU card เป็น visual truth
- ห้ามใส่ secrets หรือ credential ใน docs/log/test fixture/commit
- `/api/health` และ error response ต้องไม่แสดง secret, token, provider payload หรือ service role detail
- Remote image URL ต้องไม่ชี้ไป private/local network target
- ห้ามเปลี่ยน Prompt Framework rules โดยไม่มี test ชี้ว่าจำเป็น

## Source of truth hierarchy

1. โค้ดจริงใน `server.mjs`, `app.js`, `scripts/automation`, และ tests
2. `docs/CURRENT_TRUTH.md`
3. `AGENTS.md`
4. `docs/HANDOFF_CURRENT.md`
5. `docs/PROJECT_CONTEXT.md`
6. `docs/AUTOMATION_COPILOT_ARCHITECTURE.md`
7. `docs/ADMIN_OPERATING_MANUAL.md`
8. `docs/STAFF_SOP.md`

ถ้า docs ขัดกับ code ให้รายงานก่อนแก้ ไม่เดา business flow เอง

## Known stale/conflicting docs

- `docs/HANDOFF_CURRENT.md` ถูกเขียนเมื่อ 2026-06-12 จึงมี snapshot บางส่วนที่เก่ากว่า LINE keyword batch และ web Review decision flow ล่าสุด
- `docs/STAFF_SOP.md` เดิมอธิบาย manual `สร้างภาพ` เป็น path หลัก แต่ production MVP ตอนนี้เป็น LINE-first batch path
- `docs/ADMIN_OPERATING_MANUAL.md` ยังมีชื่อเมนู/label บางจุดจาก UI รุ่นก่อน เช่น System Health/Jobs wording
- เอกสารเก่าบางจุดใช้คำว่า export/WordPress ในความหมายกว้าง ต้องอ่านร่วมกับ guardrail ว่า WordPress live write ยังปิด

## Do not build yet

- Public customer UX
- Full workflow editor
- Prompt editor
- WordPress live write
- Multi-tenant billing
- Large frontend redesign

## Next recommended PR

1. แก้ UX copy/IA เล็กแบบไม่ refactor: Jobs + Review ให้ staff เข้าใจว่าอยู่ step ไหน
2. เพิ่ม test สำหรับ `approve Hero -> enqueue support generation` และ `regenerate Hero -> enqueue hero regeneration`
3. ทำ Web-first Hero smoke 1 SKU ด้วย catalog/Drive staged references
4. ทำ export/preflight UI ให้บอกว่าอะไรพร้อม อะไร blocked และยังไม่ live write WordPress
