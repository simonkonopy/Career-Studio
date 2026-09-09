'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {makeBackup}=require('../scripts/backup');
const {createStore}=require('../lib/store');

test('an online backup restores committed WAL data and refuses destructive destinations',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'career-backup-test-'));
  const source=path.join(dir,'live.sqlite'),output=path.join(dir,'snapshot.sqlite');
  const live=new DatabaseSync(source);live.exec("PRAGMA journal_mode=WAL; CREATE TABLE evidence (id TEXT PRIMARY KEY, content TEXT); INSERT INTO evidence VALUES ('1','Synthetic career history');");
  t.after(()=>{live.close();fs.rmSync(dir,{recursive:true,force:true});});
  await makeBackup({source,output});
  const restored=new DatabaseSync(output,{readOnly:true});
  assert.equal(restored.prepare('SELECT content FROM evidence').get().content,'Synthetic career history');restored.close();
  assert.equal(fs.statSync(output).mode&0o777,0o600);
  await assert.rejects(makeBackup({source,output}),/already exists/);
  await assert.rejects(makeBackup({source,output:source}),/separate/);
  await assert.rejects(makeBackup({source,output:path.resolve(__dirname,'../public/unsafe-backup.sqlite')}),/public/);
  assert.ok(!fs.readdirSync(dir).some(name=>name.startsWith('.career-backup-')));
});

test('restart keeps profiles and quotas and marks interrupted AI work recoverable',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'career-restart-test-')),filename=path.join(dir,'career.sqlite');
  let store=createStore(filename,{dailyLimit:1});
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
  const user=store.register('synthetic@example.test','test-hash','test-recovery-hash');
  const source=store.profile(user.id);source.profile.basics.name='Synthetic Candidate';store.saveProfile(user.id,source.profile,0);
  store.reserve(user.id,'request-restart','interview',{message:'Retain my answer'});store.addMessage(user.id,'user','Retain my answer');store.close();
  store=createStore(filename,{dailyLimit:1});
  assert.equal(store.profile(user.id).profile.basics.name,'Synthetic Candidate');
  assert.equal(store.usage(user.id).remaining,0);assert.equal(store.messages(user.id)[0].content,'Retain my answer');
  const old=store.reserve(user.id,'request-restart','interview',{message:'Retain my answer'});assert.equal(old.cached,true);assert.equal(old.failed,true);assert.equal(old.result.code,'INTERRUPTED');
});
