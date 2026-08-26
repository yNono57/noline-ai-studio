-- Forge V1.5 persistent continuity and user-controlled Git publication states.

alter table public.forge_run_artifacts
  add column if not exists restore_status text not null default 'AVAILABLE',
  add column if not exists publication_status text not null default 'LOCAL',
  add column if not exists restored_at timestamptz,
  add column if not exists restored_runtime_id uuid references public.forge_workspace_runtimes(id) on delete set null,
  add column if not exists branch_name text,
  add column if not exists commit_sha text,
  add column if not exists pull_request_url text,
  add column if not exists conflict_files jsonb not null default '[]'::jsonb;

alter table public.forge_run_artifacts
  drop constraint if exists forge_run_artifacts_restore_status_check,
  add constraint forge_run_artifacts_restore_status_check
    check (restore_status in ('AVAILABLE','RESTORING','RESTORED','CONFLICT','FAILED')),
  drop constraint if exists forge_run_artifacts_publication_status_check,
  add constraint forge_run_artifacts_publication_status_check
    check (publication_status in ('LOCAL','BRANCHED','COMMITTED','PUSHED','PR_CREATED')),
  drop constraint if exists forge_run_artifacts_branch_name_check,
  add constraint forge_run_artifacts_branch_name_check
    check (branch_name is null or (length(branch_name) between 7 and 85 and branch_name like 'forge/%')),
  drop constraint if exists forge_run_artifacts_commit_sha_check,
  add constraint forge_run_artifacts_commit_sha_check
    check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40,64}$'),
  drop constraint if exists forge_run_artifacts_conflict_files_check,
  add constraint forge_run_artifacts_conflict_files_check
    check (jsonb_typeof(conflict_files) = 'array');

create index if not exists forge_run_artifacts_restore_status_idx
  on public.forge_run_artifacts(user_id, restore_status, created_at desc);

comment on column public.forge_run_artifacts.restore_status is
  'Persistent cross-runtime restore state: AVAILABLE, RESTORING, RESTORED, CONFLICT, or FAILED.';
comment on column public.forge_run_artifacts.publication_status is
  'User-controlled Git publication state: LOCAL, BRANCHED, COMMITTED, PUSHED, or PR_CREATED.';
