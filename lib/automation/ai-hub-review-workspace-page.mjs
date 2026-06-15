export function renderAiHubReviewWorkspacePage(workspace = {}, {
  workspaceName = "ai-hub-review-workspace.json"
} = {}) {
  const items = Array.isArray(workspace.items) ? workspace.items : [];
  const summary = workspace.summary || {};

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI HUB Review Workspace</title>
    <style>${workspaceCss()}</style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">AI HUB / Review Workspace</p>
          <h1>Product Image Command Center</h1>
          <p class="subtle">${escapeHtml(workspaceName)} · ${escapeHtml(workspace.version || "workspace")}</p>
        </div>
        <div class="summary-grid">
          ${summaryTile("SKU", summary.sku_count)}
          ${summaryTile("Bundles", summary.review_bundle_count)}
          ${summaryTile("Decisions", summary.decision_artifact_count)}
          ${summaryTile("Plans", summary.action_plan_count)}
          ${summaryTile("Regen Gates", summary.regeneration_gate_count)}
          ${summaryTile("Candidates", summary.local_candidate_manifest_count)}
        </div>
      </header>

      <section class="guardrails">
        ${(workspace.guardrails || []).map((guardrail) => `<span>${escapeHtml(formatLabel(guardrail))}</span>`).join("")}
      </section>

      <section class="lane-grid">
        ${lane("Awaiting Decisions", summary.awaiting_human_decisions, "open review console")}
        ${lane("Regen Gate", summary.ready_for_regeneration_gate, "prepare generation gate")}
        ${lane("Local Candidates", summary.approved_candidates_ready, "build local manifest")}
        ${lane("Blocked", summary.blocked_review_actions, "fix decisions")}
      </section>

      <section class="workspace-table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Status</th>
              <th>Next action</th>
              <th>Counts</th>
              <th>Latest artifacts</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(renderWorkspaceRow).join("") || `<tr><td colspan="5" class="empty">ยังไม่มี AI HUB review workspace items</td></tr>`}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

function renderWorkspaceRow(item) {
  const latestBundle = item.latest_review_bundle || {};
  const latestActionPlan = item.latest_action_plan || {};
  const latestDecisions = item.latest_decisions || {};
  return `<tr>
    <td>
      <strong>${escapeHtml(item.sku || "-")}</strong>
      <span>${escapeHtml([item.target_site, item.product_name].filter(Boolean).join(" · "))}</span>
    </td>
    <td><span class="status ${statusClass(item.workspace_status)}">${escapeHtml(formatLabel(item.workspace_status))}</span></td>
    <td>${escapeHtml(formatLabel(item.next_action))}</td>
    <td>
      <div class="count-grid">
        ${miniCount("assets", item.counts?.review_assets)}
        ${miniCount("pending", item.counts?.pending_human_decision)}
        ${miniCount("regen", item.counts?.regeneration_requests)}
        ${miniCount("gate", item.counts?.ready_regeneration_requests)}
        ${miniCount("candidate", item.counts?.approved_media_candidates)}
        ${miniCount("local", item.counts?.ready_local_candidates)}
      </div>
    </td>
    <td>
      <div class="artifact-links">
        ${latestBundle.file_name ? `<a href="/ai-hub/review?bundle=${encodeURIComponent(latestBundle.file_name)}">review</a>` : ""}
        ${latestActionPlan.file_name ? `<span>${escapeHtml(latestActionPlan.file_name)}</span>` : ""}
        ${latestDecisions.file_name ? `<span>${escapeHtml(latestDecisions.file_name)}</span>` : ""}
        ${item.latest_regeneration_gate?.file_name ? `<span>${escapeHtml(item.latest_regeneration_gate.file_name)}</span>` : ""}
        ${item.latest_candidate_manifest?.file_name ? `<span>${escapeHtml(item.latest_candidate_manifest.file_name)}</span>` : ""}
      </div>
    </td>
  </tr>`;
}

function lane(label, value, caption) {
  return `<article class="lane">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(formatNumber(value))}</strong>
    <p>${escapeHtml(caption)}</p>
  </article>`;
}

