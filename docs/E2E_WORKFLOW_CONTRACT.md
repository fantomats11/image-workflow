# E2E Workflow Contract

Last updated: 2026-06-18

เอกสารนี้คือ contract กลางของ production workflow เพื่อให้ backend, LINE, frontend, worker และ tests คุยเรื่อง state เดียวกัน โดยยังไม่เปลี่ยน behavior ของ LINE/frontend ใน PR นี้

## Source of truth

อ่านร่วมกับ:

- `docs/CURRENT_TRUTH.md`
- `docs/PRODUCT_IMAGE_USE_CASE_CONTRACT.md`
- `lib/automation/e2e-workflow-state.mjs`
- `lib/automation/pilot-generation-execution-plan.mjs`
- `lib/automation/live-pilot-generation-gate.mjs`
- `lib/automation/automation-worker-core.mjs`
- `lib/automation/line-keyword-batch-intake.mjs`

ถ้าเอกสารเก่าขัดกับ contract นี้ ให้ตรวจโค้ดก่อน แล้วค่อยอัปเดตเอกสาร ไม่เดา business flow เอง

## Current E2E path

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

คำว่า `approve/export` ใน phase นี้หมายถึง export/preflight/readiness gate ไม่ใช่ WordPress/WooCommerce live write

## Batch operator-facing states

| State | ความหมาย | Next action หลัก |
| --- | --- | --- |
| `draft_created` | สร้าง batch draft แล้ว แต่ยังไม่พร้อมให้ confirm | ตรวจชุดงาน |
| `waiting_batch_review` | batch ต้องให้คนตรวจ selection/blockers ก่อน | เปิด Batch Review |
| `ready_to_confirm` | selected SKUs พร้อมให้ยืนยัน | ยืนยันชุด SKU |
| `hero_queued` | confirm แล้วและรอคิวสร้าง Hero | รอระบบ |
| `hero_generating` | worker กำลังสร้าง Hero | รอระบบ |
| `hero_waiting_review` | มี Hero ให้ตรวจแล้ว | เปิดหน้าตรวจ Hero |
| `hero_approved` | Hero ของชุดงานผ่าน approval แล้ว | รอระบบเตรียม Support |
| `support_ready` | เงื่อนไข Support พร้อมแล้วและรอ queue/run | รอระบบสร้าง Support |
| `support_queued` | Support อยู่ในคิว | รอระบบ |
| `support_generating` | worker กำลังสร้าง Support | รอระบบ |
| `support_waiting_review` | มี Support ให้ตรวจแล้ว | เปิดหน้าตรวจ Support |
| `support_approved` | Support ผ่าน review แล้ว | เปิดหน้าตรวจไฟล์ก่อนส่งออก |
| `export_ready` | candidate/media manifest พร้อมเข้า export/preflight | เปิดหน้าตรวจไฟล์ก่อนส่งออก |
| `exported` | ส่งออกแล้ว | ไม่ต้องทำอะไรต่อ |
| `partially_failed` | สำเร็จบาง SKU และล้มเหลวบาง SKU | ตรวจรายการที่ไม่สำเร็จ |
| `failed` | batch ล้มเหลว | ตรวจงานที่ไม่สำเร็จ |
| `cancelled` | batch ถูก reject/cancel | ไม่ต้องทำอะไรต่อ |

รายการ state ในโค้ด: `BATCH_OPERATOR_STATES`

## Item-level states

| State | ความหมาย | Next action หลัก |
| --- | --- | --- |
| `selected` | SKU ถูกเลือกเข้าชุดงาน | รอระบบสร้าง Hero |
| `skipped` | SKU ถูกข้ามหรือ reject | ไม่ต้องทำอะไรต่อ |
| `missing_reference` | SKU ยังไม่มีภาพอ้างอิงที่ใช้สร้างได้ | เพิ่มหรือตรวจภาพอ้างอิง |
| `hero_pending` | รอสร้าง Hero | รอระบบ |
| `hero_generating` | กำลังสร้าง Hero | รอระบบ |
| `hero_failed` | สร้าง Hero ไม่สำเร็จ | ตรวจงานสร้าง Hero ที่ไม่สำเร็จ |
| `hero_waiting_review` | Hero พร้อมให้ตรวจ | เปิดหน้าตรวจ Hero |
| `hero_approved` | บันทึก approval ของ Hero แล้ว | รอระบบเตรียม Support |
| `support_blocked_waiting_hero` | Support ถูกล็อกเพราะ Hero ยังไม่ approved | เปิดหน้าตรวจ Hero |
| `support_ready` | มี approved Hero anchor และพร้อมสร้าง Support | รอระบบสร้าง Support |
| `support_generating` | กำลังสร้าง Support | รอระบบ |
| `support_failed` | สร้าง Support ไม่สำเร็จ | ตรวจงานสร้าง Support ที่ไม่สำเร็จ |
| `support_waiting_review` | Support พร้อมให้ตรวจ | เปิดหน้าตรวจ Support |
| `support_approved` | Support ผ่าน review และพร้อมเข้า manifest/preflight | เปิดหน้าตรวจไฟล์ก่อนส่งออก |
| `exported` | SKU นี้ส่งออกแล้ว | ไม่ต้องทำอะไรต่อ |

