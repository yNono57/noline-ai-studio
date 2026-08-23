-- PROPOSITION NON DESTRUCTIVE : à appliquer avant d'utiliser Forge avec Supabase.
-- La Service Role contourne la RLS : les routes serveur doivent toujours
-- authentifier l'utilisateur et vérifier explicitement toute la chaîne d'ownership.

create table if not exists public.forge_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  repository_provider text,
  repository_identifier text,
  default_branch text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forge_conversations (
  id uuid primary key default gen_random_uuid(),
  forge_project_id uuid not null references public.forge_projects(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  model_key text not null check (length(btrim(model_key)) > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forge_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.forge_conversations(id) on delete cascade,
  role text not null check (role in ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content text not null check (length(btrim(content)) > 0),
  metadata jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'forge_projects_set_updated_at' and tgrelid = 'public.forge_projects'::regclass) then
    create trigger forge_projects_set_updated_at before update on public.forge_projects
    for each row execute function public.set_updated_at();
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'forge_conversations_set_updated_at' and tgrelid = 'public.forge_conversations'::regclass) then
    create trigger forge_conversations_set_updated_at before update on public.forge_conversations
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists forge_projects_user_activity_idx on public.forge_projects (user_id, updated_at desc);
create index if not exists forge_conversations_project_activity_idx on public.forge_conversations (forge_project_id, updated_at desc);
create index if not exists forge_messages_conversation_chronology_idx on public.forge_messages (conversation_id, created_at, id);

alter table public.forge_projects enable row level security;
alter table public.forge_conversations enable row level security;
alter table public.forge_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forge_projects' and policyname = 'forge_projects_own_all') then
    create policy "forge_projects_own_all" on public.forge_projects for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forge_conversations' and policyname = 'forge_conversations_own_all') then
    create policy "forge_conversations_own_all" on public.forge_conversations for all
    using (exists (select 1 from public.forge_projects p where p.id = forge_project_id and p.user_id = auth.uid()))
    with check (exists (select 1 from public.forge_projects p where p.id = forge_project_id and p.user_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forge_messages' and policyname = 'forge_messages_own_all') then
    create policy "forge_messages_own_all" on public.forge_messages for all
    using (exists (
      select 1 from public.forge_conversations c
      join public.forge_projects p on p.id = c.forge_project_id
      where c.id = conversation_id and p.user_id = auth.uid()
    )) with check (exists (
      select 1 from public.forge_conversations c
      join public.forge_projects p on p.id = c.forge_project_id
      where c.id = conversation_id and p.user_id = auth.uid()
    ));
  end if;
end $$;