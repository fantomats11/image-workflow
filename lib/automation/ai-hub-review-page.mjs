export function renderAiHubImageReviewPage(bundle = {}, {
  bundleName = "",
  localImageBasePath = "/api/ai-hub/local-image",
  decisionEndpoint = "/api/ai-hub/review-decisions"
} = {}) {
  const items = Array.isArray(bundle.review_items) ? bundle.review_items : [];
  const summary = bundle.summary || {};
  const title = items.length === 1
    ? `AI HUB Review - ${items[0].sku || "SKU"}`
    : "AI HUB Image Review";

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${reviewPageCss()}</style>
  </head>
  <body data-bundle-name="${escapeAttribute(bundleName)}" data-decision-endpoint="${escapeAttribute(decisionEndpoint)}">
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">AI HUB / Product Image QC</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtle">${escapeHtml(bundleName || "local review bundle")} · ${escapeHtml(bundle.version || "review bundle")}</p>
        </div>
        <div class="summary-grid" aria-label="Bundle summary">
          ${summaryTile("SKU", summary.sku_count)}
          ${summaryTile("Assets", summary.review_asset_count)}
          ${summaryTile("Generated", summary.generated_asset_count)}
          ${summaryTile("Pending QC", summary.pending_human_qc)}
        </div>
      </header>

      <section class="guardrails" aria-label="Guardrails">
        ${(bundle.guardrails || []).map((guardrail) => `<span>${escapeHtml(formatLabel(guardrail))}</span>`).join("")}
      </section>

      <section class="decision-console" aria-label="Review decision console">
        <div>
          <strong>Review Decision Console</strong>
          <p>บันทึกผลตรวจเป็น local artifacts ก่อนต่อไปยัง media preflight หรือ regeneration gate</p>
        </div>
        <label>
          Reviewer
          <input id="reviewerName" type="text" value="local-reviewer" autocomplete="off" />
        </label>
        <button class="submit-decisions" type="button" id="submitDecisionsButton">Submit Decisions</button>
        <div class="decision-message" id="decisionMessage" role="status"></div>
      </section>

      ${items.map((item) => renderReviewItem(item, { localImageBasePath })).join("") || emptyState()}
    </main>
    <script>${reviewPageScript()}</script>
  </body>
</html>`;
}

function renderReviewItem(item, { localImageBasePath }) {
  const assets = Array.isArray(item.review_assets) ? item.review_assets : [];
  const hero = item.approved_hero_anchor || {};
  return `<section class="sku-section">
    <div class="sku-header">
      <div>
        <p class="eyebrow">${escapeHtml(item.target_site || item.brand_id || "Product")}</p>
        <h2>${escapeHtml(item.sku || "Unknown SKU")}</h2>
        <p class="subtle">${escapeHtml([item.product_name, item.category, item.subcategory].filter(Boolean).join(" · "))}</p>
      </div>
      <span class="status">${escapeHtml(formatLabel(item.review_status || "review"))}</span>
    </div>

    ${hero.local_path || hero.url ? `<div class="hero-strip">
      <div>
        <strong>Approved hero anchor</strong>
        <p>${escapeHtml(hero.file_name || hero.source_name || hero.local_path || hero.url || "")}</p>
      </div>
      ${renderImage({
        sourceUrl: hero.url,
        localPath: hero.local_path,
        alt: `${item.sku || "SKU"} hero anchor`,
        localImageBasePath
      })}
    </div>` : ""}

    <div class="asset-grid">
      ${assets.map((asset) => renderReviewAsset(asset, { localImageBasePath })).join("")}
    </div>
  </section>`;
}

function renderReviewAsset(asset, { localImageBasePath }) {
  const generated = asset.generated || {};
  const qc = asset.qc || {};
  const checks = Array.isArray(qc.required_checks) ? qc.required_checks : [];
  const actions = Array.isArray(asset.review_actions) ? asset.review_actions : [];
  const flagOptions = Array.isArray(qc.human_blocking_flag_options) ? qc.human_blocking_flag_options : [];
  return `<article class="asset-card" data-review-asset-id="${escapeAttribute(asset.review_asset_id || asset.request_id || "")}" data-request-id="${escapeAttribute(asset.request_id || "")}" data-sku="${escapeAttribute(asset.sku || "")}" data-slot="${escapeAttribute(asset.slot || "")}">
    <div class="asset-media">
      ${renderImage({
        sourceUrl: generated.source_url,
        localPath: generated.local_path,
        alt: `${asset.sku || "SKU"} ${asset.slot || "image"}`,
        localImageBasePath
      })}
    </div>
    <div class="asset-body">
      <div class="asset-title">
        <div>
          <p class="eyebrow">${escapeHtml(asset.kind || "asset")}</p>
          <h3>${escapeHtml(formatLabel(asset.slot || "image"))}</h3>
        </div>
        <span class="status ${statusClass(qc.review_status)}">${escapeHtml(formatLabel(qc.review_status || "review"))}</span>
      </div>

      <dl class="meta">
        <div><dt>Request</dt><dd>${escapeHtml(asset.request_id || "")}</dd></div>
        <div><dt>Provider</dt><dd>${escapeHtml(generated.provider_request_id || "-")}</dd></div>
        <div><dt>Framework</dt><dd>${escapeHtml(asset.prompt_framework_version || "-")}</dd></div>
      </dl>

      <details class="prompt-box">
        <summary>Prompt ที่ใช้ยิงโมเดล</summary>
        <p>${escapeHtml(asset.prompt || "")}</p>
      </details>

      <div class="checklist">
        <strong>QC checklist</strong>
        ${checks.map((check) => `<label><input type="checkbox" data-check="${escapeAttribute(check)}" /> <span>${escapeHtml(formatLabel(check))}</span></label>`).join("")}
      </div>

      <div class="decision-fields">
        <label>
          Decision
          <select class="decision-action">
            ${actions.map((action) => `<option value="${escapeAttribute(action)}"${action === "needs_manual_review" ? " selected" : ""}>${escapeHtml(formatLabel(action))}</option>`).join("")}
          </select>
        </label>
        <label>
          QC flags
          <textarea class="decision-flags" rows="2" placeholder="${escapeAttribute(flagOptions.slice(0, 3).map(formatLabel).join(", "))}"></textarea>
        </label>
        <label>
          Notes
          <textarea class="decision-notes" rows="2" placeholder="เช่น logo หลังเพี้ยน / side ผ่าน / ต้อง regen close-up"></textarea>
        </label>
      </div>

      <div class="actions">
        ${actions.map((action) => `<button type="button" data-action-value="${escapeAttribute(action)}">${escapeHtml(formatLabel(action))}</button>`).join("")}
      </div>
    </div>
  </article>`;
}

function renderImage({ sourceUrl = "", localPath = "", alt = "", localImageBasePath }) {
  const src = sourceUrl || localPathToImageUrl(localPath, localImageBasePath);
  if (!src) {
    return `<div class="image-missing">No image</div>`;
  }
  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" />`;
}

