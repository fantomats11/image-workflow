# Production Smoke Record Template

ใช้เอกสารนี้เป็นแบบฟอร์มบันทึกหลักฐานหลัง deploy production จริง ก่อนตัดสินใจเริ่ม controlled internal pilot

ห้ามใส่ secret, token, key, password, cookie/session, OAuth token, private key หรือ provider payload เต็มในเอกสารนี้ ให้บันทึกเฉพาะค่า safe boolean, masked value, screenshot ที่ตรวจแล้วไม่มี secret หรือข้อความสรุป

## Smoke metadata

| Field | Value |
| --- | --- |
| Date/time | |
| Tester name | |
| Role: admin/staff | |
| Production URL | |
| Deploy environment | |
| Commit/version | |
| Render web service status | |
| Render worker service status | |

## Health snapshot

Checked endpoint: `/api/health`

| Field | Value / Evidence |
| --- | --- |
| `/api/health` checked at | |
| `status` | |
| `version` | |
| `commit` | |
| `worker_mode` | |
| `embedded_worker_enabled` | |
| `dedicated_worker_expected` | |
| `live_generation_enabled` | |
| `dry_run` | |
| `wordpress_dry_run` | |
| `wordpress_live_writes_enabled` | |
| `google_drive_configured` | |
| `google_drive_connected` | |
| `storage_configured` | |
| `line_configured` | |
| Secret leak check result | |

Expected pilot posture:

- `worker_mode = dedicated_worker`
- `embedded_worker_enabled = false`
- `dedicated_worker_expected = true`
- `wordpress_dry_run = true`
- `wordpress_live_writes_enabled = false`
- `/api/health` must not expose raw secret/env values

## Auth smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Admin login | |
| Staff login | |
| Logout | |
| Staff direct hash to `#settings` | |
| Staff direct hash to `#monitoring` | |
| Staff direct hash to `#costs` | |
| Staff forbidden admin API/manual check | |

No-Go if staff can see or execute admin-only page/action/API.

## LINE smoke

| Field | Value |
| --- | --- |
| LINE test user/group | |
| Command sent | |
| Batch id | |
| Message received | |
| Batch Review deep link URL | |
| Opened successfully: yes/no | |

Suggested first command:

```text
BATCH รองเท้า=1 เสื้อ=1
```

Expected:

- LINE replies with a short summary
- Primary action opens Batch Review
- Long SKU list is not sent in LINE
- Deep link points to production `PUBLIC_BASE_URL`

## Batch Review smoke

| Question / Check | Result | Evidence / Notes |
| --- | --- | --- |
| Operator can answer “Batch นี้คืออะไร” | |
| Operator can answer “ตอนนี้อยู่ขั้นไหน” | |
| Operator can answer “ต้องกดอะไรต่อ” | |
| Primary CTA is clear | |
| Staff does not see debug/admin internals | |

Expected:

- Batch ID, source, request text, status and next action are visible
- One primary CTA is visible for the current state
- SKU cards are readable
- Staff does not see raw queue task id, provider payload, prompt internals, or debug drawer

## Confirm smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Confirm clicked once | |
| Task queued | |
| Request handler did not hang | |
| Confirm clicked twice or refreshed | |
| Duplicate generation avoided | |

Expected:

- Confirm is idempotent
- Request handler returns promptly
- Generation work is queued/processed by worker, not done inside webhook/request handler

## Hero smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Hero queued | |
| Hero generated | |
| Hero review opened | |
| Hero approved | |
| Duplicate approve avoided | |
| `approved_hero_anchor` persisted | |
| Evidence path/link/log note | |

Expected:

- Hero review page shows generated Hero and product references when available
- Approve Hero persists approval and approved hero anchor
- Duplicate approve does not create duplicate final approval/anchor
- Regenerate Hero, if used, queues Hero again rather than skipping because an old asset exists

## Support smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Support blocked before Hero approval | |
| Support unlocked after Hero approval | |
| Support model input first item is `approved_hero_anchor` | |
| Product references follow approved hero anchor | |
| Remote-only approved hero behavior if tested | |
| Support generated | |
| Support reviewed/approved | |

Expected:

- Support cannot generate before approved Hero
- Support uses approved Hero as model input index 0
- Product references follow approved Hero anchor
- Remote-only approved Hero must block with a safe error until local/staged file is available

## Export/Drive smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Export attempted | |
| Google Drive link created or safe failure shown | |
| Jobs reflects final state | |
| Asset Library reflects final state | |
| Retry export duplicate guard if tested | |

Expected:

- If Google Drive is connected, export link is visible where expected
- If Google Drive is disconnected/fails, UI shows a user-safe recovery message
- Failed export must not look like success
- Retry export must not duplicate final exported asset unnecessarily

## WordPress guard

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| `WORDPRESS_LIVE_WRITES_ENABLED=false` | |
| No WordPress live write event | |
| Preflight/dry-run only | |

No-Go if WordPress/WooCommerce live write is enabled or any create/update/publish/media attach live event happens during this phase.

## Worker/queue smoke

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Dedicated worker processed task | |
| No duplicate task claim | |
| No stuck running task | |
| Retry/attempt status if relevant | |

Expected:

- Render worker service is the process claiming/processing queue tasks
- Web service does not start embedded worker
- No `multiple_workers` mode unless explicitly intended with `ALLOW_MULTIPLE_WORKERS=true`

## Issues found

| Issue | Severity | Owner | Workaround | Must fix before pilot: yes/no |
| --- | --- | --- | --- | --- |
| | | | | |

Severity guide:

- P0: stop pilot / rollback
- P1: must fix before letting staff continue
- P2: can pilot with workaround and admin monitoring
- P3: polish/follow-up

## Final decision

| Field | Value |
| --- | --- |
| Decision: Go / Soft Go / No-Go | |
| Decision maker | |
| Timestamp | |
| Notes | |

Decision guide:

- Go: one small pilot batch passed, no P0/P1 issues, rollback path ready
- Soft Go: core flow passed but limited to admin-supervised batch/SKU count
- No-Go: any hard no-go condition from launch gate/checklist appears
