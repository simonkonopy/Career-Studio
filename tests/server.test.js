'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const http=require('node:http');
const {createApp,configuration,clientAddress}=require('../server');
const {createStore}=require('../lib/store');
const Model=require('../lib/resume-model');

async function fixture(t,{aiEnabled=true,dailyLimit=4,globalLimit=50,aiOverrides={}}={}){
  const directory=mkdtempSync(path.join(tmpdir(),'career-test-'));
  const store=createStore(path.join(directory,'test.sqlite'),{dailyLimit,globalLimit});
  const ai={enabled:aiEnabled,calls:0,async interview({messages}){this.calls++;return {message:'What did you do with Excel?',questions:[{question:'Did you use lookups independently?',reason:'Distinguish independent skills from assistance.'}],proposals:[{label:'Describe your experience',path:'basics.summary',value:'Maintained stock lists in Excel.',evidence:messages.at(-1).content}],usage:{inputTokens:25,outputTokens:30}};},async assess(){this.calls++;return {summary:'Check required skills.',relevance:'possible',matches:[],gaps:[],unknowns:['Required license not confirmed'],questions:[],usage:{inputTokens:20,outputTokens:20}};},async tailor({profile}){this.calls++;return {summary:profile.basics.summary,experience:[],skills:[],notes:[],usage:{inputTokens:20,outputTokens:20}};},...aiOverrides};
  const config={port:0,host:'127.0.0.1',origin:'http://127.0.0.1:1',production:false,inviteCode:'',dataDir:directory,dailyLimit,globalLimit,concurrency:3};
  const app=createApp({config,store,ai,feed:async()=>({jobs:[],source:'Remotive',attribution:'Public jobs from Remotive'})});
  // Choose a port before constructing the host allowlist.
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const port=app.server.address().port;
  const base=`http://127.0.0.1:${port}`;
  async function client(){let cookie='',csrf='';return {get cookie(){return cookie;},get csrf(){return csrf;},async request(route,{method='GET',body,headers={}}={}){
    const response=await new Promise((resolve,reject)=>{
      const request=http.request(base+route,{method,headers:{Host:'127.0.0.1:1',Origin:config.origin,...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...(body!==undefined?{'Content-Length':Buffer.byteLength(JSON.stringify(body))}:{}),...headers}},incoming=>{
        const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('end',()=>{const buffer=Buffer.concat(chunks);const resultHeaders=new Headers();for(const [key,value]of Object.entries(incoming.headers))resultHeaders.set(key,Array.isArray(value)?value.join(','):value);resolve({status:incoming.statusCode,headers:resultHeaders,json:async()=>JSON.parse(buffer.toString()),arrayBuffer:async()=>buffer});});incoming.on('error',reject);
      });request.on('error',reject);request.end(body===undefined?undefined:JSON.stringify(body));
    });
    const newCookie=response.headers.get('set-cookie');if(newCookie)cookie=newCookie.split(';')[0];
    const type=response.headers.get('content-type')||'';
    const data=type.includes('json')?await response.json():Buffer.from(await response.arrayBuffer());
    if(data.csrfToken!==undefined)csrf=data.csrfToken;
    return {status:response.status,data,headers:response.headers};
  }};}
  t.after(async()=>{await app.close();rmSync(directory,{recursive:true,force:true});});
  return {app,store,ai,client,directory};
}
async function signup(client,email='alex@example.test'){
  const result=await client.request('/api/auth/register',{method:'POST',body:{email,password:'Correct horse staple 27'}});
  assert.equal(result.status,201,JSON.stringify(result.data));assert.ok(result.data.recoveryCode);return result.data;
}
async function reviewedProfile(client){const saved=await client.request('/api/state');const profile=Model.blankProfile();profile.basics.name='Alex Morgan';profile.basics.summary='Maintained stock lists in Excel.';profile.reviewed=true;return client.request('/api/profile',{method:'PUT',body:{profile,revision:saved.data.revision}});}
const job={title:'Inventory Coordinator',company:'Example Employer',description:'Maintain inventory records. An active license is required.',url:'https://example.com/jobs/123'};

