import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaExportPreflightGate } from "../../lib/automation/media-export-preflight-gate.mjs";

test("buildMediaExportPreflightGate maps ready candidate manifest into ordered export slots and media assets", () => {
  const gate = buildMediaExportPreflightGate({
    candidateManifest: candidateManifest(),
    now: new Date("2026-06-16T05:00:00Z")
  });

  assert.equal(gate.manifest_type, "ai_hub_media_export_preflight_gate");
  assert.equal(gate.gate_status, "ready_for_export_preflight");
  assert.equal(gate.live_write_allowed, false);
  assert.equal(gate.media_attach_allowed, false);
  assert.equal(gate.export_allowed, false);
  assert.equal(gate.summary.media_asset_count, 3);
  assert.equal(gate.summary.ready_export_slots, 3);
  assert.equal(gate.summary.hero_slots, 1);
  assert.equal(gate.summary.support_slots, 2);
  assert.equal(gate.media_assets[0].type, "hero_generated");
  assert.equal(gate.media_assets[0].position, 0);
  assert.equal(gate.media_assets[0].role, "main_image");
  assert.equal(gate.media_assets[1].shot_key, "side_fit_on_model");
  assert.equal(gate.media_assets[1].position, 1);
  assert.equal(gate.media_assets[1].role, "gallery_image");
  assert.equal(gate.export_slots[0].position, 0);
  assert.equal(gate.export_slots[0].export_file_name, "01-2DJ0493000_Hero.png");
  assert.equal(gate.export_slots[1].export_file_name, "02-2DJ0493000_side_fit_on_model.png");
  assert.equal(gate.items[0].export_status, "ready_for_export_preflight");
  assert.doesNotMatch(JSON.stringify(gate), /publish_now|wordpress_write|media_attach_allowed":true|live_write_allowed":true/i);
});

test("buildMediaExportPreflightGate blocks export readiness when candidate manifest is incomplete", () => {
  const manifest = candidateManifest();
  manifest.manifest_status = "blocked_before_local_candidate_manifest";
  manifest.candidates[2].public_url = "";
  manifest.candidates[2].source_url = "";

  const gate = buildMediaExportPreflightGate({ candidateManifest: manifest });

  assert.equal(gate.gate_status, "blocked_before_export_preflight");
  assert.deepEqual(gate.gate_blockers, [
    "candidate_manifest_not_ready_for_media_preflight",
    "candidate_missing_source_url_or_local_path"
  ]);
  assert.equal(gate.summary.blocked_export_slots, 1);
});

function candidateManifest() {
  return {
    manifest_type: "ai_hub_product_image_local_candidate_manifest",
    version: "live-support-candidate-manifest-v1.0",
    created_at: "2026-06-16T04:55:00Z",
    batch_id: "batch-1",
    manifest_status: "ready_for_media_manifest_preflight",
    candidates: [
      {
        sku: "2DJ0493000",
        brand_id: "go_mall",
        target_site: "gomall",
        product_name: "The North Face White Cream Puffer Jacket, Down 600",
        category: "เสื้อ",
        kind: "hero",
        slot: "hero",
        type: "hero_generated",
        candidate_role: "approved_hero_anchor",
        candidate_status: "local_candidate_pending_media_preflight",
        public_url: "https://example.test/hero.png",
        file_name: "hero.png",
        review_asset_id: "hero-1",
        blockers: []
      },
      {
        sku: "2DJ0493000",
        brand_id: "go_mall",
        target_site: "gomall",
        product_name: "The North Face White Cream Puffer Jacket, Down 600",
        category: "เสื้อ",
        kind: "support",
        slot: "side_fit_on_model",
        type: "support_generated",
        candidate_role: "approved_support_candidate",
        candidate_status: "local_candidate_pending_media_preflight",
        public_url: "https://example.test/side.png",
        file_name: "side.png",
        review_asset_id: "support-side",
        blockers: []
      },
      {
        sku: "2DJ0493000",
        brand_id: "go_mall",
        target_site: "gomall",
        product_name: "The North Face White Cream Puffer Jacket, Down 600",
        category: "เสื้อ",
        kind: "support",
        slot: "back_fit_on_model",
        type: "support_generated",
        candidate_role: "approved_support_candidate",
        candidate_status: "local_candidate_pending_media_preflight",
        public_url: "https://example.test/back.png",
        file_name: "back.png",
        review_asset_id: "support-back",
        blockers: []
      }
    ],
    items: [{
      sku: "2DJ0493000",
      brand_id: "go_mall",
      target_site: "gomall",
      product_name: "The North Face White Cream Puffer Jacket, Down 600",
      category: "เสื้อ",
      candidate_count: 3,
      hero_count: 1,
      support_count: 2
    }]
  };
}
