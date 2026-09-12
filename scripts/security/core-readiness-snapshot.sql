-- READ ONLY. Run as the administrative audit role, never as an app user subject to RLS.
-- Metadata and row fingerprints only; retain output privately outside Git.
-- A new snapshot must be taken under the approved application write freeze.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local timezone = 'UTC';

with target_relations as (
  select c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         pg_get_userbyid(c.relowner) as owner, c.relacl
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m')
    and (c.relname in ('projects','conversations','messages','github_connections')
         or c.relname like 'forge\_%' escape '\')
), counts as (
  select 'projects' as table_name, count(*) as row_count,
         md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' order by id), '')) as content_fingerprint
    from public.projects t
  union all
  select 'conversations', count(*),
         md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' order by id), ''))
    from public.conversations t
  union all
  select 'messages', count(*),
         md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' order by id), ''))
    from public.messages t
)
select jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'audit_role', current_user,
  'read_only', current_setting('transaction_read_only'),
  'ledger_relation', to_regclass('supabase_migrations.schema_migrations'),
  'counts_and_fingerprints', (select jsonb_agg(to_jsonb(x) order by table_name) from counts x),
  'reference_counts_match', (select bool_and(row_count = case table_name when 'projects' then 3 when 'conversations' then 9 else 55 end) from counts),
  'orphans', jsonb_build_object(
    'projects_without_user', (select count(*) from public.projects p left join auth.users u on u.id=p.user_id where u.id is null),
    'conversations_without_project', (select count(*) from public.conversations c left join public.projects p on p.id=c.project_id where p.id is null),
    'messages_without_conversation', (select count(*) from public.messages m left join public.conversations c on c.id=m.conversation_id where c.id is null)
  ),
  'relations', (select jsonb_agg(to_jsonb(x) order by relname) from target_relations x),
  'columns', (select jsonb_agg(to_jsonb(x) order by table_name, ordinal_position) from (
    select r.relname as table_name, a.attname as column_name, a.attnum as ordinal_position,
           format_type(a.atttypid,a.atttypmod) as type, a.attnotnull as not_null,
           a.attidentity as identity, a.attgenerated as generated, a.attacl as column_acl,
           pg_get_expr(d.adbin,d.adrelid) as default_expression
    from target_relations r join pg_attribute a on a.attrelid=r.oid
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attnum>0 and not a.attisdropped
  ) x),
  'constraints', (select jsonb_agg(to_jsonb(x) order by table_name, name) from (
    select c.conrelid::regclass::text as table_name, c.conname as name, c.contype as type,
           c.convalidated as validated, c.condeferrable as deferrable, c.condeferred as deferred,
           pg_get_constraintdef(c.oid,true) as definition
    from pg_constraint c
    where c.conrelid in (select oid from target_relations) or c.confrelid in (select oid from target_relations)
  ) x),
  'indexes', (select jsonb_agg(to_jsonb(x) order by table_name, name) from (
    select i.indrelid::regclass::text as table_name, i.indexrelid::regclass::text as name,
           i.indisvalid as valid, i.indisready as ready, pg_get_indexdef(i.indexrelid) as definition
    from pg_index i where i.indrelid in (select oid from target_relations)
  ) x),
  'triggers', (select jsonb_agg(to_jsonb(x) order by table_name, name) from (
    select t.tgrelid::regclass::text as table_name, t.tgname as name,
           t.tgenabled as enabled, t.tgfoid::regprocedure::text as function,
           pg_get_triggerdef(t.oid,true) as definition
    from pg_trigger t where not t.tgisinternal and t.tgrelid in (select oid from target_relations)
  ) x),
  'policies', (select jsonb_agg(to_jsonb(x) order by tablename, policyname) from (
    select * from pg_policies where schemaname='public' and tablename in (select relname from target_relations)
  ) x),
  'functions', (select jsonb_agg(to_jsonb(x) order by identity) from (
    select p.oid::regprocedure::text as identity, pg_get_userbyid(p.proowner) as owner,
           p.prosecdef as security_definer, p.proconfig as settings, p.proacl as acl,
           pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('set_updated_at','core_set_updated_at','handle_new_user')
  ) x),
  'grants', (select jsonb_agg(to_jsonb(x) order by table_name, grantee, privilege_type) from (
    select table_schema, table_name, grantor, grantee, privilege_type, is_grantable
    from information_schema.table_privileges where table_schema='public'
      and table_name in (select relname from target_relations)
  ) x),
  'schema_acl', (select nspacl::text from pg_namespace where nspname='public'),
  'default_acl', (select jsonb_agg(to_jsonb(x) order by owner, object_type) from (
    select pg_get_userbyid(d.defaclrole) as owner, n.nspname as schema_name,
           d.defaclobjtype as object_type, d.defaclacl::text as acl
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
    where n.nspname='public' or d.defaclnamespace=0
  ) x),
  'role_flags', (select jsonb_agg(to_jsonb(x) order by rolname) from (
    select rolname, rolsuper, rolbypassrls, rolinherit from pg_roles
    where rolname in ('anon','authenticated','service_role')
  ) x)
) as readiness_snapshot;
rollback;
