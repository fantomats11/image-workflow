# AGENTS.md

คำสั่งสำหรับ Codex หรือ agent ที่ทำงานใน repo `image-workflow`

## อ่านก่อนลงมือ

ก่อนแก้ logic production ให้เรียงอ่านตามนี้:

1. `README.md`
2. `docs/CURRENT_TRUTH.md`
3. `docs/HANDOFF_CURRENT.md`
4. `docs/PROJECT_CONTEXT.md`
5. `docs/AUTOMATION_COPILOT_ARCHITECTURE.md`
6. `docs/ADMIN_OPERATING_MANUAL.md`
7. `docs/STAFF_SOP.md`

ถ้ามี skill นี้ ให้ใช้ก่อนแตะ automation logic:

`~/.codex/skills/rent-a-coat-go-mall-automation/SKILL.md`

ถ้า skill ไม่มี ให้รายงานว่าไม่พบ แล้วใช้เอกสารใน repo เป็น source of truth แทน ห้ามเดา business flow เอง

## Current pilot path

เส้นทาง pilot ที่ owner เลือกสำหรับรอบถัดไปคือ Web-first Single-SKU:

`Login web -> เลือก SKU เดียวจาก clean/matched sheet/catalog -> ตรวจ reference -> generate Hero -> review/approve Hero -> generate Support -> review/approve Support -> Export/Drive -> WordPress/WooCommerce preflight proposal`

รายละเอียดอยู่ใน `docs/WEB_FIRST_SINGLE_SKU_PILOT.md`

LINE-first path ยังอยู่ใน repo แต่ไม่ใช่ primary pilot path รอบนี้:

`LINE keyword batch -> Batch Review -> confirm selected SKUs -> generate Hero -> review Hero -> approve Hero -> unlock Support -> generate Support -> review Support -> approve/export`

ห้ามลบ LINE flow เดิม แต่ให้ defer multi-SKU/LINE-first execution จนกว่า dedicated worker service และ smoke evidence พร้อม

## Operating surface ปัจจุบัน

- Web app เป็น operating surface หลักสำหรับ pilot 1 SKU
- LINE เป็น notification/review link surface ชั่วคราว ไม่ใช่ editor หลัก
- LINE ไม่ใช่ editor หลัก และ webhook ต้องไม่ทำ long-running generation โดยตรง
- Batch Review ยังเป็น surface สำหรับ LINE batch path เดิม แต่ไม่ใช่ primary pilot path รอบนี้
- Hero decision หลักอยู่ที่หน้า Review ในเว็บ ไม่ใช่ปุ่ม LINE เก่า
- Support จะพร้อมได้หลัง Hero ถูก approve แล้วเท่านั้น
- Approved Hero ต้องเป็น input แรกของ Support
- Real product references ต้องตามหลัง approved Hero anchor

## Hard guardrails

- ห้ามใส่ secrets, token, key, password หรือ credential ลง docs, log, fixture หรือ commit
- ห้ามเปิด WordPress/WooCommerce live writes
- `WORDPRESS_LIVE_WRITES_ENABLED` ต้องไม่ถูกเปิดในงานทั่วไป
- WordPress/WooCommerce ปัจจุบันเป็น preflight/read-only/dry-run เท่านั้น
- Support generation ต้องถูก block จนกว่า Hero จะ approved
- Approved Hero anchor ต้องเป็น model input แรกของ support
- Real product references ต้องตามหลัง approved Hero anchor
- Product references ชนะ generated images ถ้าข้อมูลขัดกัน
- ห้ามใช้ tag, barcode, SKU card หรือป้ายข้อมูลเป็น visual truth ของสินค้า
- ห้ามเปลี่ยน Prompt Framework rules โดยไม่มี test หรือเอกสาร requirement ที่ชัดเจน
- ห้าม refactor ใหญ่ถ้า scope คือ bugfix หรือเอกสาร
- ห้ามแก้ unrelated files เพียงเพราะเห็นว่ายังไม่สวย
- ห้ามใช้ destructive git command เช่น `git reset --hard` หรือ `git checkout --` โดยไม่มีคำสั่งชัดเจนจาก owner

## Current production posture

- Production app: `https://image-workflow.onrender.com`
- Runtime: Node/Express app ใน `server.mjs` และ frontend ใน `app.js`
- Render มีทั้ง web service และ worker service
- Production pilot ใช้ dedicated worker mode เป็น strategy หลัก
- Web service ต้องตั้ง `AUTOMATION_EMBEDDED_WORKER=false`
- Worker service ต้องรัน dedicated worker ผ่าน `npm run worker`
- Worker service และ web service ควรตั้ง `AUTOMATION_DEDICATED_WORKER_EXPECTED=true`
- ห้ามเปิด embedded worker และ dedicated worker พร้อมกัน เว้นแต่ตั้ง `ALLOW_MULTIPLE_WORKERS=true` พร้อมเหตุผล/incident test ที่ชัดเจน
- หลัง deploy ต้องตรวจ `/api/health` เพื่อยืนยัน `worker_mode`, `embedded_worker_enabled`, `dedicated_worker_expected`, live/dry-run flags และ WordPress guard
- `/api/health` ต้องรายงานสถานะที่ปลอดภัยเท่านั้น ห้าม expose secret, token, provider payload หรือ service role detail
- LINE keyword intake ทำหน้าที่รับคำสั่ง batch และส่ง Batch Review link
- Batch Review เป็น operating surface หลักสำหรับ confirm/review next action
- WordPress/WooCommerce ยังไม่เขียน live
- Live generation ต้องเป็น opt-in/gated ตาม env และ confirmation guard

## Coding rules

- ใช้ existing patterns ใน repo ก่อนสร้าง abstraction ใหม่
- จำกัด scope ให้ตรงกับ issue/prompt
- ถ้าแตะ production logic ให้หา test ที่เกี่ยวข้องก่อน
- ถ้าเป็น docs-only ไม่จำเป็นต้องรัน `npm test` แต่ต้องรันอย่างน้อย `git diff --check`
- ถ้าแก้ runtime code ให้รายงาน test ที่รันและ test ที่ยังไม่ได้รัน
- ถ้าเจอเอกสารขัดกับโค้ด ให้รายงานในคำตอบ ไม่เลือกตามใจ

## Do not build yet

อย่าเริ่มงานเหล่านี้จนกว่า owner จะสั่งชัดเจน:

- Public customer UX
- Full workflow editor
- Prompt editor
- WordPress live write
- Multi-tenant billing
- Large frontend redesign
