-- Align persisted Forge AgentStep numbers with the bounded 60-step runner budget.
-- Safe to rerun; no table or row is removed.

alter table public.forge_agent_steps
  drop constraint if exists forge_agent_steps_step_number_check;

alter table public.forge_agent_steps
  add constraint forge_agent_steps_step_number_check
  check (step_number between 1 and 60);
