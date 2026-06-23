# Post-Deploy Verification Checklist

ใช้ runbook นี้หลัง Render deploy เสร็จ ก่อนเริ่ม controlled internal pilot ของ `image-workflow`

อ่านร่วมกับ:

- `docs/PRODUCTION_LAUNCH_GATE.md`
- `docs/FINAL_E2E_REVIEW.md`
- `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`
- `docs/E2E_PRODUCTION_SMOKE.md`
- `docs/WORKER_MODE.md`
- `docs/ROLLBACK_AND_INCIDENT_PLAYBOOK.md`

ห้ามใส่ secret, token, key, password, cookie/session, OAuth token หรือ provider payload เต็มลงในหลักฐาน smoke

## Verification sequence

1. Verify deployment version
   - เปิด Render dashboard
   - จด commit/version ของ web service และ worker service
   - ตรวจว่า deploy เสร็จทั้งสอง service

2. Open production `/api/health`
   - เปิด `https://image-workflow.onrender.com/api/health`
   - ถ่าย screenshot เฉพาะเมื่อมั่นใจว่าไม่มี secret/token/key

3. Confirm health does not leak secrets
   - ต้องไม่เห็น raw env value, service role key, LINE token, OAuth token, cookie, password หรือ provider payload
   - หากเห็น secret ให้หยุดทันทีและถือเป็น No-Go

4. Confirm worker mode is dedicated
   - Expected: `worker_mode = dedicated_worker`

5. Confirm embedded worker is disabled
   - Expected: `embedded_worker_enabled = false`

6. Confirm dedicated worker expected is true
   - Expected: `dedicated_worker_expected = true`

7. Confirm WordPress live write disabled
   - Expected: `wordpress_dry_run = true`
   - Expected: `wordpress_live_writes_enabled = false`

8. Confirm live generation flags match intended pilot mode
   - For controlled pilot on Render, expected:
     - `live_generation_enabled = true`
     - `dry_run = false`
     - `support_after_hero_approval_enabled = true`
   - If running safe/staging smoke only, document the intended difference

9. Confirm Google Drive configured/connected or warning is clear
   - Check `google_drive_configured`
   - Check `google_drive_connected`
   - If disconnected, pilot can test generation/review only, not export success

10. Confirm LINE configured
    - Check `line_configured`
    - Confirm `LINE_TARGET_USER_ID` is set in Render env without exposing value

11. Login as admin
    - Admin should reach `#next`
    - Admin menu may include Settings/Monitoring/Costs

12. Login as staff
    - Staff should reach `#next`
    - Staff should not see admin-only controls

13. Confirm staff/admin boundary
    - Staff direct hash to `#settings` should be blocked/redirected
    - Staff direct hash to `#monitoring` should be blocked/redirected
    - Staff direct hash to `#costs` should be blocked/redirected
    - Staff should not execute admin recovery/export retry action

14. Send one small LINE BATCH command

```text
BATCH รองเท้า=1 เสื้อ=1
```

15. Open Batch Review from LINE deep link
    - Confirm link uses production base URL
    - Confirm Batch Review loads after login/auth

16. Confirm batch
    - Click primary CTA once
    - Refresh/retry once only to confirm idempotency if safe
    - Confirm request handler does not hang

17. Verify worker queues/generates Hero
    - Check Jobs state
    - Check Render worker logs
    - Confirm web service did not process queue as embedded worker

18. Approve Hero
    - Open Hero Review from LINE/Admin
    - Approve one valid Hero
    - Confirm duplicate approve does not create duplicate final approval
    - Confirm `approved_hero_anchor` is persisted

19. Verify Support unlock
    - Before approval, Support should be blocked
    - After approval, Support should unlock according to gate rules
    - If approved Hero is remote-only, system should block with safe error until staged/local file exists

20. Generate/review/approve Support
    - Confirm Support uses `approved_hero_anchor` as first input
    - Confirm product references follow approved Hero anchor
    - Review Support and approve valid candidates

21. Verify export/Drive or safe failure path
    - Attempt export/preflight path
    - If Drive succeeds, confirm Drive link
    - If Drive fails/disconnected, confirm safe recovery message
    - Confirm no WordPress/WooCommerce live write

22. Verify Jobs/Asset Library final state
    - Jobs should show current stage/action accurately
    - Asset Library should show approved/generated/export assets as expected
    - Export failure should not look like success

23. Record evidence in `docs/PRODUCTION_SMOKE_RECORD_TEMPLATE.md`
    - Fill safe values only
    - Add links/screenshots only after secret check
    - Record issues, owners and workarounds

24. Decide Go / Soft Go / No-Go
    - Go only if one small batch reaches expected final state without P0/P1 issue
    - Soft Go if core flow works but admin monitoring/workaround is needed
    - No-Go if any hard no-go condition appears

## Hard No-Go conditions

- `/api/health` leaks secret/env raw value
- Staff sees admin page/action
- LINE deep link points to wrong URL
- Confirm batch duplicates generation
- Hero approve does not persist `approved_hero_anchor`
- Support can generate without approved Hero
- Support input first item is not approved hero anchor
- Worker mode is embedded + dedicated without explicit allow
- WordPress live write enabled
- Export failure gives no recovery path
- Operator cannot tell next action from Batch Review

If any hard No-Go condition appears:

1. Stop pilot
2. Tell staff not to retry/approve more work
3. Capture safe evidence
4. Use `docs/ROLLBACK_AND_INCIDENT_PLAYBOOK.md`

## UX checks before pilot

Batch Review must pass these staff-facing checks:

- Staff opens Batch Review and can answer within 10 seconds: batch นี้คืออะไร
- Staff can answer: ตอนนี้อยู่ขั้นไหน
- Staff can answer: ต้องกดอะไรต่อ
- Primary CTA has one clear button for the current state
- Export failure message says the next step or who should fix it
- Staff does not see debug/admin internals

If staff cannot answer these without developer explanation, use Soft Go at most and keep admin supervising the pilot.

## Evidence rules

Allowed evidence:

- Timestamp
- Commit/version
- Safe `/api/health` boolean fields
- Batch id / SKU / job id / generation id
- Screenshot with no secret/token/key
- Render service status without env values
- Short notes about expected vs actual behavior

Not allowed:

- Raw `SUPABASE_SERVICE_ROLE_KEY`
- Raw `LINE_CHANNEL_ACCESS_TOKEN`
- Raw `LINE_CHANNEL_SECRET`
- OAuth token/refresh token
- Cookie/session value
- WordPress/WooCommerce password or app password
- Provider payload containing credentials
