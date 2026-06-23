# Final E2E Review

วันที่ตรวจ: 2026-06-23
โหมดงาน: review-only
ขอบเขต: ตรวจ readiness สำหรับ internal production pilot ของ `image-workflow` จาก end-to-end path จริง

หมายเหตุสำคัญ: รอบนี้ไม่มีการแก้ runtime code. การเปลี่ยนแปลงมีเฉพาะรายงานไฟล์นี้

## Executive summary

Repo มี foundation ของ pilot production ครบกว่าช่วงก่อนหน้าอย่างชัดเจน: LINE keyword batch, Batch Review API/UI, Hero generation gate, Hero approval anchor, Support unlock, Support input ordering, export/asset visibility, worker mode, health, security guard และ WordPress dry-run guard มีเอกสารและ automated tests รองรับแล้ว

ผล automated verification รอบนี้ผ่านทั้งหมด:

- `npm run test:automation` ผ่าน 244 tests
- `npm test` ผ่าน 244 tests
- `npm run e2e:readiness` ผ่าน 19 checks, 0 warn, 0 fail
- `npm run gate:generation` ผ่านและยังไม่ execute live generation เอง

ข้อสรุปคือ repo พร้อมสำหรับ controlled internal pilot แบบจำกัดคนและจำกัดจำนวน SKU หลังจากรัน manual production smoke บน Render/LINE/Google Drive จริงอีก 1 รอบและบันทึกผลแล้ว แต่ยังไม่ควร wider rollout ให้พนักงานหลายคนใช้งานเต็มรูปแบบจนกว่าจะปิด UX/manual SOP gaps และยืนยัน production export path ซ้ำ

PR12 นี้เป็น Conditional Go candidate เท่านั้น ไม่ใช่ production-ready/wider-rollout approval. ก่อนเริ่ม controlled pilot ต้องผ่าน post-deploy verification และบันทึก smoke record อย่างน้อย 1 batch:

- `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`
- `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`

## Go / No-Go recommendation

คำแนะนำ: Conditional Go สำหรับ controlled internal pilot

เงื่อนไขก่อนเริ่ม pilot:

1. รัน production smoke จริง 1 batch ผ่าน LINE OA จริง: `BATCH รองเท้า=1 เสื้อ=1`
2. ยืนยัน `/api/health` บน production ว่า worker mode, live generation, Google Drive, LINE และ WordPress guards ตรง launch gate
3. ยืนยัน Google Drive export/retry export อย่างน้อย 1 SKU
4. บันทึกผล smoke ใน `docs/PRODUCTION_LAUNCH_GATE.md` หรือ production run log
5. เติม smoke evidence ใน `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`

No-Go สำหรับ wider rollout ตอนนี้ เพราะยังมีความเสี่ยงด้าน UX/SOP และยังไม่มีหลักฐาน manual production smoke ครบ flow จาก environment จริงใน repo

## E2E flow table

