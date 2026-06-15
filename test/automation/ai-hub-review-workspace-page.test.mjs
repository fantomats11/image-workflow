import test from "node:test";
import assert from "node:assert/strict";
import { renderAiHubReviewWorkspacePage } from "../../lib/automation/ai-hub-review-workspace-page.mjs";

test("renderAiHubReviewWorkspacePage renders workspace command center and review links", () => {
  const html = renderAiHubReviewWorkspacePage(workspaceFixture(), {
    workspaceName: "ai-hub-review-workspace.json"
  });

  assert.match(html, /Product Image Command Center/);
  assert.match(html, /no wordpress db media attach or publish in workspace phase/i);
  assert.match(html, /2DJ0493000/);
  assert.match(html, /ready for regeneration gate/);
  assert.match(html, /build regeneration gate from action plan/);
  assert.match(html, /ai-hub-regeneration-gate-sample-2DJ0493000-v3\.15\.json/);
  assert.match(html, /ai-hub-local-candidate-manifest-sample-2DJ0493000-v3\.15\.json/);
  assert.match(html, /\/ai-hub\/review\?bundle=ai-hub-image-review-bundle-2DJ0493000-v3\.15\.json/);
  assert.doesNotMatch(html, /publish_now|attach_media|wordpress_write/i);
});

function workspaceFixture() {
  return {
    manifest_type: "ai_hub_product_image_review_workspace",
    version: "ai-hub-review-workspace-v1.0",
    guardrails: [
      "workspace_is_local_review_index_only",
      "no_wordpress_db_media_attach_or_publish_in_workspace_phase"
    ],
    summary: {
      sku_count: 1,
      review_bundle_count: 1,
      decision_artifact_count: 1,
      action_plan_count: 1,
      regeneration_gate_count: 1,
      local_candidate_manifest_count: 1,
      awaiting_human_decisions: 0,
      ready_for_regeneration_gate: 1,
      approved_candidates_ready: 0,
      blocked_review_actions: 0
    },
    items: [{
      sku: "2DJ0493000",
      target_site: "gomall",
      product_name: "Global brand down jacket",
      workspace_status: "ready_for_regeneration_gate",
      next_action: "build_regeneration_gate_from_action_plan",
      counts: {
        review_assets: 3,
        pending_human_decision: 0,
        regeneration_requests: 1,
        ready_regeneration_requests: 1,
        approved_media_candidates: 1,
        ready_local_candidates: 2
      },
      latest_review_bundle: {
        file_name: "ai-hub-image-review-bundle-2DJ0493000-v3.15.json"
      },
      latest_action_plan: {
        file_name: "ai-hub-review-action-plan-sample-2DJ0493000-v3.15.json"
      },
      latest_decisions: {
        file_name: "ai-hub-review-decisions-sample-2DJ0493000-v3.15.json"
      },
      latest_regeneration_gate: {
        file_name: "ai-hub-regeneration-gate-sample-2DJ0493000-v3.15.json"
      },
      latest_candidate_manifest: {
        file_name: "ai-hub-local-candidate-manifest-sample-2DJ0493000-v3.15.json"
      }
    }]
  };
}
