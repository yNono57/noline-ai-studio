-- Forge V1.3 metadata-only workspace foundation.
-- This stores immutable source metadata only: never tokens, secrets, repository
-- contents, filesystem data, or provider credentials.

create table if not exists public.forge_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forge_project_id uuid not null references public.forge_projects(id) on delete cascade,
  conversation_id uuid not null references public.forge_conversations(id) on delete cascade,
  repository text not null check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  repository_owner text not null check (length(btrim(repository_owner)) > 0),
  branch text not null check (length(btrim(branch)) > 0),
  base_commit_sha text not null check (base_commit_sha ~ '^[0-9a-f]{40,64}$'),
  status text not null check (status in ('CREATING', 'READY', 'ERROR', 'EXPIRED')),
  provider text not null check (length(btrim(provider)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, conversation_id, repository, branch, base_commit_sha, provider)
);

create index if not exists forge_workspaces_conversation_activity_idx
  on public.forge_workspaces (user_id, conversation_id, updated_at desc);

alter table public.forge_workspaces enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forge_workspaces' and policyname = 'forge_workspaces_own_read') then
    create policy "forge_workspaces_own_read" on public.forge_workspaces for select to authenticated
    using (
      auth.uid() = user_id
      and exists (
        select 1 from public.forge_conversations c
        join public.forge_projects p on p.id = c.forge_project_id
        where c.id = conversation_id and p.id = forge_project_id and p.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'forge_workspaces_set_updated_at' and tgrelid = 'public.forge_workspaces'::regclass) then
    create trigger forge_workspaces_set_updated_at before update on public.forge_workspaces
    for each row execute function public.set_updated_at();
  end if;
end $$;

comment on table public.forge_workspaces is
  'Forge workspace metadata only; no tokens, secrets, repository contents, or execution filesystem.';
