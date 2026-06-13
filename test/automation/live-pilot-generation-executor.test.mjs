import test from "node:test";
import assert from "node:assert/strict";
import { executeLivePilotGenerationGate } from "../../lib/automation/live-pilot-generation-executor.mjs";

function gate(overrides = {}) {
  return {
    batch_id: "batch-1",
    gate_status: "ready_for_manual_live_confirmation",
    live_generation_allowed: false,
    requests: [
      request("RAC-001:hero", "hero", "hero"),
      request("RAC-001:front", "support", "front_view"),
      { ...request("RAC-001:blocked", "support", "side_view"), gate_status: "blocked", blockers: ["missing_model_input_files"] }
    ],
    ...overrides
  };
}

function armedGate() {
  return gate({
    gate_status: "live_generation_armed",
    live_generation_allowed: true
  });
}

function request(id, kind, slot) {
  return {
    request_id: id,
    sku: id.split(":")[0],
    kind,
    slot,
    gate_status: "ready",
    prompt: `Prompt for ${id}`,
    model_input_files: [{
      local_path: `/tmp/${id}.jpg`,
      file_name: `${id}.jpg`,
      file_size: 123,
      staging_status: "staged_local_file"
    }]
  };
}

test("executeLivePilotGenerationGate skips ready requests when gate is not armed", async () => {
  const execution = await executeLivePilotGenerationGate({
    gate: gate(),
    env: {}
  });

  assert.equal(execution.manifest_type, "live_pilot_generation_execution");
  assert.equal(execution.dry_run, true);
  assert.equal(execution.execution_status, "blocked_or_dry_run");
  assert.equal(execution.summary.selected_requests, 2);
  assert.equal(execution.summary.skipped_requests, 2);
  assert.equal(execution.summary.executed_requests, 0);
  assert.deepEqual(execution.execution_blockers, [
    "gate_not_armed_for_live_generation",
    "missing_cli_live_flag",
    "missing_cli_live_confirmation",
    "AI_GENERATION_LIVE_ENABLED_not_true",
    "missing_FAL_KEY"
  ]);
});

test("executeLivePilotGenerationGate runs provider when live gate and confirmations pass", async () => {
  const calls = [];
  const execution = await executeLivePilotGenerationGate({
    gate: armedGate(),
    liveRequested: true,
    liveConfirmed: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" },
    providerGenerate: async (request) => {
      calls.push(request.request_id);
      return {
        provider_request_id: `provider-${request.request_id}`,
        images: [{
          url: `https://example.com/${request.request_id}.png`,
          local_path: `/tmp/${request.request_id}.png`,
          file_name: `${request.request_id}.png`,
          contentType: "image/png",
          file_size: 456
        }]
      };
    }
  });

  assert.deepEqual(calls, ["RAC-001:hero", "RAC-001:front"]);
  assert.equal(execution.dry_run, false);
  assert.equal(execution.execution_status, "completed");
  assert.equal(execution.summary.executed_requests, 2);
  assert.equal(execution.summary.generated_images, 2);
  assert.equal(execution.summary.generated_assets, 2);
  assert.equal(execution.results[0].generated_assets[0].type, "hero_generated");
  assert.equal(execution.results[1].generated_assets[0].type, "support_generated");
});

test("executeLivePilotGenerationGate records provider failures without aborting the batch", async () => {
  const execution = await executeLivePilotGenerationGate({
    gate: armedGate(),
    liveRequested: true,
    liveConfirmed: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" },
    providerGenerate: async (request) => {
      if (request.kind === "support") throw new Error("provider failed");
      return { images: [{ url: "https://example.com/hero.png" }] };
    }
  });

  assert.equal(execution.execution_status, "completed_with_failures");
  assert.equal(execution.summary.executed_requests, 1);
  assert.equal(execution.summary.failed_requests, 1);
  assert.equal(execution.results[1].execution_status, "failed");
  assert.equal(execution.results[1].error, "provider failed");
});

test("executeLivePilotGenerationGate respects maxRequests", async () => {
  const execution = await executeLivePilotGenerationGate({
    gate: armedGate(),
    liveRequested: true,
    liveConfirmed: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" },
    maxRequests: 1,
    providerGenerate: async () => ({ images: [{ url: "https://example.com/one.png" }] })
  });

  assert.equal(execution.summary.selected_requests, 1);
  assert.equal(execution.summary.executed_requests, 1);
  assert.equal(execution.results[0].request_id, "RAC-001:hero");
});
