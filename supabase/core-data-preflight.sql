-- Read-only inventory. Run on the identified AI Studio project before deployment.
-- Do not run migrations on either of the unrelated cashless projects.
select current_database(), current_setting('server_version') as postgres_version;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('projects','conversations','messages')
order by table_name, ordinal_position;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('projects','conversations','messages');

select conrelid::regclass as relation, conname, contype, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (to_regclass('public.projects'),to_regclass('public.conversations'),to_regclass('public.messages'));

select * from pg_policies where schemaname = 'public' and tablename in ('projects','conversations','messages');
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('projects','conversations','messages');
select tgrelid::regclass as relation, tgname, pg_get_triggerdef(oid) as definition from pg_trigger
where not tgisinternal and tgrelid in (to_regclass('public.projects'),to_regclass('public.conversations'),to_regclass('public.messages'));
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('projects','conversations','messages');

select to_regprocedure('public.set_updated_at()') as legacy_forge_function,
       to_regprocedure('public.core_set_updated_at()') as core_function,
       to_regclass('supabase_migrations.schema_migrations') as migration_history;
-- If migration_history is present, also inspect:
-- select version, name from supabase_migrations.schema_migrations order by version;
