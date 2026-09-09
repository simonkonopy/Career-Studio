'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../server');
const { createStore } = require('../lib/store');
const Model = require('../lib/resume-model');

// No provider authentication, real credentials, child processes or external
// network are involved. The transport still passes through createAI validation.
function mockCompanion() {
  const connections = new Map(), calls = [], disconnections = [];
  const manager = {
    available: true, connections, calls, disconnections, closed: false, respond: null,
    status(uid) { return connections.has(uid) ? { ...connections.get(uid) } : { available: true, status: 'disconnected', connected: false }; },
    async refresh(uid) { return this.status(uid); },
    async connect(uid) {
      if (!connections.has(uid)) connections.set(uid, { available: true, status: 'connected', connected: true, connectionId: randomUUID(), email: `owner-${uid}@example.test`, plan: 'Test ChatGPT plan' });
      return this.status(uid);
    },
    async disconnect(uid) { disconnections.push(uid); connections.delete(uid); },
    async request(uid, args) {
      assert.equal(this.status(uid).connected, true, 'Only the requesting account can use its connection');
      calls.push({ uid, ...args });
      if (this.respond) return this.respond(uid, args);
      const input = JSON.parse(args.input), profile = input.profile;
      let result;
      if (args.kind === 'interview') {
        const evidence = input.messages.filter(row => row.role === 'user').at(-1).content;
        result = { message: 'Which steps do you handle yourself?', questions: [{ question: 'Where did you need help?', reason: 'Keep assistance clear.' }], proposals: [{ label: 'Clarify your experience', path: 'basics.summary', value: evidence, evidence }] };
      } else if (args.kind === 'assess') {
        result = { summary: 'Compare the required skills.', relevance: 'possible', matches: [{ requirement: 'Maintaining records', evidence: profile.experience[0].responsibilities }], gaps: [], unknowns: ['Required work authorization is unconfirmed.'], questions: [] };
      } else if (args.kind === 'tailor') {
        result = { summary: profile.basics.summary, experience: [{ id: profile.experience[0].id, bullets: [{ text: profile.experience[0].responsibilities, evidence: profile.experience[0].responsibilities }] }], skills: ['Python (assisted)'], notes: ['Keep assistance visible.'] };
      } else assert.fail('Unexpected companion operation');
      return { text: JSON.stringify(result), usage: { inputTokens: 12, outputTokens: 15 } };
    },
    async close() { this.closed = true; connections.clear(); }
  };
  return manager;
}

async function unusedPort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'career-companion-test-'));
  const port = await unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  const companion = mockCompanion();
  const fallback = { enabled: true, calls: 0, async interview() { this.calls++; throw new Error('Unexpected API fallback'); }, async assess() { this.calls++; throw new Error('Unexpected API fallback'); }, async tailor() { this.calls++; throw new Error('Unexpected API fallback'); } };
  const store = createStore(path.join(directory, 'career.sqlite'));
  const config = { port, origin, host: '127.0.0.1', production: false, trustedProxyIPs: [], dataDir: directory, inviteCode: '', dailyLimit: 40, globalLimit: 400, concurrency: 3, localCompanion: true };
  const app = createApp({ config, store, companion, ai: fallback, feed: async () => ({ jobs: [] }) });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  t.after(async () => { await app.close(); assert.equal(companion.closed, true); rmSync(directory, { recursive: true, force: true }); });
  function client() {
    let cookie = '', csrfToken = '';
    return {
      async request(route, { method = 'GET', body, headers = {} } = {}) {
        const encoded = body === undefined ? undefined : JSON.stringify(body);
        return new Promise((resolve, reject) => {
          const req = http.request(origin + route, { method, headers: {
            Host: new URL(origin).host, Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } : {}),
            ...(encoded === undefined ? {} : { 'Content-Length': Buffer.byteLength(encoded) }), ...headers
          } }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
              try {
                if (res.headers['set-cookie']) cookie = res.headers['set-cookie'][0].split(';')[0];
                const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (data.csrfToken !== undefined) csrfToken = data.csrfToken;
                resolve({ status: res.statusCode, data });
              } catch (error) { reject(error); }
            });
            res.on('error', reject);
          });
          req.on('error', reject); req.end(encoded);
        });
      }
    };
  }
  return { companion, fallback, store, app, client };
}

