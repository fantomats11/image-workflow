-- Applied to project gdplvbcievvuajwhlnsl via Supabase connector on 2026-06-11.

create table if not exists public.automation_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  source text not null default 'line',
  status text not null default 'draft',
  dry_run boolean not null default true,
  requested_by_line_user_id text,
  requested_size integer,
  item_count integer not null default 0,
  command_text text,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.automation_batches(id) on delete cascade,
  sku text not null,
  product_type text,
  target_site text,
  product_name text,
  status text not null default 'draft',
  woo_status text,
  prompt_framework_version text,
  prompt_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, sku)
);

create table if not exists public.automation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  status text not null default 'queued',
  priority integer not null default 100,
  batch_id uuid references public.automation_batches(id) on delete set null,
  batch_item_id uuid references public.automation_batch_items(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_batches_status_created_at_idx on public.automation_batches(status, created_at desc);
create index if not exists automation_batch_items_batch_status_idx on public.automation_batch_items(batch_id, status);
create index if not exists automation_batch_items_sku_idx on public.automation_batch_items(sku);
create index if not exists automation_tasks_claim_idx on public.automation_tasks(status, available_at, priority, created_at);
create index if not exists automation_tasks_batch_idx on public.automation_tasks(batch_id);
create index if not exists automation_tasks_batch_item_idx on public.automation_tasks(batch_item_id);
create index if not exists automation_tasks_job_idx on public.automation_tasks(job_id);
create index if not exists automation_tasks_generation_idx on public.automation_tasks(generation_id);

alter table public.automation_batches enable row level security;
alter table public.automation_batch_items enable row level security;
alter table public.automation_tasks enable row level security;

create or replace function public.touch_automation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_automation_batches_updated_at on public.automation_batches;
create trigger touch_automation_batches_updated_at
before update on public.automation_batches
for each row execute function public.touch_automation_updated_at();

drop trigger if exists touch_automation_batch_items_updated_at on public.automation_batch_items;
create trigger touch_automation_batch_items_updated_at
before update on public.automation_batch_items
for each row execute function public.touch_automation_updated_at();

drop trigger if exists touch_automation_tasks_updated_at on public.automation_tasks;
create trigger touch_automation_tasks_updated_at
before update on public.automation_tasks
for each row execute function public.touch_automation_updated_at();
