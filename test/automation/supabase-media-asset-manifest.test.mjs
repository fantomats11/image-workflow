import test from "node:test";
import assert from "node:assert/strict";
import { readSupabaseMediaRowsForSkus } from "../../lib/automation/supabase-media-asset-manifest.mjs";

test("readSupabaseMediaRowsForSkus joins assets to generations by image_asset_id", async () => {
  const supabaseAdmin = createFakeSupabaseAdmin({
    jobs: [{
      id: "job-1",
      sku: "RAC-001",
      product_name: "Snow Boot",
      status: "hero_ready",
      form_json: { sku: "RAC-001", jobKind: "hero" },
      created_at: "2026-06-13T00:00:00Z"
    }],
    generations: [{
      id: "gen-1",
      job_id: "job-1",
      kind: "hero",
      status: "done",
      image_asset_id: "asset-1",
      created_at: "2026-06-13T00:01:00Z"
    }],
    assets: [{
      id: "asset-1",
      job_id: "job-1",
      type: "hero_generated",
      bucket: "remote_url",
      storage_key: "https://cdn.example.com/hero.png",
      public_url: "https://cdn.example.com/hero.png",
      created_at: "2026-06-13T00:02:00Z"
    }]
  });

  const rows = await readSupabaseMediaRowsForSkus({ supabaseAdmin, skus: ["RAC-001"] });

  assert.equal(rows.assets.length, 1);
  assert.equal(rows.assets[0].generation_id, "gen-1");
});

function createFakeSupabaseAdmin(seed = {}) {
  const tables = {
    jobs: [...(seed.jobs || [])],
    generations: [...(seed.generations || [])],
    assets: [...(seed.assets || [])],
    approvals: [...(seed.approvals || [])]
  };
  return {
    from(table) {
      return new FakeQuery({ table, tables });
    }
  };
}

class FakeQuery {
  constructor({ table, tables }) {
    this.table = table;
    this.tables = tables;
    this.filters = [];
    this.inFilters = [];
    this.limitCount = null;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  in(field, values) {
    this.inFilters.push({ field, values });
    return this;
  }

  order() {
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    const rows = (this.tables[this.table] || []).filter((row) =>
      this.filters.every((filter) => row[filter.field] === filter.value) &&
      this.inFilters.every((filter) => filter.values.includes(row[filter.field]))
    );
    return {
      data: this.limitCount ? rows.slice(0, this.limitCount) : rows,
      error: null
    };
  }
}
