# Winter Image Desk - Production Readiness

## Current Stage

The app is now a local internal workflow prototype. It is suitable for a pilot with a small team on one machine or one shared local server.

Implemented:

- Staff-facing form for product setup.
- Product reference upload, up to 10 images.
- Model reference upload, up to 5 images.
- Automatic prompt structure for winter product categories.
- Hero generation through fal `openai/gpt-image-2/edit`.
- Hero approval and local approved image saving.
- QC gate: support set generation is locked until Hero is approved and QC is 7/7.
- Support shot presets by product category.
- Automatic support shot detection from feature text, such as hood, fur, fleece lining, waterproof, outsole, logo.
- Custom support shot input.
- Local browser job history.
- Basic server-side generation queue to reduce concurrent API collision.

## Still Missing Before Real Multi-User Use

These are required before opening the system to multiple staff members as a real shared tool:

- Login and user roles.
- Central database for jobs, QC state, prompt versions, generated images, and approvals.
- Shared object storage for uploads and generated files.
- Durable queue worker with retry and failure handling.
- Cost tracking per job and per user.
- Audit trail: who generated, who QC'd, who approved, when.
- Admin-only prompt template editor.
- Shared Drive export using service account or approved API flow.

## Recommended Production Stack

Use this stack for the first real deployment:

- Frontend/backend: Node.js app deployed on Render, Railway, Fly.io, or a small VPS.
- Database: Supabase Postgres.
- Storage: Cloudflare R2 or AWS S3.
- Queue: BullMQ + Redis, or platform queue if available.
- Auth: Supabase Auth, Clerk, or Google Workspace OAuth.
- Export: Google Drive Shared Drive API or Make/Zapier automation as an interim bridge.

## Roles

- Admin: edits prompt rules, categories, model settings, API settings.
- Staff: creates jobs, uploads references, generates Hero, requests QC.
- Approver: approves Hero, completes QC, generates/approves support set.

## Data Model

Minimum tables:

- `users`: id, name, email, role.
- `jobs`: id, product_name, category, brand, status, created_by, created_at.
- `assets`: id, job_id, type, url, storage_key, created_at.
- `generations`: id, job_id, kind, prompt, model, request_id, status, image_url, cost_estimate.
- `qc_checks`: id, generation_id, checklist_json, checked_by, checked_at.
- `approvals`: id, generation_id, approved_by, approved_at, export_path.

## Publish Plan

1. Pilot locally with 20-50 real products.
2. Freeze prompt templates that pass QC most often.
3. Add hosted database and object storage.
4. Move uploads from local memory to object storage.
5. Add login and roles.
6. Add queue worker and retry.
7. Add Google Drive Shared Drive export.
8. Add dashboard for job status, cost, and staff throughput.

## Current Blockers

Need decisions or credentials from owner:

- Hosting provider.
- Domain/subdomain.
- Database provider.
- Storage provider.
- Google Drive destination folder or Shared Drive.
- User account list and role structure.
- Monthly generation budget or per-user limits.
