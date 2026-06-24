create table if not exists public.sku_work_states (
  sku text primary key,
  status text not null default 'available',
  version integer not null default 0,
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_work_states_status_check check (status in ('available', 'claimed', 'completed', 'released'))
);

create index if not exists sku_work_states_status_expires_idx
  on public.sku_work_states(status, expires_at);

create index if not exists sku_work_states_locked_by_idx
  on public.sku_work_states(locked_by)
  where locked_by is not null;

alter table public.sku_work_states enable row level security;

revoke all on public.sku_work_states from anon, authenticated;
grant select, insert, update, delete on public.sku_work_states to service_role;

drop trigger if exists touch_sku_work_states_updated_at on public.sku_work_states;
create trigger touch_sku_work_states_updated_at
before update on public.sku_work_states
for each row execute function public.touch_automation_updated_at();
