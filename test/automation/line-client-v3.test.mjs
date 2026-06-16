import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeroReviewFlex,
  buildHeroReviewMessages,
  buildPilotBatchFlex,
  buildReferenceMatchFlex,
  buildWordPressMediaPreflightFlex,
  buildWordPressPreflightFlex
} from "../../lib/automation/line-client.mjs";

test("pilot batch flex includes brand scope and dry-run state", () => {
  const flex = buildPilotBatchFlex({
    dry_run: true,
    prompt_framework_version: "prompt-framework-v3.0-dry-run",
    items: [
      { sku: "RAC-COAT-001", brand_label: "Rent A Coat", asset_classification_summary: { product_reference: 2, label_or_tag: 1 } },
      { sku: "GM-HAT-001", brand_label: "GO Mall", asset_classification_summary: { product_reference: 1, label_or_tag: 0 } }
    ]
  });
  const text = JSON.stringify(flex);
  assert.match(text, /Rent A Coat/);
  assert.match(text, /GO Mall/);
  assert.match(text, /unknown-batch/);
  assert.match(text, /Approve batch/);
  assert.doesNotMatch(text, /undefined/);
});

test("reference match flex exposes confidence and review action", () => {
  const flex = buildReferenceMatchFlex({
    batch_id: "dry-test",
    sku: "RAC-COAT-001",
    brand_label: "Rent A Coat",
    product_name: "เสื้อโค้ท",
    reference_manifest: {
      confidence: 0.82,
      match_method: "ocr_sku_label",
      needs_review: true
    },
    asset_classification_summary: {
      product_reference: 1,
      label_or_tag: 1,
      generated_candidate: 1,
      staff_noise: 0,
      ambiguous: 0
    }
  });
  const text = JSON.stringify(flex);
  assert.match(text, /0.82/);
  assert.match(text, /Needs review/);
  assert.match(text, /ocr_sku_label/);
  assert.match(text, /approve_sku/);
  assert.doesNotMatch(text, /approve_reference/);
  assert.doesNotMatch(text, /undefined/);
});

test("reference match flex encodes postback data for URLSearchParams", () => {
  const sku = "RAC&COAT=001 ไทย";
  const batchId = "dry=test & batch";
  const flex = buildReferenceMatchFlex({
    batch_id: batchId,
    sku,
    brand_label: "Rent A Coat",
    product_name: "เสื้อโค้ท",
    reference_manifest: {
      confidence: 0.82,
      match_method: "ocr_sku_label",
      needs_review: true
    }
  });
  const buttons = flex.contents.footer.contents;
  assert.equal(buttons.length, 3);

  const actions = buttons.map((button) => {
    assert.ok(button.action.data.length <= 300);
    const params = new URLSearchParams(button.action.data);
    assert.equal(params.get("batch_id"), batchId);
    assert.equal(params.get("sku"), sku);
    return params.get("action");
  });
  assert.deepEqual(actions, ["approve_sku", "needs_review", "reject_sku"]);
});

test("hero review flex shows hero plus references without chat decision buttons", () => {
  const flex = buildHeroReviewFlex({
    batchId: "batch-hero-1",
    item: {
      sku: "2CT1600000",
      brand_label: "GO Mall",
      product_name: "Discovery Expedition Trench Coat"
    },
    heroAsset: {
      sku: "2CT1600000",
      public_url: "https://cdn.example.com/hero.png"
    },
    referenceAssets: [{
      name: "2CT1600000_front.jpg",
      thumbnailLink: "https://cdn.example.com/ref-front.jpg",
      webViewLink: "https://drive.google.com/file/d/ref-front/view"
    }]
  });

  const text = JSON.stringify(flex);
  assert.match(text, /Hero Review/);
  assert.match(text, /ตรวจ ref \+ hero ก่อนสั่ง support/);
  assert.match(text, /ตัดสินใจในหน้า Review/);
  assert.doesNotMatch(text, /Approve hero/);
  assert.doesNotMatch(text, /approve_hero/);
  assert.match(text, /2CT1600000_front/);
  assert.doesNotMatch(text, /undefined/);
});