| Step | Expected behavior | Implementation evidence | Test evidence | Risk |
| --- | --- | --- | --- | --- |
| 1. Staff/Admin login | ผู้ใช้ต้อง login และ role ต้องแยก staff/admin | `server.mjs` มี `requireUser`, `requireAdminUser`; `app.js` redirect หน้า admin-only สำหรับ staff | `npm test` ผ่าน; security helper และ batch debug admin tested | ยังต้อง smoke UI login/logout จริงบน production |
| 2. LINE sends BATCH command | LINE รับคำสั่งเช่น `BATCH รองเท้า=5 เสื้อ=5` | `/api/line/webhook` verify signature แล้วเรียก `handleLineKeywordBatchMessage`; parser อยู่ใน `line-keyword-batch-intake.mjs` | `line-keyword-batch-intake.test.mjs`, `input-security.test.mjs` ผ่าน | ต้องยืนยัน `LINE_TARGET_USER_ID` ถูกตั้งใน production |
| 3. System creates batch | ระบบสร้าง batch จาก catalog snapshot และ selected SKU | `registerAutomationBatch` ใน LINE handler; batch metadata เก็บ selected/requested counts | batch metadata และ intake tests ผ่าน | Catalog snapshot freshness ยังเป็น operational dependency |
| 4. LINE replies with Batch Review link | LINE ตอบสั้น พร้อม primary action เปิด Batch Review | `buildLineKeywordBatchReviewFlex` ใช้ `${PUBLIC_BASE_URL}/#batch?batch_id=...` | test ยืนยัน review link, over-3 SKU summary only, safe blocker message | ต้องตรวจบน LINE OA จริงว่าปุ่มเปิด URL ได้ |
| 5. Operator opens Batch Review | Deep link เปิดหน้า batch โดยไม่ต้องไป dashboard หนัก | `app.js` รองรับ `#batch?batch_id=...`; เรียก `/api/automation/batches/:batchId/review` | `batch-review-contract.test.mjs` ผ่าน | ไม่มี browser E2E screenshot test ในรอบนี้ |
| 6. Operator confirms batch | Confirm ต้อง idempotent และไม่ทำ long-running generation ใน request handler | `POST /api/automation/batches/:batchId/confirm`; allowed actions/idempotency helpers | confirm/cancel/skip/retry tests ผ่าน | ต้อง smoke confirm จริงหลัง deploy |
| 7. Hero generation is queued/gated | Confirm แล้ว queue/gate Hero ตาม live/dry-run config | `automation-worker-core.mjs`, `buildLineBatchApprovalTaskRequests`, `live-pilot-generation-gate.mjs` | worker tests ยืนยัน enqueue live hero after LINE batch approval | Provider/env จริงยังต้อง smoke จำกัด SKU |
| 8. Hero is generated | Worker execute live generation เฉพาะเมื่อ gate ผ่านชัดเจน | `LIVE_PILOT_GENERATION_EXECUTION_TASK`; persistence plan บันทึก generation/assets | live gate/execution tests ผ่านโดยใช้ provider mock/gate | Live provider failure/cost spike ต้อง monitor |
| 9. Hero review opens from LINE/Admin | Operator เปิด review page เห็น hero + references | `/api/review/hero`, `send-line-hero-review.mjs`, `app.js` review route | hero review payload/message tests ผ่าน | ต้อง smoke UI จริง โดยเฉพาะรูป reference จาก Drive |
| 10. Hero approval persists approved hero anchor | Approve ต้องบันทึก approval และ approved hero anchor แบบ idempotent | `/api/approvals`; `hero-approval-anchor.mjs`; batch metadata anchor | `hero-approval-anchor.test.mjs` ผ่าน | ถ้า anchor มีแต่ remote URL ต้อง block จน staging พร้อม |
| 11. Support generation unlocks | Support ต้องปลดล็อกหลัง Hero approved เท่านั้น | `buildPilotGenerationExecutionPlan` อ่าน persisted approved hero anchor | plan/worker tests ยืนยัน support unlock after approval | ต้อง smoke จาก approved Hero จริง 1 SKU |
| 12. Support generation uses approved hero first | `model_input_files[0].source_role` ต้องเป็น `approved_hero_anchor` | `pilot-generation-execution-plan.mjs` สร้าง input order | tests ยืนยัน approved hero anchor index 0 และ references ตามหลัง | ถ้า reference conflict ต้องยึด product references ตาม contract |
| 13. Support images generated | Worker generate support หลัง gate ผ่าน | `maybeEnqueueLiveSupportExecution`, live support execution task | worker tests ยืนยัน enqueues/executes armed live support | Provider/live quota ต้อง monitor |
| 14. Support review/approval works | Support set ต้อง review/approve แล้วสร้าง candidate manifest | `/api/review/support-decisions`; `live-support-candidate-manifest.mjs` | support review decision/candidate manifest tests ผ่าน | UX support review ยังต้อง manual smoke |
| 15. Export/Drive link works or safe failure path | Export สำเร็จต้องเห็น Drive link; fail ต้อง user-safe | `media-asset-manifest.mjs`, export verification logic, Google Drive modules | `export-asset-verification.test.mjs` ผ่าน | Google Drive OAuth/permission จริงต้อง verify หลัง deploy |
| 16. Jobs/Asset Library reflect final state | Jobs/Assets ต้องแสดง final state และ export visibility | `/api/jobs`, `/api/assets`, `app.js` Jobs/Asset Library rendering | state mapping/export visibility tests ผ่านบางส่วน | ยังไม่มี browser E2E test ครบ Jobs + Asset Library |
| 17. Monitoring/health show safe status | Health ต้องไม่ leak secret และบอก worker/gate status | `/api/health`; `WORKER_MODE.md`; health fields safe booleans | `e2e:readiness` ผ่าน 19 checks; worker runtime tests ผ่าน | `/api/health` เป็น public operational info ต้อง monitor |
| 18. Staff/admin permissions remain correct | Staff ห้ามเห็น admin recovery/settings/costs/monitoring | server admin routes require admin; `app.js` hides/redirects admin-only pages | tests ครอบคลุมบางส่วน เช่น debug admin only, security helpers | ควรมี manual permission smoke ด้วยบัญชี staff จริง |
| 19. WordPress live write remains disabled | WordPress/WooCommerce ทำได้แค่ preflight/read-only | `wordpress-*preflight*`, render env `WORDPRESS_LIVE_WRITES_ENABLED=false` | WordPress live guard tests ผ่าน; `e2e:readiness` pass | ถ้า env ผิดต้องถือเป็น no-go ทันที |

