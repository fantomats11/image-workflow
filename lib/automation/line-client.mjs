import { createHmac } from "node:crypto";
import { getRequiredEnv } from "./env.mjs";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_POSTBACK_DATA_LIMIT = 300;

export async function pushLineMessage({ to, messages }) {
  const token = getRequiredEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ to, messages })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LINE push failed ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : { ok: true };
}

export function buildPilotBatchFlex(batch) {
  const batchId = String(batch.batch_id || "unknown-batch");
  const items = batch.items || [];
  const brandCounts = countBy(items, (item) => item.brand_label || item.brand_id || "Unknown");
  const rows = items.slice(0, 8).map((item) => {
    const dryRunAction = String(item.dry_run_action || (batch.dry_run ? "dry-run" : "-"));
    const sku = displayValue(item.sku, "unknown-sku");
    const productType = displayValue(item.product_type);
    const productName = displayValue(item.product_name);
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: `${sku} · ${productType}`,
          weight: "bold",
          size: "sm",
          wrap: true
        },
        {
          type: "text",
          text: productName,
          size: "xs",
          color: "#666666",
          wrap: true,
          maxLines: 2
        },
        {
          type: "text",
          text: dryRunAction,
          size: "xxs",
          color: dryRunAction.includes("skip") ? "#0f766e" : "#b42318",
          wrap: true
        }
      ]
    };
  });

  return {
    type: "flex",
    altText: `Dry-run batch ${batchId}: ${items.length} SKU`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "Image Workflow Dry-run",
            weight: "bold",
            size: "lg"
          },
          {
            type: "text",
            text: `${batchId} · ${items.length} SKU · dry-run only`,
            size: "xs",
            color: "#666666",
            wrap: true
          },
          {
            type: "separator"
          },
          ...Object.entries(brandCounts).map(([brand, count]) => textNode(`${brand}: ${count} SKU`, "sm")),
          ...rows
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#0f766e",
            action: {
              type: "postback",
              label: "Approve batch",
              data: postbackData({ action: "approve_batch", batch_id: batchId }),
              displayText: `Approve ${batchId}`
            }
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "Needs review",
                  data: postbackData({ action: "needs_review", batch_id: batchId }),
                  displayText: `Review ${batchId}`
                }
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "Reject",
                  data: postbackData({ action: "reject_batch", batch_id: batchId }),
                  displayText: `Reject ${batchId}`
                }
              }
            ]
          }
        ]
      }
    }
  };
}

