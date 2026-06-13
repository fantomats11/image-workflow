import test from "node:test";
import assert from "node:assert/strict";
import { buildLivePilotGenerationGate } from "../../lib/automation/live-pilot-generation-gate.mjs";

function readyPlan() {
  return {
    batch_id: "batch-1",
    items: [{
      sku: "RAC-001",
      brand_id: "rent_a_coat",
      generation_status: "ready_for_live_generation",
      blockers: [],
      generation_requests: [
        request("RAC-001:hero", "hero", "hero", 1, true),
        request("RAC-001:front", "support", "front_view", 2, true),
        request("RAC-001:side", "support", "side_view", 3, false)
      ]
    }, {
      sku: "GM-001",
      brand_id: "go_mall",
      generation_status: "ready_for_live_generation",
      blockers: [],
      generation_requests: [
        request("GM-001:hero", "hero", "hero", 1, true),
        request("GM-001:front", "support", "front_view", 2, true)
      ]
    }]
  };
}

function request(id, kind, slot, sequence, priorityRequired) {
  return {
    request_id: id,
    sku: id.split(":")[0],
    kind,
    slot,
    sequence,
    priority_required: priorityRequired,
    request_status: "ready_for_live_generation",
    prompt: `Prompt for ${id}`,
    model_input_files: [{
      local_path: `/tmp/${id}.jpg`,
      file_name: `${id}.jpg`,
      file_size: 123,
      sha256: "abc",
      staging_status: "staged_local_file"
    }]
  };
}

test("buildLivePilotGenerationGate selects priority wave without arming live generation", () => {
  const gate = buildLivePilotGenerationGate({
    generationPlan: readyPlan(),
    mode: "priority",
    maxRequests: 12,
    env: {}
  });

  assert.equal(gate.manifest_type, "live_pilot_generation_gate");
  assert.equal(gate.dry_run, true);
  assert.equal(gate.live_generation_allowed, false);
  assert.equal(gate.gate_status, "ready_for_manual_live_confirmation");
  assert.equal(gate.summary.selected_requests, 4);
  assert.equal(gate.summary.ready_requests, 4);
  assert.equal(gate.summary.hero_requests, 2);
  assert.equal(gate.requests.every((item) => item.priority_required), true);
});

test("buildLivePilotGenerationGate defaults to hero-only wave", () => {
  const gate = buildLivePilotGenerationGate({
    generationPlan: readyPlan(),
    maxRequests: 12,
    env: {}
  });

  assert.equal(gate.mode, "hero-only");
  assert.equal(gate.summary.selected_requests, 2);
  assert.equal(gate.summary.hero_requests, 2);
  assert.equal(gate.summary.support_requests, 0);
  assert.equal(gate.requests.every((item) => item.kind === "hero"), true);
});

test("buildLivePilotGenerationGate requires live confirmation and provider env", () => {
  const gate = buildLivePilotGenerationGate({
    generationPlan: readyPlan(),
    liveRequested: true,
    liveConfirmed: false,
    env: { AI_GENERATION_LIVE_ENABLED: "false" }
  });

  assert.equal(gate.live_generation_allowed, false);
  assert.equal(gate.gate_status, "blocked_before_live_generation");
  assert.deepEqual(gate.gate_blockers, [
    "missing_explicit_live_confirmation",
    "AI_GENERATION_LIVE_ENABLED_not_true",
    "missing_FAL_KEY"
  ]);
});

test("buildLivePilotGenerationGate arms live generation only when all gates pass", () => {
  const gate = buildLivePilotGenerationGate({
    generationPlan: readyPlan(),
    liveRequested: true,
    liveConfirmed: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" }
  });

  assert.equal(gate.dry_run, false);
  assert.equal(gate.live_generation_allowed, true);
  assert.equal(gate.gate_status, "live_generation_armed");
  assert.equal(gate.summary.blocked_requests, 0);
});

test("buildLivePilotGenerationGate blocks requests without staged model inputs", () => {
  const plan = readyPlan();
  plan.items[0].generation_requests[0].model_input_files = [];
  const gate = buildLivePilotGenerationGate({ generationPlan: plan });

  assert.equal(gate.summary.blocked_requests, 1);
  assert.equal(gate.requests[0].gate_status, "blocked");
  assert.deepEqual(gate.requests[0].blockers, ["missing_model_input_files"]);
});
