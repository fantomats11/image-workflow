import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLiveGenerationPersistencePlan,
  persistLiveGenerationExecution
} from "../../lib/automation/live-generation-persistence.mjs";

function generationPlan() {
  return {
    batch_id: "batch-1",
    items: [{
      sku: "RAC-001",
      product_name: "Columbia Snow Boot",
      brand_id: "rent_a_coat",
      target_site: "rentacoat",
      category: "รองเท้า",
      prompt_framework_version: "prompt-framework-v3.7-brand-mark-fidelity",
      generation_requests: [{
        request_id: "RAC-001:hero",
        sku: "RAC-001",
        kind: "hero",
        slot: "hero",
        model: "openai/gpt-image-2/edit",
        prompt: "Create hero image",
        prompt_framework_version: "prompt-framework-v3.7-brand-mark-fidelity"
      }]
    }]
  };
}

function execution() {
  return {
    batch_id: "batch-1",
    execution_status: "completed",
    results: [{
      request_id: "RAC-001:hero",
      sku: "RAC-001",
      kind: "hero",
      slot: "hero",
      execution_status: "done",
      provider_request_id: "provider-hero-1",
      generated_assets: [{
        sku: "RAC-001",
        kind: "hero",
        slot: "hero",
        type: "hero_generated",
        source_url: "https://cdn.example.com/hero.png",
        file_name: "hero.png",
        mime_type: "image/png",
        file_size: 12345,
        image_index: 1
      }]
    }]
  };
}

test("buildLiveGenerationPersistencePlan maps execution assets to product context", () => {
  const plan = buildLiveGenerationPersistencePlan({
    execution: execution(),
    generationPlan: generationPlan(),
    dryRun: true,
    now: new Date("2026-06-13T00:00:00.000Z")
  });

  assert.equal(plan.manifest_type, "live_generation_persistence");
  assert.equal(plan.dry_run, true);
  assert.equal(plan.summary.generated_assets_seen, 1);
  assert.equal(plan.summary.ready_to_persist, 1);
  assert.equal(plan.items[0].persistence_status, "ready_dry_run");
  assert.equal(plan.items[0].product_name, "Columbia Snow Boot");
  assert.equal(plan.items[0].brand_id, "rent_a_coat");
  assert.equal(plan.items[0].prompt, "Create hero image");
});

test("buildLiveGenerationPersistencePlan blocks assets without source url", () => {
  const sourceExecution = execution();
  sourceExecution.results[0].generated_assets[0].source_url = "";
  const plan = buildLiveGenerationPersistencePlan({
    execution: sourceExecution,
    generationPlan: generationPlan(),
    dryRun: true
  });

  assert.equal(plan.summary.blocked, 1);
  assert.deepEqual(plan.items[0].blockers, ["missing_source_url"]);
});

test("buildLiveGenerationPersistencePlan uses batch metadata when request is absent from latest plan", () => {
  const plan = buildLiveGenerationPersistencePlan({
    execution: execution(),
    generationPlan: { batch_id: "batch-1", items: [] },
    batch: {
      items: [{
        sku: "RAC-001",
        product_name: "Batch Product Name",
        brand_id: "rent_a_coat",
        target_site: "rentacoat",
        category: "รองเท้า",
        hero_prompt: "Batch hero prompt"
      }]
    },
    dryRun: true
  });

  assert.equal(plan.items[0].product_name, "Batch Product Name");
  assert.equal(plan.items[0].brand_id, "rent_a_coat");
  assert.equal(plan.items[0].target_site, "rentacoat");
  assert.equal(plan.items[0].prompt, "Batch hero prompt");
});

test("buildLiveGenerationPersistencePlan falls back blank product names to SKU", () => {
  const plan = buildLiveGenerationPersistencePlan({
    execution: execution(),
    generationPlan: { batch_id: "batch-1", items: [] },
    batch: {
      items: [{
        sku: "RAC-001",
        product_name: "",
        brand_id: "rent_a_coat",
        target_site: "rentacoat",
        category: "รองเท้า",
        hero_prompt: "Batch hero prompt"
      }]
    },
    dryRun: true
  });

  assert.equal(plan.items[0].product_name, "RAC-001");
  assert.equal(plan.items[0].brand_id, "rent_a_coat");
});

