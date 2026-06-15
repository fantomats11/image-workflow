import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_HUB_REVIEW_WORKSPACE_MANIFEST,
  buildAiHubReviewWorkspace
} from "../../lib/automation/ai-hub-review-workspace.mjs";

test("buildAiHubReviewWorkspace groups bundle, decisions, and action plans by SKU", () => {
  const workspace = buildAiHubReviewWorkspace({
    artifacts: [
      artifact("bundle.json", reviewBundle()),
      artifact("decisions.json", decisions()),
      artifact("action-plan.json", actionPlan({ pending: 0, approved: 1, regen: 1, manual: 1 }), "2026-06-15T03:00:00Z")
    ],
    now: new Date("2026-06-15T04:00:00Z")
  });

  assert.equal(workspace.manifest_type, AI_HUB_REVIEW_WORKSPACE_MANIFEST);
  assert.equal(workspace.live_write_allowed, false);
  assert.ok(workspace.guardrails.includes("no_wordpress_db_media_attach_or_publish_in_workspace_phase"));
  assert.equal(workspace.summary.sku_count, 1);
  assert.equal(workspace.summary.review_bundle_count, 1);
  assert.equal(workspace.summary.decision_artifact_count, 1);
  assert.equal(workspace.summary.action_plan_count, 1);
  assert.equal(workspace.summary.ready_for_regeneration_gate, 1);
  assert.equal(workspace.summary.approved_candidates_ready, 0);

  const item = workspace.items[0];
  assert.equal(item.sku, "2DJ0493000");
  assert.equal(item.workspace_status, "ready_for_regeneration_gate");
  assert.equal(item.next_action, "build_regeneration_gate_from_action_plan");
  assert.equal(item.counts.approved_media_candidates, 1);
  assert.equal(item.counts.regeneration_requests, 1);
});

test("buildAiHubReviewWorkspace prioritizes pending human decisions before downstream work", () => {
  const workspace = buildAiHubReviewWorkspace({
    artifacts: [
      artifact("bundle.json", reviewBundle()),
      artifact("pending-action-plan.json", actionPlan({ pending: 3, approved: 0, regen: 0 }), "2026-06-15T05:00:00Z")
    ]
  });

  const item = workspace.items[0];
  assert.equal(item.workspace_status, "awaiting_human_decisions");
  assert.equal(item.next_action, "open_review_console_and_submit_decisions");
  assert.equal(workspace.summary.awaiting_human_decisions, 1);
});

test("buildAiHubReviewWorkspace marks approved candidates as local manifest work, not publish work", () => {
  const workspace = buildAiHubReviewWorkspace({
    artifacts: [
      artifact("bundle.json", reviewBundle()),
      artifact("approved-action-plan.json", actionPlan({ pending: 0, approved: 3, regen: 0 }), "2026-06-15T06:00:00Z")
    ]
  });

  const item = workspace.items[0];
  assert.equal(item.workspace_status, "approved_candidates_ready_for_local_manifest");
  assert.equal(item.next_action, "build_local_media_candidate_manifest_after_qc");
  assert.doesNotMatch(item.next_action, /publish|attach|wordpress|db/i);
});

test("buildAiHubReviewWorkspace indexes regen gates and local candidate manifests", () => {
  const workspace = buildAiHubReviewWorkspace({
    artifacts: [
      artifact("bundle.json", reviewBundle()),
      artifact("action-plan.json", actionPlan({ pending: 0, approved: 1, regen: 1 }), "2026-06-15T06:00:00Z"),
      artifact("regen-gate.json", regenerationGate(), "2026-06-15T06:05:00Z"),
      artifact("candidate-manifest.json", candidateManifest(), "2026-06-15T06:06:00Z")
    ]
  });

  assert.equal(workspace.summary.regeneration_gate_count, 1);
  assert.equal(workspace.summary.local_candidate_manifest_count, 1);
  const item = workspace.items[0];
  assert.equal(item.latest_regeneration_gate.gate_status, "ready_for_manual_live_confirmation");
  assert.equal(item.latest_candidate_manifest.manifest_status, "partial_candidates_waiting_regen_or_manual_review");
  assert.equal(item.counts.ready_regeneration_requests, 1);
  assert.equal(item.counts.ready_local_candidates, 2);
});

test("buildAiHubReviewWorkspace does not count stale regen gates from older action plans", () => {
  const workspace = buildAiHubReviewWorkspace({
    artifacts: [
      artifact("bundle.json", reviewBundle()),
      artifact("newer-pending-action-plan.json", actionPlan({ pending: 3, approved: 0, regen: 0 }), "2026-06-15T08:00:00Z"),
      artifact("older-sample-regen-gate.json", regenerationGate("2026-06-15T06:00:00Z"), "2026-06-15T09:00:00Z")
    ]
  });

  const item = workspace.items[0];
  assert.equal(item.workspace_status, "awaiting_human_decisions");
  assert.equal(item.latest_regeneration_gate.stale_for_latest_action_plan, true);
  assert.equal(item.counts.ready_regeneration_requests, 0);
});

