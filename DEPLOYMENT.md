# Deployment Guide

## Local Pilot

Use this for testing with the owner or one staff member.

```bash
cd prompt-system-prototype
npm install
cp .env.example .env
npm start
```

Open:

```text
http://127.0.0.1:8765
```

Required in `.env`:

```text
FAL_KEY=...
PORT=8765
```

Optional for approved image sync:

```text
DRIVE_OUTPUT_DIR=/absolute/path/to/Google Drive synced folder
```

## Small Team on Same Network

Use this only for short internal testing.

1. Run the app on the owner's Mac.
2. Find the Mac IP address.
3. Start server with host binding if needed.
4. Staff open `http://OWNER_MAC_IP:8765`.
5. Keep generation volume low because this version has only a simple in-process queue.

Risk:

- No login.
- No per-user history.
- If the machine sleeps, the app stops.
- Uploaded files are local to the machine.

## Real Multi-User Production

Use this when several staff members need reliable access.

Recommended steps:

1. Deploy the Node app to Render, Railway, Fly.io, or a VPS.
2. Add Supabase Postgres.
3. Add Cloudflare R2 or S3 for uploaded references and generated files.
4. Add login and roles.
5. Move job history from browser localStorage into database.
6. Replace in-process queue with Redis/BullMQ or platform queue.
7. Add retry and failed-job recovery.
8. Export approved files to Google Shared Drive.

## Environment Variables for Production

```text
FAL_KEY=
OPENAI_API_KEY=
PORT=
PUBLIC_BASE_URL=
DATABASE_URL=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
DRIVE_OUTPUT_DIR=
```

## LINE Approval Webhook

The production server now exposes a permanent LINE webhook route:

```text
POST /api/line/webhook
```

Required production environment variables:

```text
PUBLIC_BASE_URL=https://your-production-domain.example
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_TARGET_USER_ID=
```

After deploying, point LINE Developers to the production route:

```bash
node scripts/automation/set-line-webhook.mjs
```

The script uses `PUBLIC_BASE_URL` automatically and verifies the endpoint with LINE. You can also pass an explicit endpoint:

```bash
node scripts/automation/set-line-webhook.mjs https://your-production-domain.example/api/line/webhook
```

LINE postback actions are recorded in `audit_events` with event types such as:

```text
line_approve_batch
line_needs_review
line_reject_batch
```

During the pilot, these actions acknowledge the approval decision and remain dry-run: no image generation or WordPress publishing is triggered until the queue worker is connected.

## Automation Worker

The worker is the backend engine behind LINE approvals. It polls `automation_tasks`, claims queued tasks, and records execution audit events.

Run locally:

```bash
npm run worker
```

Run one poll cycle for smoke tests:

```bash
AUTOMATION_WORKER_ONCE=true npm run worker
```

Required environment variables are the same Supabase server-side variables used by the web service:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AI_GENERATION_DRY_RUN=true
WORDPRESS_DRY_RUN=true
AUTOMATION_WORKER_POLL_INTERVAL_MS=5000
```

Render should run this as a separate Background Worker service:

```text
startCommand: npm run worker
```

Queue tables:

```text
automation_batches
automation_batch_items
automation_tasks
```

Current pilot behavior:

- Sending a pilot batch to LINE registers the batch and item SKUs in Supabase when service-role env is available.
- Pressing `Approve batch` creates one deduplicated `generate_batch` task.
- The worker completes that task as dry-run and records `automation_task_dry_run_completed`.
- Real generation and WordPress publishing stay disabled until `AI_GENERATION_DRY_RUN=false` and `WORDPRESS_DRY_RUN=false`, and the live task processors are connected.

## Recommended Rollout

Week 1:

- Pilot 20-50 products locally.
- Record failure cases.
- Freeze category prompt rules.

Week 2:

- Deploy hosted prototype.
- Add shared storage.
- Add job database.

Week 3:

- Add login, roles, queue worker, and Drive export.
- Train staff with 5-10 sample products per category.

Week 4:

- Set generation budget.
- Add reporting: images generated, pass rate, cost, rework rate.
