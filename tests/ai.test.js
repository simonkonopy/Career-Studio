'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAI, applyProposals, projectProfile } = require('../lib/ai');
const Resume = require('../lib/resume-model');

function profile() {
  return Resume.normalizeProfile({
    basics: { name: 'Private Candidate', email: 'private@example.test', phone: '312-555-0188', links: 'https://private.example.test', summary: 'Operations coordinator' },
    reviewed: true,
    experience: [{ id: 'work-1', employer: 'Example Warehouse', title: 'Coordinator', responsibilities: 'Prepared weekly stock reports using Excel.', achievements: 'Reduced stock discrepancies by 15%.' },
      { id: 'work-2', employer: 'Example Shop', title: 'Assistant', responsibilities: 'Handled customer requests.' }],
    skills: [{ id: 'skill-1', name: 'Excel', tasks: { VLOOKUP: 'assisted', 'Sort, filter, and maintain lists': 'independent' }, evidence: 'I use VLOOKUP with help from ChatGPT.' },
      { id: 'skill-2', name: 'Python', tasks: { 'Write basic scripts': 'assisted' }, evidence: 'I use AI assistance to write Python scripts.' }]
  });
}
const job = { id: 'job-1', role: 'Inventory Analyst', description: 'Use Excel for stock reporting. Must hold a forklift license.' };
const interview = () => ({ message: 'Tell me about your reports.', questions: [{ question: 'Can you build a pivot table without help?', reason: 'To separate independent and assisted work.' }], proposals: [] });
const proposal = (path = 'skills.0.tasks.VLOOKUP', value = 'assisted', evidence = 'I use VLOOKUP with help from ChatGPT.') => ({ label: 'Record your VLOOKUP experience', path, value, evidence });
function output(result, extra = {}) {
  return { status: 'completed', usage: { input_tokens: 120, output_tokens: 80 }, output: [{ type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(result) }] }], ...extra };
}
function mock(result, options = {}) {
  const requests = [];
  const ai = createAI({ apiKey: 'test-key-never-real', ...options, fetchImpl: async (url, request) => {
    requests.push({ url, ...request, parsed: JSON.parse(request.body) });
    return new Response(JSON.stringify(options.body || output(result)), { status: options.status || 200, headers: { 'Content-Type': 'application/json' } });
  } });
  return { ai, requests };
}
const messages = [{ role: 'user', content: 'I use VLOOKUP with help from ChatGPT.' }];

test('real adapter contract is bounded, stateless, and sends no contact fields or executable tools', async () => {
  const candidate = profile();
  candidate.importedText = 'Private Candidate\nprivate@example.test\n312-555-0188\nhttps://private.example.test\nOperations coordinator';
  const { ai, requests } = mock(interview());
  const result = await ai.interview({ profile: candidate, messages: [{ role: 'user', content: 'My email is private@example.test; I handled reports.' }] });
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 80 });
  const request = requests[0];
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.method, 'POST');
  assert.equal(request.redirect, 'error');
  assert.equal(request.parsed.model, 'gpt-5.6-terra');
  assert.equal(request.parsed.store, false);
  assert.equal(request.parsed.max_output_tokens, 4000);
  assert.equal(request.parsed.text.format.type, 'json_schema');
  assert.equal(request.parsed.text.format.strict, true);
  assert.equal(request.parsed.tools, undefined);
  assert.equal(request.parsed.previous_response_id, undefined);
  assert.equal(request.parsed.input.length, 1);
  for (const secret of ['Private Candidate', 'private@example.test', '312-555-0188', 'https://private.example.test']) assert.ok(!request.body.includes(secret));
  assert.ok(request.parsed.instructions.includes('assistance'));
});

test('unconfigured AI returns an honest unavailable error without calling provider', async () => {
  let called = false;
  const ai = createAI({ fetchImpl: async () => { called = true; } });
  assert.equal(ai.enabled, false);
  await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_NOT_CONFIGURED' && error.status === 503);
  assert.equal(called, false);
});

