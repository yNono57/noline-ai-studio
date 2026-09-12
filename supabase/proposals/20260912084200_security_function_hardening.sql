-- PROPOSAL ONLY. Not part of the active migration directory.
-- Requires explicit production authorization, fresh preflight and staging Auth/Forge tests.
-- Generated using Supabase CLI 2.117.0 `migration new security_function_hardening`.
-- Scope: function settings/ACL only. No table, trigger, function-body or row changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse to harden an unreviewed body or change a different function overload.
-- Whitespace-normalized hashes refer to the reviewed production bodies on 2026-09-12.
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = to_regprocedure('public.set_updated_at()')
      AND p.prorettype = 'trigger'::regtype AND NOT p.prosecdef
      AND p.proowner = 'postgres'::regrole AND l.lanname = 'plpgsql'
      AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) = 'd258fba5feeb9ce8126471bef81c3228'
      AND (p.proconfig IS NULL OR p.proconfig = ARRAY['search_path=""'])
  ) THEN
    RAISE EXCEPTION 'Unreviewed public.set_updated_at(); stop and re-audit';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = to_regprocedure('public.handle_new_user()')
      AND p.prorettype = 'trigger'::regtype AND p.prosecdef
      AND p.proowner = 'postgres'::regrole AND l.lanname = 'plpgsql'
      AND p.proconfig = ARRAY['search_path=""']
      AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) = '58c5cc15088a5a062b77521747f02b39'
  ) THEN
    RAISE EXCEPTION 'Unreviewed public.handle_new_user(); stop and re-audit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'Missing Supabase Auth role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = to_regclass('auth.users')
      AND tgfoid = to_regprocedure('public.handle_new_user()')
      AND tgname = 'on_auth_user_created' AND tgenabled = 'O' AND NOT tgisinternal
      AND tgtype = 5 -- AFTER INSERT FOR EACH ROW
  ) THEN
    RAISE EXCEPTION 'Unexpected Auth signup trigger; stop and re-audit';
  END IF;
END;
$preflight$;

-- Built-in now() remains resolved through pg_catalog. Shared Forge triggers stay intact.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- Preserve the Auth execution path explicitly before removing public/API-role grants.
-- Do not switch SECURITY DEFINER: profile/subscription creation requires owner privileges.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     OR NOT has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected inherited function privileges; rollback and re-audit';
  END IF;
END;
$verify$;

NOTIFY pgrst, 'reload schema';
COMMIT;