## Production blocker list

### P0 - ต้องทำก่อนเปิด pilot จริง

1. ยังไม่มีหลักฐาน manual production smoke ครบ flow ใน repo
   - Automated tests ผ่าน แต่ยังไม่แทนการทดสอบ LINE OA จริง, Render worker จริง, Google Drive OAuth จริง, และ UI จริง
   - ต้องรัน 1 batch เล็ก เช่น `BATCH รองเท้า=1 เสื้อ=1` แล้ว verify จนถึง support/export safe path

2. ต้อง verify production env บน Render หลัง deploy
   - โดยเฉพาะ `LINE_TARGET_USER_ID`, `PUBLIC_BASE_URL`, `FAL_KEY`, Supabase, Google Drive, worker mode และ WordPress live write guard
   - ถ้า `LINE_TARGET_USER_ID` ไม่ถูกตั้ง production จะเสี่ยงให้ LINE user ที่ไม่ใช่ operator ที่กำหนด trigger flow ได้ตาม fallback logic ปัจจุบัน

3. ต้องยืนยัน Google Drive connected หรือมี warning ชัดก่อนนับว่า export path พร้อม
   - `e2e:readiness` ใน local/env ปัจจุบันผ่าน Google Drive config แล้ว
   - แต่ production ต้องยืนยันด้วย `/api/health` และ manual export/retry export

### P1 - ควรแก้ก่อน handoff ให้ทีมใช้หลายคน

1. เอกสาร worker mode เคยมีจุดขัดกันใน PR12
   - PR12 finding: `AGENTS.md` ระบุว่า production config เปิด embedded worker
   - Current truth: `docs/CURRENT_TRUTH.md`, `docs/WORKER_MODE.md`, `render.yaml` ระบุ dedicated worker mode
   - PR13 docs cleanup แก้ `AGENTS.md` ให้ตรงกับ dedicated worker mode แล้ว

2. Staff SOP ยังมี manual legacy flow ปนกับ LINE-first flow
   - ไม่ใช่ code blocker
   - แต่เป็น UX/training risk สำหรับพนักงานที่ไม่ใช่ developer

## Non-blocking issues

- หน้า Jobs/Asset Library มี evidence จาก API/UI code แต่ยังไม่มี browser-level E2E test ครบทุก state
- LINE handler ยังรองรับ action legacy เช่น `approve_hero`/`regenerate_hero` แม้ current LINE card ส่งผู้ใช้ไปหน้า web review แล้ว ถือเป็น latent compatibility surface ที่ควรทำให้เอกสารตรงกับ behavior
- Export/WordPress preflight wording ยังเป็น technical อยู่บางจุด อาจทำให้ staff งงว่าอะไร publish จริงและอะไรเป็น dry-run
- `/api/health` ไม่ leak secret แต่เปิดเผย operational posture เช่น configured booleans ซึ่งควรยอมรับเป็น internal monitoring surface หรือจำกัดด้วย auth ใน phase ถัดไป

## Security findings

สิ่งที่ผ่าน:

