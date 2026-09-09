'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createJobFeed, normalizeJob, normalizeRemotiveJob, FEED_TTL_MS, FAILURE_COOLDOWN_MS, MAX_FEED_BYTES, MAX_POSTING_CHARS } = require('../lib/jobs');

const remoteJob = overrides => ({ id: 123, company_name: 'Sample Company', title: 'Operations Coordinator',
  candidate_required_location: 'USA', salary: '$55,000', job_type: 'full_time', url: 'https://remotive.com/remote-jobs/operations/sample-123',
  description: '<p>Use Excel &amp; maintain inventory.</p><script>steal()</script><p>Work with suppliers.</p>', publication_date: '2026-09-08T10:00:00', ...overrides });
const feedResponse = jobs => new Response(JSON.stringify({ jobs }), { headers: { 'content-type': 'application/json' } });
const posting = overrides => ({ title: 'Operations Coordinator', company: 'Sample Company', description: 'Maintain inventory using Excel.', url: 'https://careers.example.com/jobs/123', ...overrides });

test('user postings retain readable details and explicit unverified provenance', () => {
  const result = normalizeJob(posting({ description: '<p>Use Excel &amp; maintain inventory.</p><script>steal()</script>', verified: true, source: 'Verified employer', id: 'someone-else' }));
  assert.equal(result.role, result.title);
  assert.equal(result.employer, result.company);
  assert.equal(result.link, result.url);
  assert.equal(result.link, result.apply_url);
  assert.equal(result.source, 'User supplied');
  assert.equal(result.verified, false);
  assert.equal(result.link_status, 'UNVERIFIED');
  assert.match(result.notice, /User supplied, unverified/);
  assert.doesNotMatch(result.description, /<p>|steal|script/);
  assert.match(result.id, /^user-[a-f0-9]{24}$/);
  assert.equal(result.id, normalizeJob(posting({ description: result.description })).id);
  assert.equal(normalizeJob({ role: 'Planner', employer: 'Company', description: 'Manage schedules' }).link, '');
  assert.equal(normalizeJob(posting({ url: undefined, apply_url: 'http://careers.example.com/role' })).url, 'http://careers.example.com/role');
});

test('user posting validation rejects unsafe schemes, private destinations, credentials, and oversized fields', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'https://u:password@example.com/job', 'http://127.0.0.1/jobs', 'http://2130706433/jobs', 'http://169.254.169.254/latest', 'http://localhost:4173/', 'http://[::1]/job', 'https://server.internal/job', 'https://example.com/\njob']) {
    assert.throws(() => normalizeJob(posting({ url })), error => error.statusCode === 400, url);
  }
  for (const input of [posting({ title: '' }), posting({ company: [] }), posting({ description: '' }), posting({ description: 'A'.repeat(MAX_POSTING_CHARS + 1) }), posting({ title: 'A'.repeat(241) }), posting({ work_mode: 'imaginary' })]) {
    assert.throws(() => normalizeJob(input), error => error.statusCode === 400);
  }
});

test('Remotive normalization keeps attribution and safe source links for existing matching model', () => {
  const job = normalizeRemotiveJob(remoteJob());
  assert.equal(job.id, 'remotive-123');
  assert.equal(job.source, 'Remotive');
  assert.equal(job.sourceUrl, 'https://remotive.com');
  assert.equal(job.work_mode, 'remote');
  assert.equal(job.employment_type, 'Full time');
  assert.equal(job.title, job.role);
  assert.equal(job.link_status, 'UNVERIFIED');
  assert.match(job.description, /Excel & maintain inventory/);
  for (const url of ['http://remotive.com/jobs/123', 'https://remotive.com.attacker.test/job', 'https://u:p@remotive.com/job', 'https://remotive.com:444/job', 'javascript:alert(1)']) assert.equal(normalizeRemotiveJob(remoteJob({ url })), null);
  assert.equal(normalizeRemotiveJob(remoteJob({ job_type: '__proto__' })).employment_type, '');
});

