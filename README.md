# image-workflow

Production image workflow สำหรับ Rent A Coat / GO Mall ใช้สร้างภาพสินค้าแบบมี human approval gate ก่อนนำไป export/preflight

## Start here

ถ้าเปิด repo นี้ใหม่ ให้อ่านตามลำดับ:

1. `AGENTS.md`
2. `docs/CURRENT_TRUTH.md`
3. `docs/HANDOFF_CURRENT.md`
4. `docs/PROJECT_CONTEXT.md`

`docs/CURRENT_TRUTH.md` คือภาพรวมล่าสุดของ flow จริงใน production

## Current pilot flow

Recommended pilot path ตอนนี้คือ Web-first Single-SKU:

```text
Login web
-> เลือก SKU เดียวจาก clean/matched sheet หรือ catalog snapshot
-> ตรวจ reference
-> generate Hero
-> review/approve Hero
-> generate Support
-> review/approve Support
-> Export/Drive
-> WordPress/WooCommerce preflight proposal
```

LINE-first batch path ยังอยู่ใน repo แต่ถูก defer สำหรับ phase ถัดไปจนกว่า dedicated worker และ production smoke พร้อมกว่าเดิม:

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

คำว่า `approve/export` ตอนนี้ยังไม่ใช่ WordPress/WooCommerce live write เป็นเพียง export/preflight/readiness gate

## Production guardrails

- WordPress/WooCommerce live writes ยังปิด
- Support generation ต้องรอ approved Hero
- Approved Hero ต้องเป็น support model input แรก
- Real product references ต้องตามหลัง approved Hero
- Product references ชนะ generated images ถ้าข้อมูลขัดกัน
- ห้ามใช้ tag/barcode/SKU card เป็น visual truth
- ห้ามใส่ secrets ลง docs, logs, tests หรือ commit

## Local commands

```bash
npm install
npm run dev
npm test
```

คำสั่ง automation สำคัญอยู่ใน `package.json` เช่น:

- `npm run worker`
- `npm run plan:generation`
- `npm run gate:generation`
- `npm run execute:generation`
- `npm run persist:generation`
- `npm run build:media-manifest`
- `npm run preflight:wordpress`
- `npm run preflight:wordpress-media`

## Runtime entry points

- Backend/API: `server.mjs`
- Frontend app: `app.js`
- Render config: `render.yaml`
- Automation scripts: `scripts/automation`
- Current truth docs: `docs/CURRENT_TRUTH.md`

## Current deployment posture

- Production URL: `https://image-workflow.onrender.com`
- Render runs web service and worker service
- LINE keyword intake is implemented
- Hero decision is made in web Review, not LINE hero buttons
- WordPress/WooCommerce is still dry-run/preflight only

## Launch readiness docs

- `docs/WEB_FIRST_SINGLE_SKU_PILOT.md` คือ current pilot path และ contract สำหรับ Web-first 1 SKU
- `docs/WEB_FIRST_SINGLE_SKU_SMOKE_TEST.md` คือ checklist smoke สำหรับ Web-first 1 SKU
- `docs/PRODUCTION_LAUNCH_GATE.md` คือ go/no-go gate สำหรับ controlled internal pilot
- `docs/FINAL_E2E_REVIEW.md` คือ final E2E review ล่าสุด: Conditional Go เท่านั้น
- `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md` คือ checklist หลัง Render deploy
- `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md` คือ template สำหรับบันทึกหลักฐาน smoke จริง
- `docs/E2E_PRODUCTION_SMOKE.md` คือคู่มือรัน `e2e:readiness` และ gated pilot smoke

ห้ามสรุปว่า production-ready หรือ wider rollout จนกว่า post-deploy production smoke จริงอย่างน้อย 1 batch จะผ่านและถูกบันทึกแล้ว

## Before changing production logic

1. Read `docs/CURRENT_TRUTH.md`
2. Check the relevant route/handler in `server.mjs`
3. Check the relevant UI state in `app.js`
4. Add or run focused tests when touching runtime behavior
5. Report any doc/code conflict instead of guessing
