create table if not exists public.crm_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  company text not null,
  website text not null default '',
  facebook text not null default '',
  linkedin text not null default '',
  sector text not null default '',
  estimated_revenue numeric,
  estimated_budget numeric,
  source text not null default '',
  tags jsonb not null default '[]'::jsonb,
  need text not null default '',
  status text not null default 'Nouveau'
    check (status in ('Nouveau','Contacté','Diagnostic','Proposition','Négociation','Gagné','Perdu')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid not null references public.crm_prospects(id) on delete cascade,
  title text not null,
  type text not null,
  due_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid not null references public.crm_prospects(id) on delete cascade,
  type text not null,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists crm_prospects_user_status_idx on public.crm_prospects(user_id, status);
create index if not exists crm_tasks_user_due_idx on public.crm_tasks(user_id, due_at);
create index if not exists crm_timeline_prospect_created_idx on public.crm_timeline(prospect_id, created_at desc);

alter table public.crm_prospects enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_timeline enable row level security;

drop policy if exists "crm prospects own rows" on public.crm_prospects;
drop policy if exists "crm tasks own rows" on public.crm_tasks;
drop policy if exists "crm timeline own rows" on public.crm_timeline;

create policy "crm prospects own rows" on public.crm_prospects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "crm tasks own rows" on public.crm_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "crm timeline own rows" on public.crm_timeline for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.crm_prospects, public.crm_tasks, public.crm_timeline to authenticated;
