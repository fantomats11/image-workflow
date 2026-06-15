import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAiHubLocalCandidateManifest,
  buildAiHubRegenerationGate
} from "../../lib/automation/ai-hub-regen-candidate-phase.mjs";

test("buildAiHubRegenerationGate turns approved regen requests into a dry-run gate", () => {
  const gate = buildAiHubRegenerationGate({
    actionPlan: resolvedActionPlan(),
    env: {},
    now: new Date("2026-06-15T09:00:00Z")
  });

  assert.equal(gate.manifest_type, "ai_hub_product_image_regeneration_gate");
  assert.equal(gate.live_write_allowed, false);
  assert.equal(gate.live_generation_allowed, false);
  assert.equal(gate.gate_status, "ready_for_manual_live_confirmation");
  assert.equal(gate.summary.selected_requests, 1);
  assert.equal(gate.summary.ready_requests, 1);
  assert.equal(gate.requests[0].slot, "back_fit_on_model");
  assert.equal(gate.requests[0].gate_status, "ready_for_manual_live_confirmation");
  assert.doesNotMatch(JSON.stringify(gate), /publish_now|attach_media|wordpress_write/i);
  assert.match(gate.guardrails.join(" "), /no_wordpress_db_media_attach_or_publish/);
});

test("buildAiHubRegenerationGate blocks pending action plans before live regeneration", () => {
  const pending = resolvedActionPlan();
  pending.summary.pending_human_decision = 2;
  pending.items[0].regeneration_requests = [];

  const gate = buildAiHubRegenerationGate({ actionPlan: pending });

  assert.equal(gate.gate_status, "blocked_by_review_action_plan");
  assert.deepEqual(gate.plan_blockers, ["pending_human_decisions_must_be_resolved_first"]);
  assert.equal(gate.summary.selected_requests, 0);
});

test("buildAiHubRegenerationGate blocks support regen without approved hero anchor or staged inputs", () => {
  const plan = resolvedActionPlan();
  delete plan.items[0].regeneration_requests[0].approved_hero_anchor;
  plan.items[0].regeneration_requests[0].model_input_files = [];

  const gate = buildAiHubRegenerationGate({ actionPlan: plan });

  assert.equal(gate.gate_status, "blocked_before_live_regeneration");
  assert.deepEqual(gate.requests[0].blockers, [
    "support_regeneration_missing_approved_hero_anchor",
    "missing_model_input_files"
  ]);
});

test("buildAiHubLocalCandidateManifest combines approved hero anchor and approved support candidates", () => {
  const manifest = buildAiHubLocalCandidateManifest({
    actionPlan: resolvedActionPlan(),
    reviewBundle: reviewBundle(),
    now: new Date("2026-06-15T09:00:00Z")
  });

  assert.equal(manifest.manifest_type, "ai_hub_product_image_local_candidate_manifest");
  assert.equal(manifest.live_write_allowed, false);
  assert.equal(manifest.publish_allowed, false);
  assert.equal(manifest.media_attach_allowed, false);
  assert.equal(manifest.manifest_status, "partial_candidates_waiting_regen_or_manual_review");
  assert.equal(manifest.summary.candidate_count, 2);
  assert.equal(manifest.summary.hero_candidates, 1);
  assert.equal(manifest.summary.support_candidates, 1);
  assert.equal(manifest.summary.unresolved_regeneration_requests, 1);
  assert.equal(manifest.summary.unresolved_manual_review_assets, 1);
  assert.equal(manifest.items[0].candidate_count, 2);
  assert.doesNotMatch(JSON.stringify(manifest), /publish_now|attach_media|wordpress_write/i);
});

test("buildAiHubLocalCandidateManifest becomes ready only when review actions are fully resolved", () => {
  const plan = resolvedActionPlan();
  plan.summary.regeneration_requests = 0;
  plan.summary.manual_review_assets = 0;
  plan.items[0].regeneration_requests = [];
  plan.items[0].manual_review_assets = [];

  const manifest = buildAiHubLocalCandidateManifest({
    actionPlan: plan,
    reviewBundle: reviewBundle()
  });

  assert.equal(manifest.manifest_status, "ready_for_media_manifest_preflight");
  assert.equal(manifest.summary.ready_candidates, 2);
});

function resolvedActionPlan() {
  return {
    manifest_type: "ai_hub_product_image_review_action_plan",
    version: "ai-hub-review-action-plan-v1.0",
    created_at: "2026-06-15T08:00:00Z",
    summary: {
      sku_count: 1,
      review_action_count: 3,
      pending_human_decision: 0,
      approved_media_candidates: 1,
      regeneration_requests: 1,
      rejected_assets: 0,
      manual_review_assets: 1,
      blocked_actions: 0
    },
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      category: "เสื้อ",
      action_status: "has_regeneration_requests",
      approved_media_candidates: [{
        sku: "2DJ0493000",
        kind: "support",
        slot: "side_fit_on_model",
        type: "support_generated",
        source_url: "https://example.test/side.png",
        local_path: "/tmp/side.png",
        file_name: "side.png",
        mime_type: "image/png",
        file_size: 123,
        provider_request_id: "req-side",
        review_asset_id: "2DJ0493000:side_fit_on_model",
        approved_by: "human-reviewer",
        approved_note: "side approved"
      }],
      regeneration_requests: [{
        request_id: "2DJ0493000:back_fit_on_model",
        sku: "2DJ0493000",
        kind: "support",
        slot: "back_fit_on_model",
        model: "openai/gpt-image-2/edit",
        prompt_framework_version: "prompt-framework-v3.15-hero-led-product-marking-lock",
        prompt: "อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว สร้างภาพด้านหลังใหม่",
        approved_hero_anchor: heroAnchor(),
        model_input_files: [{
          source_role: "approved_hero_anchor",
          local_path: "/tmp/hero.png",
          file_name: "hero.png",
          file_size: 456,
          staging_status: "staged_local_file"
        }, {
          source_role: "product_reference",
          local_path: "/tmp/back-ref.jpg",
          file_name: "back-ref.jpg",
          file_size: 456,
          staging_status: "staged_local_file"
        }],
        reason: "logo mismatch on back view",
        flags: ["missing_back_logo"]
      }],
      manual_review_assets: [{
        review_asset_id: "2DJ0493000:material_or_lining_closeup"
      }]
    }]
  };
}

function reviewBundle() {
  return {
    manifest_type: "ai_hub_product_image_review_bundle",
    version: "ai-hub-image-review-bundle-v1.0",
    created_at: "2026-06-15T07:52:15Z",
    summary: {
      sku_count: 1,
      review_asset_count: 3
    },
    review_items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      category: "เสื้อ",
      approved_hero_anchor: heroAnchor()
    }]
  };
}

function heroAnchor() {
  return {
    id: "asset-hero-approved-2DJ0493000",
    sku: "2DJ0493000",
    type: "hero_generated",
    kind: "hero",
    status: "approved",
    url: "https://example.test/hero.png",
    public_url: "https://example.test/hero.png",
    local_path: "/tmp/hero.png",
    file_name: "hero.png",
    file_size: 456,
    approval_id: "approval-hero",
    approved_at: "2026-06-15T06:01:23Z"
  };
}
