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
  const rows = batch.items.slice(0, 8).map((item) => ({
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
        text: item.dry_run_action,
        size: "xxs",
        color: item.dry_run_action.includes("skip") ? "#0f766e" : "#b42318",
        wrap: true
      }
    ]
  }));

  return {
    type: "flex",
    altText: `Dry-run batch ${batch.batch_id}: ${batch.items.length} SKU`,
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
            text: `${batch.batch_id} · ${batch.items.length} SKU · dry-run only`,
            size: "xs",
            color: "#666666",
            wrap: true
          },
          {
            type: "separator"
          },
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