function summaryTile(label, value) {
  return `<div class="summary-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))}</strong></div>`;
}

function miniCount(label, value) {
  return `<span><b>${escapeHtml(formatNumber(value))}</b>${escapeHtml(label)}</span>`;
}

function formatLabel(value) {
  return String(value || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("th-TH").format(number) : "0";
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();
  if (status.includes("blocked")) return "is-blocked";
  if (status.includes("awaiting")) return "is-pending";
  if (status.includes("regeneration")) return "is-regen";
  if (status.includes("approved")) return "is-approved";
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

function workspaceCss() {
  return `
    :root { color-scheme: light; --bg:#f5f4f1; --panel:#fffdfa; --ink:#1f2421; --soft:#5d6660; --muted:#7b837d; --line:#ded8ce; --accent:#9f1f2a; --warning:#8c641b; --danger:#a2282b; --success:#267353; --info:#2f6371; --shadow:0 14px 40px rgba(39,35,30,.08); }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(180deg,#fbfaf8,var(--bg)); color:var(--ink); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.5; }
    .shell { width:min(100% - 40px, 1600px); margin:0 auto; padding:28px 0 48px; }
    .topbar { display:flex; justify-content:space-between; gap:24px; align-items:start; margin-bottom:18px; }
    .eyebrow { margin:0 0 6px; color:var(--muted); font-size:11px; font-weight:850; text-transform:uppercase; }
    h1,p { margin:0; }
    h1 { font-size:30px; line-height:1.12; }
    .subtle { margin-top:8px; color:var(--soft); font-size:14px; }
    .summary-grid { display:grid; grid-template-columns:repeat(3,minmax(92px,1fr)); gap:10px; min-width:460px; }
    .summary-tile,.lane { border:1px solid var(--line); border-radius:8px; background:#fff; padding:12px; box-shadow:0 1px 2px rgba(39,35,30,.04); }
    .summary-tile span,.lane span { display:block; color:var(--muted); font-size:12px; font-weight:750; }
    .summary-tile strong,.lane strong { display:block; margin-top:4px; font-size:24px; }
    .guardrails { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px; }
    .guardrails span { border:1px solid var(--line); border-radius:999px; background:#fff; padding:7px 10px; color:var(--soft); font-size:12px; font-weight:750; }
    .lane-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
    .lane p { margin-top:4px; color:var(--soft); font-size:12px; }
    .workspace-table-wrap { overflow:auto; border:1px solid var(--line); border-radius:10px; background:var(--panel); box-shadow:var(--shadow); }
    table { width:100%; border-collapse:collapse; min-width:980px; }
    th,td { padding:14px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:var(--muted); font-size:12px; text-transform:uppercase; }
    td strong { display:block; }
    td span { display:block; margin-top:4px; color:var(--soft); font-size:12px; }
    .status { display:inline-flex; border-radius:999px; padding:5px 10px; background:#e4eef0; color:var(--info); font-size:12px; font-weight:850; white-space:nowrap; }
    .status.is-pending { background:#f7efd9; color:var(--warning); }
    .status.is-blocked { background:#f5e4e2; color:var(--danger); }
    .status.is-regen { background:#e4eef0; color:var(--info); }
    .status.is-approved { background:#e7f1eb; color:var(--success); }
    .count-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
    .count-grid span { display:flex; align-items:baseline; gap:5px; border:1px solid var(--line); border-radius:6px; padding:7px; background:#fbfaf8; color:var(--soft); }
    .count-grid b { color:var(--ink); }
    .artifact-links { display:grid; gap:6px; }
    .artifact-links a,.artifact-links span { overflow-wrap:anywhere; color:var(--soft); font-size:12px; }
    .artifact-links a { color:var(--accent); font-weight:850; text-decoration:none; }
    .empty { color:var(--muted); text-align:center; }
    @media (max-width: 900px) { .shell { width:min(100% - 24px,1600px); } .topbar { display:grid; } .summary-grid,.lane-grid { min-width:0; grid-template-columns:repeat(2,minmax(0,1fr)); } }
  `;
}
