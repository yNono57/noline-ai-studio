-- Durable completion artifacts for Forge AgentRuns.
-- The patch is captured from the runtime's real git diff before the run becomes COMPLETED.

create table if not exists public.forge_run_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.forge_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repository text not null check (length(repository) between 1 and 500),
  base_sha text not null check (base_sha ~ '^[0-9a-f]{40,64}$'),
  source_branch text not null check (length(source_branch) between 1 and 255),
  changed_files jsonb not null default '[]'::jsonb check (jsonb_typeof(changed_files) = 'array'),
  additions integer not null default 0 check (additions >= 0),
  deletions integer not null default 0 check (deletions >= 0),
  patch text not null check (length(patch) <= 200000),
  status text not null check (status in ('READY','EMPTY')),
  created_at timestamptz not null default now()
);

create index if not exists forge_run_artifacts_owner_run_idx
  on public.forge_run_artifacts(user_id, run_id);

alter table public.forge_run_artifacts enable row level security;

drop policy if exists "forge_run_artifacts_own_read"
  on public.forge_run_artifacts;

create policy "forge_run_artifacts_own_read"
  on public.forge_run_artifacts
  for select
  to authenticated
  using (
    auth.uid() = forge_run_artifacts.user_id
    and exists (
      select 1
      from public.forge_agent_runs r
      where r.id = forge_run_artifacts.run_id
        and r.user_id = auth.uid()
    )
  );

comment on table public.forge_run_artifacts is
  'Durable, bounded Git patches captured from real Forge runtime diffs before COMPLETED; no model-reconstructed content.';
