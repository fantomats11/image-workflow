import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK,
  buildWordPressMediaMappingPreflight
} from "../../lib/automation/wordpress-media-preflight.mjs";

test("builds a ready media mapping proposal when hero and support assets exist", () => {
  const proposal = buildWordPressMediaMappingPreflight({
    task: { id: "task-media-1", batch_id: "batch-1" },
    batchItems: [{
      id: "item-1",
      sku: "RAC-001",
      product_name: "Coat",
      target_site: "rentacoat",
      prompt_json: { support_shots: "front_view|texture_closeup|side_profile" },
      metadata: { brand_id: "rent_a_coat" }
    }],
    productPreflight: {
      items: [{
        sku: "RAC-001",
        brand_id: "rent_a_coat",
        target_site: "rentacoat",
        preflight_status: "ready_for_proposal",
        proposed_action: "create_draft_product"
      }]
    },
    mediaAssets: [
      { sku: "RAC-001", type: "hero_generated", status: "approved", url: "https://cdn.example.com/rac-001-hero.png" },
      { sku: "RAC-001", type: "studio_master_generated", shot_key: "studio_master", status: "approved", url: "https://cdn.example.com/rac-001-studio-master.png" },
      { sku: "RAC-001", type: "support_generated", shot_key: "front_view", status: "approved", url: "https://cdn.example.com/rac-001-front.png" },
      { sku: "RAC-001", type: "support_generated", shot_key: "texture_closeup", status: "approved", url: "https://cdn.example.com/rac-001-texture.png" }
    ],
    now: new Date("2026-06-12T00:00:00Z")
  });

  assert.equal(proposal.task_type, WORDPRESS_MEDIA_MAPPING_PREFLIGHT_TASK);
  assert.equal(proposal.live_write_allowed, false);
  assert.equal(proposal.requires_final_confirmation, true);
  assert.equal(proposal.summary.ready_for_media_proposal, 1);
  assert.equal(proposal.summary.media_assets_matched, 4);
  assert.equal(proposal.items[0].media_status, "ready_for_media_proposal");
  assert.equal(proposal.items[0].proposed_main_image.url, "https://cdn.example.com/rac-001-hero.png");
  assert.equal(proposal.items[0].proposed_main_image.position, 0);
  assert.equal(proposal.items[0].proposed_gallery_images.length, 3);
  assert.deepEqual(proposal.items[0].proposed_gallery_images.map((image) => image.position), [1, 2, 3]);
  assert.equal(proposal.items[0].proposed_gallery_images[0].type, "studio_master_generated");
  assert.deepEqual(proposal.items[0].proposed_images.map((image) => [image.role, image.position]), [
    ["main_image", 0],
    ["gallery_image", 1],
    ["gallery_image", 2],
    ["gallery_image", 3]
  ]);
  assert.equal(proposal.items[0].write_policy, "no_upload_or_attach_without_final_confirmation");
});

test("reports remote media fetch timeout and media conflict warnings as proposal issues", () => {
  const proposal = buildWordPressMediaMappingPreflight({
    batchItems: [{
      id: "item-1",
      sku: "RAC-TIMEOUT",
      target_site: "rentacoat",
      support_shots: "front_view|back_view",
      metadata: { brand_id: "rent_a_coat" }
    }],
    productPreflight: {
      items: [{
        sku: "RAC-TIMEOUT",
        brand_id: "rent_a_coat",
        target_site: "rentacoat",
        preflight_status: "ready_for_proposal",
        proposed_action: "update_existing_product",
        remote_checks: {
          product_by_sku: { status: "found", product_id: 123 },
          media_conflicts: [{ source_url: "https://cdn.example.com/front.png", media_id: 456 }]
        }
      }]
    },
    mediaAssets: [
      { sku: "RAC-TIMEOUT", type: "hero_generated", status: "approved", url: "https://cdn.example.com/hero.png" },
      { sku: "RAC-TIMEOUT", type: "studio_master_generated", shot_key: "studio_master", status: "approved", url: "https://cdn.example.com/studio-master.png" },
      { sku: "RAC-TIMEOUT", type: "support_generated", shot_key: "front_view", status: "approved", url: "https://cdn.example.com/front.png", remote_fetch_status: "timeout" },
      { sku: "RAC-TIMEOUT", type: "support_generated", shot_key: "back_view", status: "approved", url: "https://cdn.example.com/back.png" }
    ]
  });

  assert.equal(proposal.items[0].media_status, "ready_for_media_proposal");
  assert.ok(proposal.items[0].proposal_issues.includes("remote_media_fetch_timeout"));
  assert.ok(proposal.items[0].proposal_issues.includes("remote_media_conflict"));
  assert.equal(proposal.summary.proposal_issues, 2);
  assert.equal(proposal.live_write_allowed, false);
});

test("reports missing hero and support media as an awaiting-assets gap", () => {
  const proposal = buildWordPressMediaMappingPreflight({
    batchItems: [{
      id: "item-1",
      sku: "GM-001",
      target_site: "gomall",
      support_shots: "front_view|back_view",
      metadata: { brand_id: "go_mall" }
    }],
    productPreflight: {
      items: [{
        sku: "GM-001",
        brand_id: "go_mall",
        target_site: "gomall",
        preflight_status: "ready_for_proposal",
        proposed_action: "create_draft_product"
      }]
    }
  });

  assert.equal(proposal.summary.awaiting_media_assets, 1);
  assert.equal(proposal.summary.missing_hero_media, 1);
  assert.equal(proposal.summary.missing_studio_master_media, 1);
  assert.equal(proposal.summary.missing_support_media, 1);
  assert.equal(proposal.items[0].media_status, "awaiting_media_assets");
  assert.deepEqual(proposal.items[0].blockers, ["missing_hero_media", "missing_studio_master_media", "missing_support_media"]);
  assert.equal(proposal.items[0].proposed_main_image, null);
});

test("blocks media mapping when product preflight is blocked", () => {
  const proposal = buildWordPressMediaMappingPreflight({
    batchItems: [{
      id: "item-1",
      sku: "GM-EXIST",
      target_site: "gomall",
      support_shots: "front_view|back_view",
      metadata: { brand_id: "go_mall" }
    }],
    productPreflight: {
      items: [{
        sku: "GM-EXIST",
        brand_id: "go_mall",
        target_site: "gomall",
        preflight_status: "blocked",
        proposed_action: "review_existing_product"
      }]
    },
    mediaAssets: [
      { sku: "GM-EXIST", type: "hero_generated", status: "approved", url: "https://cdn.example.com/hero.png" },
      { sku: "GM-EXIST", type: "support_generated", shot_key: "front_view", status: "approved", url: "https://cdn.example.com/front.png" },
      { sku: "GM-EXIST", type: "support_generated", shot_key: "back_view", status: "approved", url: "https://cdn.example.com/back.png" }
    ]
  });

  assert.equal(proposal.summary.blocked, 1);
  assert.equal(proposal.summary.product_preflight_blocked, 1);
  assert.equal(proposal.items[0].media_status, "blocked");
  assert.ok(proposal.items[0].blockers.includes("product_preflight_blocked"));
});
