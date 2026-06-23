# Current Truth

Last updated: 2026-06-18

เอกสารนี้คือ source of truth ปัจจุบันสำหรับ repo `image-workflow` ก่อนเริ่ม feature production ถัดไป ถ้าเอกสารเก่าขัดกับไฟล์นี้ ให้ถือว่าไฟล์นี้ใหม่กว่า และให้ตรวจโค้ดจริงก่อนแก้ production logic

## One-line product truth

`image-workflow` คือระบบ production workflow สำหรับสร้างภาพสินค้า Rent A Coat / GO Mall โดยเริ่มจาก LINE keyword batch, ให้คนยืนยัน SKU, สร้าง Hero จริง, ให้คน approve/regenerate Hero บนหน้าเว็บ, แล้วค่อยปลดล็อก Support generation และ export/preflight

## Current MVP end-to-end path

1. Staff หรือ owner ส่งคำสั่งใน LINE เช่น `BATCH รองเท้า=1 เสื้อ=1`
2. ระบบ parse keyword batch และเลือก SKU จาก catalog snapshot/source ที่เตรียมไว้
3. ระบบส่ง Batch Review กลับ LINE ให้ตรวจ selected SKUs
4. Human กด confirm/approve batch
5. ระบบ enqueue งานสร้าง Hero จริง ถ้า live generation env พร้อม
6. Worker สร้าง Hero ก่อนเท่านั้น
7. ระบบส่งลิงก์ Hero Review กลับมา หรือเปิดจาก `Automation Inbox`
8. Human ตรวจ Hero ในเว็บเทียบกับ reference product images
9. ถ้า Hero ใช้ได้ ให้กด `อนุมัติ Hero`
10. ถ้า Hero ใช้ไม่ได้ ให้กด `สร้าง Hero ใหม่`
11. `approve Hero` จะปลดล็อก Support generation
12. Support generation ต้องใช้ approved Hero เป็น model input แรก แล้วตามด้วย real product references
13. ระบบส่ง Support Review กลับมาให้ตรวจ
14. Human เลือกผลตรวจ Support เช่น approve/regenerate/reject
15. เมื่อ Support พร้อม ระบบสร้าง candidate/media manifest และเข้า export/preflight gate
16. ขั้น `approve/export` ตอนนี้หมายถึง export/preflight/readiness เท่านั้น ยังไม่ใช่ WordPress/WooCommerce live write

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
- หน้า Jobs แยก next action เช่น ตรวจ Hero, รอสร้าง Support, ตรวจ Support, ตรวจไฟล์ก่อนส่งออก

Production verified ในที่นี้ไม่ได้แปลว่า WordPress live write ผ่านแล้ว เพราะ live writes ยัง intentionally disabled/out of scope

## Pending

- ทำให้ export/preflight chain จบเป็น UX ที่เข้าใจง่ายขึ้นสำหรับ staff
- ทำให้ Jobs/Review ใช้คำไทยทั้งหมด ยกเว้นศัพท์เฉพาะ เช่น `Hero`, `Support`, `SKU`, `WordPress`
- ปรับ Batch Review ให้บอกชัดว่า SKU มาจาก source ไหน และทำไมถูกเลือก
- เพิ่ม visibility ว่า approved Hero ใดถูกใช้เป็น support anchor
- เพิ่ม visibility ว่า reference image ใดถูกใช้/ถูกตัดออก และเพราะอะไร
- เพิ่ม automated checks สำหรับ reference dedupe และการไม่ใช้ SKU card/barcode เป็น visual truth
- เพิ่ม test ครอบคลุม post-approval task enqueue และ support unlock
- ปรับ Staff SOP ให้ตรงกับ LINE-first production path ทั้งเล่ม

## Explicitly out of scope

- WordPress/WooCommerce live writes
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
3. เพิ่ม reference asset diagnostics: แยก visual truth images ออกจาก tag/barcode/SKU card
4. ทำ export/preflight UI ให้บอกว่าอะไรพร้อม อะไร blocked และยังไม่ live write WordPress
