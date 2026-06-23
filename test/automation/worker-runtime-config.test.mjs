import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkerModeStartupWarnings,
  buildWorkerQueueSafetySummary,
  resolveWorkerRuntimeConfig
} from "../../lib/automation/worker-runtime-config.mjs";

test("worker runtime config reports dedicated worker pilot mode", () => {
  const config = resolveWorkerRuntimeConfig({
    AUTOMATION_EMBEDDED_WORKER: "false",
    AUTOMATION_DEDICATED_WORKER_EXPECTED: "true",
    AI_GENERATION_LIVE_ENABLED: "true",
    AI_GENERATION_DRY_RUN: "false",
    AI_GENERATION_CONFIRM_SUPPORT_AFTER_HERO_APPROVAL: "true",
    WORDPRESS_DRY_RUN: "true",
    WORDPRESS_LIVE_WRITES_ENABLED: "false"
  });

  assert.equal(config.worker_mode, "dedicated_worker");
  assert.equal(config.embedded_worker_enabled, false);
  assert.equal(config.dedicated_worker_expected, true);
  assert.equal(config.live_generation_enabled, true);
  assert.equal(config.dry_run, false);
  assert.equal(config.support_after_hero_approval_enabled, true);
  assert.equal(config.wordpress_dry_run, true);
  assert.equal(config.wordpress_live_writes_enabled, false);
  assert.equal(config.risky_multiple_workers_without_override, false);
});

test("worker runtime config warns when embedded and dedicated workers are both enabled", () => {
  const config = resolveWorkerRuntimeConfig({
    AUTOMATION_EMBEDDED_WORKER: "true",
    AUTOMATION_DEDICATED_WORKER_EXPECTED: "true",
    ALLOW_MULTIPLE_WORKERS: "false"
  });
  const warnings = buildWorkerModeStartupWarnings(config);

  assert.equal(config.worker_mode, "multiple_workers");
  assert.equal(config.risky_multiple_workers_without_override, true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, "multiple_automation_workers_configured");
  assert.doesNotMatch(JSON.stringify(warnings), /SUPABASE|FAL|TOKEN|SECRET|KEY/i);
});

test("worker runtime config allows intentional multiple worker override", () => {
  const config = resolveWorkerRuntimeConfig({
    AUTOMATION_EMBEDDED_WORKER: "true",
    AUTOMATION_DEDICATED_WORKER_EXPECTED: "true",
    ALLOW_MULTIPLE_WORKERS: "true"
  });
  const warnings = buildWorkerModeStartupWarnings(config);

  assert.equal(config.worker_mode, "multiple_workers");
  assert.equal(config.risky_multiple_workers_without_override, false);
  assert.deepEqual(warnings, []);
});

test("worker queue safety summary documents claim guard and retry limit", () => {
  const summary = buildWorkerQueueSafetySummary();

  assert.match(summary.claim_strategy, /conditional_update_status_queued/);
  assert.match(summary.duplicate_claim_guard, /status=queued/);
  assert.match(summary.retry_attempt_limit, /max_attempts/);
  assert.match(summary.stuck_task_recovery, /locked_at/);
});
