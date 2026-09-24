-- Keep the persisted Forge tool contract aligned with the bounded runtime.
-- Forward-only and data preserving: existing values remain valid.

alter table public.forge_agent_steps
  drop constraint if exists forge_agent_steps_tool_check;

alter table public.forge_agent_steps
  add constraint forge_agent_steps_tool_check
  check (
    tool is null
    or tool in (
      'list_files',
      'search_code',
      'read_file',
      'write_file',
      'delete_file',
      'run_command',
      'git_status',
      'git_diff'
    )
  );