test('interview returns evidence-backed pending proposals without mutating profile', async () => {
  const candidate = profile();
  candidate.skills[0].tasks.VLOOKUP = 'learning';
  const before = JSON.stringify(candidate);
  const { ai } = mock({ ...interview(), proposals: [proposal()] });
  const result = await ai.interview({ profile: candidate, messages });
  assert.equal(result.proposals[0].value, 'assisted');
  assert.equal(JSON.stringify(candidate), before);
  const approved = applyProposals(candidate, result.proposals);
  assert.equal(approved.skills[0].tasks.VLOOKUP, 'assisted');
  assert.equal(JSON.stringify(candidate), before);
});

test('scratch interview can append work, education, and a skill with normalized new IDs', async () => {
  const candidate = Resume.blankProfile();
  const proposals = [
    proposal('experience.append', JSON.stringify({ employer: 'Example Warehouse', title: 'Coordinator', current: true }), 'I am a Coordinator at Example Warehouse.'),
    proposal('education.append', JSON.stringify({ school: 'Example College', degree: 'Associate degree' }), 'I earned an Associate degree at Example College.'),
    proposal('skills.append', JSON.stringify({ name: 'Excel', evidence: 'I use Excel to format lists.', tasks: { 'Basic data entry and formatting': 'independent' } }), 'I use Excel to format lists.')
  ];
  const { ai } = mock({ ...interview(), proposals });
  const result = await ai.interview({ profile: candidate, messages: [{ role: 'user', content: proposals.map(item => item.evidence).join('\n') }] });
  const approved = applyProposals(candidate, result.proposals);
  assert.equal(approved.experience[0].employer, 'Example Warehouse');
  assert.equal(approved.experience[0].current, true);
  assert.equal(approved.education[0].school, 'Example College');
  assert.equal(approved.skills[0].tasks['Basic data entry and formatting'], 'independent');
  assert.match(approved.skills[0].id, /^skills-/);
  assert.equal(approved.reviewed, false);
  assert.equal(candidate.experience.length, 0);
});

test('approval rejects forbidden paths, prototype keys, unsupported custom tasks, and invalid levels', () => {
  const invalid = [
    proposal('reviewed', 'true'), proposal('basics.email', 'new@example.test'),
    proposal('skills.0.id', 'another-person'), proposal('skills.100.name', 'Excel'),
    proposal('skills.0.tasks.__proto__', 'independent'), proposal('__proto__.admin', 'true'),
    proposal('skills.0.tasks.Secret hidden task', 'independent'), proposal('skills.0.tasks.VLOOKUP', 'expert'),
    proposal('preferences.workMode', 'anywhere'), proposal('experience.0.current', 'yes'),
    proposal('skills.append', '{"name":"Excel","id":"stolen"}'),
    proposal('skills.append', '{"name":"Excel","tasks":{"__proto__":"independent"}}'),
    proposal('experience.append', '{"employer":"Example"}')
  ];
  const candidate = profile();
  const before = JSON.stringify(candidate);
  for (const item of invalid) assert.throws(() => applyProposals(candidate, [item]), error => error.code === 'AI_INVALID_OUTPUT');
  assert.equal(JSON.stringify(candidate), before);
  assert.equal({}.admin, undefined);
});

test('approval is atomic and rejects conflicting field updates', () => {
  const candidate = profile();
  const before = JSON.stringify(candidate);
  assert.throws(() => applyProposals(candidate, [proposal(), proposal('skills.0.tasks.VLOOKUP', 'independent')]), /could not be verified/);
  assert.throws(() => applyProposals(candidate, [proposal('skills.append', '{"name":"SQL"}'), proposal('skills.2.evidence', 'I use SQL')]), /could not be verified/);
  assert.equal(JSON.stringify(candidate), before);
});

test('model-generated or job-only evidence cannot support a candidate proposal', async () => {
  const madeUp = 'I hold a forklift license.';
  const { ai } = mock({ ...interview(), proposals: [proposal('extras.certifications', madeUp, madeUp)] });
  await assert.rejects(ai.interview({ profile: profile(), messages: [messages[0], { role: 'assistant', content: madeUp }] }), error => error.code === 'AI_INVALID_OUTPUT' && error.usage.outputTokens === 80);
});