test('public searches share a bounded cached feed, deduplicate requests, and never forward customer search', async () => {
  let clock = Date.parse('2026-09-08T12:00:00Z');
  const requests = [];
  const getJobs = createJobFeed({ now: () => clock, fetchImpl: async (...args) => { requests.push(args); return feedResponse([remoteJob(), remoteJob(), remoteJob({ id: 456, title: 'Support Representative', description: 'Customer support and Zendesk' })]); } });
  const [excel, support] = await Promise.all([getJobs('Excel'), getJobs('support')]);
  assert.equal(excel.jobs.length, 1);
  assert.equal(support.jobs[0].role, 'Support Representative');
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], 'https://remotive.com/api/remote-jobs');
  assert.equal(requests[0][1].redirect, 'error');
  assert.equal(requests[0][1].body, undefined);
  assert.deepEqual(requests[0][1].headers, { accept: 'application/json' });
  assert.equal(excel.delayHours, 24);
  assert.match(excel.attribution, /Remotive/);
  assert.match(excel.notice, /delayed by 24 hours/);
  assert.equal(excel.fetchedAt, '2026-09-08T12:00:00.000Z');
  assert.equal((await getJobs('inventory, support')).total, 2);
  excel.jobs[0].role = 'Mutated outside cache';
  assert.equal((await getJobs('Excel')).jobs[0].role, 'Operations Coordinator');
  clock += FEED_TTL_MS - 1;
  await getJobs();
  assert.equal(requests.length, 1);
  clock++;
  await getJobs();
  assert.equal(requests.length, 2);
  await assert.rejects(getJobs('a'.repeat(201)), error => error.statusCode === 400);
  await assert.rejects(getJobs('Excel\n'), error => error.statusCode === 400);
});

test('optional shared storage carries public cached listings across service restarts', async () => {
  const store = new Map();
  const cache = { get: key => store.get(key), set: (key, value) => store.set(key, structuredClone(value)) };
  let requests = 0;
  const options = { cache, now: () => Date.parse('2026-09-08T12:00:00Z'), fetchImpl: async () => { requests++; return feedResponse([remoteJob()]); } };
  await createJobFeed(options)('Excel');
  const nextProcess = await createJobFeed(options)('inventory');
  assert.equal(nextProcess.jobs.length, 1);
  assert.equal(requests, 1);
  assert.equal(store.size, 1);
  const stored = JSON.stringify([...store.values()]);
  assert.doesNotMatch(stored, /"search"|"profile"|"resume"/);
});

test('failed refreshes have a persistent cooldown and hide provider internals', async () => {
  let clock = 1000000;
  let attempts = 0;
  const store = new Map();
  const cache = { get: key => store.get(key), set: (key, value) => store.set(key, value) };
  const options = { now: () => clock, cache, fetchImpl: async () => { attempts++; throw new Error('private infrastructure detail'); } };
  await assert.rejects(createJobFeed(options)(), error => error.statusCode === 502 && !error.message.includes('private'));
  await assert.rejects(createJobFeed(options)(), error => error.statusCode === 503);
  assert.equal(attempts, 1);
  clock += FAILURE_COOLDOWN_MS;
  await assert.rejects(createJobFeed(options)(), error => error.statusCode === 502);
  assert.equal(attempts, 2);
});

test('provider redirects, malformed data, advertised and streamed overflow, and timeout fail safely', async () => {
  await assert.rejects(createJobFeed({ fetchImpl: async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }) })(), error => error.statusCode === 502);
  await assert.rejects(createJobFeed({ fetchImpl: async () => new Response('<html>gateway</html>') })(), /unreadable response/);
  await assert.rejects(createJobFeed({ fetchImpl: async () => new Response('{"results":[]}') })(), /unexpected response/);
  await assert.rejects(createJobFeed({ fetchImpl: async () => feedResponse([remoteJob({ url: 'https://evil.example/' })]) })(), /no usable job listings/);
  await assert.rejects(createJobFeed({ fetchImpl: async () => new Response('large', { headers: { 'content-length': String(MAX_FEED_BYTES + 1) } }) })(), /too much data/);
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(Buffer.alloc(1024 * 1024, 65)); }, cancel() { cancelled = true; } });
  await assert.rejects(createJobFeed({ fetchImpl: async () => new Response(stream) })(), /too much data/);
  assert.equal(cancelled, true);
  let abortSignal;
  await assert.rejects(createJobFeed({ timeoutMs: 5, fetchImpl: (_, options) => { abortSignal = options.signal; return new Promise(() => {}); } })(), error => error.statusCode === 504);
  assert.equal(abortSignal.aborted, true);
});

test('large valid feeds return a bounded public result count and expose the full matching count', async () => {
  const getJobs = createJobFeed({ fetchImpl: async () => feedResponse(Array.from({ length: 250 }, (_, index) => remoteJob({ id: index + 1 }))) });
  const result = await getJobs();
  assert.equal(result.jobs.length, 200);
  assert.equal(result.total, 250);
});