function localPathToImageUrl(localPath, localImageBasePath) {
  const cleanPath = String(localPath || "").trim();
  if (!cleanPath) return "";
  return `${localImageBasePath}?path=${encodeURIComponent(cleanPath)}`;
}

function summaryTile(label, value) {
  return `<div class="summary-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))}</strong></div>`;
}

function emptyState() {
  return `<section class="empty-state">
    <h2>ยังไม่มี review items</h2>
    <p>เลือกหรือสร้าง AI HUB image review bundle ก่อนเปิดหน้านี้</p>
  </section>`;
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("th-TH").format(number) : "0";
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();
  if (status.includes("pending")) return "is-pending";
  if (status.includes("missing") || status.includes("failed") || status.includes("blocked")) return "is-blocked";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function reviewPageCss() {
  return `
    :root {
      color-scheme: light;
      --bg: #f5f4f1;
      --surface: #fffdfa;
      --panel: #ffffff;
      --ink: #1f2421;
      --soft: #5d6660;
      --muted: #7b837d;
      --line: #ded8ce;
      --accent: #9f1f2a;
      --success: #267353;
      --warning: #8c641b;
      --danger: #a2282b;
      --shadow: 0 14px 40px rgba(39, 35, 30, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #fbfaf8, var(--bg));
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    .shell { width: min(100% - 40px, 1600px); margin: 0 auto; padding: 28px 0 48px; }
    .topbar { display: flex; justify-content: space-between; gap: 24px; align-items: start; margin-bottom: 18px; }
    .eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 30px; line-height: 1.12; }
    h2 { font-size: 22px; line-height: 1.15; }
    h3 { font-size: 17px; line-height: 1.2; }
    .subtle { margin-top: 8px; color: var(--soft); font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(92px, 1fr)); gap: 10px; min-width: 460px; }
    .summary-tile { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 12px; box-shadow: 0 1px 2px rgba(39,35,30,.04); }
    .summary-tile span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; }
    .summary-tile strong { display: block; margin-top: 4px; font-size: 22px; }
    .guardrails { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .guardrails span { border: 1px solid var(--line); border-radius: 999px; background: #fff; padding: 7px 10px; color: var(--soft); font-size: 12px; font-weight: 750; }
    .decision-console { display: grid; grid-template-columns: minmax(0, 1fr) 220px 180px; gap: 12px; align-items: end; border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 14px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(39,35,30,.04); }
    .decision-console p { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .decision-console label, .decision-fields label { display: grid; gap: 6px; color: var(--soft); font-size: 12px; font-weight: 800; }
    .decision-console input, .decision-fields select, .decision-fields textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--ink); padding: 9px 10px; font: inherit; font-size: 13px; }
    .submit-decisions { min-height: 40px; border: 1px solid var(--accent); border-radius: 6px; background: var(--accent); color: #fff; font-weight: 850; }
    .decision-message { grid-column: 1 / -1; min-height: 20px; color: var(--soft); font-size: 13px; font-weight: 750; }
    .decision-message.is-error { color: var(--danger); }
    .decision-message.is-success { color: var(--success); }
    .sku-section { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 18px; box-shadow: var(--shadow); }
    .sku-header { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .status { display: inline-flex; align-items: center; min-height: 30px; border-radius: 999px; padding: 5px 10px; background: #e4eef0; color: #2f6371; font-size: 12px; font-weight: 850; white-space: nowrap; }
    .status.is-pending { background: #f7efd9; color: var(--warning); }
    .status.is-blocked { background: #f5e4e2; color: var(--danger); }
    .hero-strip { display: grid; grid-template-columns: minmax(0, 1fr) 120px; align-items: center; gap: 12px; border: 1px solid var(--line); border-radius: 8px; background: #f8f7f4; padding: 12px; margin-bottom: 14px; }
    .hero-strip p { margin-top: 4px; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .hero-strip img { width: 120px; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); background: #fff; }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; }
    .asset-card { min-width: 0; display: grid; grid-template-rows: auto 1fr; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); overflow: hidden; }
    .asset-media { display: grid; place-items: center; min-height: 360px; background: #f0eee9; border-bottom: 1px solid var(--line); }
    .asset-media img { width: 100%; height: 460px; object-fit: contain; background: #111; }
    .image-missing { display: grid; place-items: center; min-height: 240px; width: 100%; color: var(--muted); font-weight: 800; }
    .asset-body { display: grid; gap: 14px; padding: 14px; }
    .asset-title { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
    .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
    .meta div { min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 8px; background: #fbfaf8; }
    .meta dt { color: var(--muted); font-size: 11px; font-weight: 800; }
    .meta dd { margin: 4px 0 0; color: var(--soft); font-size: 12px; overflow-wrap: anywhere; }
    .prompt-box { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: #fbfaf8; }
    .prompt-box summary { cursor: pointer; font-size: 13px; font-weight: 850; }
    .prompt-box p { margin-top: 8px; color: var(--soft); font-size: 13px; white-space: pre-wrap; }
    .checklist { display: grid; gap: 8px; }
    .checklist strong { font-size: 13px; }
    .checklist label { display: flex; gap: 8px; align-items: start; color: var(--soft); font-size: 13px; }
    .checklist input { margin-top: 3px; }
    .decision-fields { display: grid; gap: 10px; }
    .decision-fields textarea { resize: vertical; min-height: 42px; }
    .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .actions button { min-height: 38px; border: 1px solid var(--line); border-radius: 6px; background: #f8f7f4; color: var(--muted); font-weight: 800; cursor: pointer; }
    .actions button.is-selected { border-color: var(--accent); background: #f6e6e4; color: var(--accent); }
    .empty-state { border: 1px dashed var(--line); border-radius: 10px; padding: 28px; background: #fff; text-align: center; color: var(--soft); }
    @media (max-width: 900px) {
      .shell { width: min(100% - 24px, 1600px); padding-top: 18px; }
      .topbar { display: grid; }
      .summary-grid { min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .decision-console { grid-template-columns: 1fr; }
      .asset-grid { grid-template-columns: 1fr; }
      .asset-media img { height: auto; max-height: 70vh; }
      .meta { grid-template-columns: 1fr; }
      .actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `;
}

function reviewPageScript() {
  return `
    const body = document.body;
    const submitButton = document.getElementById("submitDecisionsButton");
    const message = document.getElementById("decisionMessage");
    const reviewerInput = document.getElementById("reviewerName");

    document.querySelectorAll(".asset-card").forEach((card) => {
      const select = card.querySelector(".decision-action");
      const syncButtons = () => {
        card.querySelectorAll("[data-action-value]").forEach((button) => {
          button.classList.toggle("is-selected", button.dataset.actionValue === select.value);
        });
      };
      card.querySelectorAll("[data-action-value]").forEach((button) => {
        button.addEventListener("click", () => {
          select.value = button.dataset.actionValue;
          syncButtons();
        });
      });
      select.addEventListener("change", syncButtons);
      syncButtons();
    });

    submitButton?.addEventListener("click", async () => {
      setMessage("Saving local decision artifacts...", "");
      submitButton.disabled = true;
      try {
        const decisions = Array.from(document.querySelectorAll(".asset-card")).map((card) => ({
          review_asset_id: card.dataset.reviewAssetId || "",
          request_id: card.dataset.requestId || "",
          sku: card.dataset.sku || "",
          slot: card.dataset.slot || "",
          action: card.querySelector(".decision-action")?.value || "needs_manual_review",
          flags: splitList(card.querySelector(".decision-flags")?.value || ""),
          passed_checks: Array.from(card.querySelectorAll("[data-check]:checked")).map((input) => input.dataset.check),
          notes: card.querySelector(".decision-notes")?.value || ""
        }));
        const response = await fetch(body.dataset.decisionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bundle: body.dataset.bundleName,
            reviewer: reviewerInput?.value || "local-reviewer",
            decisions
          })
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Decision submit failed");
        setMessage("Saved: " + payload.summary.approved_media_candidates + " approved candidate(s), " + payload.summary.regeneration_requests + " regeneration request(s), " + payload.summary.blocked_actions + " blocked action(s).", "is-success");
      } catch (error) {
        setMessage(error.message || String(error), "is-error");
      } finally {
        submitButton.disabled = false;
      }
    });

    function splitList(value) {
      return String(value || "").split(/[\\n,|]+/).map((item) => item.trim()).filter(Boolean);
    }

    function setMessage(text, className) {
      if (!message) return;
      message.textContent = text;
      message.className = "decision-message" + (className ? " " + className : "");
    }
  `;
}
