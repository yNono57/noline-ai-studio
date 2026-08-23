-- PROPOSITION UNIQUEMENT : ne pas exécuter sans revue et migration approuvée.
-- La Service Role contourne la RLS. Toute route serveur qui l'utilise doit donc
-- vérifier explicitement l'identité de l'utilisateur et sa propriété du projet.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
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

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Maintient updated_at automatiquement sur les entités modifiables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

create index projects_user_activity_idx
  on public.projects (user_id, updated_at desc);
create index conversations_project_activity_idx
  on public.conversations (project_id, updated_at desc);
create index messages_conversation_chronology_idx
  on public.messages (conversation_id, created_at, id);

alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "projects_select_own" on public.projects
for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
for delete using (auth.uid() = user_id);

create policy "conversations_select_own" on public.conversations
for select using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = auth.uid()
));
create policy "conversations_insert_own" on public.conversations
for insert with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = auth.uid()
));
create policy "conversations_update_own" on public.conversations
for update using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = auth.uid()
)) with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = auth.uid()
));
create policy "conversations_delete_own" on public.conversations
for delete using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.user_id = auth.uid()
));

create policy "messages_select_own" on public.messages
for select using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = auth.uid()
));
create policy "messages_insert_own" on public.messages
for insert with check (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = auth.uid()
));
create policy "messages_update_own" on public.messages
for update using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = auth.uid()
)) with check (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = auth.uid()
));
create policy "messages_delete_own" on public.messages
for delete using (exists (
  select 1
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = conversation_id and p.user_id = auth.uid()
));