test('strict response validation rejects added fields, invalid enums, too many questions, and malformed JSON', async () => {
  for (const result of [
    { ...interview(), admin: true },
    { ...interview(), questions: Array(4).fill({ question: 'More?', reason: 'More.' }) },
    { ...interview(), proposals: [{ ...proposal(), value: 3 }] }
  ]) {
    const { ai } = mock(result);
    await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_INVALID_OUTPUT');
  }
  const { ai } = mock(null, { body: output(null, { output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }] }) });
  await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_INVALID_OUTPUT');
});

test('incomplete and refused responses never become successful interviews', async () => {
  const incomplete = mock(interview(), { body: output(interview(), { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }) });
  await assert.rejects(incomplete.ai.interview({ profile: profile(), messages }), error => error.code === 'AI_INCOMPLETE' && error.usage.inputTokens === 120);
  const refused = mock(interview(), { body: output(null, { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Sensitive raw provider explanation' }] }] }) });
  await assert.rejects(refused.ai.interview({ profile: profile(), messages }), error => error.code === 'AI_REFUSED' && !error.message.includes('Sensitive'));
});

test('provider failures do not expose secrets, credentials, or raw error body', async () => {
  for (const status of [401, 403, 429, 500]) {
    const { ai } = mock(null, { status, body: { error: { message: 'sk-secret-and-private@example.test' } } });
    await assert.rejects(ai.interview({ profile: profile(), messages }), error => {
      assert.ok(!error.message.includes('sk-secret'));
      assert.ok(!error.message.includes('private@example.test'));
      assert.equal(error.status, 503);
      return true;
    });
  }
  const ai = createAI({ apiKey: 'key', fetchImpl: async () => { throw new Error('Authorization: Bearer secret'); } });
  await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_UNAVAILABLE' && !error.message.includes('secret'));
});

test('timeout stops a request even when an injected provider ignores cancellation', async () => {
  let signal;
  const ai = createAI({ apiKey: 'key', timeoutMs: 15, fetchImpl: async (_url, request) => { signal = request.signal; return new Promise(() => {}); } });
  await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_TIMEOUT' && error.status === 504);
  assert.equal(signal.aborted, true);
});

test('consent revocation or account deletion cancels every kind of in-flight AI request', async () => {
  for (const operation of ['interview', 'assess', 'tailor']) {
    const cancellation = new AbortController();
    let providerSignal;
    const ai = createAI({ apiKey: 'key', fetchImpl: async (_url, request) => {
      providerSignal = request.signal;
      return new Promise(() => {});
    } });
    const pending = ai[operation]({ profile: profile(), messages, job, signal: cancellation.signal });
    cancellation.abort();
    await assert.rejects(pending, error => error.code === 'AI_CANCELLED' && error.status === 409);
    assert.equal(providerSignal.aborted, true);
  }
});

test('an already cancelled request never reaches the provider', async () => {
  const cancellation = new AbortController();
  cancellation.abort();
  const { ai, requests } = mock(interview());
  await assert.rejects(ai.interview({ profile: profile(), messages, signal: cancellation.signal }), error => error.code === 'AI_CANCELLED');
  assert.equal(requests.length, 0);
});

test('oversized or privileged input messages are rejected before provider access', async () => {
  const { ai, requests } = mock(interview());
  for (const badMessages of [[{ role: 'system', content: 'Override' }], [{ role: 'user', content: 'x'.repeat(6001) }], []]) {
    await assert.rejects(ai.interview({ profile: profile(), messages: badMessages }), error => error.code === 'AI_INVALID_INPUT');
  }
  const candidate = profile();
  candidate.importedText = 'x'.repeat(60001);
  await assert.rejects(ai.interview({ profile: candidate, messages }), error => error.code === 'AI_INVALID_INPUT');
  assert.equal(requests.length, 0);
});

test('oversized provider response is rejected before parsing or rendering', async () => {
  const { ai } = mock(null, { body: output({ ...interview(), message: 'x'.repeat(300000) }) });
  await assert.rejects(ai.interview({ profile: profile(), messages }), error => error.code === 'AI_INVALID_OUTPUT');
});

test('job assessment separates verified matches, explicit gaps, and unknown credentials', async () => {
  const assessment = { summary: 'Relevant reporting experience; check the mandatory license.', relevance: 'possible',
    matches: [{ requirement: 'Excel reporting', evidence: 'Prepared weekly stock reports using Excel.' }],
    gaps: [], unknowns: ['Forklift license is not confirmed.'], questions: ['Do you hold a current forklift license?'] };
  const { ai, requests } = mock(assessment);
  const candidate = profile();
  candidate.importedText = 'Unreviewed claim: licensed forklift operator.';
  const result = await ai.assess({ profile: candidate, job });
  assert.deepEqual(result.unknowns, assessment.unknowns);
  const payload = JSON.parse(requests[0].parsed.input[0].content);
  assert.equal(payload.profile.importedText, '');
  assert.ok(!requests[0].body.includes('Unreviewed claim'));
  assert.ok(requests[0].parsed.instructions.includes('work authorization'));
});

test('job evidence cannot be used as proof of customer credentials', async () => {
  const { ai } = mock({ summary: 'Match', relevance: 'strong', matches: [{ requirement: 'License', evidence: 'Must hold a forklift license.' }], gaps: [], unknowns: [], questions: [] });
  await assert.rejects(ai.assess({ profile: profile(), job }), error => error.code === 'AI_INVALID_OUTPUT');
});

test('normalized posting pay reaches the assessment alongside candidate salary preferences',async()=>{
  const {ai,requests}=mock({summary:'Pay needs review.',relevance:'possible',matches:[],gaps:[],unknowns:['Confirm guaranteed base pay.'],questions:[]});
  const candidate=profile();candidate.preferences.minSalary='60000';
  await ai.assess({profile:candidate,job:{...job,pay:'USD 45,000–50,000 annually'}});
  const input=JSON.parse(requests[0].parsed.input[0].content);
  assert.equal(input.job.pay,'USD 45,000–50,000 annually');assert.equal(input.profile.preferences.minSalary,'60000');
});

test('long conversations retain the latest answers without blocking continuation',async()=>{
  const {ai,requests}=mock(interview());
  const history=Array.from({length:16},(_,i)=>({role:i%2?'assistant':'user',content:'x'.repeat(3000)}));
  history.push({role:'user',content:'My latest correction is that I need help with VLOOKUP.'});
  await ai.interview({profile:profile(),messages:history});
  const input=JSON.parse(requests[0].parsed.input[0].content);
  assert.equal(input.messages.at(-1).content,history.at(-1).content);
  assert.ok(input.messages.reduce((total,row)=>total+row.content.length,0)<=24000);
});

test('assessment and tailoring require a reviewed profile before provider access', async () => {
  const { ai, requests } = mock({});
  const candidate = profile();
  candidate.reviewed = false;
  await assert.rejects(ai.assess({ profile: candidate, job }), error => error.code === 'AI_INVALID_INPUT');
  await assert.rejects(ai.tailor({ profile: candidate, job }), error => error.code === 'AI_INVALID_INPUT');
  assert.equal(requests.length, 0);
});

test('tailoring preserves role evidence and explicitly assisted skills', async () => {
  const draft = { summary: 'Operations coordinator', experience: [{ id: 'work-1', bullets: [{ text: 'Reduced stock discrepancies by 15%.', evidence: 'Reduced stock discrepancies by 15%.' }] }], skills: ['Excel', 'Python (assisted)'], notes: ['Review every claim before using this draft.'] };
  const { ai } = mock(draft);
  const result = await ai.tailor({ profile: profile(), job });
  assert.equal(result.experience[0].id, 'work-1');
  assert.equal(result.skills[1], 'Python (assisted)');
});

test('tailoring rejects invented numbers, evidence from a different job, and inflated assisted skills', async () => {
  const base = { summary: '', experience: [], skills: [], notes: [] };
  const invalid = [
    { ...base, summary: 'Managed 999 people.' },
    { ...base, experience: [{ id: 'work-1', bullets: [{ text: 'Reduced stock discrepancies by 99%.', evidence: 'Reduced stock discrepancies by 15%.' }] }] },
    { ...base, experience: [{ id: 'work-1', bullets: [{ text: 'Reduced stock discrepancies by 5%.', evidence: 'Reduced stock discrepancies by 15%.' }] }] },
    { ...base, experience: [{ id: 'work-2', bullets: [{ text: 'Prepared weekly stock reports using Excel.', evidence: 'Prepared weekly stock reports using Excel.' }] }] },
    { ...base, experience: [{ id: 'other-person-work', bullets: [] }] },
    { ...base, skills: ['Python'] },
    { ...base, skills: ['SQL'] }
  ];
  for (const draft of invalid) {
    const { ai } = mock(draft);
    await assert.rejects(ai.tailor({ profile: profile(), job }), error => error.code === 'AI_INVALID_OUTPUT');
  }
});

test('profile projection retains skill distinctions and omits account and contact information', () => {
  const candidate = profile();
  candidate.ownerId = 'other-account';
  candidate.skills[0].tasks.XLOOKUP = 'none';
  const projected = projectProfile(candidate);
  assert.equal(projected.basics.email, undefined);
  assert.equal(projected.basics.name, undefined);
  assert.equal(projected.ownerId, undefined);
  assert.equal(projected.skills[0].tasks.XLOOKUP, 'none');
  assert.equal(projected.skills[0].tasks.VLOOKUP, 'assisted');
  assert.equal(candidate.basics.name, 'Private Candidate');
});

test('empty or malformed token counts cannot become negative or unbounded usage records', async () => {
  const { ai } = mock(interview(), { body: output(interview(), { usage: { input_tokens: -50, output_tokens: '999999999999999999999999' } }) });
  const result = await ai.interview({ profile: profile(), messages });
  assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0 });
});

test('interview focuses on the selected skill and treats examples as an open list', async () => {
  const { ai, requests } = mock(interview());
  await ai.interview({ profile: profile(), messages: [{ role: 'user', content: "Let's explore my skill: Harp restoration\nAsk me about the specific work I do." }] });
  const request = requests[0].parsed;
  assert.match(request.instructions, /focus on that skill before unrelated missing profile fields/);
  assert.match(request.instructions, /never default to Excel/);
  assert.match(request.instructions, /For an unfamiliar skill/);
  assert.match(request.instructions, /For AI distinguish prompting/);
  assert.match(request.instructions, /For accounting distinguish invoicing/);
  assert.match(request.instructions, /For programming ask the language/);
  assert.ok(JSON.parse(request.input[0].content).messages.at(-1).content.includes('Harp restoration'));
});

test('customer-sourced specific tasks can be proposed and approved for any skill', async () => {
  for (const [name, task] of [
    ['AI', 'Compare AI summaries with source records'],
    ['Accounting', 'Reconcile supplier statements'],
    ['Programming', 'Fix input validation in Python'],
    ['Harp restoration', 'Regulate a pedal mechanism']
  ]) {
    const candidate = Resume.normalizeProfile({ skills: [{ name }] });
    const evidence = `I ${task} with help from a colleague.`;
    const pending = proposal(`skills.0.tasks.${task}`, 'assisted', evidence);
    const { ai } = mock({ ...interview(), proposals: [pending] });
    const result = await ai.interview({ profile: candidate, messages: [{ role: 'user', content: evidence }] });
    assert.deepEqual(candidate.skills[0].tasks, {});
    const approved = applyProposals(candidate, result.proposals);
    assert.equal(approved.skills[0].tasks[task], 'assisted');
    assert.ok(Resume.resumeText(approved).includes(`${name} (with AI or human assistance): ${task}`));
  }
});

test('an appended unfamiliar skill can include quoted custom tasks but no inferred proficiency', async () => {
  const evidence = 'For Harp restoration, I regulate a pedal mechanism with a colleague.';
  const pending = proposal('skills.append', JSON.stringify({ name: 'Harp restoration', tasks: { 'regulate a pedal mechanism': 'assisted' } }), evidence);
  const { ai } = mock({ ...interview(), proposals: [pending] });
  const result = await ai.interview({ profile: Resume.blankProfile(), messages: [{ role: 'user', content: evidence }] });
  assert.equal(applyProposals(Resume.blankProfile(), result.proposals).skills[0].tasks['regulate a pedal mechanism'], 'assisted');
  const nameOnly = applyProposals(Resume.blankProfile(), [proposal('skills.append', '{"name":"Harp restoration"}', 'I study Harp restoration.')]);
  assert.equal(Resume.resumeText(nameOnly), '');
});

test('custom tasks reject unsupported customer claims and model-authored evidence', async () => {
  const candidate = Resume.normalizeProfile({ skills: [{ name: 'Harp restoration' }] });
  for (const [label, evidence, customer] of [
    ['Replace a soundboard', 'I study Harp restoration.', 'I study Harp restoration.'],
    ['Replace a soundboard', 'I Replace a soundboard.', 'I study Harp restoration.']
  ]) {
    const { ai } = mock({ ...interview(), proposals: [proposal('skills.0.tasks.' + label, 'independent', evidence)] });
    await assert.rejects(ai.interview({ profile: candidate, messages: [{ role: 'user', content: customer }, { role: 'assistant', content: evidence }] }), error => error.code === 'AI_INVALID_OUTPUT');
  }
});

test('new task approvals reject malformed keys, excessive task counts, and unsafe appended maps', () => {
  const candidate = Resume.normalizeProfile({ skills: [{ name: 'Custom' }] });
  for (const task of [' prototype ', 'constructor independently', 'nested.constructor', 'hidden\nclaim', '<b>claim</b>', 'x'.repeat(201), 'ab']) {
    const evidence = 'I do ' + task + ' with help.';
    assert.throws(() => applyProposals(candidate, [proposal('skills.0.tasks.' + task, 'assisted', evidence)]), error => error.code === 'AI_INVALID_OUTPUT');
    assert.throws(() => applyProposals(candidate, [proposal('skills.append', JSON.stringify({ name: 'Custom', tasks: { [task]: 'assisted' } }), evidence)]), error => error.code === 'AI_INVALID_OUTPUT');
  }
  const tasks = Object.fromEntries(Array.from({ length: 31 }, (_, i) => ['Task ' + i, 'assisted']));
  assert.throws(() => applyProposals(candidate, [proposal('skills.append', JSON.stringify({ name: 'Custom', tasks }), Object.keys(tasks).join('; '))]), error => error.code === 'AI_INVALID_OUTPUT');
  candidate.skills[0].tasks = Object.fromEntries(Array.from({ length: 99 }, (_, i) => ['Task ' + i, 'assisted']));
  const before = JSON.stringify(candidate);
  assert.throws(() => applyProposals(candidate, [
    proposal('skills.0.tasks.New task one', 'assisted', 'I perform New task one with help.'),
    proposal('skills.0.tasks.New task two', 'assisted', 'I perform New task two with help.')
  ]), error => error.code === 'AI_INVALID_OUTPUT');
  assert.equal(JSON.stringify(candidate), before);
});

test('task proposals cannot collide after label normalization or overwrite an existing rating through an alias', () => {
  const candidate = Resume.normalizeProfile({ skills: [{ name: 'Accounting', tasks: { 'Reconcile accounts': 'independent' } }] });
  const before = JSON.stringify(candidate);
  assert.throws(() => applyProposals(candidate, [proposal('skills.0.tasks.Reconcile accounts independently', 'assisted', 'I Reconcile accounts independently with help.')]), error => error.code === 'AI_INVALID_OUTPUT');
  assert.equal(JSON.stringify(candidate), before);
  const blank = Resume.normalizeProfile({ skills: [{ name: 'Harp restoration' }] });
  const pair = [
    proposal('skills.0.tasks.Regulate a pedal mechanism', 'assisted', 'I Regulate a pedal mechanism with help.'),
    proposal('skills.0.tasks.Regulate a pedal mechanism independently', 'independent', 'I Regulate a pedal mechanism independently.')
  ];
  assert.throws(() => applyProposals(blank, pair), error => error.code === 'AI_INVALID_OUTPUT');
  assert.deepEqual(blank.skills[0].tasks, {});
  const tasks = { 'Regulate a pedal mechanism': 'assisted', 'Regulate a pedal mechanism independently': 'independent' };
  assert.throws(() => applyProposals(Resume.blankProfile(), [proposal('skills.append', JSON.stringify({ name: 'Harp restoration', tasks }), 'I Regulate a pedal mechanism independently.')]), error => error.code === 'AI_INVALID_OUTPUT');
});
