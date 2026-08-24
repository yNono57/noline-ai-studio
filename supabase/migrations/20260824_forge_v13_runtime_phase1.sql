-- Forge V1.3 Runtime Phase 1: provider-neutral runtime metadata only.
-- Never store GitHub tokens, provider secrets, command output, or file contents.

create table if not exists public.forge_workspace_runtimes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.forge_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (length(btrim(provider)) > 0),
  provider_runtime_id text,
  status text not null check (status in ('UNPROVISIONED', 'CREATING', 'READY', 'ERROR', 'EXPIRED', 'DESTROYING', 'DESTROYED')),
  base_commit_sha text not null check (base_commit_sha ~ '^[0-9a-f]{40,64}$'),
  ready_at timestamptz,
  expires_at timestamptz,
  last_activity_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists forge_workspace_runtimes_owner_activity_idx on public.forge_workspace_runtimes (user_id, updated_at desc);
alter table public.forge_workspace_runtimes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forge_workspace_runtimes' and policyname = 'forge_workspace_runtimes_own_read') then
    create policy "forge_workspace_runtimes_own_read" on public.forge_workspace_runtimes for select to authenticated
    using (
      auth.uid() = user_id
      and exists (
        select 1 from public.forge_workspaces w
        join public.forge_conversations c on c.id = w.conversation_id
        join public.forge_projects p on p.id = c.forge_project_id
        where w.id = workspace_id and w.user_id = auth.uid() and p.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'forge_workspace_runtimes_set_updated_at' and tgrelid = 'public.forge_workspace_runtimes'::regclass) then
    create trigger forge_workspace_runtimes_set_updated_at before update on public.forge_workspace_runtimes
    for each row execute function public.set_updated_at();
  end if;
end $$;

comment on table public.forge_workspace_runtimes is 'Forge runtime lifecycle metadata only; never store tokens, secrets, file contents, or command output.';
