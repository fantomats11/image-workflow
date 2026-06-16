import test from "node:test";
import assert from "node:assert/strict";
import { buildSupportReviewDecisionState } from "../../lib/automation/support-review-decision-state.mjs";

test("buildSupportReviewDecisionState marks candidate manifest ready when all support assets are approved", () => {
  const state = buildSupportReviewDecisionState({
    sku: "2DJ0493000",
    supportAssets: [
      { asset_id: "asset-side", generation_id: "gen-side", slot: "side_fit_on_model" },
      { asset_id: "asset-back", generation_id: "gen-back", slot: "back_fit_on_model" }
    ],
    decisions: [
      { asset_id: "asset-side", decision: "approve_support", note: "side ok" },
      { asset_id: "asset-back", decision: "approve_support", note: "back ok" }
    ]
  });

  assert.equal(state.review_status, "support_approved_for_candidate_manifest");
  assert.equal(state.candidate_manifest_ready, true);
  assert.equal(state.summary.approved, 2);
  assert.equal(state.summary.pending, 0);
});

test("buildSupportReviewDecisionState blocks candidate manifest when regeneration is requested", () => {
  const state = buildSupportReviewDecisionState({
    sku: "2DJ0493000",
    supportAssets: [
      { asset_id: "asset-side", generation_id: "gen-side", slot: "side_fit_on_model" },
      { asset_id: "asset-back", generation_id: "gen-back", slot: "back_fit_on_model" }
    ],
    decisions: [
      { asset_id: "asset-side", decision: "approve_support" },
      { asset_id: "asset-back", decision: "regenerate_support", reason: "logo_patch_wrong" }
    ]
  });

  assert.equal(state.review_status, "support_regeneration_requested");
  assert.equal(state.candidate_manifest_ready, false);
  assert.equal(state.summary.regenerate, 1);
  assert.deepEqual(state.blockers, ["support_regeneration_requested"]);
});
