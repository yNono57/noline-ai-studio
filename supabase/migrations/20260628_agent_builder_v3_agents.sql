-- Extend custom agents without changing legacy columns or existing rows.
alter table public.agents
  add column if not exists description text,
  add column if not exists target_audience text,
  add column if not exists system_prompt text,
  add column if not exists source text not null default 'legacy';

update public.agents
set
  description = coalesce(description, nullif(mission, '')),
  target_audience = coalesce(target_audience, nullif(client_type, '')),
  system_prompt = coalesce(system_prompt, nullif(output, '')),
  source = coalesce(nullif(source, ''), 'legacy')
where
  description is null
  or target_audience is null
  or system_prompt is null
  or source is null
  or source = '';

create index if not exists agents_user_id_source_created_at_idx
  on public.agents(user_id, source, created_at desc);
