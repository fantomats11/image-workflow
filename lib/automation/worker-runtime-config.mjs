export const WORKER_MODE_CONFIG_VERSION = "worker-runtime-config-v1.0";

export function resolveWorkerRuntimeConfig(env = process.env) {
  const embeddedWorkerEnabled = isEnabled(env.AUTOMATION_EMBEDDED_WORKER);
  const dedicatedWorkerExpected = isEnabled(env.AUTOMATION_DEDICATED_WORKER_EXPECTED);
  const allowMultipleWorkers = isEnabled(env.ALLOW_MULTIPLE_WORKERS);
  const liveGenerationEnabled = isEnabled(env.AI_GENERATION_LIVE_ENABLED);
  const dryRun = isDryRun(env.AI_GENERATION_DRY_RUN, true);
  const supportAfterHeroApprovalEnabled = isEnabled(env.AI_GENERATION_CONFIRM_SUPPORT_AFTER_HERO_APPROVAL);
  const wordpressDryRun = isDryRun(env.WORDPRESS_DRY_RUN, true);
  const wordpressLiveWritesEnabled = isEnabled(env.WORDPRESS_LIVE_WRITES_ENABLED);
  const multipleWorkersConfigured = embeddedWorkerEnabled && dedicatedWorkerExpected;

  return {
    version: WORKER_MODE_CONFIG_VERSION,
    worker_mode: resolveWorkerMode({ embeddedWorkerEnabled, dedicatedWorkerExpected }),
    embedded_worker_enabled: embeddedWorkerEnabled,
    dedicated_worker_expected: dedicatedWorkerExpected,
    allow_multiple_workers: allowMultipleWorkers,
    multiple_workers_configured: multipleWorkersConfigured,
    risky_multiple_workers_without_override: multipleWorkersConfigured && !allowMultipleWorkers,
    live_generation_enabled: liveGenerationEnabled,
    dry_run: dryRun,
    support_after_hero_approval_enabled: supportAfterHeroApprovalEnabled,
    wordpress_dry_run: wordpressDryRun,
    wordpress_live_writes_enabled: wordpressLiveWritesEnabled
  };
}

export function buildWorkerModeStartupWarnings(config = {}) {
  const warnings = [];
  if (config.risky_multiple_workers_without_override) {
    warnings.push({
      code: "multiple_automation_workers_configured",
      message: "AUTOMATION_EMBEDDED_WORKER and dedicated worker are both enabled. Set ALLOW_MULTIPLE_WORKERS=true only for an intentional concurrency test."
    });
  }
  if (!config.embedded_worker_enabled && !config.dedicated_worker_expected) {
    warnings.push({
      code: "no_automation_worker_configured",
      message: "No automation worker mode is enabled. Queued automation tasks will wait until a worker is started."
    });
  }
  return warnings;
}

export function buildWorkerQueueSafetySummary() {
  return {
    claim_strategy: "conditional_update_status_queued",
    duplicate_claim_guard: "UPDATE requires status=queued for the same task id before a worker can own it",
    retry_attempt_limit: "automation_tasks.max_attempts",
    stuck_task_recovery: "admin monitoring can inspect running tasks by locked_at/locked_by and retry or mark failed"
  };
}

function resolveWorkerMode({ embeddedWorkerEnabled, dedicatedWorkerExpected } = {}) {
  if (embeddedWorkerEnabled && dedicatedWorkerExpected) return "multiple_workers";
  if (dedicatedWorkerExpected) return "dedicated_worker";
  if (embeddedWorkerEnabled) return "embedded_worker";
  return "no_worker";
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isDryRun(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return isEnabled(value);
}
