import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApprovedHeroAnchor,
  mergeApprovedHeroAnchorMetadata
} from "../../lib/automation/hero-approval-anchor.mjs";

test("buildApprovedHeroAnchor marks local approved hero as staged model input anchor", () => {
  const anchor = buildApprovedHeroAnchor({
    generation: {
      id: "generation-1",
      job_id: "job-1",
      image_asset_id: "asset-hero-1"
    },
    asset: {
      id: "asset-hero-1",
      type: "hero_generated",
      kind: "hero",
      bucket: "local",
      storage_key: "/tmp/R23CBT0048/hero.png",
      public_url: "https://cdn.example.com/hero.png",
      file_name: "hero.png",
      file_size: 123
    },
    approval: {
      id: "approval-1",
      approved_by: "actor-1",
      approved_at: "2026-06-18T03:00:00.000Z"
    },
    sku: "R23CBT0048",
    source: "line"
  });

  assert.equal(anchor.source_role, "approved_hero_anchor");
  assert.equal(anchor.asset_id, "asset-hero-1");
  assert.equal(anchor.generation_id, "generation-1");
  assert.equal(anchor.status, "approved");
  assert.equal(anchor.local_path, "/tmp/R23CBT0048/hero.png");
  assert.equal(anchor.staging_status, "staged_local_file");
});

test("buildApprovedHeroAnchor keeps remote-only approved hero blocked until local staging exists", () => {
  const anchor = buildApprovedHeroAnchor({
    generation: {
      id: "generation-remote",
      job_id: "job-remote",
      image_asset_id: "asset-remote"
    },
    asset: {
      id: "asset-remote",
      type: "hero_generated",
      public_url: "https://cdn.example.com/remote-hero.png"
    },
    approval: { id: "approval-remote" },
    sku: "R24CBF0013"
  });

  assert.equal(anchor.local_path, "");
  assert.equal(anchor.staging_status, "remote_only");
});

test("mergeApprovedHeroAnchorMetadata is idempotent for duplicate hero approvals", () => {
  const anchor = buildApprovedHeroAnchor({
    generation: { id: "generation-1", job_id: "job-1", image_asset_id: "asset-hero-1" },
    asset: {
      id: "asset-hero-1",
      type: "hero_generated",
      bucket: "local",
      storage_key: "/tmp/R23CBT0048/hero.png"
    },
    approval: { id: "approval-1" },
    sku: "R23CBT0048"
  });
  const once = mergeApprovedHeroAnchorMetadata({}, anchor, {
    actionSource: "line",
    actorId: "actor-1",
    generationId: "generation-1",
    recordedAt: "2026-06-18T03:00:00.000Z"
  });
  const twice = mergeApprovedHeroAnchorMetadata(once, anchor, {
    actionSource: "line",
    actorId: "actor-1",
    generationId: "generation-1",
    recordedAt: "2026-06-18T03:00:00.000Z"
  });

  assert.deepEqual(twice.approved_hero_anchor, once.approved_hero_anchor);
  assert.equal(Array.isArray(twice.approved_hero_anchor), false);
  assert.equal(twice.line_action.last_action, "approve_hero");
  assert.equal(twice.hero_review_hero_asset.asset_id, "asset-hero-1");
});
