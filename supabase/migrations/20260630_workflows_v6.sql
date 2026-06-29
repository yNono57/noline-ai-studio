create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  client_id text,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'running', 'completed', 'failed')),
  steps jsonb not null default '[]'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workflows
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists agent_id text,
  add column if not exists client_id text,
  add column if not exists title text,
  add column if not exists status text not null default 'draft',
  add column if not exists steps jsonb not null default '[]'::jsonb,
  add column if not exists result jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists workflows_user_updated_at_idx
  on public.workflows(user_id, updated_at desc);
create index if not exists workflows_user_agent_idx
  on public.workflows(user_id, agent_id);
create index if not exists workflows_user_client_idx
  on public.workflows(user_id, client_id)
  where client_id is not null;

alter table public.workflows enable row level security;

drop policy if exists "workflows own rows" on public.workflows;
create policy "workflows own rows" on public.workflows
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workflows to authenticated;
