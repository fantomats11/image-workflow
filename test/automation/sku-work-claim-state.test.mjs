import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSkuWorkStateConflict,
  claimSkuWorkState,
  createEmptySkuWorkState,
  releaseSkuWorkState
} from "../../lib/automation/sku-work-claim-state.mjs";

const baseNow = new Date("2026-06-24T04:00:00.000Z");

test("claimSkuWorkState lets one worker win and turns the stale version into a conflict", () => {
  const empty = createEmptySkuWorkState({ sku: "FSTR240017" });
  const first = claimSkuWorkState({
    current: empty,
    submittedVersion: 0,
    actorId: "user-a",
    actorLabel: "A Team",
    now: baseNow
  });
  assert.equal(first.ok, true);
  assert.equal(first.state.version, 1);
  assert.equal(first.state.locked_by, "user-a");

  const second = claimSkuWorkState({
    current: first.state,
    submittedVersion: 0,
    actorId: "user-b",
    actorLabel: "B Team",
    now: baseNow
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, "sku_work_version_conflict");
  assert.equal(second.conflict.current_version, 1);
});

test("claimSkuWorkState returns a staff-safe conflict when another active claim exists", () => {
  const current = claimSkuWorkState({
    current: createEmptySkuWorkState({ sku: "FSTR240017" }),
    submittedVersion: 0,
    actorId: "user-a",
    actorLabel: "A Team",
    now: baseNow
  }).state;

  const conflict = claimSkuWorkState({
    current,
    submittedVersion: 1,
    actorId: "user-b",
    actorLabel: "B Team",
    now: baseNow
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "sku_work_claim_conflict");
  assert.deepEqual(conflict.conflict, buildSkuWorkStateConflict(current, { viewerId: "user-b", now: baseNow }));
  assert.equal(conflict.conflict.locked_by_me, false);
  assert.equal(conflict.conflict.locked_by_label, "A Team");
  assert.equal(conflict.conflict.locked_by, undefined);
});

test("releaseSkuWorkState clears owner claim and increments version", () => {
  const claimed = claimSkuWorkState({
    current: createEmptySkuWorkState({ sku: "FSTR240017" }),
    submittedVersion: 0,
    actorId: "user-a",
    actorLabel: "A Team",
    now: baseNow
  }).state;

  const released = releaseSkuWorkState({
    current: claimed,
    actorId: "user-a",
    actorRole: "staff",
    now: new Date(baseNow.getTime() + 60_000)
  });

  assert.equal(released.ok, true);
  assert.equal(released.state.status, "available");
  assert.equal(released.state.version, 2);
  assert.equal(released.state.locked_by, null);
});

test("expired claim can be reclaimed with the current version", () => {
  const claimed = claimSkuWorkState({
    current: createEmptySkuWorkState({ sku: "FSTR240017" }),
    submittedVersion: 0,
    actorId: "user-a",
    actorLabel: "A Team",
    now: baseNow,
    ttlMs: 60_000
  }).state;

  const reclaimed = claimSkuWorkState({
    current: claimed,
    submittedVersion: 1,
    actorId: "user-b",
    actorLabel: "B Team",
    now: new Date(baseNow.getTime() + 120_000),
    ttlMs: 60_000
  });

  assert.equal(reclaimed.ok, true);
  assert.equal(reclaimed.state.version, 2);
  assert.equal(reclaimed.state.locked_by, "user-b");
  assert.equal(reclaimed.state.metadata.previous_locked_by, "user-a");
});