- LINE webhook verify HMAC signature และ reject invalid signature
- LINE webhook ไม่ทำ long-running generation โดยตรง
- API หลักใช้ `requireUser`; admin/recovery ใช้ `requireAdminUser`
- Staff UI ถูก redirect/ซ่อน admin-only navigation
- Upload/input validation มี tests สำหรับ image mimetype/extension และ unsafe remote URL
- Error/export visibility tests ยืนยันไม่ leak provider payload
- `/api/health` คืนค่าเป็น boolean/config summary ไม่แสดง secret value
- WordPress/WooCommerce live write ถูก block ด้วย guard และ tests

ความเสี่ยงที่ต้อง monitor:

- ต้องตั้ง `LINE_TARGET_USER_ID` ใน production เสมอ เพื่อไม่ให้ fallback auth เปิดกว้างเกินไป
- ควรเพิ่ม production smoke ด้วยบัญชี staff จริงเพื่อยืนยัน direct hash/API forbidden behavior ไม่หลุด
- LINE duplicate/replay guard มีหลายชั้นจาก batch/task idempotency แต่ webhook event-level dedupe แบบ durable ยังไม่เห็นเป็น blocker สำหรับ pilot ขนาดเล็ก

## UX findings

สิ่งที่ดีขึ้น:

- Default operator experience มี `My Next Actions`
- LINE batch response พาเข้า Batch Review แทนการอ่านข้อความยาว
- Batch Review ใช้ Thai label, primary CTA เดียว, item cards แทน table หนัก
- Staff ไม่ต้องเริ่มจาก manual generation form ใน flow ใหม่

สิ่งที่ยังควรปรับ:

- คำบน export/preflight/WordPress ยัง technical เกินไปบางจุด
- Staff SOP ควรแยก “flow ชั่วคราว/manual fallback” ออกจาก “LINE-first pilot flow”
- Jobs/Asset Library ควรมี copy ที่บอกชัดว่า “รอตรวจ”, “สร้างต่อได้”, “ส่งออกแล้ว”, “ต้องแจ้ง admin”
- Manual smoke ควรมี screenshot/expected UI สำหรับพนักงาน 1 หน้า

## Data/queue/idempotency findings

สิ่งที่ผ่าน:

- Batch confirm/cancel/skip/retry มี allowed action และ idempotency tests
- Worker queue มี claim guard และ retry limit ตาม runtime config tests
- Live hero/support tasks ใช้ dedupe key
- Approve hero duplicate ไม่สร้าง duplicate approval/anchor
- Retry export skip เมื่อ final export link มีอยู่แล้ว
- Persist live generation reuse existing generation/asset by provider request

ความเสี่ยง:

- ถ้าเปิด embedded worker และ dedicated worker พร้อมกันจะเสี่ยง duplicate processing; docs/render ตั้ง dedicated worker เป็น strategy หลัก และ PR13 docs cleanup แก้ `AGENTS.md` ให้ตรงแล้ว
- Stuck task recovery มี playbook แล้ว แต่ยังควร smoke admin monitoring/recovery UI จริงก่อนให้ทีมใช้หลายคน

## Deployment/env findings

สิ่งที่ผ่านจาก config/docs/tests:

- `render.yaml` แยก web service และ worker service
- web service ตั้ง `AUTOMATION_EMBEDDED_WORKER=false`
- worker service ใช้ `npm run worker`
- `WORDPRESS_DRY_RUN=true`
- `WORDPRESS_LIVE_WRITES_ENABLED=false`
- `.env.example` ใช้ safe defaults แบบ conservative สำหรับ local
- `npm run e2e:readiness` ผ่าน env/config checks รอบนี้

จุดขัดกัน:

- PR12 พบว่า `AGENTS.md` พูดว่า embedded worker เปิดใน production config ซึ่งขัดกับ `render.yaml` และ `docs/WORKER_MODE.md`
- PR13 docs cleanup แก้ `AGENTS.md` แล้ว แต่ยังต้องยืนยัน production `/api/health` หลัง deploy จริง

## Readiness script coverage review

`npm run e2e:readiness` ครอบคลุมสิ่งต่อไปนี้จาก `scripts/automation/run-e2e-readiness-check.mjs` และ `lib/automation/e2e-production-smoke.mjs`:

