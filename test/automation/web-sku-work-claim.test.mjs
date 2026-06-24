import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJs = fs.readFileSync(path.resolve("app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve("server.mjs"), "utf8");
const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve("styles.css"), "utf8");
const migrationSql = fs.readFileSync(path.resolve("supabase/migrations/20260624000000_create_sku_work_states.sql"), "utf8");

test("migration creates SKU work state table with optimistic version fields and locked state", () => {
  assert.match(migrationSql, /create table if not exists public\.sku_work_states/);
  assert.match(migrationSql, /sku text primary key/);
  assert.match(migrationSql, /status text not null default 'available'/);
  assert.match(migrationSql, /version integer not null default 0/);
  assert.match(migrationSql, /locked_by uuid/);
  assert.match(migrationSql, /locked_at timestamptz/);
  assert.match(migrationSql, /expires_at timestamptz/);
  assert.match(migrationSql, /metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(migrationSql, /alter table public\.sku_work_states enable row level security/);
  assert.match(migrationSql, /revoke all on public\.sku_work_states from anon, authenticated/);
  assert.match(migrationSql, /grant select, insert, update, delete on public\.sku_work_states to service_role/);
  assert.doesNotMatch(migrationSql, /user_metadata|raw_user_meta_data/);
});

test("server exposes optimistic claim status, claim, and release endpoints", () => {
  assert.match(serverJs, /app\.get\("\/api\/sku-work\/:sku", requireUser/);
  assert.match(serverJs, /app\.post\("\/api\/sku-work\/:sku\/claim", requireUser/);
  assert.match(serverJs, /submittedVersion/);
  assert.match(serverJs, /\.eq\("version", submittedVersion\)/);
  assert.match(serverJs, /sku_work_claim_conflict/);
  assert.match(serverJs, /sku_work_version_conflict/);
  assert.match(serverJs, /app\.post\("\/api\/sku-work\/:sku\/release", requireUser/);
});

test("create UI claims selected SKU and blocks Hero generation on another user's claim", () => {
  assert.match(indexHtml, /id="skuWorkClaimCard"/);
  assert.match(appJs, /function loadSkuWorkClaimStatus/);
  assert.match(appJs, /function claimSelectedSkuWork/);
  assert.match(appJs, /claimSelectedSkuWork\(\);/);
  assert.match(appJs, /skuWorkClaimState\.status === "claimed_by_other"/);
  assert.match(appJs, /SKU นี้ถูก claim โดย/);
  assert.match(appJs, /ไม่ให้กดสร้าง Hero ซ้ำ/);
});

test("create UI separates claim checking, unclaimed, owned, conflict, and failed states", () => {
  assert.match(appJs, /const skuWorkClaimStatuses = new Set/);
  assert.match(appJs, /"checking"/);
  assert.match(appJs, /"unclaimed"/);
  assert.match(appJs, /"claimed_by_me"/);
  assert.match(appJs, /"claimed_by_other"/);
  assert.match(appJs, /"claim_failed"/);
  assert.doesNotMatch(appJs, /status: "error"/);
  assert.doesNotMatch(appJs, /blocked_by_other_claim/);
  assert.match(appJs, /โหลดสถานะ claim ไม่สำเร็จ/);
  assert.match(appJs, /staged reference พร้อมแล้ว แต่ claim SKU ไม่สำเร็จ/);
});

test("server writes safe diagnostics for claim status and claim endpoints", () => {
  assert.match(serverJs, /function logSkuWorkClaimDiagnostic/);
  assert.match(serverJs, /claim_status_endpoint/);
  assert.match(serverJs, /http_status/);
  assert.match(serverJs, /user_id/);
  assert.match(serverJs, /GET \/api\/sku-work\/:sku/);
  assert.match(serverJs, /POST \/api\/sku-work\/:sku\/claim/);
  const diagnosticHelper = serverJs.match(/function logSkuWorkClaimDiagnostic[\s\S]*?\n}\n\nfunction normalizeSubmittedVersion/)?.[0] || "";
  assert.doesNotMatch(diagnosticHelper, /process\.env|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_DRIVE_ACCESS_TOKEN/);
});

test("claim status failures expose staff-safe store readiness codes instead of generic text", () => {
  assert.match(serverJs, /function toSkuWorkStatePublicError/);
  assert.match(serverJs, /sku_work_state_store_unavailable/);
  assert.match(serverJs, /ระบบ claim ยังไม่พร้อม/);
  assert.match(serverJs, /res\.status\(claimError\.status\)\.json\(\{\s*ok: false,\s*code: claimError\.code,\s*error: claimError\.publicMessage/);
  assert.match(appJs, /formatSkuWorkClaimFailureMessage/);
  assert.match(appJs, /ระบบ claim ยังไม่พร้อม/);
});

test("jobs and next action surfaces expose claim status without direct frontend service role access", () => {
  assert.match(serverJs, /readSkuWorkStatesForSkus/);
  assert.match(serverJs, /claimStatus: serializeSkuWorkClaimForUser/);
  assert.match(appJs, /renderSkuWorkClaimBadge/);
  assert.match(appJs, /job\.claimStatus/);
  assert.doesNotMatch(appJs, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.match(stylesCss, /\.sku-work-claim-card/);
  assert.match(stylesCss, /\.claim-status-badge/);
});
