-- Forge V1.5 controlled GitHub publication metadata.

alter table public.forge_run_artifacts
  add column if not exists remote_branch text,
  add column if not exists pull_request_number bigint,
  add column if not exists pull_request_target text,
  add column if not exists published_at timestamptz,
  add column if not exists pull_request_created_at timestamptz;

alter table public.forge_run_artifacts
  drop constraint if exists forge_run_artifacts_remote_branch_check,
  add constraint forge_run_artifacts_remote_branch_check
    check (remote_branch is null or (length(remote_branch) between 7 and 85 and remote_branch like 'forge/%')),
  drop constraint if exists forge_run_artifacts_pull_request_number_check,
  add constraint forge_run_artifacts_pull_request_number_check
    check (pull_request_number is null or pull_request_number > 0),
  drop constraint if exists forge_run_artifacts_pull_request_target_check,
  add constraint forge_run_artifacts_pull_request_target_check
    check (pull_request_target is null or (length(pull_request_target) between 1 and 255 and pull_request_target !~ '[[:cntrl:]]'));

comment on column public.forge_run_artifacts.remote_branch is 'Confirmed GitHub remote branch used by an explicit user push.';
comment on column public.forge_run_artifacts.pull_request_number is 'GitHub Pull Request number created by an explicit user action.';
comment on column public.forge_run_artifacts.pull_request_target is 'Target branch of the GitHub Pull Request.';
comment on column public.forge_run_artifacts.published_at is 'Timestamp of the first confirmed remote push.';
comment on column public.forge_run_artifacts.pull_request_created_at is 'GitHub creation timestamp of the persisted Pull Request.';