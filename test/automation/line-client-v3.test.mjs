import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeroReviewFlex,
  buildHeroReviewMessages,
  buildPilotBatchFlex,
  buildReferenceMatchFlex,
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

test("hero review flex shows hero plus references and encodes hero approval action", () => {
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
  assert.match(text, /Approve hero/);
  assert.match(text, /approve_hero/);
  assert.match(text, /2CT1600000_front/);
  assert.doesNotMatch(text, /undefined/);

  const approveButton = flex.contents.contents[0].footer.contents[0];
  const params = new URLSearchParams(approveButton.action.data);
  assert.equal(params.get("action"), "approve_hero");
  assert.equal(params.get("batch_id"), "batch-hero-1");
  assert.equal(params.get("sku"), "2CT1600000");
});

test("hero review messages use full images and quick replies for action", () => {
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
  assert.equal(messages[3].quickReply.items.length, 3);

  const [approve, regenerate, review] = messages[3].quickReply.items.map((item) => item.action);
  assert.equal(approve.type, "postback");
  assert.equal(new URLSearchParams(approve.data).get("generation_id"), "gen-hero-1");
  assert.equal(regenerate.type, "postback");
  assert.equal(review.type, "uri");
  assert.match(review.uri, /^https:\/\/image-workflow\.onrender\.com\/#review\?/);
  assert.match(review.uri, /generation_id=gen-hero-1/);
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

test("hero review messages omit review page link without generation id", () => {
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

  const actions = messages[3].quickReply.items.map((item) => item.action);
  assert.deepEqual(actions.map((action) => action.label), ["Approve hero", "Regenerate"]);
  assert.equal(actions.some((action) => action.type === "uri"), false);
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
