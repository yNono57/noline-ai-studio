const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = readFileSync('supabase/migrations/20260911204606_noline_core_data_v1.sql', 'utf8');
const proposed = readFileSync('supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql', 'utf8');
const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create schema auth;
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${A}'), ('${B}');
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  return db;
}
async function asUser(db, id, action) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`);
  try { return await action(); } finally { await db.exec('reset role;'); }
}
async function row(db, sql, args=[]) { return (await db.query(sql,args)).rows[0]; }
async function seed(db, user=A) {
  return asUser(db,user,async()=>{
    const p = await row(db, 'insert into projects(user_id,name) values ($1,$2) returning *',[user,'Project']);
    const c = await row(db, "insert into conversations(project_id,mode,agent,title,model_key) values ($1,'CHAT','nova','Hello','nova') returning *",[p.id]);
    const m = await row(db, "insert into messages(conversation_id,role,content,metadata) values ($1,'USER','Hello',$2) returning *",[c.id,{existing:true}]);
    return {p,c,m};
  });
}
test('empty schema, replay and CRUD; timestamps and cascade', async t=>{
  const db=await database(t); await db.exec(migration); await db.exec(migration);
  const {p,c,m}=await seed(db);
  await asUser(db,A,async()=>{
    assert.equal((await row(db,'select * from projects where id=$1',[p.id])).name,'Project');
    const changed=await row(db,"update projects set status='archived' where id=$1 returning *",[p.id]);
    assert.ok(new Date(changed.updated_at)>new Date(p.updated_at));
    assert.equal((await row(db,"update conversations set title='Edited' where id=$1 returning *",[c.id])).title,'Edited');
    assert.equal((await row(db,"update messages set content='Edited' where id=$1 returning *",[m.id])).content,'Edited');
    assert.equal((await db.query('delete from messages where id=$1 returning id',[m.id])).rows.length,1);
    await db.query("insert into messages(conversation_id,role,content) values ($1,'ASSISTANT','reply')",[c.id]);
    await db.query('delete from conversations where id=$1',[c.id]);
    assert.equal((await db.query('select * from messages')).rows.length,0);
  });
  const second=await seed(db);
  await asUser(db,A,()=>db.query('delete from projects where id=$1',[second.p.id]));
  assert.equal((await db.query('select * from conversations where id=$1',[second.c.id])).rows.length,0);
  assert.equal((await db.query('select * from messages where id=$1',[second.m.id])).rows.length,0);
});
test('A/B isolation covers SELECT INSERT UPDATE DELETE and ownership/reparent attempts', async t=>{
  const db=await database(t); await db.exec(migration);
  const a=await seed(db,A), b=await seed(db,B);
  await asUser(db,B,async()=>{
    for(const [table,item] of [['projects',a.p],['conversations',a.c],['messages',a.m]]) {
      assert.equal((await db.query(`select * from ${table} where id=$1`,[item.id])).rows.length,0);
      const column=table==='projects'?'name':table==='conversations'?'title':'content';
      assert.equal((await db.query(`update ${table} set ${column}='attack' where id=$1 returning *`,[item.id])).rows.length,0);
      assert.equal((await db.query(`delete from ${table} where id=$1 returning *`,[item.id])).rows.length,0);
    }
    for(const [sql,args] of [
      ['insert into projects(user_id,name) values ($1,$2)',[A,'attack']],
      ["insert into conversations(project_id,mode,agent,title,model_key) values ($1,'CHAT','n','x','n')",[a.p.id]],
      ["insert into messages(conversation_id,role,content) values ($1,'USER','attack')",[a.c.id]],
      ['update projects set user_id=$1 where id=$2',[A,b.p.id]],
      ['update conversations set project_id=$1 where id=$2',[a.p.id,b.c.id]],
      ['update messages set conversation_id=$1 where id=$2',[a.c.id,b.m.id]]
    ]) await assert.rejects(()=>db.query(sql,args),/row-level security/);
  });
  await db.exec('set role anon');
  for(const table of ['projects','conversations','messages']) {
    for(const sql of [`select * from ${table}`,`delete from ${table}`,`update ${table} set id=id`,`insert into ${table} default values`])
      await assert.rejects(()=>db.exec(sql),/permission denied/);
  }
  await db.exec('reset role');
});
test('proposed schema upgrade preserves rows, metadata, IDs and Forge shared function', async t=>{
  const db=await database(t); await db.exec(proposed);
  await db.exec('grant select,insert,update,delete on projects,conversations,messages to authenticated');
  await db.exec(readFileSync('supabase/migrations/20260824_forge_v1_foundation.sql','utf8'));
  await db.exec(`insert into forge_projects(user_id,name) values ('${A}','Existing Forge')`);
  const forgeBefore=await db.query('select * from forge_projects');
  const fixture=await seed(db);
  const before=await row(db,"select pg_get_functiondef('public.set_updated_at()'::regprocedure) as definition");
  await db.exec(migration); await db.exec(migration);
  assert.deepEqual(await row(db,'select * from messages where id=$1',[fixture.m.id]),fixture.m);
  assert.deepEqual(await row(db,'select * from projects where id=$1',[fixture.p.id]),fixture.p);
  assert.deepEqual(await row(db,"select pg_get_functiondef('public.set_updated_at()'::regprocedure) as definition"),before);
  assert.deepEqual(await db.query('select * from forge_projects'),forgeBefore);
});
test('incompatible schema aborts atomically without creating child tables', async t=>{
  const db=await database(t);
  await db.exec('create table projects(id uuid primary key, user_id text not null)');
  await assert.rejects(()=>db.exec(migration),/Core schema mismatch/); await db.exec('rollback');
  assert.equal((await row(db,"select to_regclass('public.conversations') as relation")).relation,null);
});
test('unknown permissive policy aborts without removing the policy or data', async t=>{
  const db=await database(t); await db.exec(proposed);
  await db.exec('create policy unexpected_public_read on projects for select using (true)');
  await assert.rejects(()=>db.exec(migration),/Unexpected Core RLS policy/); await db.exec('rollback');
  assert.equal((await db.query("select 1 from pg_policies where policyname='unexpected_public_read'")).rows.length,1);
});
test('invalid legacy data aborts without backfill or deletion', async t=>{
  const db=await database(t); await db.exec(proposed);
  await db.exec("alter table projects drop constraint projects_name_check; insert into projects(user_id,name) values ('"+A+"','')");
  await assert.rejects(()=>db.exec(migration),/check constraint/); await db.exec('rollback');
  assert.equal((await row(db,'select name from projects')).name,'');
});
test('conflicting legacy foreign key deletion behavior aborts', async t=>{
  const db=await database(t); await db.exec(proposed);
  await db.exec('alter table messages drop constraint messages_conversation_id_fkey; alter table messages add foreign key(conversation_id) references conversations(id) on delete restrict');
  await assert.rejects(()=>db.exec(migration),/Incompatible foreign key/); await db.exec('rollback');
});