test("hero review messages use full images and route decisions to review page", () => {
  const messages = buildHeroReviewMessages({
    batchId: "batch-hero-1",
    reviewBaseUrl: "https://image-workflow.onrender.com",
    item: {
      sku: "2CT1600000",
      brand_label: "GO Mall",
      product_name: "Discovery Expedition Trench Coat"
    },
    heroAsset: {
      id: "asset-hero-1",
      generation_id: "gen-hero-1",
      sku: "2CT1600000",
      public_url: "https://cdn.example.com/hero.png"
    },
    referenceAssets: [{
      name: "2CT1600000_front.jpg",
      thumbnailLink: "https://cdn.example.com/ref-front.jpg",
      webViewLink: "https://drive.google.com/file/d/ref-front/view"
    }]
  });

  assert.equal(messages.length, 4);
  assert.equal(messages[0].type, "text");
  assert.equal(messages[1].type, "image");
  assert.equal(messages[1].originalContentUrl, "https://cdn.example.com/ref-front.jpg");
  assert.equal(messages[2].type, "image");
  assert.equal(messages[2].originalContentUrl, "https://cdn.example.com/hero.png");
  assert.equal(messages[3].type, "text");
  assert.match(messages[3].text, /เปิดหน้า Review/);
  assert.match(messages[3].text, /^https:\/\/image-workflow\.onrender\.com\/#review\?/m);
  assert.match(messages[3].text, /generation_id=gen-hero-1/);
  assert.doesNotMatch(JSON.stringify(messages), /"template"/);
  assert.doesNotMatch(JSON.stringify(messages), /approve_hero/);
  assert.doesNotMatch(JSON.stringify(messages), /regenerate_hero/);
});

test("hero review messages use signed proxy URLs for Drive reference images", () => {
  const messages = buildHeroReviewMessages({
    batchId: "batch-hero-1",
    reviewBaseUrl: "https://image-workflow.onrender.com",
    lineImageProxySecret: "test-secret",
    item: {
      sku: "2CT1600000",
      brand_label: "GO Mall",
      product_name: "Discovery Expedition Trench Coat"
    },
    heroAsset: {
      id: "asset-hero-1",
      generation_id: "gen-hero-1",
      sku: "2CT1600000",
      public_url: "https://cdn.example.com/hero.png"
    },
    referenceAssets: [{
      drive_file_id: "drive-file-123456",
      name: "2CT1600000_front.jpg",
      webContentLink: "https://drive.google.com/uc?id=drive-file-123456&export=download"
    }]
  });

  assert.equal(messages[1].type, "image");
  assert.match(messages[1].originalContentUrl, /^https:\/\/image-workflow\.onrender\.com\/api\/public\/line-image\/drive-file-123456\?/);
  assert.match(messages[1].originalContentUrl, /sig=/);
  assert.match(messages[1].originalContentUrl, /exp=/);
});

test("hero review messages explain missing review page without generation id", () => {
  const messages = buildHeroReviewMessages({
    batchId: "batch-hero-1",
    reviewBaseUrl: "https://image-workflow.onrender.com",
    item: {
      sku: "2CT1600000",
      brand_label: "GO Mall",
      product_name: "Discovery Expedition Trench Coat"
    },
    heroAsset: {
      id: "local-asset-hero-1",
      sku: "2CT1600000",
      public_url: "https://cdn.example.com/hero.png"
    },
    referenceAssets: [{
      name: "2CT1600000_front.jpg",
      thumbnailLink: "https://cdn.example.com/ref-front.jpg"
    }]
  });

  assert.equal(messages[3].type, "text");
  assert.match(messages[3].text, /ยังเปิดหน้า Review/);
  assert.doesNotMatch(messages[3].text, /#review\?/);
});

test("WordPress preflight flex summarizes read-only WooCommerce proposal", () => {
  const flex = buildWordPressPreflightFlex({
    batch_id: "batch-woo-1",
    summary: {
      item_count: 2,
      ready_for_proposal: 1,
      blocked: 1,
      remote_checked: 2,
      remote_errors: 0,
      remote_sku_exists: 1
    },
    items: [
      {
        sku: "RAC-001",
        target_site: "rentacoat",
        preflight_status: "ready_for_proposal",
        proposed_action: "create_draft_product",
        blockers: []
      },
      {
        sku: "GM-001",
        target_site: "gomall",
        preflight_status: "blocked",
        proposed_action: "review_existing_product",
        blockers: ["remote_sku_exists"]
      }
    ]
  });
  const text = JSON.stringify(flex);
  assert.match(text, /WooCommerce Preflight/);
  assert.match(text, /Ready: 1\/2/);
  assert.match(text, /remote_sku_exists/);
  assert.match(text, /read-only/);
  assert.match(text, /ยังไม่มีการ create\/update\/publish/);
  assert.doesNotMatch(text, /Approve publish/);
  assert.doesNotMatch(text, /undefined/);
});

test("WordPress media preflight flex summarizes media handoff without attach buttons", () => {
  const flex = buildWordPressMediaPreflightFlex({
    batch_id: "batch-media-1",
    summary: {
      item_count: 1,
      ready_for_media_proposal: 1,
      awaiting_media_assets: 0,
      media_assets_matched: 3,
      proposed_main_images: 1,
      proposed_gallery_images: 2
    },
    items: [{
      sku: "2DJ0493000",
      target_site: "gomall",
      media_status: "ready_for_media_proposal",
      proposed_action: "propose_media_attach_after_final_confirmation",
      proposed_gallery_images: [{ url: "https://cdn.example.test/side.png" }, { url: "https://cdn.example.test/back.png" }],
      blockers: []
    }]
  });
  const text = JSON.stringify(flex);
  assert.match(text, /Media Mapping Preflight/);
  assert.match(text, /Ready: 1\/1/);
  assert.match(text, /Assets: 3/);
  assert.match(text, /main 1 · gallery 2/);
  assert.match(text, /ยังไม่มีการ upload\/attach\/replace media/);
  assert.doesNotMatch(text, /Attach now|Approve attach|Publish/);
  assert.doesNotMatch(text, /undefined/);
});
