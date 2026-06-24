export const SKU_WORK_CLAIM_TTL_MS = 20 * 60 * 1000;

export function createEmptySkuWorkState({ sku = "" } = {}) {
  return {
    sku: normalizeSku(sku),
    status: "available",
    version: 0,
    locked_by: null,
    locked_at: null,
    expires_at: null,
    metadata: {}
  };
}

export function claimSkuWorkState({
  current = null,
  submittedVersion = 0,
  actorId = "",
  actorLabel = "",
  now = new Date(),
  ttlMs = SKU_WORK_CLAIM_TTL_MS
} = {}) {
  const state = normalizeState(current);
  const version = Number(submittedVersion);
  if (!Number.isInteger(version) || version !== Number(state.version || 0)) {
    return {
      ok: false,
      code: "sku_work_version_conflict",
      conflict: buildSkuWorkStateConflict(state, { viewerId: actorId, now })
    };
  }

  const activeClaim = isActiveClaim(state, now);
  if (activeClaim && state.locked_by && state.locked_by !== actorId) {
    return {
      ok: false,
      code: "sku_work_claim_conflict",
      conflict: buildSkuWorkStateConflict(state, { viewerId: actorId, now })
    };
  }

  const lockedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const previousLockedBy = state.locked_by && state.locked_by !== actorId ? state.locked_by : null;
  return {
    ok: true,
    state: {
      ...state,
      status: "claimed",
      version: Number(state.version || 0) + 1,
      locked_by: actorId || null,
      locked_at: lockedAt,
      expires_at: expiresAt,
      metadata: compactObject({
        ...normalizeMetadata(state.metadata),
        locked_by_label: actorLabel || null,
        previous_locked_by: previousLockedBy,
        last_claimed_at: lockedAt
      })
    }
  };
}

export function releaseSkuWorkState({
  current = null,
  actorId = "",
  actorRole = "staff",
  now = new Date()
} = {}) {
  const state = normalizeState(current);
  const canRelease = state.locked_by === actorId || actorRole === "admin" || !isActiveClaim(state, now);
  if (!canRelease) {
    return {
      ok: false,
      code: "sku_work_release_forbidden",
      conflict: buildSkuWorkStateConflict(state, { viewerId: actorId, now })
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      status: "available",
      version: Number(state.version || 0) + 1,
      locked_by: null,
      locked_at: null,
      expires_at: null,
      metadata: compactObject({
        ...normalizeMetadata(state.metadata),
        released_by: actorId || null,
        released_at: now.toISOString()
      })
    }
  };
}

export function buildSkuWorkStateConflict(current = null, { viewerId = "", now = new Date() } = {}) {
  const state = normalizeState(current);
  const active = isActiveClaim(state, now);
  const lockedByMe = Boolean(active && state.locked_by && state.locked_by === viewerId);
  return compactObject({
    sku: state.sku,
    status: active ? "claimed" : "available",
    current_version: Number(state.version || 0),
    locked_by_me: lockedByMe,
    locked_by_label: active ? normalizeMetadata(state.metadata).locked_by_label || "ทีมอื่น" : "",
    locked_at: active ? state.locked_at : null,
    expires_at: active ? state.expires_at : null
  });
}

export function serializeSkuWorkClaimForUser(current = null, { viewerId = "", now = new Date() } = {}) {
  const state = normalizeState(current);
  const active = isActiveClaim(state, now);
  const lockedByMe = Boolean(active && state.locked_by && state.locked_by === viewerId);
  return {
    sku: state.sku,
    status: active ? lockedByMe ? "claimed_by_me" : "claimed_by_other" : "available",
    version: Number(state.version || 0),
    locked_by_me: lockedByMe,
    locked_by_label: active ? normalizeMetadata(state.metadata).locked_by_label || "ทีมอื่น" : "",
    locked_at: active ? state.locked_at : null,
    expires_at: active ? state.expires_at : null
  };
}

export function isActiveClaim(state = {}, now = new Date()) {
  if (state.status !== "claimed" || !state.locked_by) return false;
  if (!state.expires_at) return true;
  return new Date(state.expires_at).getTime() > now.getTime();
}

function normalizeState(value = null) {
  const state = value && typeof value === "object" ? value : {};
  return {
    sku: normalizeSku(state.sku),
    status: state.status || "available",
    version: Number.isInteger(Number(state.version)) ? Number(state.version) : 0,
    locked_by: state.locked_by || null,
    locked_at: state.locked_at || null,
    expires_at: state.expires_at || null,
    metadata: normalizeMetadata(state.metadata)
  };
}

function normalizeMetadata(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeSku(value = "") {
  return String(value || "").trim().toUpperCase();
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
