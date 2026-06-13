import test from "node:test";
import assert from "node:assert/strict";
import { runLivePilotGenerationSmokeTest } from "../../lib/automation/live-pilot-smoke-test.mjs";

function readyPlan() {
  return {
    batch_id: "batch-smoke",
    items: [
      {
        sku: "RAC-001",
        brand_id: "rent_a_coat",
        generation_status: "ready_for_live_generation",
        blockers: [],
        generation_requests: [
          request("RAC-001:hero", "hero", "hero", true),
          request("RAC-001:front", "support", "front_view", true)
        ]
      },
      {
        sku: "GM-001",
        brand_id: "go_mall",
        generation_status: "ready_for_live_generation",
        blockers: [],
        generation_requests: [
          request("GM-001:hero", "hero", "hero", true),
          request("GM-001:front", "support", "front_view", true)
        ]
      }
    ]
  };
}

function request(id, kind, slot, priorityRequired) {
  return {
    request_id: id,
    sku: id.split(":")[0],
    kind,
    slot,
    sequence: kind === "hero" ? 1 : 2,
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

test("runLivePilotGenerationSmokeTest selects exactly one request for readiness", async () => {
  const smoke = await runLivePilotGenerationSmokeTest({
    generationPlan: readyPlan(),
    liveRequested: true,
    liveConfirmed: true,
    readinessOnly: true,
    env: { AI_GENERATION_LIVE_ENABLED: "false", FAL_KEY: "set" }
  });

  assert.equal(smoke.manifest_type, "live_pilot_generation_smoke_test");
  assert.equal(smoke.readiness_only, true);
  assert.equal(smoke.summary.selected_requests, 1);
  assert.equal(smoke.summary.ready_requests, 1);
  assert.equal(smoke.summary.executed_requests, 0);
  assert.equal(smoke.summary.skipped_requests, 1);
  assert.equal(smoke.smoke_status, "blocked_before_live_smoke_execution");
  assert.equal(smoke.gate.requests[0].request_id, "RAC-001:hero");
});

test("runLivePilotGenerationSmokeTest executes a single request when all gates pass", async () => {
  const calls = [];
  const smoke = await runLivePilotGenerationSmokeTest({
    generationPlan: readyPlan(),
    liveRequested: true,
    liveConfirmed: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" },
    providerGenerate: async (request) => {
      calls.push(request.request_id);
      return {
        provider_request_id: "provider-1",
        images: [{
          url: "https://example.com/generated.png",
          local_path: "/tmp/generated.png",
          file_name: "generated.png",
          contentType: "image/png",
          file_size: 456
        }]
      };
    }
  });

  assert.deepEqual(calls, ["RAC-001:hero"]);
  assert.equal(smoke.summary.executed_requests, 1);
  assert.equal(smoke.summary.generated_images, 1);
  assert.equal(smoke.summary.generated_assets, 1);
  assert.equal(smoke.smoke_status, "smoke_generated_asset_ready_for_qc");
});

test("runLivePilotGenerationSmokeTest can target a GO Mall SKU request", async () => {
  const smoke = await runLivePilotGenerationSmokeTest({
    generationPlan: readyPlan(),
    mode: "hero-only",
    requestFilter: { brandId: "go_mall", sku: "GM-001", slot: "hero" },
    liveRequested: true,
    liveConfirmed: true,
    readinessOnly: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" }
  });

  assert.equal(smoke.summary.selected_requests, 1);
  assert.equal(smoke.gate.requests[0].request_id, "GM-001:hero");
  assert.equal(smoke.gate.requests[0].brand_id, "go_mall");
});

test("runLivePilotGenerationSmokeTest can be readiness-only even when gate would otherwise arm", async () => {
  const smoke = await runLivePilotGenerationSmokeTest({
    generationPlan: readyPlan(),
    liveRequested: true,
    liveConfirmed: true,
    readinessOnly: true,
    env: { AI_GENERATION_LIVE_ENABLED: "true", FAL_KEY: "set" }
  });

  assert.equal(smoke.gate.gate_status, "live_generation_armed");
  assert.equal(smoke.summary.executed_requests, 0);
  assert.equal(smoke.summary.execution_blockers, 1);
  assert.equal(smoke.execution.execution_blockers[0], "missing_provider_generate_callback");
  assert.equal(smoke.smoke_status, "ready_for_live_smoke_execution");
});
