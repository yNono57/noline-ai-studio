-- HISTORICAL MIGRATION — already applied manually in Production.
-- Do not reapply blindly; retained as the source of truth for the deployed schema.
-- Forge GitHub App installation metadata. No GitHub access token is persisted.
-- Installation access tokens must be short-lived, generated server-side, and
-- never returned to the browser.

create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_id bigint not null,
  account_login text not null check (length(btrim(account_login)) > 0),
  account_type text not null check (account_type in ('User', 'Organization')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists github_connections_user_activity_idx
  on public.github_connections (user_id, updated_at desc);

alter table public.github_connections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'github_connections'
      and policyname = 'Users can read their GitHub connections'
  ) then
    create policy "Users can read their GitHub connections"
      on public.github_connections
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

-- Mutations intentionally have no authenticated-user RLS policy. Connection
-- creation/revocation must happen in authenticated server routes after explicit
-- ownership and signed-state checks. Service Role bypasses RLS, so every such
-- route must derive user_id from the verified Supabase session and never accept
-- it from request input.

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_github_connections_updated_at'
      and tgrelid = 'public.github_connections'::regclass
  ) then
    create trigger set_github_connections_updated_at
      before update on public.github_connections
      for each row execute function public.set_updated_at();
  end if;
end
$$;

comment on table public.github_connections is
  'Forge GitHub App installation metadata only; never store GitHub access tokens here.';
