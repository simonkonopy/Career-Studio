'use strict';

const { createHash } = require('node:crypto');
const { isIP } = require('node:net');

const FEED_URL = 'https://remotive.com/api/remote-jobs';
const SOURCE_URL = 'https://remotive.com';
const FEED_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60000;
const MAX_FEED_BYTES = 16 * 1024 * 1024;
const MAX_POSTING_CHARS = 20000;
const CACHE_KEY = 'remotive-public-feed-v1';
const ATTRIBUTION = 'Remote jobs provided by Remotive';
const FEED_NOTICE = 'Remote jobs from Remotive. Their public feed is delayed by 24 hours and refreshed here at most every 6 hours. Listings and eligibility are unverified: check the source and employer before applying. No resume or contact details are sent to Remotive.';

class JobError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; this.status = statusCode; }
}

function cleanText(value, limit) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, limit).trim();
}

function plainDescription(value) {
  return cleanText(String(value ?? '').replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*\/?(?:p|div|li|br|h[1-6])\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/gi, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&#39;': "'" })[entity.toLowerCase()])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => { const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; })
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n'), MAX_POSTING_CHARS);
}

function aliases(job) {
  return { ...job, title: job.role, company: job.employer, url: job.link, apply_url: job.link };
}

function publicPostingUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020]/.test(value)) throw new JobError(400, 'Provide a valid public job posting URL.');
  let url;
  try { url = new URL(value); } catch { throw new JobError(400, 'Provide a valid public job posting URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new JobError(400, 'Use an http or https posting URL without account credentials.');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  // Posting links are stored, never fetched by this module. Reject obvious
  // internal addresses as an additional guard for links customers can open.
  if (!hostname.includes('.') || hostname === 'localhost' || /\.(?:localhost|local|internal)$/.test(hostname) || isIP(hostname) === 6) throw new JobError(400, 'Use a public employer or job-board posting URL.');
  if (isIP(hostname) === 4) {
    const [a, b] = hostname.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && [18, 19].includes(b))) throw new JobError(400, 'Use a public employer or job-board posting URL.');
  }
  return url.href;
}

function postingField(value, label, limit, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > limit) throw new JobError(400, label + ' must be text of ' + limit + ' characters or fewer.');
  const text = cleanText(value, limit);
  if (required && !text) throw new JobError(400, 'Provide the ' + label.toLowerCase() + '.');
  return text;
}

function normalizeJob(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new JobError(400, 'Provide the job posting details.');
  const role = postingField(input.role ?? input.title, 'Job title', 240, true);
  const employer = postingField(input.employer ?? input.company ?? input.company_name, 'Company', 240, true);
  const description = plainDescription(postingField(input.description ?? input.postingText, 'Job description', MAX_POSTING_CHARS, true));
  if (!description) throw new JobError(400, 'Provide the job description as readable text.');
  const suppliedUrl = input.link ?? input.url ?? input.apply_url ?? input.applyUrl;
  const link = suppliedUrl === undefined || suppliedUrl === null || suppliedUrl === '' ? '' : publicPostingUrl(suppliedUrl);
  const id = 'user-' + createHash('sha256').update([role, employer, link, description].join('\n')).digest('hex').slice(0, 24);
  const workMode = postingField(input.work_mode ?? input.workMode, 'Work arrangement', 40).toLowerCase();
  if (workMode && !['remote', 'hybrid', 'onsite', 'on-site', 'unknown'].includes(workMode)) throw new JobError(400, 'Choose remote, hybrid, onsite, or unknown for the work arrangement.');
  return aliases({
    id, role, employer, description, link,
    location: postingField(input.location, 'Location', 240), pay: postingField(input.pay ?? input.salary, 'Pay', 240),
    employment_type: postingField(input.employment_type ?? input.employmentType, 'Employment type', 80), work_mode: workMode === 'on-site' ? 'onsite' : workMode,
    source: 'User supplied', sourceUrl: '', link_status: 'UNVERIFIED', verified: false,
    notice: 'User supplied, unverified. Check the employer, requirements, and posting before applying.'
  });
}

