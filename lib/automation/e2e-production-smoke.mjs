import { validateE2EWorkflowInvariants } from "./e2e-workflow-state.mjs";

export const E2E_READINESS_TASK = "e2e_production_readiness_check";
export const E2E_PILOT_SMOKE_TASK = "e2e_pilot_smoke";

const SECRET_NAME_PATTERN = /(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|PRIVATE)/i;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function buildEnvPresenceChecks({
  env = process.env,
  required = [],
  optional = []
} = {}) {
  return [
    ...required.map((name) => buildEnvPresenceCheck({ name, env, required: true })),
    ...optional.map((name) => buildEnvPresenceCheck({ name, env, required: false }))
  ];
}

export function buildEnvPresenceCheck({ name, env = process.env, required = false } = {}) {
  const present = hasEnvValue(env, name);
  return buildCheck({
    id: `env_${name}`,
    level: present ? "pass" : required ? "fail" : "warn",
    label: present
      ? `${name} ถูกตั้งค่าแล้ว`
      : `${name} ยังไม่ได้ตั้งค่า`,
    details: {
      env: name,
      present,
      value: maskEnvValue(name, env?.[name])
    }
  });
}

export function maskEnvValue(name = "", value = "") {
  if (!value) return "[missing]";
  const stringValue = String(value);
  if (SECRET_NAME_PATTERN.test(name)) return `[set:${stringValue.length}]`;
  if (stringValue.length <= 6) return "[set]";
  return `${stringValue.slice(0, 3)}...${stringValue.slice(-2)}`;
}

export function summarizeSmokeChecks(checks = []) {
  const summary = {
    pass: 0,
    warn: 0,
    fail: 0,
    total: checks.length
  };
  for (const check of checks) {
    if (check.level === "pass") summary.pass += 1;
    else if (check.level === "warn") summary.warn += 1;
    else if (check.level === "fail") summary.fail += 1;
  }
  return {
    ...summary,
    status: summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "pass",
    exitCode: summary.fail > 0 ? 1 : 0
  };
}

export function buildWordPressGuardrailCheck({ env = process.env } = {}) {
  const enabled = isTruthyEnv(env.WORDPRESS_LIVE_WRITES_ENABLED);
  return buildCheck({
    id: "wordpress_live_writes_disabled",
    level: enabled ? "fail" : "pass",
    label: enabled
      ? "WordPress/WooCommerce live write เปิดอยู่ ต้องปิดก่อน smoke"
      : "WordPress/WooCommerce live write ปิดอยู่",
    details: {
      WORDPRESS_LIVE_WRITES_ENABLED: maskEnvValue("WORDPRESS_LIVE_WRITES_ENABLED", env.WORDPRESS_LIVE_WRITES_ENABLED || "")
    }
  });
}

export function buildSupportGateChecks({ generationPlan = {} } = {}) {
  const requests = collectGenerationRequests(generationPlan);
  const supportRequests = requests.filter((request) => request.kind === "support");
  const blockedSupport = supportRequests.filter((request) => {
    const blockers = Array.isArray(request.blockers) ? request.blockers : [];
    return blockers.includes("pending_hero_approval_for_support") ||
      blockers.includes("support_requires_approved_hero_anchor") ||
      blockers.includes("approved_hero_anchor_requires_local_file");
  });
  const readySupport = supportRequests.filter((request) => request.request_status === "ready_for_live_generation" && !request.blockers?.length);
  const anchorReadySupport = readySupport.filter((request) => request.model_input_files?.[0]?.source_role === "approved_hero_anchor");
  const fixtureViolations = validateE2EWorkflowInvariants({
    itemState: "support_ready",
    approvedHeroAnchor: { asset_id: "fixture-approved-hero" },
    generationRequest: {
      kind: "support",
      approved_hero_anchor: true,
      model_input_files: [
        { source_role: "approved_hero_anchor", local_path: "/tmp/approved-hero.png" },
        { source_role: "product_reference", local_path: "/tmp/reference-front.png" }
      ]
    },
    env: { WORDPRESS_LIVE_WRITES_ENABLED: "false" }
  });

  return [
    buildCheck({
      id: "support_blocked_without_approved_hero",
      level: supportRequests.length && blockedSupport.length ? "pass" : supportRequests.length ? "fail" : "warn",
      label: supportRequests.length
        ? blockedSupport.length
          ? "Support ถูก block เมื่อยังไม่มี approved Hero ตาม guardrail"
          : "พบ Support request แต่ไม่พบ blocker สำหรับ approved Hero"
        : "ไม่พบ Support request ใน generation plan นี้",
      details: {
        support_requests: supportRequests.length,
        blocked_support_requests: blockedSupport.length
      }
    }),
    buildCheck({
      id: "support_ready_with_approved_hero_fixture",
      level: fixtureViolations.length ? "fail" : "pass",
      label: fixtureViolations.length
        ? "Approved Hero fixture ยังไม่ผ่าน invariant"
        : "Approved Hero fixture ปลดล็อก Support ได้ตาม invariant",
      details: {
        fixture_violations: fixtureViolations,
        ready_support_requests: readySupport.length,
        ready_support_with_hero_anchor_first: anchorReadySupport.length
      }
    })
  ];
}

