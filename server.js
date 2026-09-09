'use strict';
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const {isIP}=require('node:net');
const {createStore,StoreError}=require('./lib/store');
const Auth=require('./lib/auth');
const Model=require('./lib/resume-model');
const {createAI,applyProposals}=require('./lib/ai');
const Documents=require('./lib/documents');
const {createJobFeed,normalizeJob}=require('./lib/jobs');
const {createCompanion,validateLocalConfiguration}=require('./lib/companion');

function integer(value,fallback,min=1,max=100000){const n=Number(value??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error('Invalid numeric server configuration.');return n;}
function configuration(env=process.env){
  const port=integer(env.PORT,4174,1,65535),production=env.NODE_ENV==='production';
  const origin=new URL(env.APP_ORIGIN||`http://127.0.0.1:${port}`);
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_ORIGIN must be an http(s) origin without a path.');
  if(production&&origin.protocol!=='https:')throw new Error('Production requires an HTTPS APP_ORIGIN.');
  if(production&&(!env.PILOT_INVITE_CODE||env.PILOT_INVITE_CODE.length<16))throw new Error('Production requires a PILOT_INVITE_CODE of at least 16 characters.');
  const trustedProxyIPs=(env.TRUSTED_PROXY_IPS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(trustedProxyIPs.some(ip=>!isIP(ip)))throw new Error('TRUSTED_PROXY_IPS must contain exact IP addresses, separated by commas.');
  if(production&&!trustedProxyIPs.length)throw new Error('Production requires explicit TRUSTED_PROXY_IPS for the HTTPS reverse proxy.');
  const config={localCompanion:env.LOCAL_COMPANION==='1',codexBin:env.CODEX_BIN,port,production,origin:origin.origin,trustedProxyIPs,host:env.HOST||'127.0.0.1',dataDir:path.resolve(__dirname,env.DATA_DIR||'data'),inviteCode:env.PILOT_INVITE_CODE||'',dailyLimit:integer(env.AI_DAILY_LIMIT,40),globalLimit:integer(env.AI_GLOBAL_DAILY_LIMIT,400),concurrency:integer(env.AI_CONCURRENCY,3,1,20)};
  if(config.localCompanion)validateLocalConfiguration(config);
  return config;
}
function clientAddress(req,config){const peer=(req.socket.remoteAddress||'local').replace(/^::ffff:/,'');if((config.trustedProxyIPs||[]).includes(peer)){const forwarded=String(req.headers['x-forwarded-for']||'').trim();if(isIP(forwarded))return forwarded;}return peer;}
function safeText(value,max=20000){return typeof value==='string'?value.replace(/\u0000/g,'').trim().slice(0,max):'';}
function createApp(options={}){
  const config=options.config||configuration();
  if(config.localCompanion||options.companion?.available)validateLocalConfiguration(config);
  const companion=options.companion||createCompanion({enabled:config.localCompanion,binary:config.codexBin});
  const localMode=Boolean(config.localCompanion||companion.available);
  const store=options.store||createStore(path.join(config.dataDir,'career.sqlite'),{dailyLimit:config.dailyLimit,globalLimit:config.globalLimit});
  const ai=options.ai||createAI({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-5.6-terra'});
  const docs=options.documents||Documents;
  const feed=options.feed||createJobFeed({cache:store.cache});
  const authLimit=Auth.limiter(),generalLimit=Auth.limiter({max:300,windowMs:60000}),guidedLimit=Auth.limiter({max:60,windowMs:60000});
  const active=new Map(); let activeCount=0,authActive=0;
  const cookieName='career_session';
  const allowedHost=new URL(config.origin).host;
  const tokenOf=req=>{const match=String(req.headers.cookie||'').match(/(?:^|;\s*)career_session=([A-Za-z0-9_-]{43})(?:;|$)/);return match?match[1]:'';};
  function setCookie(res,token,clear=false){res.setHeader('Set-Cookie',`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${config.production?'; Secure':''}`);}
  function aiInfo(uid){return {enabled:localMode?Boolean(uid&&companion.status(uid).connected):Boolean(ai.enabled),provider:localMode?'chatgpt_local':ai.enabled?'openai_api':'none',consent:Boolean(uid&&store.user(uid)?.consent)};}
  function companionInfo(uid){return uid?companion.status(uid):{available:localMode,status:localMode?'disconnected':'unavailable',connected:false};}
  function statePayload(uid){return {...store.state(uid,aiInfo(uid).enabled),ai:aiInfo(uid),companion:companionInfo(uid)};}
  function sessionPayload(session){return {user:session?{id:session.user_id,email:session.email}:null,csrfToken:session?.csrf||'',ai:aiInfo(session?.user_id),companion:companionInfo(session?.user_id),signupAllowed:true,inviteRequired:Boolean(config.inviteCode)};}
  async function disconnectOwner(uid){active.get(uid)?.abort();if(store.user(uid))store.consent(uid,false);await companion.disconnect(uid);}
  function startSession(res,user){const token=Auth.secret(),csrf=Auth.secret();store.createSession(user.id,token,csrf);setCookie(res,token);return sessionPayload({user_id:user.id,email:user.email,csrf});}
  function send(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));}
  async function readJSON(req,maxBytes=2*1024*1024){
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new StoreError(415,'Send JSON data.');
    const size=Number(req.headers['content-length']||0);if(size>maxBytes)throw new StoreError(413,'This upload is too large.');
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>maxBytes)throw new StoreError(413,'This upload is too large.');chunks.push(chunk);}
    try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new StoreError(400,'Unable to read this request.');}
  }
  async function withAuthLimit(req,fn){authLimit(clientAddress(req,config));if(authActive>=4)throw new StoreError(429,'Sign-in is busy. Please try again shortly.');authActive++;try{return await fn();}finally{authActive--;}}
  function requiredProfile(userId){const source=store.profile(userId);if(!source.profile.reviewed)throw new StoreError(400,'Review and confirm your career profile before creating a resume.','REVIEW_REQUIRED');if(!source.profile.basics.name)throw new StoreError(400,'Add your name before creating a resume.');return source;}
  async function runAI(userId,body,operation,work){
    const provider=localMode?createAI({structuredRequest:args=>companion.request(userId,args),timeoutMs:120000}):ai;
    if(!aiInfo(userId).enabled)throw new StoreError(503,'The AI interviewer is not available yet. You can keep building and saving your profile.','AI_NOT_CONFIGURED');
    if(!store.user(userId)?.consent)throw new StoreError(403,'Confirm that your career information may be shared with the AI provider before continuing.','AI_CONSENT_REQUIRED');
    if(typeof body.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId))throw new StoreError(400,'A valid request identifier is required.');
    if(active.has(userId)||activeCount>=config.concurrency)throw new StoreError(429,'AI is working on another request. Please try again shortly.','AI_BUSY');
    const receipt=store.reserve(userId,body.requestId,operation,localMode?{...body,companionConnectionId:companion.status(userId).connectionId}:body);
    if(receipt.cached){if(receipt.failed)throw new StoreError(receipt.result.status||502,receipt.result.error,receipt.result.code);return receipt.result;}
    const controller=new AbortController();active.set(userId,controller);activeCount++;
    try{
      const value=await work(controller.signal,provider);
      if(controller.signal.aborted||!store.user(userId)||!store.user(userId).consent)throw new StoreError(409,'AI access was stopped. Please review your saved work.','AI_CANCELLED');
      const usageData=value.usage||{};
      store.finish(userId,body.requestId,value,usageData);
      return value;
    }catch(error){
      const publicError={error:publicMessage(error),code:error.code||'AI_FAILED',status:error.status||error.statusCode||502};
      if(store.user(userId))store.finish(userId,body.requestId,publicError,error.usage||{},true);
      throw new StoreError(publicError.status,publicError.error,publicError.code);
    }finally{active.delete(userId);activeCount--;}
  }
  function publicMessage(error){return Number.isInteger(error.status||error.statusCode)?error.message:'Something went wrong. Your saved work is safe. Please try again.';}
  function sourceStillCurrent(userId,revision,signal){if(signal.aborted||!store.user(userId)?.consent)throw new StoreError(409,'AI access was stopped.','AI_CANCELLED');if(store.profile(userId).revision!==revision)throw new StoreError(409,'Your profile changed while AI was working. Please try again with the updated profile.','PROFILE_CONFLICT');}
  const handler=async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cache-Control','no-store');
    if(config.production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      if(req.headers.host!==allowedHost)throw new StoreError(403,'This host is not allowed.');
      const url=new URL(req.url,config.origin),route=url.pathname,method=req.method;
      if(['POST','PUT','PATCH','DELETE'].includes(method)&&req.headers.origin!==config.origin)throw new StoreError(403,'This request must come from the application.','ORIGIN_REQUIRED');
      generalLimit(clientAddress(req,config));
      if(route==='/health'&&method==='GET')return send(res,200,{status:'ok'});
      const token=tokenOf(req),session=token?store.session(token):null;
      if(route==='/api/session'&&method==='GET')return send(res,200,sessionPayload(session));
      if(route==='/api/jobs'&&method==='GET')return send(res,200,await feed(url.searchParams.get('search')||''));
      if(route==='/api/auth/register'&&method==='POST')return await withAuthLimit(req,async()=>{
        const body=await readJSON(req,4096),email=Auth.email(body.email);
        if(config.inviteCode&&!Auth.equal(body.inviteCode||'',config.inviteCode))throw new StoreError(403,'Enter a valid pilot invitation code.','INVITE_REQUIRED');
        const encoded=await Auth.passwordHash(body.password),recoveryCode=Auth.recoveryCode();
        const user=store.register(email,encoded,Auth.hash(recoveryCode));if(session){await disconnectOwner(session.user_id);store.logout(token);}return send(res,201,{...startSession(res,user),recoveryCode});
      });
      if(route==='/api/auth/login'&&method==='POST')return await withAuthLimit(req,async()=>{
        const body=await readJSON(req,4096),email=Auth.email(body.email),user=store.userByEmail(email);
        const valid=await Auth.verifyPassword(body.password,user?.password);if(!user||!valid)throw new StoreError(401,'Email or password is incorrect.','INVALID_LOGIN');
        if(session)await disconnectOwner(session.user_id);if(token)store.logout(token);return send(res,200,startSession(res,user));
      });
      if(route==='/api/auth/recover'&&method==='POST')return await withAuthLimit(req,async()=>{
        const body=await readJSON(req,4096),email=Auth.email(body.email),user=store.userByEmail(email);
        if(!user||typeof body.recoveryCode!=='string'||body.recoveryCode.length>100||!Auth.equal(Auth.hash(body.recoveryCode),user.recovery_hash))throw new StoreError(401,'Email or recovery code is incorrect.','INVALID_RECOVERY');
        const password=await Auth.passwordHash(body.password),recoveryCode=Auth.recoveryCode();
        await disconnectOwner(user.id);if(session&&session.user_id!==user.id){await disconnectOwner(session.user_id);store.logout(token);}store.recover(user.id,password,Auth.hash(recoveryCode));return send(res,200,{...startSession(res,user),recoveryCode});
      });
      if(route.startsWith('/api/')){
        if(!session)throw new StoreError(401,'Sign in to continue.','UNAUTHENTICATED');
        if(['POST','PUT','PATCH','DELETE'].includes(method)&&!Auth.equal(req.headers['x-csrf-token']||'',session.csrf))throw new StoreError(403,'Your session changed. Refresh and try again.','CSRF_REQUIRED');
        const uid=session.user_id;
        if(route==='/api/auth/logout'&&method==='POST'){await disconnectOwner(uid);store.logout(token);setCookie(res,'',true);return send(res,200,{ok:true});}
        if(route==='/api/companion'&&method==='GET'){await companion.refresh(uid);return send(res,200,statePayload(uid));}
        if(route==='/api/companion/connect'&&method==='POST'){await readJSON(req,2048);if(!['connecting','connected'].includes(companion.status(uid).status)){active.get(uid)?.abort();store.consent(uid,false);}await companion.connect(uid);return send(res,200,statePayload(uid));}
        if(route==='/api/companion/disconnect'&&method==='POST'){await readJSON(req,2048);await disconnectOwner(uid);return send(res,200,statePayload(uid));}
        if(route==='/api/state'&&method==='GET')return send(res,200,statePayload(uid));
        if(route==='/api/profile'&&method==='PUT'){const body=await readJSON(req);if(!body.profile||typeof body.profile!=='object'||Array.isArray(body.profile))throw new StoreError(400,'A career profile is required.');return send(res,200,store.saveProfile(uid,body.profile,body.revision));}
        if(route==='/api/consent'&&method==='POST'){const body=await readJSON(req,2048);if(typeof body.enabled!=='boolean')throw new StoreError(400,'Choose whether to enable AI.');store.consent(uid,body.enabled);if(!body.enabled)active.get(uid)?.abort();return send(res,200,statePayload(uid));}
        if(route==='/api/interview/guided'&&method==='POST'){
          const body=await readJSON(req,32000);
          if(typeof body.message!=='string'||!body.message.trim()||body.message.length>6000||body.message.includes('\u0000'))throw new StoreError(400,'Write an answer or choose a skill, using 1 to 6,000 characters.');
          if(typeof body.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId))throw new StoreError(400,'A valid request identifier is required.');
          if(body.topic!==undefined&&(typeof body.topic!=='string'||body.topic.length>200||/[\u0000-\u001f\u007f]/.test(body.topic)))throw new StoreError(400,'Choose a skill name of 200 characters or fewer.');
          guidedLimit(uid);
          store.guidedInterview(uid,body.requestId,{message:body.message.trim(),topic:body.topic?.trim()||''});
          return send(res,200,statePayload(uid));
        }
        if(route==='/api/interview'&&method==='POST'){
          const body=await readJSON(req,16000),message=safeText(body.message,6000);if(!message)throw new StoreError(400,'Write an answer or tell us what you would like to explore.');if(body.message.length>6000)throw new StoreError(400,'Keep each answer under 6,000 characters.');
          await runAI(uid,body,'interview',async (signal,provider)=>{
            const source=store.profile(uid);store.addMessage(uid,'user',message);
            const result=await provider.interview({profile:source.profile,messages:store.messages(uid),signal});
            sourceStillCurrent(uid,source.revision,signal);
            store.transaction(()=>{store.addMessage(uid,'assistant',result.message,result.questions);store.addProposals(uid,result.proposals,source.revision);});
            return {ok:true,usage:result.usage};
          });return send(res,200,statePayload(uid));
        }
        const proposal=route.match(/^\/api\/proposals\/([A-Za-z0-9-]+)\/(accept|reject)$/);
        if(proposal&&method==='POST'){store.decideProposal(uid,proposal[1],proposal[2]==='accept',applyProposals);return send(res,200,statePayload(uid));}
        if(route==='/api/resume/extract'&&method==='POST'){const body=await readJSON(req,12*1024*1024);return send(res,200,await docs.extractResume(body));}
        if(route==='/api/jobs/assess'&&method==='POST'){
          const body=await readJSON(req,150000),job=normalizeJob(body.job);
          requiredProfile(uid);
          const result=await runAI(uid,body,'assess',async (signal,provider)=>{const source=store.profile(uid);const result=await provider.assess({profile:source.profile,job,signal});sourceStillCurrent(uid,source.revision,signal);return result;});
          return send(res,200,{assessment:result,usage:store.usage(uid)});
        }
        if(route==='/api/resumes'&&method==='POST'){
          const body=await readJSON(req,150000),title=safeText(body.title,160)||'My resume';
          if(!body.job){const source=requiredProfile(uid);return send(res,201,{resume:store.addResume(uid,{title,text:Model.resumeText(source.profile),profile:source.profile})});}
          const job=normalizeJob(body.job);
          const result=await runAI(uid,body,'tailor',async (signal,provider)=>{
            const source=requiredProfile(uid),draft=await provider.tailor({profile:source.profile,job,signal});sourceStillCurrent(uid,source.revision,signal);
            const tailored=Model.normalizeProfile(source.profile);tailored.basics.summary=draft.summary;
            for(const role of tailored.experience){const result=draft.experience.find(row=>row.id===role.id);if(result){role.responsibilities='';role.achievements=result.bullets.map(b=>b.text).join('\n');}}
            // Select relevant skills without changing any customer-assessed task levels.
            const selectedSkills=new Set(draft.skills.map(name=>name.replace(/ \(assisted\)$/,'')));
            tailored.skills=tailored.skills.filter(skill=>selectedSkills.has(skill.name));
            const text=Model.resumeText(tailored);
            const resume=store.addResume(uid,{title,text,job:{...job,reviewNotes:draft.notes},profile:source.profile});return {resume,usage:draft.usage};
          });return send(res,201,{resume:result.resume,usage:store.usage(uid)});
        }
        const resume=route.match(/^\/api\/resumes\/([A-Za-z0-9-]+)(\/docx)?$/);
        if(resume&&method==='PATCH'&&!resume[2]){const body=await readJSON(req,150000);if(body.text!==undefined&&(typeof body.text!=='string'||!body.text.trim()||body.text.length>100000))throw new StoreError(400,'Resume text must contain 1 to 100,000 characters.');return send(res,200,{resume:store.editResume(uid,resume[1],{text:body.text,approved:body.approved})});}
        if(resume&&method==='GET'&&resume[2]){const row=store.resume(uid,resume[1]);if(!row)throw new StoreError(404,'Resume not found.');if(!row.approved)throw new StoreError(400,'Review and approve this resume before downloading.','REVIEW_REQUIRED');const buffer=await docs.createDocx(row.text);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="resume.docx"'});return res.end(buffer);}
        if(route==='/api/applications'&&method==='POST'){const body=await readJSON(req,150000);return send(res,201,{application:store.addApplication(uid,normalizeJob(body.job))});}
        const application=route.match(/^\/api\/applications\/([A-Za-z0-9-]+)$/);
        if(application&&method==='PATCH'){
          const body=await readJSON(req,25000),changes={};
          if(body.stage!==undefined){if(!['saved','applied','screening','interview','offer','rejected','withdrawn'].includes(body.stage))throw new StoreError(400,'Choose a valid application stage.');changes.stage=body.stage;}
          if(body.notes!==undefined)changes.notes=safeText(body.notes);
          if(body.followUpDate!==undefined){if(typeof body.followUpDate!=='string'||(body.followUpDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(body.followUpDate)||!Number.isFinite(Date.parse(body.followUpDate))||new Date(body.followUpDate).toISOString().slice(0,10)!==body.followUpDate)))throw new StoreError(400,'Choose a valid follow-up date.');changes.followUpDate=body.followUpDate;}
          if(body.resumeId!==undefined){if(body.resumeId!==null&&typeof body.resumeId!=='string')throw new StoreError(400,'Choose a saved resume.');changes.resumeId=body.resumeId||null;}
          return send(res,200,{application:store.editApplication(uid,application[1],changes)});
        }
        if(route==='/api/export'&&method==='GET'){res.setHeader('Content-Disposition','attachment; filename="career-studio-backup.json"');return send(res,200,{format:'career-studio-export-v1',exportedAt:new Date().toISOString(),...store.state(uid,aiInfo(uid).enabled)});}
        if(route==='/api/account'&&method==='DELETE'){const body=await readJSON(req,4096);return await withAuthLimit(req,async()=>{if(!await Auth.verifyPassword(body.password,store.user(uid).password))throw new StoreError(403,'Password is incorrect.');await disconnectOwner(uid);store.deleteAccount(uid);setCookie(res,'',true);return send(res,200,{ok:true});});}
        throw new StoreError(404,'This action was not found.');
      }
      if(method==='GET'||method==='HEAD'){
        const assets={'/':['index.html','text/html'],'/builder':['index.html','text/html'],'/demo':['index.html','text/html'],'/demo.js':['demo.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/app.css':['app.css','text/css']};
        if(route==='/resume-model.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(method==='HEAD'?'':Model.browserSource);}
        if(assets[route]){const [name,type]=assets[route];const content=fs.readFileSync(path.join(__dirname,'public',name));res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});return res.end(method==='HEAD'?'':content);}
      }
      throw new StoreError(404,'Page not found.');
    }catch(error){if(!res.headersSent)send(res,error.status||error.statusCode||500,{error:publicMessage(error),code:error.code||'REQUEST_FAILED'});else res.end();}
  };
  const server=http.createServer(handler);server.requestTimeout=30000;server.headersTimeout=15000;server.maxHeadersCount=60;
  return {server,store,config,close:async()=>{for(const controller of active.values())controller.abort();await companion.close();await new Promise(resolve=>server.close(resolve));store.close();}};
}
if(require.main===module){const app=createApp();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));app.server.listen(app.config.port,app.config.host,()=>console.log(`Career Studio: ${app.config.origin}\nAI: ${app.config.localCompanion?'local ChatGPT companion (connect in Your account)':process.env.OPENAI_API_KEY?'configured':'awaiting server setup'}\nData: private persistent storage`));}
module.exports={createApp,configuration,clientAddress};
