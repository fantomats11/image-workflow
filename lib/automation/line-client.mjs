import { getRequiredEnv } from "./env.mjs";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

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
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: `${item.sku} · ${item.product_type}`,
          weight: "bold",
          size: "sm",
          wrap: true
        },
        {
          type: "text",
          text: item.product_name || "-",
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
    altText: `Dry-run batch ${batch.batch_id}: ${items.length} SKU`,
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
            text: `${batch.batch_id} · ${items.length} SKU · dry-run only`,
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
              data: `action=approve_batch&batch_id=${encodeURIComponent(batchId)}`,
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
                  data: `action=needs_review&batch_id=${encodeURIComponent(batchId)}`,
                  displayText: `Review ${batchId}`
                }
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "Reject",
                  data: `action=reject_batch&batch_id=${encodeURIComponent(batchId)}`,
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
  return {
    type: "flex",
    altText: `Reference review: ${item.sku}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          textNode(`${item.brand_label || "Brand"} / ${item.sku}`, "lg", "bold"),
          textNode(item.product_name || "-", "sm", "regular", "#64748B"),
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
          postbackButton("Approve match", `action=approve_reference&batch_id=${item.batch_id}&sku=${item.sku}`, "primary"),
          postbackButton("Needs review", `action=needs_review&batch_id=${item.batch_id}&sku=${item.sku}`, "secondary"),
          postbackButton("Reject", `action=reject_sku&batch_id=${item.batch_id}&sku=${item.sku}`, "secondary")
        ]
      }
    }
  };
}

function textNode(text, size = "sm", weight = "regular", color = "#111827") {
  return { type: "text", text: String(text || "-").slice(0, 300), size, weight, color, wrap: true };
}

function separatorNode() {
  return { type: "separator", margin: "md" };
}

function postbackButton(label, data, style) {
  return {
    type: "button",
    style,
    action: {
      type: "postback",
      label,
      data
    }
  };
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