export function buildGateChecks({ gate = {} } = {}) {
  const gateStatus = gate.gate_status || "";
  const summary = gate.summary || {};
  return [
    buildCheck({
      id: "live_gate_built",
      level: gateStatus ? "pass" : "fail",
      label: gateStatus ? `Live gate สร้างแล้ว: ${gateStatus}` : "Live gate ยังไม่ถูกสร้าง",
      details: {
        gate_status: gateStatus,
        selected_requests: summary.selected_requests || 0,
        ready_requests: summary.ready_requests || 0,
        blocked_requests: summary.blocked_requests || 0
      }
    }),
    buildCheck({
      id: "live_gate_safe_by_default",
      level: gate.live_generation_allowed ? "fail" : "pass",
      label: gate.live_generation_allowed
        ? "Readiness gate arm live generation แล้ว ซึ่งไม่ควรเกิดใน safe mode"
        : "Readiness gate ยังไม่ execute live generation",
      details: {
        dry_run: gate.dry_run !== false,
        live_generation_allowed: gate.live_generation_allowed === true
      }
    })
  ];
}

export function buildReadinessResult({
  checks = [],
  manifest = {},
  now = new Date()
} = {}) {
  const summary = summarizeSmokeChecks(checks);
  return {
    manifest_type: E2E_READINESS_TASK,
    created_at: now.toISOString(),
    dry_run: true,
    live_write_allowed: false,
    live_generation_allowed: false,
    status: summary.status,
    summary,
    manifest,
    checks
  };
}

export function buildPilotSmokeGuardChecks({
  env = process.env,
  sku = "",
  readinessResult = null
} = {}) {
  const checks = [
    buildCheck({
      id: "pilot_confirm_env",
      level: isTruthyEnv(env.E2E_PILOT_CONFIRM) ? "pass" : "fail",
      label: isTruthyEnv(env.E2E_PILOT_CONFIRM)
        ? "ยืนยัน E2E_PILOT_CONFIRM=true แล้ว"
        : "ต้องตั้ง E2E_PILOT_CONFIRM=true ก่อน pilot smoke",
      details: {
        E2E_PILOT_CONFIRM: maskEnvValue("E2E_PILOT_CONFIRM", env.E2E_PILOT_CONFIRM || "")
      }
    }),
    buildCheck({
      id: "pilot_sku_required",
      level: sku ? "pass" : "fail",
      label: sku ? "ระบุ SKU สำหรับ pilot smoke แล้ว" : "ต้องระบุ SKU ด้วย --sku หรือ E2E_PILOT_SKU",
      details: {
        sku: sku || ""
      }
    }),
    buildWordPressGuardrailCheck({ env })
  ];

  if (readinessResult?.summary?.fail) {
    checks.push(buildCheck({
      id: "readiness_must_pass_before_pilot_smoke",
      level: "fail",
      label: "Readiness check ยังมี fail ต้องแก้ก่อน pilot smoke",
      details: {
        readiness_status: readinessResult.status,
        readiness_fail: readinessResult.summary.fail
      }
    }));
  }

  return checks;
}

export function formatSmokeSummaryLines(result = {}) {
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const lines = [
    `สถานะรวม: ${result.status || "unknown"}`,
    `Summary: pass=${result.summary?.pass || 0} warn=${result.summary?.warn || 0} fail=${result.summary?.fail || 0}`
  ];
  checks.forEach((check) => {
    const icon = check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : "FAIL";
    lines.push(`[${icon}] ${check.label}`);
  });
  return lines;
}

function collectGenerationRequests(generationPlan = {}) {
  const items = Array.isArray(generationPlan.items) ? generationPlan.items : [];
  return items.flatMap((item) => (item.generation_requests || []).map((request) => ({
    ...request,
    sku: request.sku || item.sku || "",
    item_blockers: item.blockers || []
  })));
}

function buildCheck({ id, level, label, details = {} }) {
  return {
    id,
    level,
    label,
    details
  };
}

function hasEnvValue(env = {}, name = "") {
  return Boolean(String(env?.[name] || "").trim());
}

function isTruthyEnv(value = "") {
  return TRUE_VALUES.has(String(value || "").trim().toLowerCase());
}