รายการ state ในโค้ด: `ITEM_OPERATOR_STATES`

## `next_action` contract

ทุก batch/item ต้องตอบได้ว่า user ต้องทำอะไรต่อ 1 อย่างเท่านั้น

ตัวอย่าง:

```json
{
  "state": "hero_waiting_review",
  "label_th": "รอตรวจ Hero",
  "next_action": {
    "type": "open_review",
    "label_th": "เปิดหน้าตรวจ Hero",
    "href": "/#review?generation_id=..."
  }
}
```

`next_action.type` ที่ใช้ได้ใน phase นี้:

- `review_batch`
- `open_batch_review`
- `confirm_batch`
- `wait_system`
- `open_review`
- `open_export_preflight`
- `resolve_reference`
- `inspect_failure`
- `none`

## Internal-to-user-facing mapping

Mapping อยู่ใน `lib/automation/e2e-workflow-state.mjs`

ตัวอย่าง mapping สำคัญ:

| Internal status/blocker | User-facing state/error |
| --- | --- |
| `awaiting_approval` | `ready_to_confirm` หรือ `selected` |
| `approved` batch | `hero_queued` |
| `hero_approved` item | `hero_approved` หรือ `support_ready` ถ้ามี approved anchor |
| `support_ready_for_review` | `support_waiting_review` |
| `support_approved_for_candidate_manifest` | `support_approved` |
| `ready_for_media_manifest_preflight` | `export_ready` |
| `reference_assets_need_resolution` | `missing_reference_assets` |
| `support_requires_approved_hero_anchor` | `approved_hero_anchor_missing` |
| `approved_hero_anchor_requires_local_file` | `approved_hero_anchor_requires_local_file` |

## Current API wiring

`/api/jobs` ใช้ `resolveBatchWorkflowState` และ `resolveItemWorkflowState` เพื่อส่ง contract กลางกลับไปพร้อม job row แล้ว โดยเป็น field เพิ่มแบบ backward-compatible:

- `workflow.item`
- `workflow.batch`
- `workflowState`
- `workflowStateLabelTh`
- `workflowNextAction`
- `batchWorkflowState`
- `batchWorkflowStateLabelTh`
- `batchWorkflowNextAction`

field เดิมของ `/api/jobs` ยังอยู่ครบ และ frontend ยังไม่ได้เปลี่ยนมา render จาก contract ใหม่นี้ใน PR นี้

Batch Review API ใช้เป็น source of truth สำหรับหน้า operator review ของ LINE keyword batch:

- `GET /api/automation/batches/:batchId/review`
  - คืน batch summary, raw request text, requested/selected counts, item cards, blockers, progress, `label_th`, `next_action`, `allowed_actions`
  - คืน `debug` เฉพาะ admin
- `POST /api/automation/batches/:batchId/confirm`
  - idempotent ผ่าน `automation_tasks.dedupe_key`
  - update batch เป็น `approved` แล้ว enqueue `generate_batch` สำหรับ Hero ตาม existing gate rules
  - ไม่ run long-running generation ใน request handler
- `POST /api/automation/batches/:batchId/cancel`
  - cancel ได้เฉพาะก่อน generation/approval phase
  - idempotent ผ่าน completed audit task
- `POST /api/automation/batch-items/:itemId/skip`
  - skip SKU ก่อน generation
- `POST /api/automation/batch-items/:itemId/retry`
  - retry เฉพาะ item state `hero_failed` หรือ `support_failed`
  - enqueue `generate_batch` ด้วย dedupe key เพื่อไม่สร้าง final output ซ้ำ

## Staff-safe error codes

| Code | ข้อความสำหรับ staff |
| --- | --- |
| `missing_reference_assets` | ไม่พบภาพอ้างอิงสินค้า |
| `approved_hero_anchor_missing` | ไม่พบ Hero ที่อนุมัติแล้ว |
| `approved_hero_anchor_requires_local_file` | Hero ที่อนุมัติแล้วยังไม่มีไฟล์ local สำหรับใช้สร้าง Support |
| `generation_provider_failed` | ระบบสร้างภาพไม่สำเร็จ |
| `queue_timeout` | งานค้างในคิวนานเกินไป |
| `export_failed` | ส่งออกไฟล์ไม่สำเร็จ |
| `google_drive_disconnected` | Google Drive ยังไม่พร้อมใช้งาน |
| `permission_denied` | บัญชีนี้ไม่มีสิทธิ์ทำรายการ |

