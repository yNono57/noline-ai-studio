// Local-only PostgreSQL/PGlite rehearsal. Never connects to Supabase.
// PGLITE_MODULE can point to an existing installation; no application dependency is added.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const loadModule = createRequire(import.meta.url);
const { PGlite } = loadModule(process.env.PGLITE_MODULE || '@electric-sql/pglite');

const proposal = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '20260912084200_security_function_hardening.sql'), 'utf8');
const tables = ['projects', 'conversations', 'forge_projects', 'forge_conversations', 'github_connections', 'forge_workspaces', 'forge_workspace_runtimes'];

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_auth_admin;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text);
    CREATE TABLE public.subscriptions(user_id uuid PRIMARY KEY, plan text, status text);
    CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
    begin
      insert into public.profiles (id, email)
      values (new.id, coalesce(new.email, ''))
      on conflict (id) do nothing;
      insert into public.subscriptions (user_id, plan, status)
      values (new.id, 'free', 'active')
      on conflict (user_id) do nothing;
      return new;
    end;
    $body$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $body$
    begin
      new.updated_at = now();
      return new;
    end;
    $body$;
    GRANT EXECUTE ON FUNCTION public.handle_new_user(), public.set_updated_at() TO anon, authenticated, service_role;
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
    GRANT INSERT ON auth.users TO supabase_auth_admin;
  `);
  for (const table of tables) {
    await db.exec(`CREATE TABLE public.${table}(id integer PRIMARY KEY, updated_at timestamptz NOT NULL);
      CREATE TRIGGER ${table}_set_updated_at BEFORE UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
      INSERT INTO public.${table} VALUES (1, '2000-01-01Z');
      GRANT SELECT, UPDATE ON public.${table} TO authenticated;`);
  }
  return db;
}

async function snapshot(db) {
  return (await db.query(`SELECT jsonb_build_object(
    'functions', (SELECT jsonb_agg(jsonb_build_object('oid',oid,'body',prosrc,'config',proconfig,'acl',proacl::text,'owner',proowner,'definer',prosecdef) ORDER BY proname)
      FROM pg_proc WHERE oid IN ('public.handle_new_user()'::regprocedure,'public.set_updated_at()'::regprocedure)),
    'triggers', (SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal)
  ) AS state`)).rows[0].state;
}

(async () => {
  const checks = [];
  const db = await fixture();
  try {
    // Existing EXECUTE grants do not turn a trigger-returning function into a callable RPC body.
    await assert.rejects(db.exec('SET ROLE anon; SELECT public.handle_new_user();'), /trigger functions can only be called as triggers/i);
    await db.exec('RESET ROLE');
    checks.push('ordinary direct call rejected even before hardening');
    const before = await snapshot(db);
    await db.exec(proposal);
    const after = await snapshot(db);
    assert.deepEqual(after.triggers, before.triggers);
    assert.deepEqual(after.functions.map(({ body, owner, definer, oid }) => ({ body, owner, definer, oid })), before.functions.map(({ body, owner, definer, oid }) => ({ body, owner, definer, oid })));
    checks.push('function bodies, owners, execution mode and all eight triggers unchanged');

    const acl = (await db.query(`SELECT has_function_privilege('anon','public.handle_new_user()','EXECUTE') anon,
      has_function_privilege('authenticated','public.handle_new_user()','EXECUTE') authenticated,
      has_function_privilege('supabase_auth_admin','public.handle_new_user()','EXECUTE') auth_admin,
      has_function_privilege('service_role','public.handle_new_user()','EXECUTE') service_role`)).rows[0];
    assert.deepEqual(acl, { anon: false, authenticated: false, auth_admin: true, service_role: true });
    checks.push('API roles revoked, Auth and existing service role preserved');

    await db.exec(`SET ROLE supabase_auth_admin;
      INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001','synthetic@example.invalid');
      RESET ROLE;`);
    assert.deepEqual((await db.query('SELECT plan,status FROM public.subscriptions')).rows, [{ plan: 'free', status: 'active' }]);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.profiles')).rows[0].n, 1);
    checks.push('Auth signup still creates profile and free active subscription');

    for (const table of tables) {
      await db.exec(`SET ROLE authenticated; UPDATE public.${table} SET updated_at = '2001-01-01Z' WHERE id = 1; RESET ROLE;`);
      assert.equal((await db.query(`SELECT updated_at > '2001-01-01Z'::timestamptz AS touched FROM public.${table}`)).rows[0].touched, true);
    }
    checks.push('all seven historical update triggers still work as authenticated');
    await db.exec(proposal);
    assert.deepEqual(await snapshot(db), after);
    checks.push('second application is idempotent');
  } finally { await db.close(); }

  const failing = await fixture();
  try {
    await failing.exec(`CREATE ROLE inherited_executor; GRANT inherited_executor TO anon;
      GRANT EXECUTE ON FUNCTION public.handle_new_user() TO inherited_executor;`);
    const before = await snapshot(failing);
    await assert.rejects(failing.exec(proposal), /Unexpected inherited function privileges/);
    await failing.exec('ROLLBACK');
    assert.deepEqual(await snapshot(failing), before);
    checks.push('late inherited-ACL incompatibility rolls back every function setting and grant');
  } finally { await failing.close(); }

  const drift = await fixture();
  try {
    await drift.exec(`CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`);
    const before = await snapshot(drift);
    await assert.rejects(drift.exec(proposal), /Unreviewed public.set_updated_at/);
    await drift.exec('ROLLBACK');
    assert.deepEqual(await snapshot(drift), before);
    checks.push('changed historical body fails closed');
  } finally { await drift.close(); }
  process.stdout.write(JSON.stringify({ result: 'PASS', localOnly: true, checks }, null, 2) + '\n');
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
