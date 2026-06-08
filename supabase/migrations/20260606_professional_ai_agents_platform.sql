begin;

create extension if not exists "pgcrypto";

-- Core account tables. These definitions make this migration independent from
-- supabase/schema.sql while preserving existing tables and rows.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists full_name text,
  add column if not exists plan text not null default 'free',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'business')) not valid;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists user_id uuid,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists plan text not null default 'free',
  add column if not exists status text not null default 'active',
  add column if not exists current_period_end timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'business')) not valid;

create unique index if not exists subscriptions_user_id_key
  on public.subscriptions(user_id);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions(stripe_subscription_id);

-- Custom agents may not exist yet on a fresh Supabase project.
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  client_type text not null default '',
  mission text not null default '',
  features text not null default '',
  tone text not null default '',
  complexity text not null default '',
  business_goal text not null default '',
  output text not null default '',
  description text,
  category text,
  tones text[] not null default '{}',
  system_prompt text,
  variables jsonb not null default '[]'::jsonb,
  use_cases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agents
  add column if not exists user_id uuid,
  add column if not exists name text,
  add column if not exists client_type text not null default '',
  add column if not exists mission text not null default '',
  add column if not exists features text not null default '',
  add column if not exists tone text not null default '',
  add column if not exists complexity text not null default '',
  add column if not exists business_goal text not null default '',
  add column if not exists output text not null default '',
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists tones text[] not null default '{}',
  add column if not exists system_prompt text,
  add column if not exists variables jsonb not null default '[]'::jsonb,
  add column if not exists use_cases jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists agents_user_id_created_at_idx
  on public.agents(user_id, created_at desc);

create table if not exists public.official_agents (
  id text primary key,
  name text not null,
  description text not null,
  category text not null,
  tones text[] not null default '{}',
  system_prompt text not null,
  variables jsonb not null default '[]'::jsonb,
  use_cases jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sector text not null,
  logo text,
  email text,
  phone text,
  website text,
  slogan text,
  primary_color text not null default '#FF6B00',
  secondary_color text not null default '#FFFFFF',
  facebook text,
  instagram text,
  linkedin text,
  tiktok text,
  related_structure text,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  client_id uuid references public.clients(id) on delete set null,
  user_prompt text not null,
  input_values jsonb not null default '{}'::jsonb,
  result text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('agent', 'generation')),
  target_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'business')),
  generation_count integer not null default 0
    check (generation_count >= 0),
  limit_count integer
    check (limit_count is null or limit_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month)
);

create index if not exists clients_user_id_created_at_idx
  on public.clients(user_id, created_at desc);

create index if not exists generations_user_id_created_at_idx
  on public.generations(user_id, created_at desc);

create index if not exists generations_agent_id_idx
  on public.generations(agent_id);

create index if not exists favorites_user_id_idx
  on public.favorites(user_id);

-- Add missing auth.users foreign keys to pre-existing compatible tables.
-- NOT VALID preserves legacy rows while enforcing the constraint for new rows.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and contype = 'f'
      and conname = 'subscriptions_user_id_fkey'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agents'::regclass
      and contype = 'f'
      and conname = 'agents_user_id_fkey'
  ) then
    alter table public.agents
      add constraint agents_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade not valid;
  end if;
end
$$;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.agents enable row level security;
alter table public.official_agents enable row level security;
alter table public.clients enable row level security;
alter table public.generations enable row level security;
alter table public.favorites enable row level security;
alter table public.usage_limits enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "subscriptions own rows" on public.subscriptions;
create policy "subscriptions own rows" on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "agents own rows" on public.agents;
create policy "agents own rows" on public.agents
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "official agents readable" on public.official_agents;
create policy "official agents readable" on public.official_agents
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "clients own rows" on public.clients;
create policy "clients own rows" on public.clients
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "generations own rows" on public.generations;
create policy "generations own rows" on public.generations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites own rows" on public.favorites;
create policy "favorites own rows" on public.favorites
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "usage limits own rows" on public.usage_limits;
create policy "usage limits own rows" on public.usage_limits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select on public.official_agents to anon, authenticated;
grant select, insert, update, delete
  on public.clients, public.generations, public.favorites
  to authenticated;
grant select on public.usage_limits to authenticated;

-- Keep profile and subscription creation automatic for future Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles and subscriptions for users created before this migration.
insert into public.profiles (id, email)
select id, coalesce(email, '')
from auth.users
on conflict (id) do nothing;

insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
on conflict (user_id) do nothing;

insert into public.official_agents (
  id,
  name,
  description,
  category,
  tones,
  system_prompt,
  variables,
  use_cases
)
values
  (
    'matchday-pro',
    'Matchday Pro',
    'Communication sportive multiformat pour les temps forts des matchs.',
    'Sport & communication',
    array['Dynamique', 'Sportive', 'Federatrice', 'Institutionnelle'],
    'Tu es Matchday Pro, expert en communication sportive francophone.',
    '[]'::jsonb,
    '["Avant-match", "Jour de match", "Resultat", "Homme du match"]'::jsonb
  ),
  (
    'sponsor-pro',
    'Sponsor Pro',
    'Prospection, relance et valorisation des partenaires.',
    'Partenariats',
    array['Professionnelle', 'Commerciale', 'Institutionnelle'],
    'Tu es Sponsor Pro, expert en partenariats locaux et sponsoring.',
    '[]'::jsonb,
    '["Email sponsor", "Relance sponsor", "Dossier partenaire"]'::jsonb
  ),
  (
    'community-manager-pro',
    'Community Manager Pro',
    'Planification et creation de contenus pour les reseaux sociaux.',
    'Reseaux sociaux',
    array['Creative', 'Dynamique', 'Proche'],
    'Tu es Community Manager Pro, stratege social media francophone.',
    '[]'::jsonb,
    '["Calendrier editorial", "Publications", "Stories"]'::jsonb
  ),
  (
    'commercial-pro',
    'Commercial Pro',
    'Supports de prospection et de vente directement exploitables.',
    'Vente',
    array['Directe', 'Commerciale', 'Premium'],
    'Tu es Commercial Pro, expert en vente B2B locale.',
    '[]'::jsonb,
    '["Prospection", "Relance", "Proposition commerciale"]'::jsonb
  ),
  (
    'portfolio-builder',
    'Portfolio Builder',
    'Etudes de cas et presentations professionnelles.',
    'Presentation',
    array['Premium', 'Narrative', 'Corporate'],
    'Tu es Portfolio Builder, expert en storytelling de marque et etudes de cas.',
    '[]'::jsonb,
    '["Etude de cas", "Portfolio", "Presentation commerciale"]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  tones = excluded.tones,
  system_prompt = excluded.system_prompt,
  variables = excluded.variables,
  use_cases = excluded.use_cases,
  updated_at = now();

commit;
