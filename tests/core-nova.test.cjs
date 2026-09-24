const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const store = require('../lib/chat/conversation-store.ts');
const shared = require('../app/api/nova/_shared.ts');
const projects = require('../app/api/nova/projects/route.ts');
const project = require('../app/api/nova/projects/[projectId]/route.ts');
const conversations = require('../app/api/nova/projects/[projectId]/conversations/route.ts');
const conversation = require('../app/api/nova/conversations/[conversationId]/route.ts');
const messages = require('../app/api/nova/conversations/[conversationId]/messages/route.ts');
const A = {id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',accessToken:'user-a'};
const B = {id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',accessToken:'user-b'};
const db = new PGlite();
const originalFetch=global.fetch;
const calls=[];
let beforeMutation=null;
const originalEnv={...process.env};
// A narrow in-process PostgREST transport adapter. SQL is executed by PostgreSQL
// under the caller's role; this is not a Supabase Auth or PostgREST integration test.
before(async()=>{
  process.env.NOLINE_APP_ENVIRONMENT='test';
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://core-test.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPENAI_API_KEY;
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key); insert into auth.users values ('${A.id}'),('${B.id}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20260911204606_noline_core_data_v1.sql','utf8'));
  global.fetch=async(input,init={})=>{
    const url=new URL(String(input)); const headers=new Headers(init.headers); const method=init.method||'GET';
    calls.push({url:String(url),method,headers});
    assert.equal(url.origin,'https://core-test.invalid','No external/provider network call is permitted');
    assert.equal(headers.get('apikey'),'public-test-key');
    const user=headers.get('authorization')==='Bearer user-a'?A:headers.get('authorization')==='Bearer user-b'?B:null;
    if(url.pathname==='/auth/v1/user') return Response.json(user?{id:user.id}:{error:'invalid'}, {status:user?200:401});
    assert.ok(user,'all database requests must carry a user token');
    if(beforeMutation && method!=='GET') { const hook=beforeMutation; beforeMutation=null; await hook(); }
    const table=url.pathname.split('/').at(-1);
    assert.ok(['projects','conversations','messages'].includes(table));
    const values=[];const conditions=[];
    for(const [key,value] of url.searchParams) {
      if(['select','order','limit'].includes(key)) continue;
      assert.match(key,/^[a-z_]+$/);assert.ok(value.startsWith('eq.'));
      values.push(value.slice(3));conditions.push(`${key}=$${values.length}`);
    }
    const where=conditions.length?' where '+conditions.join(' and '):'';
    const body=init.body?JSON.parse(init.body):{};
    const columns=Object.keys(body);columns.forEach(x=>assert.match(x,/^[a-z_]+$/));
    let sql;
    if(method==='GET') {
      sql=`select * from ${table}${where}`;
      if(url.searchParams.has('order')) sql+=' order by '+url.searchParams.get('order').split(',').map(x=>{assert.match(x,/^[a-z_]+\.(asc|desc)$/);return x.replace('.',' ');}).join(',');
      if(url.searchParams.has('limit')) {assert.equal(url.searchParams.get('limit'),'1');sql+=' limit 1';}
    } else if(method==='POST') {
      values.push(...Object.values(body));sql=`insert into ${table}(${columns.join(',')}) values (${columns.map((_,i)=>'$'+(i+1)).join(',')}) returning *`;
    } else if(method==='PATCH') {
      const sets=columns.map(col=>{values.push(body[col]);return `${col}=$${values.length}`;});
      sql=`update ${table} set ${sets.join(',')}${where} returning *`;
    } else {assert.equal(method,'DELETE');sql=`delete from ${table}${where} returning *`;}
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${user.id}';`);
    try {return Response.json((await db.query(sql,values)).rows);}
    catch(error) {return Response.json({message:error.message},{status:403});}
    finally {await db.exec('reset role');}
  };
});
after(async()=>{global.fetch=originalFetch;process.env=originalEnv;await db.close();});
function request(method='GET',body,user=A) {
  return new Request('https://app.invalid/api/nova',{method,headers:{...(user?{Authorization:`Bearer ${user.accessToken}`} : {}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
function context(key,id) {return {params:Promise.resolve({[key]:id})};}
async function fixture(user=A) {
  const p=await store.createProject(user,{name:'Project'});
  const c=await store.createConversation(user,p.id,{mode:'CHAT',agent:'nova',title:'Conversation',modelKey:'nova'});
  return {p,c};
}
test('every Nova endpoint rejects missing/invalid credentials before touching the database',async()=>{
  const handlers=[
    [projects.GET],[projects.POST],[project.PATCH,context('projectId',A.id)],[project.DELETE,context('projectId',A.id)],
    [conversations.GET,context('projectId',A.id)],[conversations.POST,context('projectId',A.id)],
    [conversation.PATCH,context('conversationId',A.id)],[conversation.DELETE,context('conversationId',A.id)],
    [messages.GET,context('conversationId',A.id)],[messages.POST,context('conversationId',A.id)]
  ];
  for(const [handler,ctx] of handlers) {
    assert.equal((await handler(request('POST',{},null),ctx)).status,401);
    assert.equal((await handler(request('POST',{}, {accessToken:'invalid'}),ctx)).status,401);
  }
  assert.equal(calls.filter(c=>c.url.includes('/rest/')).length,0);
  await assert.rejects(()=>shared.authenticate(new Request('https://app.invalid',{headers:{Authorization:'user-a'}})),e=>e.status===401);
});
test('route CRUD works without a Service Role key; owner comes only from verified auth',async()=>{
  const response=await projects.POST(request('POST',{name:' Example ',user_id:B.id}));
  assert.equal(response.status,201); const p=(await response.json()).project;
  assert.equal(p.user_id,A.id);assert.equal(p.name,'Example');
  assert.equal((await projects.GET(request())).status,200);
  const created=await conversations.POST(request('POST',{mode:'CHAT',agent:'nova',title:'Hello',modelKey:'untrusted'}),context('projectId',p.id));
  assert.equal(created.status,201); const c=(await created.json()).conversation;
  assert.notEqual(c.model_key,'untrusted');
  assert.equal((await conversations.GET(request(),context('projectId',p.id))).status,200);
  assert.equal((await project.PATCH(request('PATCH',{status:'archived'}),context('projectId',p.id))).status,200);
  assert.equal((await conversation.PATCH(request('PATCH',{status:'archived'}),context('conversationId',c.id))).status,200);
  assert.equal((await conversation.DELETE(request('DELETE'),context('conversationId',c.id))).status,204);
  assert.equal((await project.DELETE(request('DELETE'),context('projectId',p.id))).status,204);
});
test('cross-user Nova routes return 404 and never generate or mutate',async()=>{
  const {p,c}=await fixture(A);const start=calls.length;
  for(const [handler,req,ctx] of [
    [project.PATCH,request('PATCH',{status:'archived'},B),context('projectId',p.id)],
    [project.DELETE,request('DELETE',undefined,B),context('projectId',p.id)],
    [conversations.GET,request('GET',undefined,B),context('projectId',p.id)],
    [conversations.POST,request('POST',{mode:'CHAT',agent:'nova',title:'attack'},B),context('projectId',p.id)],
    [conversation.PATCH,request('PATCH',{status:'archived'},B),context('conversationId',c.id)],
    [conversation.DELETE,request('DELETE',undefined,B),context('conversationId',c.id)],
    [messages.GET,request('GET',undefined,B),context('conversationId',c.id)],
    [messages.POST,request('POST',{content:'attack'},B),context('conversationId',c.id)]
  ]) assert.equal((await handler(req,ctx)).status,404);
  assert.equal(calls.slice(start).filter(c=>c.method!=='GET').length,0);
  assert.equal((await store.listProjects(B)).length,0);
});
test('invalid payloads and IDs return 400',async()=>{
  for(const body of [null,[],{name:''},{name:42},{name:'ok',description:42}]) assert.equal((await projects.POST(request('POST',body))).status,400);
  const malformed=new Request('https://app.invalid',{method:'POST',headers:{Authorization:'Bearer user-a'},body:'{'});
  assert.equal((await projects.POST(malformed)).status,400);
  assert.equal((await project.DELETE(request('DELETE'),context('projectId','not-uuid'))).status,400);
  assert.equal((await project.PATCH(request('PATCH',{status:'invalid'}),context('projectId',A.id))).status,400);
  assert.equal((await conversations.POST(request('POST',{mode:'INVALID',agent:'nova',title:'x'}),context('projectId',A.id))).status,400);
  assert.equal((await messages.POST(request('POST',{content:'x',user_message_id:42}),context('conversationId',A.id))).status,400);
  assert.equal((await messages.POST(request('POST',{content:'x',user_message_id:'bad'}),context('conversationId',A.id))).status,400);
});
test('messages persist metadata in stable order; retries return the stored reply',async()=>{
  const {c}=await fixture(); const u=await store.createMessage(A,c.id,{role:'USER',content:'hello'});
  const reply=await store.createMessage(A,c.id,{role:'ASSISTANT',content:'reply',metadata:{reply_to_message_id:u.id,searchUsed:true,sources:[]}});
  await db.query("update messages set created_at='2026-01-01T00:00:00Z' where conversation_id=$1",[c.id]);
  const get=await messages.GET(request(),context('conversationId',c.id));
  assert.equal(get.status,200);assert.deepEqual((await get.json()).messages.map(m=>m.id),[u.id,reply.id].sort());
  const retry=await messages.POST(request('POST',{content:'hello',user_message_id:u.id}),context('conversationId',c.id));
  assert.equal(retry.status,200);assert.equal((await retry.json()).assistant_message.id,reply.id);
  assert.equal((await store.listMessages(A,c.id)).length,2);
  assert.equal((await messages.POST(request('POST',{content:'x',user_message_id:B.id}),context('conversationId',c.id))).status,404);
});
test('generation failure retains the user message and returns 502',async()=>{
  const {c}=await fixture();
  const result=await messages.POST(request('POST',{content:'hello'}),context('conversationId',c.id));
  assert.equal(result.status,502);
  assert.equal((await result.json()).user_message.content,'hello');
  assert.equal((await store.listMessages(A,c.id)).length,1);
});
test('RLS prevents mutation if ownership changes after the application check',async()=>{
  const {p,c}=await fixture();
  beforeMutation=()=>db.query('update projects set user_id=$1 where id=$2',[B.id,p.id]);
  await assert.rejects(()=>store.setConversationStatus(A,c.id,'archived'),e=>e.code==='NOT_FOUND');
  assert.equal((await store.getConversation(B,c.id)).status,'active');
});
test('upstream errors stay generic; direct store input validation fails closed',async()=>{
  assert.equal(shared.routeErrorResponse(new Error('secret database detail')).status,500);
  assert.deepEqual(await shared.routeErrorResponse(new Error('secret database detail')).json(),{error:'Erreur serveur inattendue.'});
  await assert.rejects(()=>store.listProjects({id:A.id,accessToken:''}),e=>e.code==='UNAUTHENTICATED');
  await assert.rejects(()=>store.createProject(A,{name:42}),e=>e.code==='INVALID_INPUT');
  await assert.rejects(()=>store.createProject(A,{name:'x',status:'bad'}),e=>e.code==='INVALID_INPUT');
  const {c}=await fixture();
  await assert.rejects(()=>store.createMessage(A,c.id,{role:'ADMIN',content:'x'}),e=>e.code==='INVALID_INPUT');
  await assert.rejects(()=>store.createMessage(A,c.id,{role:'USER',content:'x',metadata:[]}),e=>e.code==='INVALID_INPUT');
});
