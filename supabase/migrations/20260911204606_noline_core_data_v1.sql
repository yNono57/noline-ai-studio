-- Core Data V1. Transactional; no backfill, deletion or ownership inference.
-- Supports empty schemas and the exact proposed schema with existing rows.
-- Incompatible layouts/data abort the whole migration for explicit remediation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mode text not null check (mode in ('CHAT', 'CODE')),
  agent text not null check (length(btrim(agent)) > 0),
title text not null check (length(btrim(title)) > 0),
model_key text not null check (length(btrim(model_key)) > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);


lock table public.projects, public.conversations, public.messages in access exclusive mode;

-- Validate before changing access or constraints. IF NOT EXISTS is not validation.
do $$
declare r record; actual record;
begin
  for r in select * from (values
    ('projects', 'id', 'uuid', true),
    ('projects', 'user_id', 'uuid', true),
    ('projects', 'name', 'text', true),
    ('projects', 'description', 'text', false),
    ('projects', 'status', 'text', true),
    ('projects', 'created_at', 'timestamp with time zone', true),
    ('projects', 'updated_at', 'timestamp with time zone', true),
    ('conversations', 'id', 'uuid', true),
    ('conversations', 'project_id', 'uuid', true),
    ('conversations', 'mode', 'text', true),
    ('conversations', 'agent', 'text', true),
    ('conversations', 'title', 'text', true),
    ('conversations', 'model_key', 'text', true),
    ('conversations', 'status', 'text', true),
    ('conversations', 'created_at', 'timestamp with time zone', true),
    ('conversations', 'updated_at', 'timestamp with time zone', true),
    ('messages', 'id', 'uuid', true),
    ('messages', 'conversation_id', 'uuid', true),
    ('messages', 'role', 'text', true),
    ('messages', 'content', 'text', true),
    ('messages', 'metadata', 'jsonb', false),
    ('messages', 'created_at', 'timestamp with time zone', true)
  ) as expected(table_name, column_name, type_name, required)
  loop
    select format_type(a.atttypid, a.atttypmod) as type_name, a.attnotnull as required into actual
    from pg_attribute a where a.attrelid = format('public.%I', r.table_name)::regclass
      and a.attname = r.column_name and a.attnum > 0 and not a.attisdropped;
    if not found or actual.type_name <> r.type_name or actual.required <> r.required then
      raise exception 'Core schema mismatch: %.% (expected %, not null=%)', r.table_name, r.column_name, r.type_name, r.required;
    end if;
  end loop;
  for r in select unnest(array['projects','conversations','messages']) as table_name loop
    if not exists (select 1 from pg_constraint c join pg_attribute a
      on a.attrelid = c.conrelid and a.attname = 'id'
      where c.conrelid = format('public.%I', r.table_name)::regclass
      and c.contype = 'p' and c.conkey = array[a.attnum]) then
      raise exception 'Core schema mismatch: %.id must be the primary key', r.table_name;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.table_name
      and policyname not in (r.table_name || '_select_own', r.table_name || '_insert_own', r.table_name || '_update_own', r.table_name || '_delete_own')) then
      raise exception 'Unexpected Core RLS policy on %; review it before migrating', r.table_name;
    end if;
  end loop;
end;
$$;

-- Namespaced trigger: do not replace the function used by Forge.
create or replace function public.core_set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.core_set_updated_at() from public, anon, authenticated;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.core_set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.core_set_updated_at();

alter table public.projects drop constraint if exists core_projects_name_check;
alter table public.projects add constraint core_projects_name_check check (length(btrim(name)) > 0) not valid;
alter table public.projects validate constraint core_projects_name_check;

alter table public.projects drop constraint if exists core_projects_status_check;
alter table public.projects add constraint core_projects_status_check check (status in ('active', 'archived')) not valid;
alter table public.projects validate constraint core_projects_status_check;

alter table public.conversations drop constraint if exists core_conversations_mode_check;
alter table public.conversations add constraint core_conversations_mode_check check (mode in ('CHAT', 'CODE')) not valid;
alter table public.conversations validate constraint core_conversations_mode_check;

alter table public.conversations drop constraint if exists core_conversations_agent_check;
alter table public.conversations add constraint core_conversations_agent_check check (length(btrim(agent)) > 0) not valid;
alter table public.conversations validate constraint core_conversations_agent_check;

alter table public.conversations drop constraint if exists core_conversations_title_check;
alter table public.conversations add constraint core_conversations_title_check check (length(btrim(title)) > 0) not valid;
alter table public.conversations validate constraint core_conversations_title_check;

