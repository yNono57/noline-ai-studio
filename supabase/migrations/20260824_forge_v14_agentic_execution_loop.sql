-- Forge V1.4 agent runs and bounded step summaries.
-- No tokens, provider identifiers, file contents, full command output, or secrets.

create table if not exists public.forge_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forge_project_id uuid not null references public.forge_projects(id) on delete cascade,
  conversation_id uuid not null references public.forge_conversations(id) on delete cascade,
  workspace_id uuid not null references public.forge_workspaces(id) on delete cascade,
  runtime_id uuid not null references public.forge_workspace_runtimes(id) on delete cascade,
  status text not null check (status in ('QUEUED','PLANNING','RUNNING','VALIDATING','COMPLETED','FAILED','CANCELLED')),
  objective text not null check (length(objective) between 1 and 4000),
  base_commit_sha text not null check (base_commit_sha ~ '^[0-9a-f]{40,64}$'),
  plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array'),
  final_report text check (final_report is null or length(final_report) <= 20000),
  error text check (error is null or length(error) <= 1000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz
);
create unique index if not exists forge_agent_runs_one_active_runtime_idx on public.forge_agent_runs(runtime_id) where status in ('QUEUED','PLANNING','RUNNING','VALIDATING');
create index if not exists forge_agent_runs_owner_conversation_idx on public.forge_agent_runs(user_id, conversation_id, created_at desc);

create table if not exists public.forge_agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.forge_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 20),
  type text not null check (type in ('PLAN','TOOL_CALL','FINAL','FAIL')),
  summary text not null check (length(summary) <= 1000),
  tool text check (tool is null or tool in ('list_files','read_file','write_file','delete_file','run_command','git_status','git_diff')),
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object'),
  result_summary text check (result_summary is null or length(result_summary) <= 20000),
  status text not null check (status in ('RUNNING','COMPLETED','FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(run_id, step_number)
);
create index if not exists forge_agent_steps_run_idx on public.forge_agent_steps(run_id, step_number);

alter table public.forge_agent_runs enable row level security;
alter table public.forge_agent_steps enable row level security;
drop policy if exists "forge_agent_runs_own_read"
  on public.forge_agent_runs;

create policy "forge_agent_runs_own_read"
  on public.forge_agent_runs
  for select
  to authenticated
  using (
    auth.uid() = forge_agent_runs.user_id
    and exists (
      select 1
      from public.forge_conversations c
      join public.forge_projects p
        on p.id = c.forge_project_id
      join public.forge_workspaces w
        on w.conversation_id = c.id
       and w.forge_project_id = p.id
      join public.forge_workspace_runtimes rt
        on rt.workspace_id = w.id
      where c.id = forge_agent_runs.conversation_id
        and p.id = forge_agent_runs.forge_project_id
        and w.id = forge_agent_runs.workspace_id
        and rt.id = forge_agent_runs.runtime_id
        and w.user_id = auth.uid()
        and rt.user_id = auth.uid()
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "forge_agent_steps_own_read"
  on public.forge_agent_steps;

create policy "forge_agent_steps_own_read"
  on public.forge_agent_steps
  for select
  to authenticated
  using (
    auth.uid() = forge_agent_steps.user_id
    and exists (
      select 1
      from public.forge_agent_runs r
      where r.id = forge_agent_steps.run_id
        and r.user_id = auth.uid()
    )
  );
comment on table public.forge_agent_runs is 'Bounded Forge agent run metadata; no provider secrets or tool payloads.';
comment on table public.forge_agent_steps is 'Sanitized bounded Forge agent step summaries; no file contents or full outputs.';