test('product entry is generic and private records require an account',async t=>{
  const f=await fixture(t);const c=await f.client();
  assert.equal((await c.request('/api/state')).status,401);
  assert.equal((await c.request('/api/jobs')).status,200);
  for(const route of ['/applications.csv','/CLAUDE.md','/research/CANDIDATE_BRIEF.md','/data/career.sqlite','/.env','/../README.md'])assert.equal((await c.request(route)).status,404);
  const page=await c.request('/');assert.equal(page.status,200);assert.match(page.data.toString(),/Career Studio/);assert.doesNotMatch(page.data.toString(),/CANDIDATE_BRIEF|applications\.csv|board_changelog/);
  assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
test('registration stores hashed secrets, secure session attributes and recovery invalidates sessions',async t=>{
  const f=await fixture(t);const c=await f.client();const created=await signup(c);
  const row=f.store.user(created.user.id);assert.notEqual(row.password,'Correct horse staple 27');assert.notEqual(row.recovery_hash,created.recoveryCode);
  const state=await c.request('/api/session');assert.equal(state.data.user.email,'alex@example.test');
  const recover=await f.client();const result=await recover.request('/api/auth/recover',{method:'POST',body:{email:'alex@example.test',recoveryCode:created.recoveryCode,password:'A different secure password'}});
  assert.equal(result.status,200);assert.notEqual(result.data.recoveryCode,created.recoveryCode);
  assert.equal((await c.request('/api/state')).status,401);
  assert.equal((await recover.request('/api/state')).status,200);
  const replay=await recover.request('/api/auth/recover',{method:'POST',body:{email:'alex@example.test',recoveryCode:created.recoveryCode,password:'A third secure password'}});assert.equal(replay.status,401);
});
test('rejects hostile origins, wrong hosts, missing CSRF and malformed input',async t=>{
  const f=await fixture(t);const c=await f.client();await signup(c);
  assert.equal((await c.request('/api/profile',{method:'PUT',headers:{Origin:'https://evil.example'},body:{}})).status,403);
  assert.equal((await c.request('/api/consent',{method:'POST',headers:{'X-CSRF-Token':''},body:{enabled:true}})).status,403);
  assert.equal((await c.request('/api/session',{headers:{Host:'evil.example'}})).status,403);
  assert.equal((await c.request('/api/profile',{method:'PUT',body:{profile:[],revision:0}})).status,400);
});
test('profile saves survive reconnect and stale revisions cannot overwrite newer edits',async t=>{
  const f=await fixture(t);const c=await f.client();await signup(c);const saved=await reviewedProfile(c);assert.equal(saved.status,200);
  const stale=await c.request('/api/profile',{method:'PUT',body:{profile:Model.blankProfile(),revision:0}});assert.equal(stale.status,409);
  const another=await f.client();await another.request('/api/auth/login',{method:'POST',body:{email:'alex@example.test',password:'Correct horse staple 27'}});
  assert.equal((await another.request('/api/state')).data.profile.basics.name,'Alex Morgan');
});
test('customer A cannot read, approve, download or attach customer B resume',async t=>{
  const f=await fixture(t);const a=await f.client(),b=await f.client();await signup(a);await signup(b,'blair@example.test');await reviewedProfile(b);
  const draft=await b.request('/api/resumes',{method:'POST',body:{title:'My resume'}});assert.equal(draft.status,201);const resumeId=draft.data.resume.id;
  assert.equal((await a.request(`/api/resumes/${resumeId}/docx`)).status,404);
  assert.equal((await a.request(`/api/resumes/${resumeId}`,{method:'PATCH',body:{approved:true}})).status,404);
  await b.request(`/api/resumes/${resumeId}`,{method:'PATCH',body:{approved:true}});
  const app=await a.request('/api/applications',{method:'POST',body:{job}});
  assert.equal((await a.request(`/api/applications/${app.data.application.id}`,{method:'PATCH',body:{resumeId}})).status,400);
  assert.equal((await b.request(`/api/applications/${app.data.application.id}`,{method:'PATCH',body:{notes:'intrusion'}})).status,404);
});
test('reviewed document versions freeze after approval and application saves deduplicate',async t=>{
  const f=await fixture(t);const c=await f.client();await signup(c);
  assert.equal((await c.request('/api/resumes',{method:'POST',body:{}})).status,400);
  await reviewedProfile(c);const created=await c.request('/api/resumes',{method:'POST',body:{title:'First version'}});const resume=created.data.resume;
  assert.equal((await c.request(`/api/resumes/${resume.id}/docx`)).status,400);
  assert.equal((await c.request(`/api/resumes/${resume.id}`,{method:'PATCH',body:{approved:true}})).status,200);
  assert.equal((await c.request(`/api/resumes/${resume.id}`,{method:'PATCH',body:{text:'changed'}})).status,409);
  const doc=await c.request(`/api/resumes/${resume.id}/docx`);assert.equal(doc.status,200);assert.equal(doc.data.subarray(0,2).toString(),'PK');
  const first=await c.request('/api/applications',{method:'POST',body:{job}}),second=await c.request('/api/applications',{method:'POST',body:{job}});
  assert.equal(first.data.application.id,second.data.application.id);
  const update=await c.request(`/api/applications/${first.data.application.id}`,{method:'PATCH',body:{stage:'applied',resumeId:resume.id,followUpDate:'2026-09-20'}});assert.equal(update.status,200);
  assert.equal((await c.request(`/api/applications/${first.data.application.id}`,{method:'PATCH',body:{followUpDate:'2026-02-31'}})).status,400);
});
test('AI requires consent and preserves source-backed suggestions for explicit approval',async t=>{
  const f=await fixture(t);const c=await f.client();const account=await signup(c);const body={message:'I maintained stock lists in Excel.',requestId:randomUUID()};
  assert.equal((await c.request('/api/interview',{method:'POST',body})).status,403);assert.equal(f.ai.calls,0);
  await c.request('/api/consent',{method:'POST',body:{enabled:true}});
  const answer=await c.request('/api/interview',{method:'POST',body});assert.equal(answer.status,200);assert.equal(answer.data.profile.basics.summary,'');
  const proposal=answer.data.interview.proposals[0];assert.equal(proposal.status,'pending');assert.equal(answer.data.interview.messages.length,2);
  const outsider=await f.client();await signup(outsider,'outside@example.test');assert.equal((await outsider.request(`/api/proposals/${proposal.id}/accept`,{method:'POST',body:{}})).status,404);
  const accepted=await c.request(`/api/proposals/${proposal.id}/accept`,{method:'POST',body:{}});assert.equal(accepted.status,200);assert.equal(accepted.data.profile.basics.summary,'Maintained stock lists in Excel.');assert.equal(accepted.data.profile.reviewed,false);
  assert.equal(f.store.usage(account.user.id).used,1);
});
test('AI request replay does not spend twice; limits and failures persist',async t=>{
  const f=await fixture(t,{dailyLimit:1});const c=await f.client();await signup(c);await c.request('/api/consent',{method:'POST',body:{enabled:true}});
  const body={message:'I maintained stock lists in Excel.',requestId:randomUUID()};assert.equal((await c.request('/api/interview',{method:'POST',body})).status,200);
  assert.equal((await c.request('/api/interview',{method:'POST',body})).status,200);assert.equal(f.ai.calls,1);
  assert.equal((await c.request('/api/interview',{method:'POST',body:{...body,message:'Changed input'}})).status,409);
  assert.equal((await c.request('/api/interview',{method:'POST',body:{...body,requestId:randomUUID()}})).status,429);
  assert.equal((await c.request('/api/state')).data.usage.remaining,0);
});
test('parallel AI requests cannot bypass per-customer admission',async t=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const f=await fixture(t,{aiOverrides:{async interview(){await gate;return {message:'Saved',questions:[],proposals:[],usage:{}};}}});
  const c=await f.client();await signup(c);await c.request('/api/consent',{method:'POST',body:{enabled:true}});
  const running=c.request('/api/interview',{method:'POST',body:{message:'My experience',requestId:randomUUID()}});
  while(f.store.db.prepare('SELECT count(*) AS n FROM requests').get().n===0)await new Promise(resolve=>setTimeout(resolve,5));
  const second=await c.request('/api/interview',{method:'POST',body:{message:'A second request',requestId:randomUUID()}});assert.equal(second.status,429);
  release();assert.equal((await running).status,200);
});
test('AI errors are honest, retain customer answers and never leak provider secrets',async t=>{
  const f=await fixture(t,{aiOverrides:{async interview(){throw new Error('sk-secret-provider-token');}}});const c=await f.client();await signup(c);await c.request('/api/consent',{method:'POST',body:{enabled:true}});
  const result=await c.request('/api/interview',{method:'POST',body:{message:'Keep this answer',requestId:randomUUID()}});assert.equal(result.status,502);assert.doesNotMatch(result.data.error,/sk-secret/);
  const state=await c.request('/api/state');assert.equal(state.data.interview.messages[0].content,'Keep this answer');assert.equal(state.data.usage.used,1);
});
test('manual flow works without an AI key and does not misrepresent live AI',async t=>{
  const f=await fixture(t,{aiEnabled:false});const c=await f.client();await signup(c);await reviewedProfile(c);
  const request=await c.request('/api/interview',{method:'POST',body:{message:'Hello',requestId:randomUUID()}});assert.equal(request.status,503);assert.equal(request.data.code,'AI_NOT_CONFIGURED');
  assert.equal((await c.request('/api/resumes',{method:'POST',body:{}})).status,201);assert.equal((await c.request('/api/state')).data.usage.used,0);
});
test('export contains only own records; account deletion revokes sessions and preserves aggregate budget',async t=>{
  const f=await fixture(t);const c=await f.client();const account=await signup(c);await c.request('/api/consent',{method:'POST',body:{enabled:true}});await c.request('/api/interview',{method:'POST',body:{message:'My experience',requestId:randomUUID()}});
  const exported=await c.request('/api/export');assert.equal(exported.data.format,'career-studio-export-v1');assert.equal(exported.data.interview.messages.length,2);assert.equal(exported.data.password,undefined);
  assert.equal((await c.request('/api/account',{method:'DELETE',body:{password:'wrong'}})).status,403);
  assert.equal((await c.request('/api/account',{method:'DELETE',body:{password:'Correct horse staple 27'}})).status,200);
  assert.equal(f.store.user(account.user.id),undefined);assert.equal((await c.request('/api/state')).status,401);
  assert.equal(f.store.db.prepare('SELECT sum(attempts) AS n FROM global_usage').get().n,1);
});
test('production configuration refuses insecure origins or an open signup pilot',()=>{
  assert.throws(()=>configuration({NODE_ENV:'production'}),/HTTPS/);
  assert.throws(()=>configuration({NODE_ENV:'production',APP_ORIGIN:'https://career.example'}),/INVITE/);
  assert.throws(()=>configuration({NODE_ENV:'production',APP_ORIGIN:'https://career.example',PILOT_INVITE_CODE:'long-enough-pilot-code'}),/TRUSTED_PROXY/);
  assert.equal(configuration({NODE_ENV:'production',APP_ORIGIN:'https://career.example',PILOT_INVITE_CODE:'long-enough-pilot-code',TRUSTED_PROXY_IPS:'127.0.0.1'}).production,true);
});
test('forwarded client addresses are trusted only from explicitly configured proxy peers',()=>{
  const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'198.51.100.10'}};
  assert.equal(clientAddress(req,{trustedProxyIPs:[]}), '127.0.0.1');
  assert.equal(clientAddress(req,{trustedProxyIPs:['127.0.0.1']}),'198.51.100.10');
  req.headers['x-forwarded-for']='198.51.100.10, 203.0.113.1';assert.equal(clientAddress(req,{trustedProxyIPs:['127.0.0.1']}),'127.0.0.1');
});
test('approving a corrected suggestion prevents an older interview batch from reverting it',async t=>{
  const f=await fixture(t);const c=await f.client();const account=await signup(c);
  const earlier={label:'Earlier summary',path:'basics.summary',value:'Earlier draft',evidence:'Earlier draft'};
  f.store.addProposals(account.user.id,[earlier],0);
  f.store.addProposals(account.user.id,[{...earlier,label:'Correction',value:'Corrected draft'}],0);
  const [correction,old]=f.store.proposals(account.user.id);
  assert.equal((await c.request(`/api/proposals/${correction.id}/accept`,{method:'POST',body:{}})).status,200);
  assert.equal((await c.request(`/api/proposals/${old.id}/accept`,{method:'POST',body:{}})).status,409);
  assert.equal(f.store.profile(account.user.id).profile.basics.summary,'Corrected draft');
});
