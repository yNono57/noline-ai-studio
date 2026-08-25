-- Align Forge AgentRun persistence with the centralized 50,000-character mission safety limit.
-- Additive constraint update only; no data rewrite or destructive table operation.

alter table public.forge_agent_runs
  drop constraint if exists forge_agent_runs_objective_check;

alter table public.forge_agent_runs
  add constraint forge_agent_runs_objective_check
  check (length(objective) between 1 and 50000);