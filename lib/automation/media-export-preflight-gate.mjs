export const MEDIA_EXPORT_PREFLIGHT_GATE = "ai_hub_media_export_preflight_gate";

export function buildMediaExportPreflightGate({
  candidateManifest = {},
  now = new Date()
} = {}) {
  const candidates = (Array.isArray(candidateManifest.candidates) ? candidateManifest.candidates : [])
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .sort(compareCandidateOrder);
  const mediaAssets = candidates.map(toMediaAsset);
  const exportSlots = candidates.map(toExportSlot);
  const gateBlockers = buildGateBlockers({ candidateManifest, candidates });

  return {
    manifest_type: MEDIA_EXPORT_PREFLIGHT_GATE,
    version: "media-export-preflight-gate-v1.0",
    created_at: now.toISOString(),
    batch_id: candidateManifest.batch_id || null,
    source_candidate_manifest: {
      manifest_type: candidateManifest.manifest_type || "",
      version: candidateManifest.version || "",
      created_at: candidateManifest.created_at || null,
      manifest_status: candidateManifest.manifest_status || ""
    },
    dry_run: true,
    live_write_allowed: false,
    live_writes_enabled: false,
    export_allowed: false,
    media_attach_allowed: false,
    publish_allowed: false,
    requires_final_confirmation: true,
    proposed_write_scope: "export_files_or_media_mapping_only_after_later_confirmation",
    gate_status: gateBlockers.length ? "blocked_before_export_preflight" : "ready_for_export_preflight",
    gate_blockers: gateBlockers,
    guardrails: [
      "media_export_preflight_only_no_wordpress_db_media_attach_or_publish",
      "candidate_manifest_must_be_ready_before_export",
      "export_file_names_are_proposals_not_written_files",
      "hero_export_precedes_support_gallery",
      "later_media_attach_requires_final_confirmation"
    ],
    summary: summarize({ candidates, exportSlots, mediaAssets, gateBlockers }),
    items: groupBySku({ candidates, exportSlots }),
    media_assets: mediaAssets,
    export_slots: exportSlots
  };
}

function normalizeCandidate(candidate = {}, index = 0) {
  const sourceUrl = candidate.public_url || candidate.source_url || candidate.url || "";
  return {
    sku: String(candidate.sku || "").trim(),
    brand_id: candidate.brand_id || "",
    target_site: candidate.target_site || "",
    product_name: candidate.product_name || "",
    category: candidate.category || "",
    kind: candidate.kind || inferKind(candidate),
    slot: candidate.slot || candidate.shot_key || "",
    type: candidate.type || inferType(candidate),
    candidate_role: candidate.candidate_role || "",
    candidate_status: candidate.candidate_status || "",
    source_url: sourceUrl,
    public_url: sourceUrl,
    local_path: candidate.local_path || "",
    file_name: candidate.file_name || fileNameFromUrl(sourceUrl) || "",
    mime_type: candidate.mime_type || "",
    file_size: Number(candidate.file_size || 0),
    provider_request_id: candidate.provider_request_id || null,
    review_asset_id: candidate.review_asset_id || candidate.asset_id || candidate.id || "",
    generation_id: candidate.generation_id || null,
    source_index: index,
    blockers: Array.isArray(candidate.blockers) ? candidate.blockers : []
  };
}

function toMediaAsset(candidate) {
  return {
    id: candidate.review_asset_id || null,
    asset_id: candidate.review_asset_id || null,
    generation_id: candidate.generation_id,
    sku: candidate.sku,
    type: candidate.type,
    kind: candidate.kind,
    shot_key: candidate.kind === "hero" ? "hero" : candidate.slot,
    status: "approved",
    url: candidate.public_url,
    public_url: candidate.public_url,
    local_path: candidate.local_path,
    file_name: candidate.file_name,
    source: candidate.public_url ? "remote_url" : candidate.local_path ? "local" : "",
    candidate_role: candidate.candidate_role
  };
}

