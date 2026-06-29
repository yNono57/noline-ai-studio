-- Guarantee that generation history can be scoped to the authenticated user.
alter table public.generations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists generations_user_id_created_at_idx
  on public.generations(user_id, created_at desc);

alter table public.generations enable row level security;

drop policy if exists "generations own rows" on public.generations;
create policy "generations own rows" on public.generations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
