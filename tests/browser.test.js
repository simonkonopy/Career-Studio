'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { chromium } = require('playwright-core');
const mammoth = require('mammoth');
const { createApp } = require('../server');

let browser;
before(async () => {
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.CHROMIUM_PATH || (process.platform === 'darwin' && fs.existsSync(localChrome) ? localChrome : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
});
after(async () => browser?.close());
const posting = { id: 'sample-1', title: 'Inventory Coordinator', role: 'Inventory Coordinator', company: 'Example Goods', employer: 'Example Goods', url: 'https://remotive.com/remote-jobs/operations/example-1', link: 'https://remotive.com/remote-jobs/operations/example-1', description: 'Maintain inventory lists in Excel. Independently use VLOOKUP. Check the required location and current work authorization.', location: 'United States', pay: 'USD 65000–80000', source: 'Remotive', work_mode: 'remote' };
async function fixture(t, { enabled = false, width = 1440 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'career-browser-'));
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const config = { port, host: '127.0.0.1', origin: base, production: false, inviteCode: '', dataDir: directory, dailyLimit: 8, globalLimit: 80, concurrency: 3 };
  const ai = { enabled, async interview({ messages }) { return { message: 'Tell me how you maintained the stock lists.', questions: [{ question: 'Which Excel tasks can you repeat without help?', reason: 'Distinguish independent work from help.' }], proposals: [{ label: 'Describe the work you did', path: 'basics.summary', value: 'Maintained stock lists in Excel.', evidence: messages.at(-1).content }], usage: { inputTokens: 12, outputTokens: 20 } }; }, async assess() { return { summary: 'Your recordkeeping connects to this work. Confirm the remaining requirements.', relevance: 'possible', matches: [{ requirement: 'Inventory records', evidence: 'Maintained stock lists in Excel.' }], gaps: [{ requirement: 'Independent VLOOKUP', reason: 'Only assisted use is confirmed.' }], unknowns: ['Work authorization and location eligibility are not confirmed.'], questions: ['Can you use VLOOKUP independently?'], usage: { inputTokens: 12, outputTokens: 20 } }; }, async tailor({ profile }) { return { summary: profile.basics.summary, experience: [], skills: [], notes: ['Confirm work authorization directly with the employer.'], usage: { inputTokens: 10, outputTokens: 15 } }; } };
  const app = createApp({ config, ai, feed: async query => ({ jobs: !query || /inventory|excel/i.test(query) ? [posting] : [], source: 'Remotive', attribution: 'Remote jobs provided by Remotive' }) });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  await context.route(/^https?:/, route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  t.after(async () => { await context.close(); app.server.closeAllConnections(); await app.close(); fs.rmSync(directory, { recursive: true, force: true }); assert.deepEqual(errors, [], 'No client script errors'); });
  await page.goto(base);
  return { page, app, base, context };
}
async function signUp(page, email = 'alex@example.test') {
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('A private memorable phrase 27');
  await page.getByRole('button', { name: /Create your account/ }).click();
  await page.getByRole('heading', { name: 'Make your next move clearer.' }).waitFor();
  if (process.env.CAREER_SCREENSHOT_DIR && page.viewportSize().width >= 1000) { fs.mkdirSync(process.env.CAREER_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.CAREER_SCREENSHOT_DIR, 'career-studio-desktop.png'), fullPage: true }); }
}
const go = (page, name) => page.locator('.nav').getByRole('button', { name, exact: true }).click();
const tab = (page, name) => page.locator('.tabs').getByRole('button', { name, exact: true }).click();
async function save(page) { await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-save-state]')?.textContent === 'Saved to your account'); }
async function basicProfile(page) {
  await go(page, 'Your story');
  await page.getByLabel('Full name', { exact: true }).fill('Alex Example');
  await page.getByLabel('Contact email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('Professional headline', { exact: true }).fill('Inventory coordinator');
  await page.getByLabel('Your professional summary', { exact: true }).fill('Maintained inventory records in Excel.');
  await save(page);
}
async function review(page) { await tab(page, 'Review'); await page.getByRole('checkbox', { name: /I have reviewed these details/ }).check(); await save(page); }
async function stateOf(page) { return page.evaluate(async () => (await fetch('/api/state')).json()); }

test('demo opens a populated workspace without authentication, API traffic, or stored customer data',async t=>{
  const {page,app,context,base}=await fixture(t);
  await page.getByRole('heading',{name:'Welcome to your studio'}).waitFor();
  const apiRequests=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
  await page.getByRole('link',{name:'Explore demo'}).click();
  await page.getByRole('heading',{name:'Welcome back, Jamie.'}).waitFor();
  assert.match(await page.locator('.demo-banner').innerText(),/Fictional sample data.*AI responses are simulated/s);
  assert.equal(await page.locator('.stats .stat').nth(0).locator('strong').innerText(),'2');
  assert.equal(await page.locator('.stats .stat').nth(2).locator('strong').innerText(),'4');
  assert.equal(await page.locator('.activity-card').count(),3);
  await go(page,'Interview');
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await page.getByPlaceholder('Share an example, answer a question, or tell us what to explore next…').fill('Can you ask more about Excel?');
  await page.locator('form[data-form="interview"]').getByRole('button',{name:/Send/}).click();
  await page.getByText(/This is a scripted demo response/).waitFor();
  await go(page,'Find jobs');
  await page.getByRole('heading',{name:'Inventory Coordinator',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Remotive',exact:true}).count(),0);
  assert.equal(await page.getByText('Sample job',{exact:true}).count(),6);
  await go(page,'Resumes');
  assert.equal(await page.getByRole('button',{name:'Download text',exact:true}).count(),2);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download text',exact:true}).first().click();
  const downloaded=await downloadEvent;assert.match(fs.readFileSync(await downloaded.path(),'utf8'),/Jamie Morgan/);
  await page.getByRole('button',{name:'Your account',exact:true}).click();
  await page.getByRole('heading',{name:'A workspace to explore.'}).waitFor();
  assert.equal(await page.locator('a[href^="/api/"]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Delete my account',exact:true}).count(),0);
  assert.deepEqual(apiRequests,[]);assert.deepEqual(await context.cookies(),[]);
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM users').get().n,0);
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM requests').get().n,0);
  assert.equal((await page.request.get(base+'/api/state')).status(),401);
});

test('demo edits stay in the tab, reset on reload, and fit a mobile screen',async t=>{
  const {page,app,base}=await fixture(t,{width:390});
  await page.goto(base+'/demo');await page.getByRole('heading',{name:'Welcome back, Jamie.'}).waitFor();
  await go(page,'Your story');await page.getByLabel('Full name',{exact:true}).fill('Temporary preview name');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-save-state]')?.textContent==='Saved for this preview');
  await go(page,'Overview');await page.getByRole('heading',{name:'Welcome back, Temporary.'}).waitFor();
  await page.getByRole('button',{name:'Reset demo',exact:true}).click();
  await page.getByRole('heading',{name:'Welcome back, Jamie.'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await go(page,'Your story');await tab(page,'Skills');
  assert.equal(await page.getByLabel('VLOOKUP',{exact:true}).inputValue(),'assisted');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM profiles').get().n,0);
});

test('demo interviews explore AI, accounting, programming, and a custom skill without assigning proficiency or calling APIs', async t => {
  const { page, app, base, context } = await fixture(t, { width: 390 });
  await page.getByRole('heading', { name: 'Welcome to your studio' }).waitFor();
  const apiRequests = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  await page.goto(base + '/demo'); await go(page, 'Interview');
  await page.getByRole('heading', { name: 'What would you like to explore?' }).waitFor();
  const chooser = page.locator('form[data-form="interview-skill"]');
  for (const [name, expected] of [['AI tools', /prompts|outputs|AI-generated/i], ['Accounting', /invoices|payments|reconcile/i], ['Programming', /program|code|script/i], ['Calligraphy', /specific activities.*Calligraphy.*tools or methods/i]]) {
    await page.getByLabel('Skill to explore', { exact: true }).fill(name);
    await chooser.getByRole('button', { name: 'Ask about this skill', exact: true }).click();
    await page.waitForFunction(name => document.querySelector('#messages .assistant:last-child')?.textContent.includes('scripted demo response about ' + name), name);
    const last = page.locator('#messages .assistant').last();
    assert.match(await last.innerText(), expected);
    assert.match(await last.innerText(), /do not verify your skill or add claims/);
    assert.doesNotMatch(await last.innerText(), /VLOOKUP|stock lists/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  }
  await page.getByLabel('Your answer', { exact: true }).fill('I use a pointed nib to address wedding envelopes. A tutor helps me with spacing.');
  await page.locator('form[data-form="interview"]').getByRole('button', { name: /Send/ }).click();
  await page.waitForFunction(() => document.querySelector('#messages .assistant:last-child')?.textContent.includes('Describe one real example of Calligraphy'));
  assert.match(await page.locator('#messages .assistant').last().innerText(), /without AI or another person/);
  await page.getByLabel('Your answer', { exact: true }).fill('I addressed invitations for a family event and checked every name against the list.');
  await page.locator('form[data-form="interview"]').getByRole('button', { name: /Send/ }).click();
  await page.waitForFunction(() => document.querySelector('#messages .assistant:last-child')?.textContent.includes('When did you last use Calligraphy'));
  await go(page, 'Your story'); await tab(page, 'Skills');
  assert.equal(await page.getByRole('heading', { name: 'Calligraphy', exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'AI tools', exact: true }).count(), 0);
  assert.deepEqual(apiRequests, []); assert.deepEqual(await context.cookies(), []);
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM users').get().n, 0);
});

test('customer-confirmed tasks for any skill persist and only supported levels appear on the resume', async t => {
  const { page } = await fixture(t); await signUp(page); await basicProfile(page); await tab(page, 'Skills');
  const examples = [
    ['AI tools', 'Check AI summaries against source documents', 'independent'],
    ['Accounting', 'Reconcile supplier statements in QuickBooks', 'assisted'],
    ['Programming', 'Write a file-renaming script in Python', 'learning'],
    ['Calligraphy', 'Address invitations with a pointed nib', 'independent'],
    ['Unassessed skill', '', '']
  ];
  for (const [name, task, level] of examples) {
    await page.getByLabel('Skill or tool name', { exact: true }).fill(name); await page.getByRole('button', { name: '+ Add skill', exact: true }).click();
    const card = page.locator('.record').filter({ has: page.getByRole('heading', { name, exact: true }) });
    assert.ok((await card.locator('[data-skill-index]').evaluateAll(nodes => nodes.map(node => node.value))).every(value => value === ''));
    assert.equal(await card.getByLabel('Your level for this task', { exact: true }).inputValue(), '');
    if (!task) continue;
    await card.getByLabel('Add a specific task', { exact: true }).fill(task);
    await card.getByLabel('Your level for this task', { exact: true }).selectOption(level);
    await card.getByRole('button', { name: 'Add task', exact: true }).click();
    await card.getByLabel('A real example', { exact: true }).fill(`My example: ${task}.`);
  }
  await save(page); await page.reload(); await go(page, 'Your story'); await tab(page, 'Skills');
  for (const [name, task, level] of examples) {
    const card = page.locator('.record').filter({ has: page.getByRole('heading', { name, exact: true }) });
    if (task) assert.equal(await card.getByLabel(task, { exact: true }).inputValue(), level);
  }
  const saved = (await stateOf(page)).profile;
  assert.deepEqual(saved.skills.find(skill => skill.name === 'Unassessed skill').tasks, {});
  assert.deepEqual(saved.skills.find(skill => skill.name === 'Programming').tasks, { 'Write a file-renaming script in Python': 'learning' });
  await review(page); await go(page, 'Resumes'); await page.getByLabel('Resume title').fill('Confirmed skills resume');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click(); await page.getByRole('button', { name: 'Approve this version' }).waitFor();
  const resume = (await stateOf(page)).resumes[0].text;
  assert.match(resume, /Check AI summaries against source documents/);
  assert.match(resume, /Reconcile supplier statements in QuickBooks.*assist|assist.*Reconcile supplier statements in QuickBooks/i);
  assert.match(resume, /Address invitations with a pointed nib/);
  assert.doesNotMatch(resume, /Write a file-renaming script|Unassessed skill|Deploy and maintain applications/);
});

test('task editing rejects normalized duplicates and preserves an over-limit choice until space is available', async t => {
  const { page } = await fixture(t); await signUp(page); await basicProfile(page); await tab(page, 'Skills');
  await page.getByLabel('Skill or tool name', { exact: true }).fill('Accounting'); await page.getByRole('button', { name: '+ Add skill', exact: true }).click();
  await page.getByLabel('Reconcile accounts', { exact: true }).selectOption('independent');
  await page.getByLabel('Add a specific task', { exact: true }).fill('Reconcile accounts independently');
  await page.getByLabel('Your level for this task', { exact: true }).selectOption('assisted');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'That task is already listed' }).waitFor();
  assert.equal(await page.getByLabel('Add a specific task', { exact: true }).inputValue(), 'Reconcile accounts independently');
  assert.equal(await page.getByLabel('Your level for this task', { exact: true }).inputValue(), 'assisted');
  assert.equal(await page.getByLabel('Reconcile accounts', { exact: true }).inputValue(), 'independent');
  await save(page); assert.deepEqual((await stateOf(page)).profile.skills[0].tasks, { 'Reconcile accounts': 'independent' });
  await page.evaluate(async () => {
    const session = await (await fetch('/api/session')).json(), saved = await (await fetch('/api/state')).json();
    saved.profile.skills[0].tasks = Object.fromEntries(Array.from({ length: 100 }, (_, index) => ['Original task ' + (index + 1), 'independent']));
    const result = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({ profile: saved.profile, revision: saved.revision }) });
    if (!result.ok) throw new Error('Unable to seed the task-limit fixture');
  });
  await page.reload(); await go(page, 'Your story'); await tab(page, 'Skills');
  await page.getByLabel('Reconcile accounts', { exact: true }).selectOption('assisted');
  await page.getByRole('alert').filter({ hasText: 'This skill already has 100 rated tasks' }).waitFor();
  assert.equal(await page.getByLabel('Reconcile accounts', { exact: true }).inputValue(), 'assisted');
  assert.equal(await page.getByRole('button', { name: 'Save this task', exact: true }).count(), 1);
  await go(page, 'Overview'); await go(page, 'Your story');
  assert.equal(await page.getByLabel('Reconcile accounts', { exact: true }).inputValue(), 'assisted');
  const unchanged = (await stateOf(page)).profile.skills[0].tasks;
  assert.equal(Object.keys(unchanged).length, 100); assert.equal(unchanged['Reconcile accounts'], undefined);
  await page.getByLabel('Original task 1', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save this task', exact: true }).click(); await save(page);
  const finalTasks = (await stateOf(page)).profile.skills[0].tasks;
  assert.equal(Object.keys(finalTasks).length, 100); assert.equal(finalTasks['Reconcile accounts'], 'assisted'); assert.equal(finalTasks['Original task 1'], undefined);
  assert.equal(await page.getByRole('button', { name: 'Save this task', exact: true }).count(), 0);
});

test('public job listings are available before sign-in and private data is absent', async t => {
  const { page } = await fixture(t);
  assert.doesNotMatch(await page.content(), /CANDIDATE_BRIEF|applications\.csv|board_changelog/);
  await page.getByRole('button', { name: 'Browse public jobs' }).click();
  await page.getByRole('heading', { name: 'Inventory Coordinator', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Remotive', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Save opportunity', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome to your studio' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length), 0);
});

test('manual customer journey builds granular skills, approves an immutable resume, and downloads Word', async t => {
  const { page } = await fixture(t); await signUp(page); await basicProfile(page);
  await tab(page, 'Work'); await page.getByRole('button', { name: '+ Add work', exact: true }).click();
  await page.getByLabel('Job title / role', { exact: true }).fill('Stockroom Coordinator');
  await page.getByLabel('Employer / organization', { exact: true }).fill('Example Goods');
  await page.getByLabel('What did you actually do?', { exact: true }).fill('Maintained weekly stock records.');
  await tab(page, 'Skills');
  await page.getByLabel('Skill or tool name').fill('Excel'); await page.getByRole('button', { name: '+ Add skill', exact: true }).click();
  await page.getByLabel('Basic formulas (SUM, AVERAGE, IF)', { exact: true }).selectOption('independent');
  await page.getByLabel('VLOOKUP', { exact: true }).selectOption('assisted');
  await page.getByLabel('Pivot tables', { exact: true }).selectOption('learning');
  await page.getByLabel('A real example', { exact: true }).fill('I summed stock counts myself and asked a colleague for lookup help.');
  await review(page);
  if (process.env.CAREER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.CAREER_SCREENSHOT_DIR, 'career-studio-profile.png'), fullPage: true });
  const profile = (await stateOf(page)).profile;
  assert.equal(profile.skills[0].tasks.VLOOKUP, 'assisted');
  assert.equal(profile.reviewed, true);
  await go(page, 'Resumes'); await page.getByLabel('Resume title').fill('Operations resume'); await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await page.getByRole('button', { name: 'Approve this version' }).waitFor();
  await page.getByRole('button', { name: 'Approve this version' }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download Word', exact: true }).click(); const download = await downloadPromise;
  const result = await mammoth.extractRawText({ path: await download.path() });
  assert.match(result.value, /Alex Example/); assert.match(result.value, /VLOOKUP/); assert.match(result.value, /assist|help/i); assert.doesNotMatch(result.value, /Pivot tables/);
  assert.equal(await page.getByRole('button', { name: 'Approve this version' }).count(), 0);
  const saved = await stateOf(page); assert.equal(saved.resumes[0].approved, true); assert.equal(saved.usage.used, 0);
});

test('resume upload preserves original text, requires review, and escapes untrusted content', async t => {
  const { page } = await fixture(t); await signUp(page);
  await page.getByRole('button', { name: 'Upload a resume', exact: true }).click();
  const text = 'Jamie Sample\njamie@example.test\nSUMMARY\nMaintained customer records.\nEXPERIENCE\nSupport Specialist | Sample Goods | 2021 - Present\n- Used Excel and answered customer questions.\nSKILLS\nExcel, SQL\n<script>window.badUpload=true</script>';
  await page.getByLabel('Upload PDF, Word, or text resume').setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.getByRole('heading', { name: 'Make sure it reflects you.' }).waitFor();
  const saved = await stateOf(page); assert.equal(saved.profile.reviewed, false); assert.match(saved.profile.importedText, /window.badUpload/);
  assert.deepEqual(saved.profile.skills[0].tasks, {}); assert.equal(await page.evaluate(() => window.badUpload), undefined);
  await go(page, 'Resumes'); assert.equal(await page.getByRole('button', { name: 'Create draft', exact: true }).isDisabled(), true);
});

test('AI interview requires consent and leaves changes pending until accepted', async t => {
  const { page } = await fixture(t, { enabled: true }); await signUp(page); await basicProfile(page);
  await go(page, 'Interview'); assert.equal(await page.getByLabel('Your answer', { exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Enable my interview guide', exact: true }).click();
  await page.getByLabel('Your answer', { exact: true }).fill('I maintained weekly stock lists in Excel, with help for VLOOKUP.');
  await page.getByRole('button', { name: 'Send →', exact: true }).click();
  await page.getByRole('heading', { name: 'Describe the work you did' }).waitFor();
  if (process.env.CAREER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.CAREER_SCREENSHOT_DIR, 'career-studio-interview.png'), fullPage: true });
  assert.equal((await stateOf(page)).profile.basics.summary, 'Maintained inventory records in Excel.');
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.proposal'));
  const saved = await stateOf(page); assert.equal(saved.profile.basics.summary, 'Maintained stock lists in Excel.'); assert.equal(saved.interview.proposals[0].status, 'accepted'); assert.equal(saved.usage.used, 1);
  await go(page, 'Your story'); await review(page); await go(page, 'Find jobs'); await page.getByRole('button', { name: 'Review my fit' }).click();
  await page.getByText('Known gaps to consider', { exact: true }).waitFor(); assert.equal(await page.getByText('Work authorization and location eligibility are not confirmed.', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Create a tailored resume', exact: true }).click();
  await page.getByRole('button', { name: 'Approve this version', exact: true }).waitFor();
  assert.equal((await stateOf(page)).usage.used, 3);
});

test('saved opportunities persist with notes, stage, follow-up, and approved resume reference', async t => {
  const { page } = await fixture(t); await signUp(page); await go(page, 'Find jobs');
  await page.getByRole('button', { name: 'Save opportunity', exact: true }).click();
  await page.getByRole('button', { name: '✓ Saved', exact: true }).waitFor();
  await go(page, 'Applications');
  await page.getByLabel('Stage', { exact: true }).selectOption('interview');
  await page.getByLabel('Follow up on', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Your notes', { exact: true }).fill('Prepare an example of reconciling stock records.');
  await page.getByRole('button', { name: 'Save updates', exact: true }).click();
  await page.reload(); await go(page, 'Applications');
  assert.equal(await page.getByLabel('Stage', { exact: true }).inputValue(), 'interview');
  assert.equal(await page.getByLabel('Follow up on', { exact: true }).inputValue(), '2026-10-01');
  assert.match(await page.getByLabel('Your notes', { exact: true }).inputValue(), /reconciling stock/);
});

test('accounts remain separate and signed-in data persists after signing out', async t => {
  const { page } = await fixture(t); await signUp(page); await basicProfile(page);
  await go(page, 'Find jobs'); await page.getByRole('button', { name: 'Add a job posting', exact: true }).click();
  await page.getByLabel('Job title', { exact: true }).fill('Private referral for Alex');
  await page.getByLabel('Company', { exact: true }).fill('Confidential Referral Company');
  await page.getByLabel('Full job description and requirements', { exact: true }).fill('A private referral discussed with Alex. Maintain stock records in Excel.');
  await page.getByRole('button', { name: 'Add posting', exact: true }).click();
  await page.getByRole('heading', { name: 'Private referral for Alex', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Your account', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signUp(page, 'second@example.test');
  assert.equal((await stateOf(page)).profile.basics.name, '');
  await go(page, 'Find jobs'); await page.getByRole('heading', { name: 'Inventory Coordinator', exact: true }).waitFor();
  assert.doesNotMatch(await page.content(), /Private referral for Alex|Confidential Referral Company/);
  await page.getByRole('button', { name: 'Your account', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.test'); await page.getByLabel('Password', { exact: true }).fill('A private memorable phrase 27');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back, Alex.' }).waitFor();
  assert.equal((await stateOf(page)).profile.basics.name, 'Alex Example'); assert.equal(await page.evaluate(() => localStorage.length), 0);
});

test('a stale tab preserves its profile draft instead of overwriting a newer saved profile', async t => {
  const { page, context, base } = await fixture(t); await signUp(page); await basicProfile(page);
  const second = await context.newPage(); second.on('dialog', dialog => dialog.accept()); await second.goto(base); await go(second, 'Your story');
  await page.getByLabel('Full name', { exact: true }).fill('Alex Newer'); await save(page);
  await second.getByLabel('Full name', { exact: true }).fill('Alex Draft'); await second.getByRole('button', { name: 'Save changes', exact: true }).click();
  await second.getByRole('button', { name: 'Download my draft', exact: true }).waitFor();
  assert.equal(await second.getByLabel('Full name', { exact: true }).inputValue(), 'Alex Draft');
  assert.equal((await stateOf(page)).profile.basics.name, 'Alex Newer');
  const downloadPromise = second.waitForEvent('download'); await second.getByRole('button', { name: 'Download my draft', exact: true }).click(); const download = await downloadPromise;
  assert.equal(JSON.parse(fs.readFileSync(await download.path(), 'utf8')).profile.basics.name, 'Alex Draft');
  await second.getByRole('button', { name: 'Load saved profile', exact: true }).click(); await second.waitForFunction(() => document.querySelector('#field-basics-name')?.value === 'Alex Newer');
});

test('the customer interface fits a narrow screen and preserves readable skill controls', async t => {
  const { page } = await fixture(t, { width: 390 }); await signUp(page);
  const screenshotDir = process.env.CAREER_SCREENSHOT_DIR; if (screenshotDir) { fs.mkdirSync(screenshotDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotDir, 'career-studio-mobile.png'), fullPage: true }); }
  await basicProfile(page); await tab(page, 'Skills'); await page.getByLabel('Skill or tool name').fill('Excel'); await page.getByRole('button', { name: '+ Add skill', exact: true }).click();
  await page.getByLabel('VLOOKUP', { exact: true }).selectOption('assisted'); await save(page);
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth })); assert.ok(layout.content <= layout.width, JSON.stringify(layout));
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'career-studio-skills-mobile.png'), fullPage: true });
});
