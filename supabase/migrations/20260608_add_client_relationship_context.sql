begin;

alter table public.clients
  add column if not exists related_structure text,
  add column if not exists role text;

commit;