| Coverage area | Status | Notes |
| --- | --- | --- |
| Masked env checks | Covered | ใช้ `maskEnvValue` และแสดง secret-like env เป็น `[set:length]` |
| Supabase read-only probe | Covered | Probe `automation_batches limit 1` เมื่อ env ครบ |
| LINE config | Covered | ตรวจ presence ของ `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_TARGET_USER_ID` แบบ masked |
| Google Drive config/connected status | Partially covered | ตรวจ config readiness; connected/OAuth จริงต้องดู `/api/health` และ manual post-deploy smoke |
| WordPress guard | Covered | Fail ถ้า `WORDPRESS_LIVE_WRITES_ENABLED` เป็น truthy |
| Worker mode | Partially covered | Covered by `/api/health` และ worker runtime tests; readiness script ยังไม่ query production `/api/health` เอง |
| Support blocked without approved Hero | Covered | `buildSupportGateChecks` ตรวจ blocked support requests |
| Support ready with approved Hero fixture/path | Covered | ใช้ invariant fixture ที่มี `approved_hero_anchor` |
| Remote-only approved Hero blocked | Not directly in readiness | Covered by automation tests; recommended follow-up ถ้าต้องการให้ readiness script ตรวจ artifact จริง |
| Support input order | Covered by fixture/invariant | Fixture ตรวจ `approved_hero_anchor` เป็น input แรก |
| Confirm idempotency evidence | Not directly in readiness | Covered by batch review contract tests; manual smoke ต้องยืนยัน production confirm ซ้ำไม่ duplicate |
| Secret-safe output | Covered | Summary และ JSON details ใช้ masked env output |

Recommended follow-up: ถ้าจะให้ readiness script แทน manual preflight ได้มากขึ้น ให้เพิ่ม optional check ที่ query production `/api/health` และ artifact-based remote-only approved Hero case โดยยังไม่ generate ภาพจริง

## Required fixes before pilot

1. รัน manual production smoke บน Render/LINE/Google Drive จริง 1 batch
2. ไล่ `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`
3. ตรวจ `/api/health` production และบันทึกค่า safe status โดยไม่ใส่ secret
4. ยืนยัน `LINE_TARGET_USER_ID` production ถูกตั้ง
5. ยืนยัน Google Drive connected และ export/retry export path ใช้งานได้หรือแสดง warning ที่เข้าใจง่าย
6. เติมหลักฐานใน `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`
7. เตรียม rollback owner และ cost monitor ระหว่าง pilot วันแรก

## Suggested fixes after pilot

1. Polish UX ภาษาไทยบน Jobs, Asset Library, Export, Monitoring
2. เพิ่ม browser/manual smoke checklist พร้อม screenshot สำหรับ staff
3. เพิ่ม durable LINE webhook event dedupe ถ้าปริมาณ usage เพิ่ม
4. จำกัด `/api/health` เพิ่มเติมถ้าระบบเปิดนอก internal network
5. แยก Staff SOP เป็น 2 โหมด: LINE-first pilot และ manual fallback
6. เพิ่ม production audit dashboard สำหรับ approve/retry/cancel/export โดยไม่เปิด WordPress live write

## Test results

รันเมื่อ 2026-06-23:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:automation` | pass | 244 tests, 0 fail |
| `npm test` | pass | 244 tests, 0 fail |
| `npm run e2e:readiness` | pass | 19 pass, 0 warn, 0 fail; ไม่ generate ภาพจริง |
| `npm run gate:generation` | pass | `Gate status: ready_for_manual_live_confirmation`; selected requests 0 |

## Recommended next PRs

ถ้าจะให้ pilot แข็งขึ้นก่อนเปิดให้ทีมใช้จริง แนะนำ PR เล็กที่สุดตามนี้:

1. PR: Production smoke record and health snapshot
   - ใช้ `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md` เป็นหลักฐาน smoke
   - บันทึก expected `/api/health` fields สำหรับ go/no-go โดยไม่ใส่ secret

2. PR: Staff-facing UX copy polish for pilot
   - ปรับคำไทยใน Jobs/Batch Review/Export ให้ลด technical wording
   - ไม่เปลี่ยน business flow และไม่เปิด WordPress live write

3. PR: Optional readiness script extension
   - เพิ่ม optional production `/api/health` check
   - เพิ่ม artifact-based remote-only approved Hero blocker check โดยไม่ยิง live generation