export function buildReferenceMatchFlex(item = {}) {
  const manifest = item.reference_manifest || {};
  const summary = item.asset_classification_summary || {};
  const batchId = displayValue(item.batch_id, "unknown-batch");
  const sku = displayValue(item.sku, "unknown-sku");
  const brandLabel = displayValue(item.brand_label, "Brand");
  const productName = displayValue(item.product_name);
  return {
    type: "flex",
    altText: `Reference review: ${sku}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          textNode(`${brandLabel} / ${sku}`, "lg", "bold"),
          textNode(productName, "sm", "regular", "#64748B"),
          separatorNode(),
          textNode(`Match: ${manifest.match_method || "unknown"}`, "sm"),
          textNode(`Confidence: ${formatConfidence(manifest.confidence)}`, "sm"),
          textNode(`Assets: product ${summary.product_reference || 0}, label ${summary.label_or_tag || 0}, generated ${summary.generated_candidate || 0}, noise ${summary.staff_noise || 0}, ambiguous ${summary.ambiguous || 0}`, "xs", "regular", "#64748B")
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          postbackButton("Approve match", { action: "approve_sku", batch_id: batchId, sku }, "primary"),
          postbackButton("Needs review", { action: "needs_review", batch_id: batchId, sku }, "secondary"),
          postbackButton("Reject", { action: "reject_sku", batch_id: batchId, sku }, "secondary")
        ]
      }
    }
  };
}

export function buildHeroReviewFlex({ batchId, item = {}, heroAsset = {}, referenceAssets = [] } = {}) {
  const resolvedBatchId = displayValue(batchId || item.batch_id, "unknown-batch");
  const sku = displayValue(item.sku || heroAsset.sku, "unknown-sku");
  const brandLabel = displayValue(item.brand_label || item.brand_id, "Brand");
  const productName = displayValue(item.product_name);
  const heroUrl = safeHttpsUrl(heroAsset.public_url || heroAsset.url || heroAsset.source_url);
  const refAssets = Array.isArray(referenceAssets) ? referenceAssets.slice(0, 5) : [];
  const heroBubble = {
    type: "bubble",
    size: "mega",
    ...(heroUrl
      ? {
        hero: {
          type: "image",
          url: heroUrl,
          size: "full",
          aspectRatio: "1:1",
          aspectMode: "cover"
        }
      }
      : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        textNode("Hero Review", "lg", "bold"),
        textNode(`${brandLabel} / ${sku}`, "sm", "bold"),
        textNode(productName, "xs", "regular", "#64748B"),
        separatorNode(),
        textNode("ตรวจ ref + hero ก่อนสั่ง support", "sm", "bold", "#0f766e"),
        textNode(`Reference assets: ${refAssets.length}`, "xs", "regular", "#64748B"),
        ...refAssets.slice(0, 3).map((asset, index) => textNode(`Ref ${index + 1}: ${displayValue(asset.name || asset.file_name || asset.source_name, "reference image")}`, "xxs", "regular", "#64748B"))
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        textNode("ตัดสินใจในหน้า Review เท่านั้น เพื่อให้สถานะกลางและลำดับ action ชัดเจน", "xs", "regular", "#64748B")
      ]
    }
  };
  const referenceBubbles = refAssets
    .map((asset, index) => buildReferenceBubble(asset, index + 1, sku))
    .filter(Boolean);

  return {
    type: "flex",
    altText: `Hero review: ${sku}`,
    contents: referenceBubbles.length
      ? { type: "carousel", contents: [heroBubble, ...referenceBubbles].slice(0, 6) }
      : heroBubble
  };
}

export function buildHeroReviewMessages({
  batchId,
  item = {},
  heroAsset = {},
  referenceAssets = [],
  reviewBaseUrl = "",
  lineImageProxyBaseUrl = "",
  lineImageProxySecret = ""
} = {}) {
  const resolvedBatchId = displayValue(batchId || item.batch_id, "unknown-batch");
  const sku = displayValue(item.sku || heroAsset.sku, "unknown-sku");
  const brandLabel = displayValue(item.brand_label || item.brand_id, "Brand");
  const productName = displayValue(item.product_name);
  const heroUrl = preferredAssetImageUrl(heroAsset);
  const refAssets = Array.isArray(referenceAssets) ? referenceAssets.slice(0, 5) : [];
  const firstRefUrl = preferredReferenceImageUrl(refAssets[0], {
    lineImageProxyBaseUrl: lineImageProxyBaseUrl || reviewBaseUrl,
    lineImageProxySecret
  });
  const reviewUrl = buildHeroReviewUrl({ reviewBaseUrl, batchId: resolvedBatchId, sku, heroAsset });
  const messages = [{
    type: "text",
    text: [
      `Hero Review | ${brandLabel} / ${sku}`,
      productName,
      `Reference assets: ${refAssets.length}`,
      "ตรวจ ref + hero ก่อนสั่ง support"
    ].filter(Boolean).join("\n")
  }];

  if (firstRefUrl) {
    messages.push({
      type: "image",
      originalContentUrl: firstRefUrl,
      previewImageUrl: firstRefUrl
    });
  }

  if (heroUrl) {
    messages.push({
      type: "image",
      originalContentUrl: heroUrl,
      previewImageUrl: heroUrl
    });
  }

  messages.push({
    type: "text",
    text: reviewUrl
      ? [
        `เปิดหน้า Review เพื่อตัดสินใจสำหรับ ${sku}`,
        reviewUrl,
        "ให้กด Approve / Regenerate ในหน้านี้เท่านั้น เพื่อให้สถานะกลางและลำดับ action ชัดเจน"
      ].join("\n")
      : [
        `ยังเปิดหน้า Review สำหรับ ${sku} ไม่ได้`,
        "ยังไม่มี generation_id สำหรับล็อก hero candidate"
      ].join("\n")
  });

  return messages;
}

export function buildWordPressPreflightFlex(preflight = {}) {
  const batchId = displayValue(preflight.batch_id, "unknown-batch");
  const summary = preflight.summary || {};
  const items = Array.isArray(preflight.items) ? preflight.items : [];
  const rows = items.slice(0, 8).map((item) => {
    const status = item.preflight_status === "ready_for_proposal" ? "ready" : "blocked";
    const action = displayValue(item.proposed_action);
    const blockers = Array.isArray(item.blockers) && item.blockers.length
      ? `Blockers: ${item.blockers.join(", ")}`
      : "No blockers";
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        textNode(`${displayValue(item.sku, "unknown-sku")} · ${displayValue(item.target_site)}`, "sm", "bold"),
        textNode(`${status} · ${action}`, "xs", "regular", status === "ready" ? "#0f766e" : "#b42318"),
        textNode(blockers, "xxs", "regular", "#64748B")
      ]
    };
  });

  return {
    type: "flex",
    altText: `WooCommerce preflight ${batchId}: ${summary.ready_for_proposal || 0}/${summary.item_count || 0} ready`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          textNode("WooCommerce Preflight", "lg", "bold"),
          textNode(`${batchId} · dry-run / read-only`, "xs", "regular", "#64748B"),
          separatorNode(),
          textNode(`Ready: ${summary.ready_for_proposal || 0}/${summary.item_count || 0}`, "sm", "bold"),
          textNode(`Blocked: ${summary.blocked || 0} · Existing SKU: ${summary.remote_sku_exists || 0}`, "sm"),
          textNode(`Remote checked: ${summary.remote_checked || 0} · Errors: ${summary.remote_errors || 0}`, "xs", "regular", "#64748B"),
          separatorNode(),
          ...rows,
          textNode("ยังไม่มีการ create/update/publish ใน WordPress หรือ WooCommerce", "xs", "regular", "#b42318")
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          postbackButton("Needs review", { action: "needs_review", batch_id: batchId }, "secondary"),
          postbackButton("Reject", { action: "reject_batch", batch_id: batchId }, "secondary")
        ]
      }
    }
  };
}

export function buildWordPressMediaPreflightFlex(preflight = {}) {
  const batchId = displayValue(preflight.batch_id, "unknown-batch");
  const summary = preflight.summary || {};
  const items = Array.isArray(preflight.items) ? preflight.items : [];
  const rows = items.slice(0, 8).map((item) => {
    const status = item.media_status === "ready_for_media_proposal" ? "ready" : item.media_status || "waiting";
    const blockers = Array.isArray(item.blockers) && item.blockers.length
      ? `Blockers: ${item.blockers.join(", ")}`
      : "No blockers";
    const galleryCount = Array.isArray(item.proposed_gallery_images) ? item.proposed_gallery_images.length : 0;
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        textNode(`${displayValue(item.sku, "unknown-sku")} · ${displayValue(item.target_site)}`, "sm", "bold"),
        textNode(`${status} · ${displayValue(item.proposed_action)}`, "xs", "regular", status === "ready" ? "#0f766e" : "#b45309"),
        textNode(`main ${item.proposed_main_image ? 1 : 0} · gallery ${galleryCount}`, "xxs", "regular", "#64748B"),
        textNode(blockers, "xxs", "regular", "#64748B")
      ]
    };
  });

  return {
    type: "flex",
    altText: `Media preflight ${batchId}: ${summary.ready_for_media_proposal || 0}/${summary.item_count || 0} ready`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          textNode("Media Mapping Preflight", "lg", "bold"),
          textNode(`${batchId} · dry-run / final confirmation required`, "xs", "regular", "#64748B"),
          separatorNode(),
          textNode(`Ready: ${summary.ready_for_media_proposal || 0}/${summary.item_count || 0}`, "sm", "bold"),
          textNode(`Assets: ${summary.media_assets_matched || 0} · Waiting: ${summary.awaiting_media_assets || 0} · Blocked: ${summary.blocked || 0}`, "sm"),
          textNode(`Proposed: main ${summary.proposed_main_images || 0} · gallery ${summary.proposed_gallery_images || 0}`, "xs", "regular", "#64748B"),
          separatorNode(),
          ...rows,
          textNode("ยังไม่มีการ upload/attach/replace media หรือ publish ใน WordPress", "xs", "regular", "#b42318")
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          postbackButton("Needs review", { action: "needs_review", batch_id: batchId }, "secondary"),
          postbackButton("Reject", { action: "reject_batch", batch_id: batchId }, "secondary")
        ]
      }
    }
  };
}

export function buildWordPressMediaAttachConfirmationFlex(confirmationGate = {}) {
  const batchId = displayValue(confirmationGate.batch_id, "unknown-batch");
  const summary = confirmationGate.summary || {};
  const items = Array.isArray(confirmationGate.items) ? confirmationGate.items : [];
  const rows = items.slice(0, 8).map((item) => {
    const status = item.confirmation_status || "waiting";
    const blockers = Array.isArray(item.blockers) && item.blockers.length
      ? `Blockers: ${item.blockers.join(", ")}`
      : "No blockers";
    const operations = Array.isArray(item.proposed_operations) ? item.proposed_operations : [];
    const mainCount = operations.filter((operation) => operation.role === "main_image").length;
    const galleryCount = operations.filter((operation) => operation.role === "gallery_image").length;
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        textNode(`${displayValue(item.sku, "unknown-sku")} · ${displayValue(item.target_site)}`, "sm", "bold"),
        textNode(status, "xs", "regular", status === "ready_for_final_confirmation" ? "#0f766e" : "#b45309"),
        textNode(`main ${mainCount} · gallery ${galleryCount}`, "xxs", "regular", "#64748B"),
        textNode(blockers, "xxs", "regular", "#64748B")
      ]
    };
  });

  return {
    type: "flex",
    altText: `Media attach gate ${batchId}: ${summary.ready_for_confirmation || 0}/${summary.item_count || 0} ready`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          textNode("Media Attach Confirmation Gate", "lg", "bold"),
          textNode(`${batchId} · dry-run / final confirmation package`, "xs", "regular", "#64748B"),
          separatorNode(),
          textNode(`Ready: ${summary.ready_for_confirmation || 0}/${summary.item_count || 0}`, "sm", "bold"),
          textNode(`Operations: ${summary.proposed_operations || 0} · Blocked: ${summary.blocked || 0}`, "sm"),
          textNode(`Proposed: main ${summary.proposed_main_image_updates || 0} · gallery ${summary.proposed_gallery_image_updates || 0}`, "xs", "regular", "#64748B"),
          separatorNode(),
          ...rows,
          textNode("ยังไม่มีการ upload/attach/replace media หรือ publish ใน WordPress", "xs", "regular", "#b42318")
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          postbackButton("Needs review", { action: "needs_review", batch_id: batchId }, "secondary"),
          postbackButton("Reject", { action: "reject_batch", batch_id: batchId }, "secondary")
        ]
      }
    }
  };
}

function buildReferenceBubble(asset = {}, index, sku) {
  const imageUrl = safeHttpsUrl(asset.thumbnailLink || asset.public_url || asset.url);
  const linkUrl = safeHttpsUrl(asset.webViewLink || asset.public_url || asset.url);
  if (!imageUrl && !linkUrl) return null;
  return {
    type: "bubble",
    size: "mega",
    ...(imageUrl
      ? {
        hero: {
          type: "image",
          url: imageUrl,
          size: "full",
          aspectRatio: "1:1",
          aspectMode: "cover"
        }
      }
      : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        textNode(`Reference ${index}`, "md", "bold"),
        textNode(displayValue(asset.name || asset.file_name || asset.source_name, `${sku} reference`), "xs", "regular", "#64748B")
      ]
    },
    ...(linkUrl
      ? {
        footer: {
          type: "box",
          layout: "vertical",
          contents: [{
            type: "button",
            style: "secondary",
            action: { type: "uri", label: "Open ref", uri: linkUrl }
          }]
        }
      }
      : {})
  };
}

function textNode(text, size = "sm", weight = "regular", color = "#111827") {
  return { type: "text", text: String(text || "-").slice(0, 300), size, weight, color, wrap: true };
}

function separatorNode() {
  return { type: "separator", margin: "md" };
}

function postbackButton(label, params, style) {
  return {
    type: "button",
    style,
    action: {
      type: "postback",
      label,
      data: postbackData(params)
    }
  };
}

function quickReplyPostback(label, params) {
  return {
    action: {
      type: "postback",
      label,
      data: postbackData(compactParams(params)),
      displayText: label
    },
    type: "action"
  };
}

function quickReplyUri(label, uri) {
  return {
    type: "action",
    action: {
      type: "uri",
      label,
      uri
    }
  };
}

function templatePostbackAction(label, params) {
  return {
    type: "postback",
    label,
    data: postbackData(compactParams(params)),
    displayText: label
  };
}

function templateUriAction(label, uri) {
  return {
    type: "uri",
    label,
    uri
  };
}

function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function buildHeroReviewUrl({ reviewBaseUrl = "", batchId, sku, heroAsset = {} } = {}) {
  const base = safeHttpsUrl(reviewBaseUrl).replace(/\/+$/, "");
  if (!base) return "";
  if (!heroAsset.generation_id) return "";
  const params = new URLSearchParams(compactParams({
    batch_id: batchId,
    sku,
    generation_id: heroAsset.generation_id || "",
    asset_id: heroAsset.id || heroAsset.asset_id || ""
  }));
  return `${base}/#review?${params.toString()}`;
}

function postbackData(params) {
  const data = new URLSearchParams(params).toString();
  if (data.length > LINE_POSTBACK_DATA_LIMIT) {
    throw new RangeError(`LINE postback data exceeds ${LINE_POSTBACK_DATA_LIMIT} characters`);
  }
  return data;
}

function displayValue(value, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function safeHttpsUrl(value = "") {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

function preferredAssetImageUrl(asset = {}) {
  return safeHttpsUrl(
    asset.public_url ||
    asset.url ||
    asset.source_url ||
    asset.webContentLink ||
    asset.originalContentUrl ||
    asset.thumbnailLink
  );
}

function preferredReferenceImageUrl(asset = {}, { lineImageProxyBaseUrl = "", lineImageProxySecret = "" } = {}) {
  const driveFileId = String(asset.drive_file_id || asset.id || "").trim();
  const proxyUrl = buildLineImageProxyUrl({
    baseUrl: lineImageProxyBaseUrl,
    secret: lineImageProxySecret,
    driveFileId,
    fileName: asset.name || asset.file_name || ""
  });
  if (proxyUrl) return proxyUrl;
  return preferredAssetImageUrl(asset);
}

function buildLineImageProxyUrl({ baseUrl = "", secret = "", driveFileId = "", fileName = "" } = {}) {
  const base = safeHttpsUrl(baseUrl).replace(/\/+$/, "");
  const fileId = String(driveFileId || "").trim();
  const signingSecret = String(secret || "").trim();
  if (!base || !fileId || !signingSecret) return "";
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const sig = createHmac("sha256", signingSecret)
    .update(`${fileId}.${exp}`)
    .digest("hex");
  const params = new URLSearchParams({ exp: String(exp), sig });
  if (fileName) params.set("name", fileName);
  return `${base}/api/public/line-image/${encodeURIComponent(fileId)}?${params.toString()}`;
}

function formatConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "-";
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}
