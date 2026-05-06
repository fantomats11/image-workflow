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
