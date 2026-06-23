import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnvPresenceChecks,
  buildPilotSmokeGuardChecks,
  buildReadinessResult,
  buildSupportGateChecks,
  buildWordPressGuardrailCheck,
  formatSmokeSummaryLines,
  maskEnvValue,
  summarizeSmokeChecks
} from "../../lib/automation/e2e-production-smoke.mjs";

test("E2E smoke helper masks secret-like env values", () => {
  const masked = maskEnvValue("FAL_KEY", "sample-mask-value-123");
  assert.equal(masked, "[set:21]");
  assert.doesNotMatch(masked, /sample-mask-value-123/);

  const checks = buildEnvPresenceChecks({
    env: {
      FAL_KEY: "sample-mask-value-123",
      PUBLIC_BASE_URL: "https://example.test"
    },
    required: ["FAL_KEY"],
    optional: ["PUBLIC_BASE_URL", "LINE_CHANNEL_SECRET"]
  });
  const serialized = JSON.stringify(checks);
  assert.doesNotMatch(serialized, /sample-mask-value-123/);
  assert.match(serialized, /\[set:21\]/);
  assert.match(serialized, /htt\.\.\.st/);
});

test("E2E smoke summary returns failing exit code only when checks fail", () => {
  const passing = summarizeSmokeChecks([
    { level: "pass" },
    { level: "warn" }
  ]);
  assert.equal(passing.status, "warn");
  assert.equal(passing.exitCode, 0);

  const failing = summarizeSmokeChecks([
    { level: "pass" },
    { level: "fail" }
  ]);
  assert.equal(failing.status, "fail");
  assert.equal(failing.exitCode, 1);
});

test("WordPress live write guard fails when enabled", () => {
  const disabled = buildWordPressGuardrailCheck({ env: { WORDPRESS_LIVE_WRITES_ENABLED: "false" } });
  assert.equal(disabled.level, "pass");

  const enabled = buildWordPressGuardrailCheck({ env: { WORDPRESS_LIVE_WRITES_ENABLED: "true" } });
  assert.equal(enabled.level, "fail");
  assert.doesNotMatch(JSON.stringify(enabled), /secret|token|password/i);
});

test("support gate checks require approved hero before support and pass approved hero fixture", () => {
  const generationPlan = {
    items: [
      {
        sku: "SKU-1",
        generation_requests: [
          {
            kind: "support",
            request_status: "blocked",
            blockers: ["pending_hero_approval_for_support"],
            model_input_files: []
          }
        ]
      }
    ]
  };
  const checks = buildSupportGateChecks({ generationPlan });
  assert.equal(checks.find((check) => check.id === "support_blocked_without_approved_hero").level, "pass");
  assert.equal(checks.find((check) => check.id === "support_ready_with_approved_hero_fixture").level, "pass");
});

test("pilot smoke guard requires explicit confirmation and SKU", () => {
  const checks = buildPilotSmokeGuardChecks({
    env: {
      E2E_PILOT_CONFIRM: "",
      WORDPRESS_LIVE_WRITES_ENABLED: "false"
    },
    sku: "",
    readinessResult: { summary: { fail: 0 } }
  });
  assert.equal(checks.find((check) => check.id === "pilot_confirm_env").level, "fail");
  assert.equal(checks.find((check) => check.id === "pilot_sku_required").level, "fail");

  const readyChecks = buildPilotSmokeGuardChecks({
    env: {
      E2E_PILOT_CONFIRM: "true",
      WORDPRESS_LIVE_WRITES_ENABLED: "false"
    },
    sku: "R23CBT0048",
    readinessResult: { summary: { fail: 0 } }
  });
  assert.equal(readyChecks.find((check) => check.id === "pilot_confirm_env").level, "pass");
  assert.equal(readyChecks.find((check) => check.id === "pilot_sku_required").level, "pass");
});

test("readiness result and output lines stay operator-facing", () => {
  const result = buildReadinessResult({
    checks: [
      { id: "safe", level: "pass", label: "ปลอดภัย", details: {} },
      { id: "missing", level: "warn", label: "ยังไม่ครบ", details: {} }
    ],
    now: new Date("2026-06-23T00:00:00.000Z")
  });
  assert.equal(result.dry_run, true);
  assert.equal(result.live_generation_allowed, false);
  assert.equal(result.live_write_allowed, false);
  assert.equal(result.status, "warn");
  const lines = formatSmokeSummaryLines(result);
  assert.match(lines.join("\n"), /สถานะรวม: warn/);
  assert.match(lines.join("\n"), /\[PASS\] ปลอดภัย/);
});
