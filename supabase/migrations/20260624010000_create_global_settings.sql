create table if not exists public.global_settings (
  key text primary key,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.global_settings enable row level security;

revoke all on public.global_settings from anon, authenticated;
grant select, insert, update, delete on public.global_settings to service_role;

drop trigger if exists touch_global_settings_updated_at on public.global_settings;
create trigger touch_global_settings_updated_at
before update on public.global_settings
for each row execute function public.touch_automation_updated_at();