function toExportSlot(candidate, index) {
  const extension = fileExtension(candidate.file_name || candidate.public_url || candidate.local_path) || "png";
  const slot = candidate.kind === "hero" ? "Hero" : candidate.slot || `Support_${index + 1}`;
  const blockers = [...candidate.blockers];
  if (!candidate.source_url && !candidate.local_path) blockers.push("candidate_missing_source_url_or_local_path");
  if (!candidate.sku) blockers.push("missing_sku");
  if (!candidate.kind) blockers.push("missing_kind");
  if (!candidate.slot) blockers.push("missing_slot");
  return {
    sku: candidate.sku,
    kind: candidate.kind,
    slot: candidate.kind === "hero" ? "hero" : candidate.slot,
    export_index: index + 1,
    export_file_name: `${String(index + 1).padStart(2, "0")}-${candidate.sku}_${sanitizeFileSegment(slot)}.${extension}`,
    source_url: candidate.public_url,
    local_path: candidate.local_path,
    media_asset_id: candidate.review_asset_id || null,
    export_status: blockers.length ? "blocked" : "ready",
    blockers: Array.from(new Set(blockers))
  };
}

function buildGateBlockers({ candidateManifest, candidates }) {
  const blockers = [];
  if (candidateManifest.manifest_status !== "ready_for_media_manifest_preflight") {
    blockers.push("candidate_manifest_not_ready_for_media_preflight");
  }
  if (!candidates.some((candidate) => candidate.kind === "hero")) blockers.push("missing_hero_candidate");
  if (!candidates.some((candidate) => candidate.kind === "support")) blockers.push("missing_support_candidates");
  if (candidates.some((candidate) => candidate.blockers.length)) blockers.push("candidate_has_blockers");
  if (candidates.some((candidate) => !candidate.source_url && !candidate.local_path)) {
    blockers.push("candidate_missing_source_url_or_local_path");
  }
  return Array.from(new Set(blockers));
}

function summarize({ candidates, exportSlots, mediaAssets, gateBlockers }) {
  return {
    sku_count: new Set(candidates.map((candidate) => candidate.sku).filter(Boolean)).size,
    candidate_count: candidates.length,
    media_asset_count: mediaAssets.length,
    export_slot_count: exportSlots.length,
    ready_export_slots: exportSlots.filter((slot) => slot.export_status === "ready").length,
    blocked_export_slots: exportSlots.filter((slot) => slot.export_status === "blocked").length,
    hero_slots: exportSlots.filter((slot) => slot.kind === "hero").length,
    support_slots: exportSlots.filter((slot) => slot.kind === "support").length,
    gate_blockers: gateBlockers.length
  };
}

function groupBySku({ candidates, exportSlots }) {
  const map = new Map();
  for (const candidate of candidates) {
    const sku = normalizeSku(candidate.sku);
    if (!sku) continue;
    if (!map.has(sku)) {
      map.set(sku, {
        sku: candidate.sku,
        brand_id: candidate.brand_id,
        target_site: candidate.target_site,
        product_name: candidate.product_name,
        category: candidate.category,
        export_status: "ready_for_export_preflight",
        export_slot_count: 0,
        ready_export_slots: 0,
        blocked_export_slots: 0,
        slots: []
      });
    }
  }
  for (const slot of exportSlots) {
    const item = map.get(normalizeSku(slot.sku));
    if (!item) continue;
    item.slots.push(slot);
    item.export_slot_count += 1;
    if (slot.export_status === "ready") item.ready_export_slots += 1;
    if (slot.export_status === "blocked") item.blocked_export_slots += 1;
  }
  for (const item of map.values()) {
    if (item.blocked_export_slots) item.export_status = "blocked_before_export_preflight";
  }
  return Array.from(map.values()).sort((a, b) => normalizeSku(a.sku).localeCompare(normalizeSku(b.sku), "en"));
}

function compareCandidateOrder(left, right) {
  return candidatePriority(left) - candidatePriority(right) ||
    normalizeSku(left.sku).localeCompare(normalizeSku(right.sku), "en") ||
    Number(left.source_index || 0) - Number(right.source_index || 0) ||
    String(left.slot || "").localeCompare(String(right.slot || ""), "en");
}

function candidatePriority(candidate) {
  if (candidate.kind === "hero") return 0;
  return 10;
}

function inferKind(candidate) {
  if (/hero|main/i.test(`${candidate.type || ""} ${candidate.slot || ""}`)) return "hero";
  return "support";
}

function inferType(candidate) {
  return inferKind(candidate) === "hero" ? "hero_generated" : "support_generated";
}

function fileExtension(value = "") {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const ext = clean.includes(".") ? clean.split(".").pop() : "";
  return /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : "";
}

function fileNameFromUrl(url = "") {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

function sanitizeFileSegment(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Asset";
}

function normalizeSku(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}