test("persistLiveGenerationExecution writes job generation asset and audit rows", async () => {
  const supabaseAdmin = createFakeSupabaseAdmin();
  const result = await persistLiveGenerationExecution({
    supabaseAdmin,
    execution: execution(),
    generationPlan: generationPlan(),
    actorId: "actor-1",
    dryRun: false,
    now: new Date("2026-06-13T00:00:00.000Z")
  });

  assert.equal(result.persistence_status, "completed");
  assert.equal(result.summary.persisted, 1);
  assert.equal(result.items[0].job_id, "job-1");
  assert.equal(result.items[0].generation_id, "generation-1");
  assert.equal(result.items[0].asset_id, "asset-1");
  assert.equal(supabaseAdmin.tables.jobs.length, 1);
  assert.equal(supabaseAdmin.tables.generations.length, 1);
  assert.equal(supabaseAdmin.tables.assets.length, 1);
  assert.equal(supabaseAdmin.tables.audit_events[0].event_type, "live_generation_asset_persisted");
  assert.equal(supabaseAdmin.tables.assets[0].generation_id, undefined);
  assert.equal(supabaseAdmin.tables.generations[0].image_asset_id, "asset-1");
  assert.equal(supabaseAdmin.tables.audit_events[0].event_json.assetId, "asset-1");
});

test("persistLiveGenerationExecution reuses existing generation and asset by provider request", async () => {
  const supabaseAdmin = createFakeSupabaseAdmin({
    jobs: [{ id: "job-existing", sku: "RAC-001", created_at: "2026-06-12T00:00:00.000Z" }],
    generations: [{
      id: "generation-existing",
      job_id: "job-existing",
      kind: "hero",
      request_id: "provider-hero-1",
      status: "done",
      image_asset_id: "asset-existing",
      created_at: "2026-06-12T00:00:00.000Z"
    }],
    assets: [{
      id: "asset-existing",
      job_id: "job-existing",
      type: "hero_generated",
      storage_key: "https://cdn.example.com/hero.png",
      public_url: "https://cdn.example.com/hero.png",
      created_at: "2026-06-12T00:00:00.000Z"
    }]
  });

  const result = await persistLiveGenerationExecution({
    supabaseAdmin,
    execution: execution(),
    generationPlan: generationPlan(),
    actorId: "actor-1",
    dryRun: false
  });

  assert.equal(result.summary.persisted, 1);
  assert.equal(result.items[0].job_id, "job-existing");
  assert.equal(result.items[0].generation_id, "generation-existing");
  assert.equal(result.items[0].asset_id, "asset-existing");
  assert.equal(supabaseAdmin.tables.jobs.length, 1);
  assert.equal(supabaseAdmin.tables.generations.length, 1);
  assert.equal(supabaseAdmin.tables.assets.length, 1);
});

function createFakeSupabaseAdmin(seed = {}) {
  const tables = {
    jobs: [...(seed.jobs || [])],
    generations: [...(seed.generations || [])],
    assets: [...(seed.assets || [])],
    audit_events: [...(seed.audit_events || [])]
  };
  const counters = {
    jobs: tables.jobs.length,
    generations: tables.generations.length,
    assets: tables.assets.length,
    audit_events: tables.audit_events.length
  };
  return {
    tables,
    from(table) {
      return new FakeQuery({ table, tables, counters });
    }
  };
}

class FakeQuery {
  constructor({ table, tables, counters }) {
    this.table = table;
    this.tables = tables;
    this.counters = counters;
    this.filters = [];
    this.insertPayload = null;
    this.updatePayload = null;
    this.limitCount = null;
    this.singleMode = false;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  order() {
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  insert(payload) {
    this.insertPayload = payload;
    return this;
  }

  update(payload) {
    this.updatePayload = payload;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    const rows = this.applyFilters();
    return Promise.resolve({ data: rows[0] || null, error: null });
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    if (this.insertPayload) {
      const row = {
        id: this.insertPayload.id || nextId(this.table, this.counters),
        ...this.insertPayload
      };
      this.tables[this.table].push(row);
      return { data: this.singleMode ? row : [row], error: null };
    }
    if (this.updatePayload) {
      const rows = this.applyFilters();
      rows.forEach((row) => Object.assign(row, this.updatePayload));
      return { data: rows, error: null };
    }
    const rows = this.applyFilters();
    const limited = this.limitCount ? rows.slice(0, this.limitCount) : rows;
    return { data: this.singleMode ? limited[0] || null : limited, error: null };
  }

  applyFilters() {
    return (this.tables[this.table] || []).filter((row) =>
      this.filters.every((filter) => row[filter.field] === filter.value)
    );
  }
}

function nextId(table, counters) {
  counters[table] = (counters[table] || 0) + 1;
  const singular = table.replace(/s$/, "");
  return `${singular}-${counters[table]}`;
}
