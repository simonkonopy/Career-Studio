/* Fictional, disposable product walkthrough. This adapter makes no network calls. */
(() => {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
  const date = offset => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString(); };
  const day = offset => date(offset).slice(0, 10);
  const error = (message, status = 400) => { const problem = new Error(message); problem.status = status; problem.code = 'DEMO_PREVIEW'; return problem; };

  function create(Model) {
    const profile = Model.normalizeProfile({
      basics: { name: 'Jamie Morgan', email: 'jamie@example.test', phone: '', location: 'Chicago, Illinois', headline: 'Operations & inventory coordinator', summary: 'Operations coordinator with experience keeping inventory accurate, supporting purchasing, and helping small teams run smoothly. Comfortable maintaining Excel reports and improving everyday workflows.' },
      experience: [
        { id: 'demo-work-1', employer: 'Northline Goods · sample company', title: 'Operations Coordinator', location: 'Chicago, Illinois', start: '2021', current: true, responsibilities: 'Maintain stock records for 1,800 SKUs. Coordinate purchase orders, supplier updates, and weekly cycle counts. Train new team members on receiving procedures.', achievements: 'Reduced recurring stock discrepancies by 12% after introducing a weekly reconciliation checklist.', tools: 'Excel, inventory management software, purchase orders', teamSize: 'Train and coordinate three team members; no formal direct reports.' },
        { id: 'demo-work-2', employer: 'Juniper Home · sample company', title: 'Customer Operations Associate', location: 'Chicago, Illinois', start: '2018', end: '2021', responsibilities: 'Resolved order questions, coordinated returns, and maintained customer records. Shared recurring issues with the warehouse team.', achievements: 'Wrote an order-exception guide used to onboard new colleagues.', tools: 'Customer records, shared inbox, spreadsheets', teamSize: 'Individual contributor' }
      ],
      education: [{ id: 'demo-school-1', school: 'Lakeside Community College · sample school', degree: 'Associate degree', field: 'Business Administration', start: '2016', end: '2018', details: 'Completed. Coursework included business communication and accounting fundamentals.' }],
      skills: [
        { id: 'demo-skill-excel', name: 'Excel', tasks: { 'Basic data entry and formatting': 'independent', 'Sort, filter, and maintain lists': 'independent', 'Basic formulas (SUM, AVERAGE, IF)': 'independent', VLOOKUP: 'assisted', XLOOKUP: 'none', 'Pivot tables': 'learning', 'Charts and reporting': 'independent' }, evidence: 'I keep stock lists accurate, use SUM and IF, and create a weekly chart. A colleague helps me build VLOOKUP formulas.', years: 'Weekly for five years', lastUsed: 'This week', context: 'Independent with everyday reports; colleague assistance for lookup formulas.' },
        { id: 'demo-skill-inventory', name: 'Inventory management', tasks: { 'Receive and count stock': 'independent', 'Maintain SKU and location records': 'independent', 'Investigate count discrepancies': 'independent', 'Set reorder points and safety stock': 'assisted' }, evidence: 'Investigated recurring differences between physical counts and inventory records, then introduced a weekly checklist.', years: 'Five years', lastUsed: 'This week', context: 'A small consumer-goods warehouse with 1,800 SKUs.' },
        { id: 'demo-skill-procurement', name: 'Procurement', tasks: { 'Create purchase orders': 'independent', 'Source and compare suppliers': 'independent', 'Manage MOQs and lead times': 'independent', 'Negotiate pricing and payment terms': 'assisted' }, evidence: 'Compare supplier quotes and delivery dates, create purchase orders, and flag late orders.', years: 'Four years', lastUsed: 'This month', context: 'The operations manager approves final pricing and contracts.' },
        { id: 'demo-skill-comms', name: 'Communication', tasks: { 'Write clear emails and updates': 'independent', 'Listen and clarify requirements': 'independent', 'Explain complex information to a non-specialist': 'independent' }, evidence: 'Write supplier updates and explain receiving procedures to new colleagues.', years: 'Eight years', lastUsed: 'Daily', context: 'Customers, suppliers, and warehouse colleagues.' }
      ],
      extras: { projects: 'Created a weekly inventory reconciliation checklist and a short receiving guide.', languages: 'English — fluent; Spanish — conversational', volunteering: 'Monthly community food-pantry stock sorting.' },
      preferences: { roles: 'Inventory coordinator, purchasing coordinator, operations coordinator', location: 'Chicago, Illinois', workMode: 'any', minSalary: '60000', currency: 'USD', employmentType: 'full_time', schedule: 'Weekdays; daytime hours preferred', excluded: 'Commission-only sales', relocation: 'Not currently considering relocation' },
      reviewed: true
    });
    const makeJob = (id, title, company, location, pay, workMode, description) => ({ id, title, role: title, company, employer: company, location, pay, salary: pay, work_mode: workMode, employment_type: 'full_time', description, source: 'Demo sample', url: '', link: '', fit_level: 'UNVERIFIED', isDemo: true });
    const jobs = [
      makeJob('demo-job-1', 'Inventory Coordinator', 'Cedar & Co.', 'Chicago, IL · Hybrid', 'USD 62,000–74,000', 'hybrid', 'FICTIONAL SAMPLE POSTING. Maintain stock records, investigate cycle-count differences, and coordinate with receiving. Requires inventory experience and basic Excel formulas. Weekday schedule. Advanced reporting is preferred, not required.'),
      makeJob('demo-job-2', 'Purchasing Coordinator', 'Harborfield Supply', 'Remote · United States', 'USD 64,000–78,000', 'remote', 'FICTIONAL SAMPLE POSTING. Prepare purchase orders, compare supplier quotes, track delivery dates, and communicate order updates. Requires purchasing support experience and clear written communication. Confirm state eligibility and working hours.'),
      makeJob('demo-job-3', 'Operations Specialist', 'Willow Commerce', 'Chicago, IL · On-site', 'USD 60,000–72,000', 'onsite', 'FICTIONAL SAMPLE POSTING. Support daily order workflows, maintain procedures, and help train colleagues. Requires operations coordination, process documentation, and Excel. Monday through Friday daytime hours; exact location needs confirmation.'),
      makeJob('demo-job-4', 'Supply Chain Analyst', 'Summit Works', 'Remote · United States', 'USD 78,000–92,000', 'remote', 'FICTIONAL SAMPLE POSTING. Analyze inventory and supplier performance. Requires independent SQL, advanced Excel lookup formulas, and pivot tables. A bachelor’s degree or equivalent analytical experience is required.'),
      makeJob('demo-job-5', 'Vendor Operations Coordinator', 'Brightway Retail', 'Chicago, IL · Hybrid', 'USD 65,000–76,000', 'hybrid', 'FICTIONAL SAMPLE POSTING. Coordinate vendor records, purchase orders, and delivery exceptions. Requires supplier communication, attention to detail, and two years of operations support. Confirm the required software and office schedule.'),
      makeJob('demo-job-6', 'Customer Operations Coordinator', 'Mapleline Studio', 'Remote · United States', 'USD 58,000–66,000', 'remote', 'FICTIONAL SAMPLE POSTING. Resolve order exceptions, maintain customer records, and coordinate returns. Requires customer service and accurate recordkeeping. Starting base pay and state eligibility need confirmation.')
    ];
    const resumeText = Model.resumeText(profile);
    const resumes = [
      { id: 'demo-resume-1', title: 'Operations & inventory · Master resume', text: resumeText, approved: true, createdAt: date(-4), job: null, notes: [] },
      { id: 'demo-resume-2', title: 'Cedar & Co. · Inventory Coordinator', text: resumeText.replace(profile.basics.summary, 'Inventory coordinator with experience maintaining stock records, investigating count discrepancies, and supporting receiving teams. Uses everyday Excel formulas independently and lookup formulas with colleague assistance.'), approved: true, createdAt: date(-2), job: jobs[0], notes: [] },
      { id: 'demo-resume-3', title: 'Harborfield · Purchasing Coordinator', text: resumeText.replace(profile.basics.summary, 'Purchasing and operations coordinator with experience comparing supplier quotes, tracking delivery dates, and maintaining accurate purchase orders.'), approved: false, createdAt: date(-1), job: jobs[1], notes: ['Sample draft: confirm the employer’s remote-state requirements before applying.', 'Keep independent Excel tasks separate from lookup formulas completed with help.'] }
    ];
    const applications = [
      { id: 'demo-app-1', job: jobs[0], stage: 'interview', notes: 'Sample: conversation with the operations lead on Thursday. Prepare the cycle-count improvement example.', followUpDate: day(1), resumeId: 'demo-resume-2', createdAt: date(-7), updatedAt: date(-1) },
      { id: 'demo-app-2', job: jobs[1], stage: 'applied', notes: 'Sample: application submitted. Confirm remote eligibility for Illinois.', followUpDate: day(2), resumeId: 'demo-resume-1', createdAt: date(-3), updatedAt: date(-3) },
      { id: 'demo-app-3', job: jobs[2], stage: 'screening', notes: 'Sample: recruiter asked about availability and experience training new colleagues.', followUpDate: day(0), resumeId: 'demo-resume-1', createdAt: date(-6), updatedAt: date(-1) },
      { id: 'demo-app-4', job: jobs[4], stage: 'saved', notes: 'Sample: review the required purchasing software before applying.', followUpDate: day(3), resumeId: null, createdAt: date(-1), updatedAt: date(-1) }
    ];
    const state = {
      profile, revision: 0, applications, resumes,
      interview: {
        messages: [
          { id: 'demo-message-1', role: 'assistant', content: 'We can explore any skill: AI, accounting, programming, trades, and more. Here is one sample conversation about Excel. What can you do yourself, and where do you need a colleague or AI to help?', questions: [], createdAt: date(-1) },
          { id: 'demo-message-2', role: 'user', content: 'I maintain stock lists, use SUM and IF, and make a weekly chart. A colleague helps with VLOOKUP. I’m still learning pivot tables.', questions: [], createdAt: date(-1) },
          { id: 'demo-message-3', role: 'assistant', content: 'That distinction makes your resume more accurate. We can describe everyday Excel reporting as independent and lookup formulas as assisted. Here is an example suggestion for you to review.', questions: [{ question: 'What decision did the weekly report help your team make?', reason: 'A concrete example explains the value of the skill.' }], createdAt: date(-1) }
        ],
        proposals: [{ id: 'demo-proposal-1', label: 'Clarify your Excel experience', path: 'skills.0.evidence', value: 'Maintain stock lists, use SUM and IF, and create a weekly chart independently. Build VLOOKUP formulas with colleague assistance; currently learning pivot tables.', evidence: 'I maintain stock lists, use SUM and IF, and make a weekly chart. A colleague helps with VLOOKUP. I’m still learning pivot tables.', status: 'pending', revision: 0, createdAt: date(-1) }]
      },
      usage: { used: 7, limit: 40, remaining: 33, resetsAt: date(1) }, ai: { enabled: true, consent: true }, demo: true
    };
    const session = { user: { id: 'demo-customer', email: 'jamie@example.test' }, csrfToken: '', ai: { enabled: true }, signupAllowed: false, inviteRequired: false, demo: true };
    const receipts = new Map();
    let interviewTopic = '', interviewTurn = 0;
    function interviewReply(content) {
      const selected = content.match(/^Let's explore my skill: ([^\n]+)/i);
      const named = !selected && content.match(/(?:ask(?: me)?(?: more)? about|talk about|discuss|go deeper (?:on|into)|explore (?:my )?skill:?|my skill is|I (?:also )?know)\s+([^?!.\n]{1,200})/i);
      const detected = Model.detectSkills(content);
      const mentioned = named && (Model.detectSkills(named[1])[0] || named[1]);
      const topic = (selected?.[1] || mentioned || (!interviewTopic && detected[0]) || '').trim().slice(0, 200);
      if (topic && (selected || topic.toLowerCase() !== interviewTopic.toLowerCase())) { interviewTopic = topic; interviewTurn = 0; }
      const name = interviewTopic;
      const saved = state.profile.skills.find(skill => skill.name.toLowerCase() === name.toLowerCase());
      const prompts = Model.skillInterviewQuestions(saved || name);
      let question;
      if (!name) question = 'Which skill would you like to explore? Name any skill or tool, then tell me one task you have used it for.';
      else if (interviewTurn < prompts.length) question = prompts[interviewTurn];
      else if (interviewTurn % 2) question = `For that ${name} task, which steps can you repeat independently? Which parts require AI, a template, or another person, and how do you verify the result?`;
      else question = `What is another specific ${name} task you have actually done? Describe the tool or method, one difficult part, and what changed because of your contribution.`;
      interviewTurn++;
      return { content: `This is a scripted demo response${name ? ` about ${name}` : ''}. These questions illustrate the interview; they do not verify your skill or add claims to your profile.`, questions: [{ question, reason: 'A skill name alone does not establish proficiency. Concrete tasks, evidence, and assistance make the resume accurate.' }] };
    }
    function count() { state.usage.used += 1; state.usage.remaining = Math.max(0, state.usage.limit - state.usage.used); }
    function assess(job) {
      const text = `${job.title || job.role} ${job.description || ''}`;
      const advanced = /analyst|independent SQL|advanced Excel/i.test(text);
      return {
        summary: advanced ? 'Sample review: inventory knowledge is relevant, but the required independent analytical skills are not supported by this sample profile.' : 'Sample review: the profile connects to this role through inventory records, order coordination, and supplier communication. Confirm the practical requirements before applying.',
        relevance: advanced ? 'weak' : /inventory/i.test(job.title || job.role) ? 'strong' : 'possible',
        matches: [{ requirement: 'Inventory and operations coordination', evidence: 'Maintain stock records for 1,800 SKUs. Coordinate purchase orders, supplier updates, and weekly cycle counts.' }, { requirement: 'Everyday spreadsheet work', evidence: 'Basic formulas and maintaining lists are recorded as independent.' }],
        gaps: advanced ? [{ requirement: 'Independent SQL and advanced Excel', reason: 'SQL is not documented. VLOOKUP is assisted and pivot tables are still being learned.' }] : [],
        unknowns: ['This is a fictional posting, not an active opening.', 'Exact location, work authorization, software requirements, and guaranteed starting salary need employer confirmation.'],
        questions: advanced ? ['Would you like to focus on coordinator roles while building analytical skills?'] : ['Which example best demonstrates the work this role needs?']
      };
    }
    const initialAssessments = jobs.slice(0, 4).map(job => ({ job: copy(job), assessment: assess(job) }));
    function mutateProfile(path, value) {
      const parts = path.split('.');
      if (parts.some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) throw error('This sample change is unavailable.');
      let target = state.profile;
      for (const part of parts.slice(0, -1)) { if (!Object.hasOwn(target, part)) throw error('The sample profile changed. Reset the demo to try this suggestion again.'); target = target[part]; }
      if (!Object.hasOwn(target, parts.at(-1))) throw error('The sample profile changed.');
      target[parts.at(-1)] = value; state.profile.reviewed = false; state.revision++;
    }
    async function request(url, options = {}) {
      const route = url.split('?')[0], method = options.method || 'GET', body = options.body || {};
      if (route === '/api/session') return copy(session);
      if (route === '/api/state') return copy(state);
      if (route === '/api/jobs' && method === 'GET') {
        const query = new URLSearchParams(url.split('?')[1] || '').get('search') || '';
        const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
        return copy({ jobs: jobs.filter(job => !words.length || words.some(word => `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(word))), source: 'Fictional sample jobs', attribution: 'Demo opportunities for exploring the product; not live job listings.', notice: 'Fictional sample data', total: jobs.length, fetchedAt: date(0) });
      }
      if (route === '/api/profile' && method === 'PUT') {
        if (body.revision !== state.revision) throw error('The demo profile changed. Reload the preview to reset it.', 409);
        state.profile = Model.normalizeProfile(body.profile); state.revision++; return copy({ profile: state.profile, revision: state.revision });
      }
      if (route === '/api/consent') { state.ai.consent = body.enabled === true; return copy(state); }
      if (route === '/api/interview') {
        if (receipts.has(body.requestId)) return copy(state);
        const content = String(body.message || '').slice(0, 6000).trim();
        if (!content) throw error('Try a sample answer to see the interview flow.');
        state.interview.messages.push({ id: newId('demo-message'), role: 'user', content, questions: [], createdAt: date(0) });
        state.interview.messages.push({ id: newId('demo-message'), role: 'assistant', ...interviewReply(content), createdAt: date(0) });
        receipts.set(body.requestId, true); count(); return copy(state);
      }
      const proposal = route.match(/^\/api\/proposals\/([^/]+)\/(accept|reject)$/);
      if (proposal) {
        const row = state.interview.proposals.find(item => item.id === proposal[1]);
        if (!row || row.status !== 'pending') throw error('That sample suggestion has already been reviewed.');
        if (proposal[2] === 'accept') { if (row.revision !== state.revision) throw error('The sample profile changed. Reset the demo to try the original suggestion.', 409); mutateProfile(row.path, row.value); }
        row.status = proposal[2] === 'accept' ? 'accepted' : 'rejected'; return copy(state);
      }
      if (route === '/api/jobs/assess') { if (!receipts.has(body.requestId)) { receipts.set(body.requestId, assess(body.job)); count(); } return copy({ assessment: receipts.get(body.requestId), usage: state.usage }); }
      if (route === '/api/applications' && method === 'POST') {
        const existing = state.applications.find(item => item.job.title === body.job.title && item.job.company === body.job.company);
        if (existing) return copy({ application: existing });
        const value = { id: newId('demo-app'), job: copy(body.job), stage: 'saved', notes: '', followUpDate: '', resumeId: null, createdAt: date(0), updatedAt: date(0) }; state.applications.unshift(value); return copy({ application: value });
      }
      const application = route.match(/^\/api\/applications\/([^/]+)$/);
      if (application && method === 'PATCH') { const row = state.applications.find(item => item.id === application[1]); if (!row) throw error('Sample application not found.', 404); for (const field of ['stage', 'notes', 'followUpDate', 'resumeId']) if (Object.hasOwn(body, field)) row[field] = body[field]; row.updatedAt = date(0); return copy({ application: row }); }
      if (route === '/api/resumes' && method === 'POST') {
        if (!state.profile.reviewed) throw error('Review your sample profile before creating a version.');
        if (body.requestId && receipts.has(body.requestId)) return copy(receipts.get(body.requestId));
        const row = { id: newId('demo-resume'), title: String(body.title || 'Sample resume').slice(0, 160), text: Model.resumeText(state.profile), approved: false, job: body.job || null, notes: body.job ? ['Demo draft: this uses the sample profile to illustrate the review step. Live AI tailoring is not running.'] : [], createdAt: date(0) }; state.resumes.unshift(row);
        if (body.job) count(); const result = { resume: row, usage: state.usage }; if (body.requestId) receipts.set(body.requestId, copy(result)); return copy(result);
      }
      const resume = route.match(/^\/api\/resumes\/([^/]+)$/);
      if (resume && method === 'PATCH') { const row = state.resumes.find(item => item.id === resume[1]); if (!row) throw error('Sample resume not found.', 404); if (row.approved) throw error('This approved sample version is preserved. Create a new one to make changes.', 409); if (typeof body.text === 'string') row.text = body.text.slice(0, 100000); if (body.approved === true) row.approved = true; return copy({ resume: row }); }
      if (route === '/api/export') return copy({ format: 'career-studio-demo', notice: 'Fictional sample data; not a real customer account.', ...state });
      if (route === '/api/resume/extract') throw error('File extraction is outside this preview. You can paste sample text or explore the populated profile. No file has been uploaded.');
      throw error('This action is outside the demo. Use the preview navigation to keep exploring.');
    }
    return { request, sampleResumeText: resumeText, initialAssessments, assessments: Object.fromEntries(initialAssessments.map(row => [row.job.id, row.assessment])) };
  }
  window.CareerDemo = { create };
})();