## Invariants

Invariant ที่ contract helper enforce แล้ว:

- Support generation ห้าม ready ถ้ายังไม่มี approved hero
- `support model_input_files[0].source_role` ต้องเป็น `approved_hero_anchor`
- `product_reference` inputs ต้องตามหลัง hero anchor
- WordPress live write ต้องไม่เกิดเมื่อ `WORDPRESS_LIVE_WRITES_ENABLED=true` ถูกส่งเข้า validator
- LINE webhook ห้ามทำ long-running generation โดยตรง
- Batch confirmation ต้องมี dedupe key
- Approve Hero ต้องมี dedupe key
- Retry ต้องไม่สร้าง duplicate final assets

Invariant ที่ code เดิม enforce อยู่แล้ว:

- `buildPilotGenerationExecutionPlan` block Support ด้วย `support_requires_approved_hero_anchor`
- `buildRequest` ใส่ approved Hero anchor เป็น model input แรกของ Support เมื่อมี anchor
- `buildPilotGenerationExecutionPlan` อ่าน `approved_hero_anchor` จาก `automation_batch_items.metadata` ได้ หลัง Web/Admin หรือ LINE approve hero
- `recordLineAutomationAction` ใช้ dedupe key กับ batch confirmation tasks
- `/api/approvals` idempotent ต่อ generation approval เดิม
- WordPress/media preflight modules ตั้ง `live_write_allowed: false`, `live_writes_enabled: false`

## Test plan

### Unit

- `test/automation/e2e-workflow-state.test.mjs`
- ตรวจ state list ทั้ง batch/item
- ตรวจ `next_action` มี 1 action ต่อ state
- ตรวจ staff-safe error mapping
- ตรวจ support model input ordering invariant
- ตรวจ hard guardrails ผ่าน `validateE2EWorkflowInvariants`

### Integration

- เพิ่มในรอบถัดไป: route/API contract test สำหรับ `/api/review/hero`, `/api/approvals`, `/api/review/support-decisions`
- เพิ่มในรอบถัดไป: worker task chain test สำหรับ `approve_batch -> hero -> approve_hero -> support`

### Smoke

- รัน `npm run test:automation`
- ตรวจว่าไม่มี test เดิมเกี่ยวกับ Prompt Framework, LINE client, generation gate, media preflight แตก

### Single-SKU support generation smoke path

ใช้กับ SKU เดียวหลัง Hero ถูก approve แล้ว เพื่อยืนยันว่า Support unlock ตาม gate rules โดยไม่ยิง live image ก่อน:

1. Readiness-only:

```bash
npm run plan:generation
npm run gate:generation
```

2. ตรวจผล plan/gate:

- Support request ของ SKU นั้นต้องไม่มี `support_requires_approved_hero_anchor`
- `model_input_files[0].source_role` ต้องเป็น `approved_hero_anchor`
- `product_reference` ต้องอยู่หลัง index 0
- ถ้า Hero ยังเป็น remote-only ต้องเห็น `approved_hero_anchor_requires_local_file`

3. Execute จริงเฉพาะ operator ตั้ง env gate เองชัดเจน:

```bash
AI_GENERATION_LIVE_ENABLED=true AI_GENERATION_DRY_RUN=false AI_GENERATION_CONFIRM_SUPPORT_AFTER_HERO_APPROVAL=true npm run worker
```

ห้ามเปิด WordPress/WooCommerce live writes ระหว่าง smoke นี้

### Manual production smoke

1. ส่ง `BATCH รองเท้า=1 เสื้อ=1` ใน LINE
2. ยืนยัน batch จาก LINE
3. เปิด `Automation Inbox`
4. ตรวจว่า state ไป `hero_queued` หรือ `hero_generating`
5. เมื่อ Hero เสร็จ ให้เปิดหน้า Review
6. กด `อนุมัติ Hero`
7. ตรวจว่า Support ถูก unlock และสร้างต่อ
8. ตรวจ Support Review
9. กด approve support candidates
10. ตรวจว่า export/preflight แสดง ready/blocked ชัดเจน
11. ยืนยันว่าไม่มี WordPress/WooCommerce live write

## Out of scope for this PR

- Wire helper เข้า `app.js`
- เปลี่ยน LINE card/UI behavior
- เปลี่ยน schema เป็น enum
- เปิด WordPress/WooCommerce live write
- เปลี่ยน Prompt Framework rules