function normalizeRemotiveJob(job) {
  if (!job || typeof job !== 'object' || !job.id || typeof job.title !== 'string' || !job.title.trim() || typeof job.company_name !== 'string' || !job.company_name.trim()) return null;
  let url;
  try { url = new URL(job.url); } catch { return null; }
  if (url.protocol !== 'https:' || !['remotive.com', 'www.remotive.com'].includes(url.hostname) || url.username || url.password || url.port || url.href.length > 2048) return null;
  const employmentTypes = { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', freelance: 'Freelance', internship: 'Internship' };
  const employmentType = cleanText(job.job_type, 80).toLowerCase();
  return aliases({
    id: 'remotive-' + cleanText(job.id, 80), employer: cleanText(job.company_name, 240), role: cleanText(job.title, 240),
    location: cleanText(job.candidate_required_location || 'Location not specified', 240), pay: cleanText(job.salary, 240),
    link: url.href, description: plainDescription(job.description), link_status: 'UNVERIFIED', verified: false,
    source: 'Remotive', sourceUrl: SOURCE_URL, publishedAt: cleanText(job.publication_date, 80),
    work_mode: 'remote', employment_type: Object.hasOwn(employmentTypes, employmentType) ? employmentTypes[employmentType] : ''
  });
}

async function boundedResponseText(response) {
  const advertised = Number(response.headers?.get('content-length'));
  if (advertised > MAX_FEED_BYTES) throw new JobError(502, 'The job provider returned too much data. Try again later.');
  if (!response.body) throw new JobError(502, 'The job provider returned an empty response. Try again later.');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_FEED_BYTES) throw new JobError(502, 'The job provider returned too much data. Try again later.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function newState() { return { value: null, pending: null, hydration: null, lastFailureAt: -Infinity }; }
const processState = newState();

// Pass one instance to the public, unauthenticated /api/jobs route. The optional
// cache persists public listings only; get(key)/set(key,value) may be async.
function createJobFeed(options = {}) {
  const { fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 12000, cache } = options;
  const state = !options.fetchImpl && !options.now && !cache ? processState : newState();
  async function hydrate() {
    if (!cache) return;
    if (!state.hydration) state.hydration = (async () => {
      const saved = await cache.get(CACHE_KEY);
      if (!saved || typeof saved !== 'object') return;
      if (Number.isFinite(saved.lastFailureAt) && saved.lastFailureAt <= now()) state.lastFailureAt = saved.lastFailureAt;
      const value = saved.value;
      if (value && Number.isFinite(value.fetchedMs) && value.fetchedMs <= now() && typeof value.fetchedAt === 'string' && Array.isArray(value.jobs) && value.jobs.length <= 25000 && value.jobs.every(job => job && job.source === 'Remotive' && typeof job.role === 'string' && typeof job.employer === 'string' && typeof job.description === 'string' && /^https:\/\/(?:www\.)?remotive\.com\//.test(job.link))) state.value = value;
    })().catch(() => {});
    await state.hydration;
  }
  async function persist() {
    if (cache) await Promise.resolve().then(() => cache.set(CACHE_KEY, { value: state.value, lastFailureAt: Number.isFinite(state.lastFailureAt) ? state.lastFailureAt : null })).catch(() => {});
  }
  async function refresh() {
    const controller = new AbortController();
    let timer;
    try {
      const value = await Promise.race([
        (async () => {
          // Search terms and resume/profile data never leave this server for
          // the feed provider. Redirects cannot change this fixed destination.
          const response = await fetchImpl(FEED_URL, { headers: { accept: 'application/json' }, signal: controller.signal, redirect: 'error' });
          if (!response.ok) throw new JobError(502, 'Remotive is unavailable (HTTP ' + response.status + '). Try again later.');
          const text = await boundedResponseText(response);
          let data;
          try { data = JSON.parse(text); } catch { throw new JobError(502, 'Remotive returned an unreadable response. Try again later.'); }
          if (!data || !Array.isArray(data.jobs) || data.jobs.length > 25000) throw new JobError(502, 'Remotive returned an unexpected response. Try again later.');
          const seen = new Set();
          const jobs = data.jobs.map(normalizeRemotiveJob).filter(job => job && !seen.has(job.id) && seen.add(job.id));
          if (data.jobs.length && !jobs.length) throw new JobError(502, 'Remotive returned no usable job listings. Try again later.');
          const fetchedMs = now();
          return { jobs, fetchedAt: new Date(fetchedMs).toISOString(), fetchedMs };
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new JobError(504, 'Remotive took too long to respond. Try again later.')); }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 30000) : 12000); })
      ]);
      state.value = value;
      state.lastFailureAt = -Infinity;
      await persist();
    } catch (error) {
      state.lastFailureAt = now();
      await persist();
      if (error instanceof JobError) throw error;
      throw new JobError(502, 'Live job discovery is unavailable. Please try again later.');
    } finally { clearTimeout(timer); controller.abort(); }
  }
  return async function getJobs(search = '') {
    if (typeof search !== 'string' || search.length > 200 || /[\u0000-\u001f]/.test(search)) throw new JobError(400, 'Use a job keyword search of 200 characters or fewer.');
    await hydrate();
    if (!state.value || now() - state.value.fetchedMs >= FEED_TTL_MS) {
      if (!state.pending && now() - state.lastFailureAt < FAILURE_COOLDOWN_MS) throw new JobError(503, 'The job feed is temporarily unavailable. Please wait a minute before retrying.');
      if (!state.pending) state.pending = refresh().finally(() => { state.pending = null; });
      await state.pending;
    }
    const clauses = search.toLowerCase().split(',').map(clause => clause.trim().split(/\s+/).filter(Boolean)).filter(clause => clause.length);
    const matching = state.value.jobs.filter(job => {
      const text = (job.role + ' ' + job.employer + ' ' + job.description).toLowerCase();
      return !clauses.length || clauses.some(words => words.every(word => text.includes(word)));
    });
    return { jobs: matching.slice(0, 200).map(job => ({ ...job })), total: matching.length, source: 'Remotive', sourceUrl: SOURCE_URL, attribution: ATTRIBUTION, delayHours: 24, fetchedAt: state.value.fetchedAt, notice: FEED_NOTICE };
  };
}

module.exports = { createJobFeed, normalizeJob, normalizeRemotiveJob, FEED_TTL_MS, FAILURE_COOLDOWN_MS, MAX_FEED_BYTES, MAX_POSTING_CHARS };