alter table public.conversations drop constraint if exists core_conversations_model_key_check;
alter table public.conversations add constraint core_conversations_model_key_check check (length(btrim(model_key)) > 0) not valid;
alter table public.conversations validate constraint core_conversations_model_key_check;

alter table public.conversations drop constraint if exists core_conversations_status_check;
alter table public.conversations add constraint core_conversations_status_check check (status in ('active', 'archived')) not valid;
alter table public.conversations validate constraint core_conversations_status_check;

alter table public.messages drop constraint if exists core_messages_role_check;
alter table public.messages add constraint core_messages_role_check check (role in ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')) not valid;
alter table public.messages validate constraint core_messages_role_check;

-- Refuse conflicting foreign keys rather than changing their deletion behavior.
do $$ begin
  if exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='user_id'
    where c.conrelid='public.projects'::regclass and c.contype='f' and a.attnum=any(c.conkey)
    and (c.confrelid <> 'auth.users'::regclass or c.confdeltype <> 'c'
      or c.conkey <> array[a.attnum] or c.confkey <> array[(select attnum from pg_attribute where attrelid='auth.users'::regclass and attname='id')])) then
    raise exception 'Incompatible foreign key: projects.user_id';
  end if;
end $$;
alter table public.projects drop constraint if exists core_projects_user_id_fkey;
alter table public.projects add constraint core_projects_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.projects validate constraint core_projects_user_id_fkey;

-- Refuse conflicting foreign keys rather than changing their deletion behavior.
do $$ begin
  if exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='project_id'
    where c.conrelid='public.conversations'::regclass and c.contype='f' and a.attnum=any(c.conkey)
    and (c.confrelid <> 'public.projects'::regclass or c.confdeltype <> 'c'
      or c.conkey <> array[a.attnum] or c.confkey <> array[(select attnum from pg_attribute where attrelid='public.projects'::regclass and attname='id')])) then
    raise exception 'Incompatible foreign key: conversations.project_id';
  end if;
end $$;
alter table public.conversations drop constraint if exists core_conversations_project_id_fkey;
alter table public.conversations add constraint core_conversations_project_id_fkey foreign key (project_id) references public.projects(id) on delete cascade not valid;
alter table public.conversations validate constraint core_conversations_project_id_fkey;

-- Refuse conflicting foreign keys rather than changing their deletion behavior.
do $$ begin
  if exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='conversation_id'
    where c.conrelid='public.messages'::regclass and c.contype='f' and a.attnum=any(c.conkey)
    and (c.confrelid <> 'public.conversations'::regclass or c.confdeltype <> 'c'
      or c.conkey <> array[a.attnum] or c.confkey <> array[(select attnum from pg_attribute where attrelid='public.conversations'::regclass and attname='id')])) then
    raise exception 'Incompatible foreign key: messages.conversation_id';
  end if;
end $$;
alter table public.messages drop constraint if exists core_messages_conversation_id_fkey;
alter table public.messages add constraint core_messages_conversation_id_fkey foreign key (conversation_id) references public.conversations(id) on delete cascade not valid;
alter table public.messages validate constraint core_messages_conversation_id_fkey;

alter table public.projects alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.projects alter column status set default 'active', alter column updated_at set default now();

alter table public.conversations alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.conversations alter column status set default 'active', alter column updated_at set default now();

alter table public.messages alter column id set default gen_random_uuid(), alter column created_at set default now();
create index if not exists projects_user_activity_idx
  on public.projects (user_id, updated_at desc);
create index if not exists conversations_project_activity_idx
  on public.conversations (project_id, updated_at desc);
create index if not exists messages_conversation_chronology_idx
  on public.messages (conversation_id, created_at, id);

alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own" on public.conversations
for select to authenticated using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = (select auth.uid())
));
drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations
for insert to authenticated with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = (select auth.uid())
));
drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own" on public.conversations
for update to authenticated using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = (select auth.uid())
));
drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations
for delete to authenticated using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = (select auth.uid())
));

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
for select to authenticated using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = (select auth.uid())
));
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
for insert to authenticated with check (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = (select auth.uid())
));
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
for update to authenticated using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = (select auth.uid())
)) with check (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = (select auth.uid())
));
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages
for delete to authenticated using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = (select auth.uid())
));

-- Explicit privileges work with both old and new Supabase Data API defaults.
revoke all on public.projects, public.conversations, public.messages from public, anon, authenticated;
grant select, insert, update, delete on public.projects, public.conversations, public.messages to authenticated;
grant select, insert, update, delete on public.projects, public.conversations, public.messages to service_role;
notify pgrst, 'reload schema';
commit;
