create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  structure_name text,
  logo text,
  primary_color text not null default '#FF6B00',
  secondary_color text not null default '#FFFFFF',
  typography text,
  socials text,
  email text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.generated_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generator_id text not null,
  title text not null,
  values jsonb not null default '{}'::jsonb,
  output text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_visuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null,
  width integer not null,
  height integer not null,
  svg text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  generation_count integer not null default 0,
  limit_count integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions(stripe_subscription_id);

alter table public.profiles enable row level security;
alter table public.client_brands enable row level security;
alter table public.generated_texts enable row level security;
alter table public.generated_visuals enable row level security;
alter table public.monthly_quotas enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "client brands own rows" on public.client_brands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generated texts own rows" on public.generated_texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generated visuals own rows" on public.generated_visuals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "monthly quotas own rows" on public.monthly_quotas
  for select using (auth.uid() = user_id);

create policy "subscriptions own rows" on public.subscriptions
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