const password = 'Correct horse staple 27';
async function signup(client, email = 'alex@example.test') {
  const result = await client.request('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
async function connect(client) {
  const result = await client.request('/api/companion/connect', { method: 'POST', body: {} });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.companion.connected, true);
  assert.equal(result.data.ai.provider, 'chatgpt_local');
  assert.equal(result.data.ai.enabled, true);
  return result.data;
}
async function consent(client) { assert.equal((await client.request('/api/consent', { method: 'POST', body: { enabled: true } })).status, 200); }
async function saveProfile(client) {
  const state = (await client.request('/api/state')).data;
  const profile = Model.normalizeProfile({ basics: { name: 'Alex Morgan', email: 'private@example.test', summary: 'Maintained supplier records.' },
    experience: [{ id: 'work-1', employer: 'Sample employer', title: 'Coordinator', responsibilities: 'Maintained supplier records.' }],
    skills: [{ id: 'skill-1', name: 'Python', tasks: { 'Write basic scripts': 'assisted' } }], reviewed: true });
  const result = await client.request('/api/profile', { method: 'PUT', body: { profile, revision: state.revision } });
  assert.equal(result.status, 200); return result.data;
}
const job = { title: 'Operations Coordinator', company: 'Example Employer', description: 'Maintain supplier records and use Python. Must hold work authorization.', url: 'https://example.com/jobs/one' };

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('local companion rejects unsafe production, host, origin and proxy configurations before starting', () => {
  const base = { port: 4175, origin: 'http://127.0.0.1:4175', host: '127.0.0.1', production: false, trustedProxyIPs: [], inviteCode: '', dailyLimit: 40, globalLimit: 400, concurrency: 3, localCompanion: true };
  for (const override of [
    { production: true, origin: 'https://careers.example.test', trustedProxyIPs: ['127.0.0.1'], inviteCode: 'long-private-invitation' },
    { host: '0.0.0.0' }, { host: 'localhost' }, { origin: 'http://localhost:4175' },
    { origin: 'https://127.0.0.1:4175' }, { origin: 'http://192.168.1.2:4175' },
    { trustedProxyIPs: ['127.0.0.1'] }
  ]) {
    const store = createStore(':memory:');let created;
    try { assert.throws(() => { created = createApp({ config: { ...base, ...override }, store, companion: mockCompanion() }); }, /companion|loopback|local|127\.0\.0\.1|production/i); }
    finally { created?.server.close(() => {});store.close(); }
  }
});

test('companion connection routes require account ownership, CSRF and the expected origin', async t => {
  const f = await fixture(t), guest = f.client(), a = f.client(), b = f.client();
  assert.equal((await guest.request('/api/companion')).status, 401);
  assert.equal((await guest.request('/api/companion/connect', { method: 'POST', body: {} })).status, 401);
  const accountA = await signup(a), accountB = await signup(b, 'blair@example.test');
  assert.equal(accountA.ai.provider, 'chatgpt_local');assert.equal(accountA.ai.enabled, false);
  assert.equal((await a.request('/api/companion/connect', { method: 'POST', body: {}, headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await a.request('/api/companion/connect', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal(f.companion.connections.size, 0);
  const disconnectedRequest = await a.request('/api/interview', { method: 'POST', body: { message: 'Please interview me.', requestId: randomUUID() } });
  assert.equal(disconnectedRequest.status, 503);assert.equal(f.companion.calls.length, 0);assert.equal(f.fallback.calls, 0);
  const connectedA = await connect(a);
  assert.equal(connectedA.ai.consent, false);
  for (const route of ['/api/session', '/api/state', '/api/companion']) {
    const own = (await a.request(route)).data;
    assert.equal(own.companion.connected, true);assert.equal(own.ai.enabled, true);assert.equal(own.ai.provider, 'chatgpt_local');
    const other = (await b.request(route)).data;
    assert.equal(other.companion.connected, false);assert.equal(other.ai.enabled, false);
    assert.ok(!JSON.stringify(other).includes(connectedA.companion.email));
    assert.ok(!JSON.stringify(other).includes(connectedA.companion.connectionId));
  }
  const publicSession = (await guest.request('/api/session')).data;
  assert.ok(!JSON.stringify(publicSession).includes(connectedA.companion.email));
  await connect(b);
  assert.notEqual(f.companion.status(accountA.user.id).connectionId, f.companion.status(accountB.user.id).connectionId);
  assert.equal((await a.request('/api/companion/disconnect', { method: 'POST', body: {}, headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal(f.companion.status(accountA.user.id).connected, true);
  assert.equal(f.fallback.calls, 0);
});

test('own companion interview still requires consent, validates results and preserves explicit profile approval', async t => {
  const f = await fixture(t), c = f.client();const account = await signup(c);await connect(c);
  const body = { message: 'I maintain supplier records independently.', requestId: randomUUID() };
  assert.equal((await c.request('/api/interview', { method: 'POST', body })).status, 403);assert.equal(f.companion.calls.length, 0);
  await consent(c);
  for (const requestId of ['', 'short', 'x'.repeat(101)]) assert.equal((await c.request('/api/interview', { method: 'POST', body: { ...body, requestId } })).status, 400);
  const result = await c.request('/api/interview', { method: 'POST', body });assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(f.companion.calls.length, 1);assert.equal(f.companion.calls[0].uid, account.user.id);assert.equal(f.companion.calls[0].kind, 'interview');
  assert.equal(result.data.profile.basics.summary, '');assert.equal(result.data.interview.proposals.length, 1);
  const proposal = result.data.interview.proposals[0];assert.equal(proposal.status, 'pending');
  assert.equal((await c.request('/api/interview', { method: 'POST', body })).status, 200);assert.equal(f.companion.calls.length, 1);
  assert.equal((await c.request('/api/interview', { method: 'POST', body: { ...body, message: 'Changed message' } })).status, 409);
  const accepted = await c.request(`/api/proposals/${proposal.id}/accept`, { method: 'POST', body: {} });assert.equal(accepted.status, 200);
  assert.equal(accepted.data.profile.basics.summary, body.message);assert.equal(accepted.data.profile.reviewed, false);
  assert.equal(f.fallback.calls, 0);
});

test('connected job assessment and tailoring use only the owner companion and retain assisted skill wording', async t => {
  const f = await fixture(t), c = f.client();const account = await signup(c);await connect(c);await consent(c);await saveProfile(c);
  const assessment = await c.request('/api/jobs/assess', { method: 'POST', body: { job, requestId: randomUUID() } });
  assert.equal(assessment.status, 200, JSON.stringify(assessment.data));assert.equal(assessment.data.assessment.relevance, 'possible');
  const tailored = await c.request('/api/resumes', { method: 'POST', body: { title: 'Reviewed candidate draft', job, requestId: randomUUID() } });
  assert.equal(tailored.status, 201, JSON.stringify(tailored.data));assert.equal(tailored.data.resume.approved, false);
  assert.match(tailored.data.resume.text, /Python \(with AI or human assistance\)/);
  assert.deepEqual(f.companion.calls.map(call => call.kind), ['assess', 'tailor']);
  for (const call of f.companion.calls) { assert.equal(call.uid, account.user.id);assert.ok(!call.input.includes('private@example.test'));assert.equal(call.apiKey, undefined); }
  assert.equal(f.fallback.calls, 0);
});

test('invalid or unsupported companion output is rejected without API fallback or automatic claims', async t => {
  const f = await fixture(t), c = f.client();await signup(c);await connect(c);await consent(c);
  const invalidResults = [
    '{broken',
    JSON.stringify({ message: 'Injected', questions: [], proposals: [], admin: true }),
    JSON.stringify({ message: 'Invented evidence', questions: [], proposals: [{ label: 'Credential', path: 'extras.certifications', value: 'Forklift license', evidence: 'I hold a forklift license.' }] })
  ];
  for (const text of invalidResults) {
    f.companion.respond = async () => ({ text, usage: { inputTokens: 1, outputTokens: 1 } });
    const result = await c.request('/api/interview', { method: 'POST', body: { message: 'I work with supplier records.', requestId: randomUUID() } });
    assert.equal(result.status, 502, JSON.stringify(result.data));assert.equal(result.data.code, 'AI_INVALID_OUTPUT');
  }
  f.companion.respond = async () => { throw new Error('private-local-token-do-not-display'); };
  const unavailable = await c.request('/api/interview', { method: 'POST', body: { message: 'Please continue.', requestId: randomUUID() } });
  assert.equal(unavailable.status, 503);assert.ok(!JSON.stringify(unavailable.data).includes('private-local-token'));
  const state = (await c.request('/api/state')).data;assert.equal(state.interview.proposals.length, 0);assert.equal(state.profile.extras.certifications, '');assert.equal(state.profile.basics.summary, '');
  assert.equal(f.fallback.calls, 0);
});

test('disconnect and consent revocation cancel in-flight owner work without affecting another account', { timeout: 15000 }, async t => {
  const f = await fixture(t), a = f.client(), b = f.client();const accountA = await signup(a), accountB = await signup(b, 'blair@example.test');await connect(a);await connect(b);await consent(a);await consent(b);
  for (const action of ['consent', 'disconnect']) {
    await consent(a);
    const started = deferred();
    f.companion.respond = async (_uid, args) => { started.resolve(args.signal);return new Promise(() => {}); };
    const pending = a.request('/api/interview', { method: 'POST', body: { message: 'An answer still being processed.', requestId: randomUUID() } });
    const signal = await started.promise;
    const route = action === 'consent' ? '/api/consent' : '/api/companion/disconnect';
    const stopped = await a.request(route, { method: 'POST', body: action === 'consent' ? { enabled: false } : {} });
    assert.equal(stopped.status, 200);assert.equal(stopped.data.ai.consent, false);
    const result = await pending;assert.equal(result.status, 409);assert.equal(result.data.code, 'AI_CANCELLED');assert.equal(signal.aborted, true);
    assert.equal(f.companion.status(accountB.user.id).connected, true);
  }
  assert.equal(f.companion.status(accountA.user.id).connected, false);
  assert.equal((await a.request('/api/session')).data.ai.enabled, false);
  assert.equal(f.fallback.calls, 0);
});

test('logout, recovery and account deletion close only that customer companion and clear sharing consent', async t => {
  const f = await fixture(t), a = f.client(), b = f.client();const accountA = await signup(a), accountB = await signup(b, 'blair@example.test');await connect(a);await connect(b);await consent(a);await consent(b);
  assert.equal((await a.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal(f.companion.status(accountA.user.id).connected, false);assert.equal(f.companion.status(accountB.user.id).connected, true);
  assert.equal(f.store.user(accountA.user.id).consent, 0);
  const login = await a.request('/api/auth/login', { method: 'POST', body: { email: 'alex@example.test', password } });assert.equal(login.status, 200);assert.equal(login.data.ai.enabled, false);
  await connect(a);await consent(a);
  const recovery = f.client();const recovered = await recovery.request('/api/auth/recover', { method: 'POST', body: { email: 'alex@example.test', recoveryCode: accountA.recoveryCode, password: 'A different secure password' } });
  assert.equal(recovered.status, 200);assert.equal(f.companion.status(accountA.user.id).connected, false);assert.equal(f.companion.status(accountB.user.id).connected, true);assert.equal(f.store.user(accountA.user.id).consent, 0);
  assert.equal((await a.request('/api/state')).status, 401);
  await connect(recovery);await consent(recovery);
  assert.equal((await recovery.request('/api/account', { method: 'DELETE', body: { password: 'A different secure password' } })).status, 200);
  assert.equal(f.companion.status(accountA.user.id).connected, false);assert.equal(f.store.user(accountA.user.id), undefined);assert.equal(f.companion.status(accountB.user.id).connected, true);
  assert.ok(f.companion.disconnections.filter(uid => uid === accountA.user.id).length >= 3);assert.equal(f.fallback.calls, 0);
});

test('switching signed-in accounts disconnects the prior companion only after successful authentication', async t => {
  const f = await fixture(t), switching = f.client(), other = f.client();
  const accountA = await signup(switching), accountB = await signup(other, 'blair@example.test');
  await connect(switching);await consent(switching);
  const connectionId = f.companion.status(accountA.user.id).connectionId;
  const disconnects = f.companion.disconnections.length;
  const failed = await switching.request('/api/auth/login', { method: 'POST', body: { email: 'blair@example.test', password: 'An incorrect password' } });
  assert.equal(failed.status, 401);
  const unchanged = (await switching.request('/api/session')).data;
  assert.equal(unchanged.user.id, accountA.user.id);assert.equal(unchanged.companion.connected, true);assert.equal(unchanged.companion.connectionId, connectionId);assert.equal(unchanged.ai.consent, true);
  assert.equal(f.companion.disconnections.length, disconnects);assert.equal(f.store.user(accountA.user.id).consent, 1);
  const switched = await switching.request('/api/auth/login', { method: 'POST', body: { email: 'blair@example.test', password } });
  assert.equal(switched.status, 200);assert.equal(switched.data.user.id, accountB.user.id);
  assert.equal(f.companion.status(accountA.user.id).connected, false);assert.equal(f.store.user(accountA.user.id).consent, 0);
  assert.equal(switched.data.companion.connected, false);assert.equal(switched.data.ai.enabled, false);assert.equal(switched.data.ai.consent, false);
  assert.ok(f.companion.disconnections.includes(accountA.user.id));assert.equal(f.fallback.calls, 0);
});
