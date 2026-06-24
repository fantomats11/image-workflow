import test from "node:test";
import assert from "node:assert/strict";
import { buildDualExportGatewayPlan } from "../../lib/automation/dual-export-gateway.mjs";

test("buildDualExportGatewayPlan maps approved Hero to Drive archive position 0 and Support to ordered gallery positions", () => {
  const plan = buildDualExportGatewayPlan({
    sku: "FSTR240017",
    productName: "BLUE DOG The Spirit of Adventure",
    brandId: "go_mall",
    targetSite: "gomall",
    approvedAssets: [
      { id: "support-back", type: "support_generated", shot_key: "back_view", status: "approved", public_url: "https://cdn.example.test/back.png", approved_at: "2026-06-24T04:03:00.000Z" },
      { id: "hero", type: "hero_generated", shot_key: "hero", status: "approved", public_url: "https://cdn.example.test/hero.png", approved_at: "2026-06-24T04:00:00.000Z" },
      { id: "draft-side", type: "support_generated", shot_key: "side_view", status: "generated", public_url: "https://cdn.example.test/draft-side.png", approved_at: "" },
      { id: "support-front", type: "support_generated", shot_key: "front_view", status: "approved", public_url: "https://cdn.example.test/front.png", approved_at: "2026-06-24T04:02:00.000Z" }
    ],
    now: new Date("2026-06-24T04:10:00.000Z")
  });

  assert.equal(plan.gateway_type, "dual_export_gateway");
  assert.equal(plan.live_write_allowed, false);
  assert.equal(plan.wordpress_live_write_allowed, false);
  assert.equal(plan.drive_archive.folder_name, "FSTR240017_BLUE_DOG_The_Spirit_of_Adventure");
  assert.equal(plan.summary.approved_asset_count, 3);
  assert.equal(plan.summary.excluded_unapproved_assets, 1);
  assert.equal(plan.media_manifest.slots[0].role, "main_image");
  assert.equal(plan.media_manifest.slots[0].position, 0);
  assert.equal(plan.media_manifest.slots[0].source_asset_id, "hero");
  assert.deepEqual(plan.media_manifest.slots.slice(1).map((slot) => [slot.role, slot.position, slot.shot_key]), [
    ["gallery_image", 1, "front_view"],
    ["gallery_image", 2, "back_view"]
  ]);
  assert.equal(plan.drive_archive.files[0].file_name, "FSTR240017_00_Hero.png");
  assert.equal(plan.drive_archive.files[1].file_name, "FSTR240017_01_front_view.png");
  assert.equal(plan.drive_archive.files[2].idempotency_key, "drive_archive:FSTR240017:2:back_view:support-back");
  assert.doesNotMatch(JSON.stringify(plan), /draft-side|publish_now|attach_now|wordpress_write/i);
});

test("buildDualExportGatewayPlan skips Drive archive uploads when an export idempotency key already exists", () => {
  const plan = buildDualExportGatewayPlan({
    sku: "FSTR240017",
    approvedAssets: [
      { id: "hero", type: "hero_generated", shot_key: "hero", status: "approved", public_url: "https://cdn.example.test/hero.png" }
    ],
    existingDriveExports: [
      { idempotency_key: "drive_archive:FSTR240017:0:hero:hero", drive_file_id: "drive-hero", web_view_link: "https://drive.google.test/file/hero" }
    ]
  });

  assert.equal(plan.drive_archive.files[0].export_status, "already_exported");
  assert.equal(plan.drive_archive.files[0].drive_file_id, "drive-hero");
  assert.equal(plan.summary.drive_already_exported, 1);
  assert.equal(plan.summary.drive_upload_ready, 0);
});