function artifact(fileName, content, createdAt = content.created_at || "2026-06-15T02:00:00Z") {
  return {
    file_name: fileName,
    file_path: `/tmp/${fileName}`,
    mtime_ms: new Date(createdAt).getTime(),
    content: {
      ...content,
      created_at: createdAt
    }
  };
}

function reviewBundle() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    version: "ai-hub-image-review-bundle-v1.0",
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      review_status: "pending_human_qc",
      review_assets: [
        reviewAsset("side_fit_on_model"),
        reviewAsset("back_fit_on_model"),
        reviewAsset("material_or_lining_closeup")
      ]
    }]
  };
}

function decisions() {
  return {
    manifest_type: "ai_hub_product_image_review_decisions",
    version: "ai-hub-review-decisions-v1.0",
    decisions: [
      { review_asset_id: "2DJ0493000:side_fit_on_model", sku: "2DJ0493000", action: "approve_asset", validation_status: "valid" },
      { review_asset_id: "2DJ0493000:back_fit_on_model", sku: "2DJ0493000", action: "regenerate_slot", validation_status: "valid" },
      { review_asset_id: "2DJ0493000:material_or_lining_closeup", sku: "2DJ0493000", action: "needs_manual_review", validation_status: "valid" }
    ]
  };
}

function actionPlan({ pending, approved, regen, manual = 0 }) {
  const actions = [
    ...Array.from({ length: pending }, (_, index) => action(`pending-${index}`, "pending_human_decision")),
    ...Array.from({ length: approved }, (_, index) => action(`approved-${index}`, "ready_for_media_manifest")),
    ...Array.from({ length: regen }, (_, index) => action(`regen-${index}`, "ready_for_regeneration")),
    ...Array.from({ length: manual }, (_, index) => action(`manual-${index}`, "held_for_manual_review"))
  ];
  return {
    manifest_type: "ai_hub_product_image_review_action_plan",
    version: "ai-hub-review-action-plan-v1.0",
    summary: {
      sku_count: 1,
      review_action_count: actions.length,
      pending_human_decision: pending,
      approved_media_candidates: approved,
      regeneration_requests: regen,
      manual_review_assets: manual,
      blocked_actions: 0
    },
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      action_status: pending ? "pending_human_decisions" : regen ? "has_regeneration_requests" : "approved_candidates_ready",
      approved_media_candidates: Array.from({ length: approved }, (_, index) => ({ slot: `approved-${index}` })),
      regeneration_requests: Array.from({ length: regen }, (_, index) => ({ slot: `regen-${index}` })),
      rejected_assets: [],
      manual_review_assets: Array.from({ length: manual }, (_, index) => ({ slot: `manual-${index}` })),
      pending_assets: Array.from({ length: pending }, (_, index) => ({ slot: `pending-${index}` })),
      blocked_actions: [],
      actions
    }]
  };
}

function reviewAsset(slot) {
  return {
    review_asset_id: `2DJ0493000:${slot}`,
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    slot,
    generated: {
      source_url: `https://cdn.example.com/${slot}.png`
    },
    qc: {
      review_status: "pending_human_qc"
    }
  };
}

function action(slot, status) {
  return {
    request_id: `2DJ0493000:${slot}`,
    sku: "2DJ0493000",
    slot,
    action_status: status,
    blockers: []
  };
}

function regenerationGate(sourceActionPlanCreatedAt = "2026-06-15T06:00:00Z") {
  return {
    manifest_type: "ai_hub_product_image_regeneration_gate",
    version: "ai-hub-regeneration-gate-v1.0",
    source_action_plan: {
      created_at: sourceActionPlanCreatedAt
    },
    gate_status: "ready_for_manual_live_confirmation",
    summary: {
      selected_requests: 1,
      ready_requests: 1
    },
    requests: [{
      request_id: "2DJ0493000:back_fit_on_model",
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      kind: "support",
      slot: "back_fit_on_model",
      gate_status: "ready_for_manual_live_confirmation",
      blockers: []
    }]
  };
}

function candidateManifest(sourceActionPlanCreatedAt = "2026-06-15T06:00:00Z") {
  return {
    manifest_type: "ai_hub_product_image_local_candidate_manifest",
    version: "ai-hub-local-candidate-manifest-v1.0",
    source_action_plan: {
      created_at: sourceActionPlanCreatedAt
    },
    manifest_status: "partial_candidates_waiting_regen_or_manual_review",
    summary: {
      candidate_count: 2,
      ready_candidates: 2
    },
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      category: "เสื้อ",
      candidate_count: 2,
      hero_count: 1,
      support_count: 1,
      candidates: [
        { sku: "2DJ0493000", kind: "hero", slot: "hero", blockers: [] },
        { sku: "2DJ0493000", kind: "support", slot: "side_fit_on_model", blockers: [] }
      ]
    }]
  };
}
