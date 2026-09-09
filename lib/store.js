'use strict';
const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, chmodSync } = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Model = require('./resume-model');

const id = () => randomUUID();
const hash = value => createHash('sha256').update(value).digest('hex');
const parse = value => JSON.parse(value);
class StoreError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
function createStore(filename, { dailyLimit = 40, globalLimit = 400, now = () => Date.now() } = {}) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (db.prepare('PRAGMA user_version').get().user_version > 2) { db.close(); throw new Error('This database needs a newer version of Career Studio.'); }
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, recovery_hash TEXT NOT NULL, consent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, questions TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, batch_id TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS resumes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, text TEXT NOT NULL, profile TEXT NOT NULL, job TEXT, approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, job_key TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(user_id,job_key));
    CREATE TABLE IF NOT EXISTS requests (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT NOT NULL, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, day TEXT NOT NULL, status TEXT NOT NULL, result TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, PRIMARY KEY(user_id,request_id));
    CREATE TABLE IF NOT EXISTS feed_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS global_usage (day TEXT PRIMARY KEY, attempts INTEGER NOT NULL);
    `);
  if (!db.prepare('PRAGMA table_info(proposals)').all().some(row => row.name === 'batch_id')) db.exec("ALTER TABLE proposals ADD COLUMN batch_id TEXT NOT NULL DEFAULT ''");
  db.exec('PRAGMA user_version=2');
  // Interrupted attempts still count toward the allowance; retry needs a new request id.
  db.prepare("UPDATE requests SET status='failed', result=? WHERE status='running'").run(JSON.stringify({ error: 'The server restarted during this request. Your saved work is safe. Please try again.', code: 'INTERRUPTED', status: 503 }));
  const timestamp = () => new Date(now()).toISOString();
  const day = () => timestamp().slice(0, 10);
  const user = userId => db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  const profile = userId => {
    const row = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(userId);
    if (!row) throw new StoreError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    return { profile: parse(row.data), revision: row.revision };
  };
  const usage = userId => {
    const used = db.prepare("SELECT count(*) AS n FROM requests WHERE user_id=? AND day=? AND operation!='guided'").get(userId, day()).n;
    const reset = new Date(now()); reset.setUTCHours(24, 0, 0, 0);
    return { used, limit: dailyLimit, remaining: Math.max(0, dailyLimit - used), resetsAt: reset.toISOString() };
  };
  const messages = userId => db.prepare('SELECT * FROM messages WHERE user_id=? ORDER BY rowid').all(userId).map(row => ({ id: row.id, role: row.role, content: row.content, questions: parse(row.questions), createdAt: row.created_at }));
  const proposals = userId => db.prepare('SELECT * FROM proposals WHERE user_id=? ORDER BY rowid DESC').all(userId).map(row => ({ ...parse(row.data), id: row.id, revision: row.revision, status: row.status, createdAt: row.created_at }));
  const resumes = userId => db.prepare('SELECT * FROM resumes WHERE user_id=? ORDER BY rowid DESC').all(userId).map(row => ({ id: row.id, title: row.title, text: row.text, job: row.job ? parse(row.job) : null, notes: row.job ? parse(row.job).reviewNotes || [] : [], approved: Boolean(row.approved), createdAt: row.created_at }));
  const applications = userId => db.prepare('SELECT data FROM applications WHERE user_id=? ORDER BY rowid DESC').all(userId).map(row => parse(row.data));
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  function saveProfile(userId, value, revision) {
    const normalized = Model.normalizeProfile(value);
    const current = profile(userId);
    if (!Number.isInteger(revision) || current.revision !== revision) throw new StoreError(409, 'This profile changed in another tab. Reload the saved version before saving again.', 'PROFILE_CONFLICT');
    db.prepare('UPDATE profiles SET data=?, revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(normalized), userId, revision);
    return profile(userId);
  }
  return {
    db, close: () => db.close(), user, profile, usage, messages, proposals, resumes, applications, transaction, saveProfile,
    userByEmail: email => db.prepare('SELECT * FROM users WHERE email=?').get(email),
    register(email, password, recoveryHash) { return transaction(() => {
      const userId = id();
      try { db.prepare('INSERT INTO users(id,email,password,recovery_hash,created_at) VALUES(?,?,?,?,?)').run(userId, email, password, recoveryHash, timestamp()); }
      catch (e) { if (e.code?.startsWith('ERR_SQLITE') && this.userByEmail(email)) throw new StoreError(409, 'Unable to create this account. Try signing in or recovering your account.', 'ACCOUNT_EXISTS'); throw e; }
      db.prepare('INSERT INTO profiles(user_id,data) VALUES(?,?)').run(userId, JSON.stringify(Model.blankProfile()));
      return user(userId);
    }); },
    createSession(userId, token, csrf) { db.prepare('DELETE FROM sessions WHERE expires<?').run(now()); db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token), userId, csrf, now() + 7 * 86400000); },
    session(token) { return db.prepare('SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?').get(hash(token), now()); },
    logout(token) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); },
    recover(userId, password, recoveryHash) { transaction(() => { db.prepare('UPDATE users SET password=?,recovery_hash=? WHERE id=?').run(password,recoveryHash,userId); db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); }); },
    consent(userId, enabled) { db.prepare('UPDATE users SET consent=? WHERE id=?').run(enabled ? 1 : 0,userId); },
    state(userId, aiEnabled = false) { return { ...profile(userId), interview: { messages: messages(userId), proposals: proposals(userId) }, applications: applications(userId), resumes: resumes(userId), usage: usage(userId), ai: { enabled: aiEnabled, consent: Boolean(user(userId)?.consent) } }; },
    addMessage(userId, role, content, questions = []) { const messageId = id(); db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(messageId, userId, role, content, JSON.stringify(questions), timestamp()); return messageId; },
    addProposals(userId, values, revision) { const batchId=id(); for (const value of values) db.prepare('INSERT INTO proposals(id,user_id,data,revision,created_at,batch_id) VALUES(?,?,?,?,?,?)').run(id(),userId,JSON.stringify(value),revision,timestamp(),batchId); },
    decideProposal(userId, proposalId, accept, apply) { return transaction(() => {
      const row = db.prepare('SELECT * FROM proposals WHERE id=? AND user_id=?').get(proposalId,userId);
      if (!row) throw new StoreError(404,'Suggestion not found.');
      if (row.status !== 'pending') throw new StoreError(409,'This suggestion has already been reviewed.');
      if (accept) {
        const current = profile(userId);
        if (current.revision !== row.revision) throw new StoreError(409,'Your profile changed since this suggestion. Ask the interviewer for an updated suggestion.', 'STALE_PROPOSAL');
        saveProfile(userId, { ...apply(current.profile,[parse(row.data)]), reviewed: false }, current.revision);
        // Other proposals from this exact unchanged batch can still be reviewed. Paths never delete or reorder records.
        if (row.batch_id) db.prepare("UPDATE proposals SET revision=? WHERE user_id=? AND status='pending' AND revision=? AND batch_id=?").run(current.revision+1,userId,current.revision,row.batch_id);
      }
      db.prepare('UPDATE proposals SET status=? WHERE id=? AND user_id=?').run(accept ? 'accepted' : 'rejected',proposalId,userId);
    }); },
    guidedInterview(userId, requestId, input) { return transaction(() => {
      const fingerprint = hash(JSON.stringify(input));
      const existing = db.prepare('SELECT * FROM requests WHERE user_id=? AND request_id=?').get(userId,requestId);
      if (existing) {
        if (existing.operation !== 'guided' || existing.fingerprint !== fingerprint) throw new StoreError(409,'Use a new request for changed input.', 'REQUEST_CONFLICT');
        return { cached: true };
      }
      const prior = db.prepare("SELECT result FROM requests WHERE user_id=? AND operation='guided' AND status='complete' ORDER BY rowid DESC LIMIT 1").get(userId);
      const reply = Model.guidedInterviewReply({ profile: profile(userId).profile, message: input.message, topic: input.topic, previous: prior ? parse(prior.result) : null });
      this.addMessage(userId,'user',input.message);
      this.addMessage(userId,'assistant',reply.message,reply.questions);
      // Guided receipts use the existing table but never reserve AI allowance or
      // increment global usage. The reply cursor is durable and account-scoped.
      db.prepare("INSERT INTO requests(user_id,request_id,operation,fingerprint,day,status,result,created_at) VALUES(?,?,'guided',?,?,'complete',?,?)")
        .run(userId,requestId,fingerprint,day(),JSON.stringify({ topic: reply.topic, step: reply.step }),timestamp());
      return { cached: false };
    }); },
    reserve(userId, requestId, operation, input) { return transaction(() => {
      const fingerprint = hash(JSON.stringify(input));
      const existing = db.prepare('SELECT * FROM requests WHERE user_id=? AND request_id=?').get(userId,requestId);
      if (existing) {
        if (existing.operation !== operation || existing.fingerprint !== fingerprint) throw new StoreError(409,'Use a new request for changed input.', 'REQUEST_CONFLICT');
        if (existing.status === 'running') throw new StoreError(409,'This request is still running. Please wait.', 'REQUEST_RUNNING');
        return { cached: true, failed: existing.status === 'failed', result: parse(existing.result) };
      }
      if (usage(userId).remaining <= 0) throw new StoreError(429,'Your daily AI allowance is used. Your saved work remains available. Try again after the reset.', 'AI_LIMIT');
      const total = db.prepare('SELECT attempts FROM global_usage WHERE day=?').get(day())?.attempts || 0;
      if (total >= globalLimit) throw new StoreError(429,'AI is paused for today. Your saved work remains available.', 'AI_SERVICE_LIMIT');
      db.prepare("INSERT INTO requests(user_id,request_id,operation,fingerprint,day,status,created_at) VALUES(?,?,?,?,?,'running',?)").run(userId,requestId,operation,fingerprint,day(),timestamp());
      db.prepare('INSERT INTO global_usage VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1').run(day());
      return { cached:false };
    }); },
    finish(userId, requestId, result, usageData = {}, failed = false) { db.prepare('UPDATE requests SET status=?,result=?,input_tokens=?,output_tokens=? WHERE user_id=? AND request_id=?').run(failed?'failed':'complete',JSON.stringify(result),Math.max(0,Math.trunc(usageData.inputTokens||0)),Math.max(0,Math.trunc(usageData.outputTokens||0)),userId,requestId); },
    addResume(userId, {title,text,job=null,profile:sourceProfile}) { const resumeId=id(); db.prepare('INSERT INTO resumes(id,user_id,title,text,profile,job,created_at) VALUES(?,?,?,?,?,?,?)').run(resumeId,userId,title,text,JSON.stringify(sourceProfile),job?JSON.stringify(job):null,timestamp()); return resumes(userId).find(row=>row.id===resumeId); },
    resume(userId,resumeId) { return resumes(userId).find(row=>row.id===resumeId); },
    editResume(userId,resumeId,{text,approved}) { const row=this.resume(userId,resumeId); if(!row)throw new StoreError(404,'Resume not found.'); if(row.approved)throw new StoreError(409,'Approved resume versions are preserved. Create a new version to make changes.'); db.prepare('UPDATE resumes SET text=?,approved=? WHERE id=? AND user_id=?').run(text===undefined?row.text:text,approved===true?1:0,resumeId,userId); return this.resume(userId,resumeId); },
    addApplication(userId,job) { const key=hash([job.url||job.apply_url||'',job.company||job.company_name||'',job.title||''].join('\n')); const existing=db.prepare('SELECT data FROM applications WHERE user_id=? AND job_key=?').get(userId,key); if(existing)return parse(existing.data); const value={id:id(),job,stage:'saved',notes:'',followUpDate:'',resumeId:null,createdAt:timestamp(),updatedAt:timestamp()}; db.prepare('INSERT INTO applications VALUES(?,?,?,?)').run(value.id,userId,key,JSON.stringify(value)); return value; },
    editApplication(userId,appId,changes) { const row=db.prepare('SELECT * FROM applications WHERE id=? AND user_id=?').get(appId,userId); if(!row)throw new StoreError(404,'Application not found.'); const value={...parse(row.data),...changes,updatedAt:timestamp()}; if(value.resumeId) { const resume=this.resume(userId,value.resumeId); if(!resume||!resume.approved)throw new StoreError(400,'Choose an approved resume from your library.'); } db.prepare('UPDATE applications SET data=? WHERE id=? AND user_id=?').run(JSON.stringify(value),appId,userId); return value; },
    deleteAccount(userId) { db.prepare('DELETE FROM users WHERE id=?').run(userId); },
    cache: { get(key) { const row=db.prepare('SELECT data FROM feed_cache WHERE key=?').get(key); return row?parse(row.data):null; }, set(key,value) { db.prepare('INSERT INTO feed_cache VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key,JSON.stringify(value)); } }
  };
}
module.exports = { createStore, StoreError, hash };
