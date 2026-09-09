// Pure, shared resume rules. Keep this factory self-contained for the offline dashboard.
function createResumeModel() {
  const clean = (value, limit = 20000) => typeof value === 'string' ? value.replace(/\u0000/g, '').slice(0, limit).trim() : '';
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fields = (value, names) => Object.fromEntries(names.map(name => [name, clean(object(value)[name])]));
  const lines = value => clean(value).split(/\n+/).map(line => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  const unique = values => [...new Set(values)];
  const levels = new Set(['independent', 'assisted', 'learning', 'none']);
  const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
  const catalog = [
    { name: 'Excel', pattern: /\b(?:excel|vlookup|xlookup|pivot tables?|power query|spreadsheet formulas?)\b/i, tasks: ['Basic data entry and formatting', 'Sort, filter, and maintain lists', 'Basic formulas (SUM, AVERAGE, IF)', 'VLOOKUP', 'XLOOKUP', 'Pivot tables', 'Charts and reporting', 'Power Query', 'Macros / VBA'] },
    { name: 'Google Sheets', pattern: /\bgoogle sheets?\b/i, tasks: ['Data entry, formatting, and filters', 'Basic formulas (SUM, IF, COUNTIF)', 'VLOOKUP / XLOOKUP', 'Pivot tables', 'QUERY and IMPORTRANGE', 'Sharing and access permissions', 'Apps Script automation'] },
    { name: 'SQL', pattern: /\b(?:sql|postgres(?:ql)?|mysql|sqlite)\b/i, tasks: ['Write SELECT queries and filters', 'JOIN tables', 'GROUP BY and aggregate data', 'Subqueries and CTEs', 'Window functions', 'Validate query results', 'Design or change database schemas', 'Debug and optimize queries'] },
    { name: 'Programming', pattern: /\b(?:program+ing|coding|software development|computer programming)\b/i, tasks: ['Explain code and break down a problem', 'Write functions and control flow', 'Work with files and data', 'Connect to APIs', 'Debug errors and handle edge cases', 'Write and run automated tests', 'Use Git and review changes', 'Deploy and maintain software'] },
    { name: 'Python', pattern: /\bpython\b/i, tasks: ['Write basic scripts', 'Work with files and CSV data', 'Clean and analyze data with pandas', 'Connect to APIs', 'Debug errors', 'Write automated tests', 'Manage packages and environments', 'Deploy and maintain applications'] },
    { name: 'JavaScript', pattern: /\b(?:javascript|typescript|node\.?js)\b/i, tasks: ['Write functions and data transformations', 'Build browser interfaces', 'Use async requests and APIs', 'Debug application errors', 'Write automated tests', 'Use a framework such as React', 'Deploy and maintain applications'] },
    { name: 'HTML / CSS', pattern: /\b(?:html|css)\b/i, tasks: ['Write semantic HTML', 'Style layouts with CSS', 'Build responsive layouts', 'Support keyboard and screen reader access', 'Debug browser layout issues'] },
    { name: 'Power BI', pattern: /\bpower bi\b/i, tasks: ['Connect and clean data', 'Build reports and dashboards', 'Model relationships', 'Write DAX measures', 'Configure refresh and permissions', 'Validate business metrics'] },
    { name: 'Tableau', pattern: /\btableau\b/i, tasks: ['Connect and prepare data', 'Build charts and dashboards', 'Create calculated fields', 'Use filters and parameters', 'Publish and manage permissions', 'Validate business metrics'] },
    { name: 'Salesforce', pattern: /\bsalesforce\b/i, tasks: ['Maintain accounts, contacts, and activities', 'Manage leads and opportunities', 'Build reports and dashboards', 'Import and clean records', 'Configure fields and workflows', 'Manage roles and permissions'] },
    { name: 'HubSpot', pattern: /\bhubspot\b/i, tasks: ['Maintain contacts and companies', 'Manage deals and pipelines', 'Create reports', 'Build workflows', 'Import and deduplicate data', 'Manage integrations'] },
    { name: 'CRM', pattern: /\b(?:crm|customer relationship management)\b/i, tasks: ['Maintain customer records', 'Track leads and follow-ups', 'Manage pipelines', 'Create reports', 'Configure workflows', 'Train other users', 'Administer access and integrations'] },
    { name: 'SAP', pattern: /\bsap\b/i, tasks: ['Navigate the modules actually used', 'Create or update business transactions', 'Run standard reports', 'Reconcile records', 'Configure a module', 'Train users or support a rollout'] },
    { name: 'Oracle', pattern: /\boracle\b/i, tasks: ['Navigate the modules actually used', 'Create or update business transactions', 'Run standard reports', 'Reconcile records', 'Configure a module', 'Train users or support a rollout'] },
    { name: 'Inventory management', pattern: /\b(?:inventory|stock control|reorder points?|safety stock|warehouse management)\b/i, tasks: ['Receive and count stock', 'Maintain SKU and location records', 'Set reorder points and safety stock', 'Forecast demand', 'Investigate count discrepancies', 'Use an inventory / WMS platform', 'Report inventory turns and stockouts'] },
    { name: 'Procurement', pattern: /\b(?:procurement|purchasing|strategic sourcing|vendor management|supplier management|buyer)\b/i, tasks: ['Create purchase orders', 'Source and compare suppliers', 'Negotiate pricing and payment terms', 'Calculate landed cost', 'Manage MOQs and lead times', 'Evaluate supplier performance', 'Own purchasing budgets', 'Run formal bids or RFPs'] },
    { name: 'Logistics', pattern: /\b(?:logistics|shipping|fulfillment|dispatch|freight)\b/i, tasks: ['Prepare shipments and shipping documents', 'Coordinate carriers and delivery schedules', 'Track shipments and resolve exceptions', 'Plan freight or delivery routes', 'Handle returns', 'Prepare import / export documents', 'Use shipping or transportation software'] },
    { name: 'Operations', pattern: /\b(?:operations|sops?|process improvement|operating procedures)\b/i, tasks: ['Run daily workflows', 'Write standard operating procedures', 'Plan staffing and schedules', 'Track operating costs and KPIs', 'Improve a process and measure results', 'Coordinate across teams', 'Own a department or business budget'] },
    { name: 'People management', pattern: /\b(?:people management|team management|leadership|supervis(?:e|ed|ion|or)|direct reports?|staff training|hiring)\b/i, tasks: ['Train and onboard staff', 'Schedule and assign work', 'Supervise direct reports', 'Coach and give performance feedback', 'Hire and interview staff', 'Handle performance issues', 'Manage other managers'] },
    { name: 'Communication', pattern: /\b(?:communication|public speaking|presentation skills|business writing)\b/i, tasks: ['Write clear emails and updates', 'Listen and clarify requirements', 'Explain complex information to a non-specialist', 'Present to a group', 'Facilitate meetings and document decisions', 'Handle difficult conversations', 'Adapt communication for different audiences'] },
    { name: 'Project management', pattern: /\b(?:project management|project manager|project planning|scrum|agile)\b/i, tasks: ['Define scope and deliverables', 'Build schedules and track milestones', 'Manage risks and dependencies', 'Coordinate stakeholders', 'Manage a project budget', 'Run Agile / Scrum ceremonies', 'Deliver work to an external client'] },
    { name: 'Customer service', pattern: /\b(?:customer service|customer support|help ?desk|ticketing|zendesk)\b/i, tasks: ['Answer customer questions', 'Resolve complaints and escalations', 'Use a ticketing system', 'Document cases and follow-ups', 'Track response and resolution metrics', 'Create help articles', 'Train support staff'] },
    { name: 'Accounting', pattern: /\b(?:accounting|bookkeeping|accounts payable|accounts receivable|quickbooks|reconciliation)\b/i, tasks: ['Create invoices and record payments', 'Manage accounts payable / receivable', 'Reconcile accounts', 'Use accounting software', 'Prepare budgets and cash forecasts', 'Prepare financial statements', 'Complete month-end close'] },
    { name: 'Data analysis', pattern: /\b(?:data analys(?:is|t)|data cleaning|data visualization|business intelligence)\b/i, tasks: ['Clean and validate data', 'Define business metrics', 'Compare trends and segments', 'Build charts and reports', 'Explain findings to stakeholders', 'Apply statistical methods', 'Design and evaluate experiments'] },
    { name: 'AI tools', pattern: /\b(?:ai|artificial intelligence|chatgpt|claude|llms?|ollama|lm studio|copilot)\b/i, tasks: ['Write prompts and evaluate outputs', 'Use AI to assist with documents or analysis', 'Describe requirements for AI-assisted coding', 'Test and verify AI-generated work', 'Connect tools or APIs', 'Run a local language model', 'Train other people to use a workflow', 'Deploy and support a workflow for external customers'] },
    { name: 'Shopify', pattern: /\bshopify\b/i, tasks: ['Maintain products and collections', 'Process orders and refunds', 'Manage inventory and fulfillment', 'Review sales reports', 'Configure store settings and apps', 'Customize themes', 'Build integrations'] },
    { name: 'Social media', pattern: /\b(?:social media|tiktok|instagram|social commerce)\b/i, tasks: ['Plan and publish content', 'Manage a community', 'Read platform analytics', 'Run paid campaigns', 'Manage a social commerce store', 'Host live commerce sessions', 'Measure attributable revenue'] },
    { name: 'CAD', pattern: /\b(?:cad|solidworks|autocad|fusion 360)\b/i, tasks: ['Read drawings and dimensions', 'Edit existing models', 'Create original 2D drawings', 'Create original 3D models', 'Apply tolerances and design constraints', 'Prepare manufacturing files'] },
    { name: 'Design / Figma', pattern: /\b(?:figma|ux design|ui design|product design|graphic design)\b/i, tasks: ['Create layouts and use typography', 'Build wireframes', 'Design reusable components', 'Create interactive prototypes', 'Use auto layout and responsive constraints', 'Conduct or interpret usability research', 'Check accessibility', 'Prepare designs and specifications for handoff'] },
    { name: 'Welding', pattern: /\b(?:welding|welder|tig|mig|smaw|gtaw|gmaw)\b/i, tasks: ['Read fabrication drawings and weld symbols', 'Prepare materials and joints', 'Set up equipment and follow safety procedures', 'Perform MIG / GMAW welds', 'Perform TIG / GTAW welds', 'Perform stick / SMAW welds', 'Inspect welds and identify defects', 'Meet a documented welding procedure or qualification'] },
    { name: 'Electrical work', pattern: /\b(?:electrician|electrical work|electrical installation)\b/i, tasks: ['Read wiring diagrams', 'Identify circuits and components', 'Use test instruments', 'Install wiring or fixtures within authorized scope', 'Troubleshoot electrical faults', 'Follow isolation and lockout procedures', 'Document inspections and repairs', 'Apply the codes and license requirements for the work performed'] },
    { name: '3D printing', pattern: /\b(?:3d print(?:ing|ers?)?|additive manufacturing|print farm)\b/i, tasks: ['Prepare and slice print files', 'Set up and calibrate printers', 'Troubleshoot print failures', 'Maintain and repair equipment', 'Manage production queues', 'Inspect quality and reduce waste', 'Create original models'] },
    { name: 'Compliance', pattern: /\b(?:compliance|regulatory|fda|iso 9001|quality assurance)\b/i, tasks: ['Follow documented procedures', 'Maintain compliance records', 'Review labeling or required documentation', 'Prepare for audits', 'Investigate incidents and corrective actions', 'Interpret regulations in the industry used', 'Own a compliance program'] }
  ];

  function blankProfile() {
    return {
      version: 1,
      basics: fields({}, ['name', 'email', 'phone', 'location', 'headline', 'summary', 'links']),
      experience: [], education: [], skills: [],
      extras: fields({}, ['certifications', 'projects', 'languages', 'volunteering', 'awards']),
      preferences: { roles: '', location: '', workMode: 'any', minSalary: '', currency: 'USD', employmentType: '', schedule: '', excluded: '', relocation: '' },
      importedText: '', reviewed: false
    };
  }

  function normalizeProfile(raw) {
    raw = object(raw);
    const profile = blankProfile();
    profile.basics = fields(raw.basics, Object.keys(profile.basics));
    profile.extras = fields(raw.extras, Object.keys(profile.extras));
    profile.preferences = { ...profile.preferences, ...fields(raw.preferences, Object.keys(profile.preferences)) };
    if (!['any', 'remote', 'hybrid', 'onsite'].includes(profile.preferences.workMode)) profile.preferences.workMode = 'any';
    if (!profile.preferences.currency) profile.preferences.currency = 'USD';
    const records = (source, kind, names) => {
      const used = new Set();
      return (Array.isArray(source) ? source : []).filter(row => row && typeof row === 'object' && !Array.isArray(row)).slice(0, 100).map((row, index) => {
        let id = clean(row.id, 100) || kind + '-' + (index + 1);
        while (used.has(id)) id += '-2';
        used.add(id);
        return { id, ...fields(row, names) };
      });
    };
    profile.experience = records(raw.experience, 'experience', ['employer', 'title', 'location', 'start', 'end', 'responsibilities', 'achievements', 'tools', 'teamSize']);
    // Follow the same filtered ordering used by records; a string such as "false" is never truthy confirmation.
    const experiences = (Array.isArray(raw.experience) ? raw.experience : []).filter(row => row && typeof row === 'object' && !Array.isArray(row));
    profile.experience.forEach((row, index) => { row.current = experiences[index].current === true; });
    profile.education = records(raw.education, 'education', ['school', 'degree', 'field', 'start', 'end', 'details']);
    const skills = (Array.isArray(raw.skills) ? raw.skills : []).filter(row => row && typeof row === 'object' && !Array.isArray(row));
    profile.skills = records(skills, 'skill', ['name', 'evidence', 'years', 'lastUsed', 'context']).map((skill, index) => ({ ...skill,
      tasks: normalizeTaskRatings(skills[index].tasks)
    }));
    profile.importedText = clean(raw.importedText, 250000);
    profile.reviewed = raw.reviewed === true;
    return profile;
  }

  function normalizeSkillTaskLabel(value) {
    if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f<>]/.test(value)) return '';
    const label = value.replace(/\s+independently\b/gi, '').trim();
    if (!label || [value, label].some(item => item.split('.').some(part => unsafeKeys.has(part.trim())))) return '';
    return label;
  }

  function isSafeSkillTaskLabel(value) { return Boolean(normalizeSkillTaskLabel(value)); }

  function normalizeTaskRatings(value) {
    const entries = Object.entries(object(value)).slice(0, 100)
      .map(([raw, level]) => ({ raw, task: normalizeSkillTaskLabel(raw), level }))
      .filter(entry => entry.task && levels.has(entry.level));
    // Prefer an already canonical stored label to a later variant. Normalizing
    // an incoming label must not silently overwrite that recorded rating.
    entries.sort((a, b) => Number(b.raw === b.task) - Number(a.raw === a.task));
    const result = {};
    for (const { task, level } of entries) if (!Object.hasOwn(result, task)) result[task] = level;
    return result;
  }

  function skillEntry(name) {
    const term = clean(name, 200);
    return catalog.find(skill => skill.name.toLowerCase() === term.toLowerCase())
      || (term ? catalog.find(skill => skill.pattern.test(term)) : undefined);
  }

  function skillTasks(name) {
    const term = clean(name, 200);
    if (!term) return [];
    const entry = skillEntry(term);
    return entry ? [...entry.tasks] : ['Complete basic tasks with ', 'Complete routine work with ', 'Handle complex work with ', 'Troubleshoot problems with ', 'Teach or support others using '].map(prefix => prefix + term.slice(0, 200 - prefix.length));
  }

  // Domain examples are conversation starters, never inferred proficiencies.
  // Unknown skills remain interviewable without inventing a domain taxonomy.
  function skillInterviewQuestions(raw) {
    const skill = typeof raw === 'string' ? { name: raw } : object(raw);
    const name = clean(skill.name, 200);
    if (!name) return ['Which skill would you like to explore, and what have you used it for?'];
    const tasks = object(skill.tasks);
    const known = skillEntry(name);
    const unanswered = unique([...Object.keys(tasks).filter(isSafeSkillTaskLabel), ...(known ? skillTasks(name) : [])])
      .filter(task => !levels.has(tasks[task]));
    const prompts = [];
    if (!known && !Object.keys(tasks).some(task => levels.has(tasks[task]))) {
      prompts.push('What specific activities do you perform with ' + name + ', and which tools or methods do you use? Name a few actual tasks so we can describe this skill precisely.');
    } else if (unanswered.length) {
      prompts.push('For ' + name + ', what can you do independently, with AI or human help, or are still learning? Start with ' + unanswered.slice(0, 3).join('; ') + '. It is fine if you have not tried a task.');
    } else {
      const limited = Object.keys(tasks).filter(task => ['assisted', 'learning'].includes(tasks[task]));
      prompts.push(limited.length
        ? 'For ' + name + ', you marked ' + limited.slice(0, 2).join('; ') + ' as assisted or in progress. Which steps do you handle yourself, and where is help still needed?'
        : 'What is the most challenging ' + name + ' task you can repeat yourself, and where would you need help? Describe the steps you personally handle.');
    }
    prompts.push(clean(skill.evidence)
      ? 'Thinking about your ' + name + ' example, how did you check the result, what problems did you solve yourself, and which parts came from AI, templates, or another person?'
      : 'Describe one real example of ' + name + ': the problem, the steps you personally took, and the result. What could you repeat or explain without AI or another person?');
    prompts.push(!clean(skill.lastUsed) || !clean(skill.years) || !clean(skill.context)
      ? 'When did you last use ' + name + ', how long and how often have you used it, and was it at work, school, or in a personal project? Include the tools, software versions, or methods and the scale of the work.'
      : 'What other ' + name + ' tasks or limitations should your resume include? Give an example beyond the work we have already recorded, and keep plans separate from completed work.');
    return prompts;
  }

  // A deterministic, transcript-only interview for customers without AI access.
  // Previous progression is server-owned; answers never assign profile facts.
  function guidedInterviewReply({ profile: rawProfile, message, topic, previous } = {}) {
    const profile = normalizeProfile(rawProfile);
    const text = clean(message, 6000);
    const prior = object(previous);
    const explicit = clean(topic, 200);
    const selection = text.match(/^Let's explore my skill:\s*([^\n]+)/i);
    const named = text.match(/^(?:ask(?: me)? about|my skill is|I want to (?:explore|discuss))\s+([^?!\n]{1,200})[?!.]?$/i)
      || (!clean(prior.topic, 200) && text.match(/^I (?:also )?know\s+([^?!\n]{1,200})[?!.]?$/i));
    const shortName = text.length <= 200 && text.split(/\s+/).length <= 8 && !/[.!?\n]/.test(text)
      && !/^(?:I|we|my|our|yes|no|thanks|hello|hi)\b/i.test(text) ? text : '';
    const chosen = explicit || clean(selection?.[1], 200) || clean(named?.[1], 200);
    const name = chosen || clean(prior.topic, 200) || detectSkills(text)[0] || shortName;
    const lastStep = Number.isSafeInteger(prior.step) && prior.step >= 0 ? Math.min(prior.step, 10000) : -1;
    const step = chosen || name !== clean(prior.topic, 200) ? 0 : lastStep + 1;
    const skill = profile.skills.find(row => row.name.toLowerCase() === name.toLowerCase());
    const prompts = skillInterviewQuestions(skill || name);
    let question;
    if (!name) question = 'Which skill or tool would you like to explore? Name any skill, such as AI, accounting, programming, or a skill from your own work.';
    else if (step < prompts.length) question = prompts[step];
    else if (step % 2) question = 'For that ' + name + ' task, which steps can you repeat independently, which need AI or human help, and how do you check the result?';
    else question = 'What is another specific ' + name + ' task you have actually completed? Include the tool or method, your contribution, and the result. You can also choose another skill to explore.';
    return {
      message: 'Guided interview (no AI). This conversation is saved in your account. These prepared questions help you describe your experience; add confirmed details to Your story before they appear on your resume.',
      questions: [{ question, reason: 'Concrete tasks, examples, recency, and the help you need make a skill clearer. A name alone does not establish proficiency.' }],
      topic: name, step: Math.min(step, 10000)
    };
  }

  function detectSkills(text) {
    return catalog.filter(skill => skill.pattern.test(clean(text, 250000))).map(skill => skill.name);
  }

  function importText(text) {
    const profile = blankProfile();
    profile.importedText = clean(text, 250000).replace(/\r\n?/g, '\n');
    const source = profile.importedText;
    const rows = source.split('\n').map(row => row.trim()).filter(Boolean);
    profile.basics.email = (source.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
    profile.basics.phone = (source.match(/(?:\+\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/) || [''])[0];
    profile.basics.links = unique(source.match(/(?:https?:\/\/|www\.)[^\s<>]+|linkedin\.com\/in\/[^\s<>]+/gi) || []).join('\n');
    const heading = /^(?:(?:professional |work |employment |relevant )?experience|(?:professional |career )?summary|profile|objective|education|(?:technical |core |key )?skills|certifications?|projects?|languages?|volunteer(?:ing| experience)?|awards?|references?)\s*:?$/i;
    const name = rows.slice(0, 4).find(row => !heading.test(row) && /^[\p{L}][\p{L}'’.\-]+(?:\s+[\p{L}][\p{L}'’.\-]+){1,4}$/u.test(row) && !/\b(?:resume|curriculum|vitae|manager|engineer|specialist|analyst|director|university|college|skills|summary|experience)\b/i.test(row));
    if (name) profile.basics.name = name;
    let section = '';
    let experience = null;
    let pendingWork = [];
    let education = null;
    const namedSkills = [];
    const datePart = '(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ .]+|(?:0?[1-9]|1[0-2])[/.-])?(?:19|20)\\d{2}';
    const dateRange = new RegExp('(' + datePart + ')\\s*(?:–|—|-|\\bto\\b)\\s*(' + datePart + '|present|current)', 'i');
    const roleTitle = /\b(?:manager|director|coordinator|specialist|analyst|engineer|developer|designer|assistant|associate|supervisor|founder|owner|operator|officer|president|technician|representative|consultant|administrator|executive|accountant|bookkeeper|buyer|clerk|teacher|instructor|nurse|driver|intern|apprentice|lead|cashier|server|barista|mechanic|electrician|plumber|welder|receptionist|recruiter|counselor|scientist|researcher|architect|chef|cook|laborer|agent|recruit|soldier)\b/i;
    const locationLine = value => /^[\p{L} .'-]+,?\s+[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:\s*\([^)]*\))?$/u.test(value) || /^(?:remote|hybrid|on[ -]site)$/i.test(value);
    const addExperience = (title, employer, location, range) => {
      experience = { id: 'experience-' + (profile.experience.length + 1), title, employer, location: location || '', start: range ? range[1] : '', end: range && !/present|current/i.test(range[2]) ? range[2] : '', current: Boolean(range && /present|current/i.test(range[2])), responsibilities: '', achievements: '', tools: '', teamSize: '' };
      profile.experience.push(experience);
      pendingWork = [];
    };
    const assignDates = range => {
      experience.start = range[1]; experience.current = /present|current/i.test(range[2]); experience.end = experience.current ? '' : range[2];
    };
    for (const row of rows) {
      if (heading.test(row)) { section = row.replace(/:$/, '').toLowerCase(); experience = null; education = null; pendingWork = []; continue; }
      if (/(?:^| )skills$/.test(section) && row.length <= 600 && namedSkills.length < 100) {
        // Only preserve short list items from an explicit skills section. A
        // sentence about work is source text, not a newly inferred skill name.
        for (const token of row.replace(/^[-•*]\s*/, '').split(/[,;|•]/)) {
          const label = clean(token, 201);
          if (!label || label.length > 80 || label.split(/\s+/).length > 8 || /[:!?]|\.$/.test(label)
            || !isSafeSkillTaskLabel(label) || /^(?:i|we|my|our|responsible|worked|working|used|using|experienced in|proficient in)\b/i.test(label)) continue;
          const known = skillEntry(label);
          namedSkills.push(known ? known.name : label);
          if (namedSkills.length >= 100) break;
        }
      }
      if (/summary|profile|objective/.test(section)) profile.basics.summary += (profile.basics.summary ? '\n' : '') + row;
      if (/experience/.test(section)) {
        const range = row.match(dateRange);
        const label = row.replace(dateRange, '').replace(/[|,\s–—-]+$/, '').trim();
        const parts = label.split(/\s*\|\s*|\s+at\s+|\s+[–—]\s+/i);
        if (parts.length >= 2 && parts[0] && parts[1] && !/^[-•*]/.test(row)) {
          const companyFirst = !roleTitle.test(parts[0]) && roleTitle.test(parts[1]);
          addExperience(parts[companyFirst ? 1 : 0], parts[companyFirst ? 0 : 1], parts[2], range);
        } else if (range && !/^[-•*]/.test(row)) {
          if (label) pendingWork.push(label);
          const candidates = pendingWork.filter(value => !locationLine(value) && !/@|https?:\/\//.test(value));
          const titleIndex = candidates.findLastIndex(value => roleTitle.test(value));
          const title = candidates[titleIndex];
          const employer = candidates.map((value, index) => ({ value, distance: Math.abs(index - titleIndex) })).filter(item => item.value !== title && !roleTitle.test(item.value)).sort((a, b) => a.distance - b.distance)[0]?.value;
          if (title && employer) addExperience(title, employer, pendingWork.find(locationLine), range);
          else if (experience && !candidates.length) {
            assignDates(range);
            if (!experience.location) experience.location = pendingWork.find(locationLine) || '';
          } else if (pendingWork.length) experience = null;
          pendingWork = [];
        } else if (experience && /^[-•*]/.test(row) && !pendingWork.length) {
          experience.responsibilities += (experience.responsibilities ? '\n' : '') + row.replace(/^[-•*]\s*/, '');
        } else if (!/^[-•*]/.test(row)) {
          pendingWork.push(label);
          pendingWork = pendingWork.slice(-5);
        }
      }
      if (/education/.test(section)) {
        if (/\b(?:university|college|school|institute|academy)\b/i.test(row)) {
          education = { id: 'education-' + (profile.education.length + 1), school: row.split(/\s*\|\s*/)[0], degree: '', field: '', start: '', end: '', details: '' };
          profile.education.push(education);
        }
        if (education) {
          const degree = row.match(/\b(?:Bachelor(?:'s)?|Master(?:'s)?|Associate(?:'s)?|Doctor(?:ate)?|Ph\.?D\.?|[BMA]\.?[SAB]\.?|Diploma|Certificate|GED)(?:\s+(?:of|in)\s+[^|,]+)?/i);
          if (degree) education.degree = degree[0];
          const years = row.match(/\b(?:19|20)\d{2}\b/g);
          if (years) { education.end = years.at(-1); if (years.length > 1) education.start = years[0]; }
        }
      }
    }
    const skillNames = [...new Map([...detectSkills(source), ...namedSkills].map(name => [name.toLowerCase(), name])).values()].slice(0, 100);
    profile.skills = skillNames.map((name, index) => ({ id: 'skill-' + (index + 1), name, tasks: {}, evidence: '', years: '', lastUsed: '', context: '' }));
    return normalizeProfile(profile);
  }

  function questions(raw) {
    const profile = normalizeProfile(raw);
    const result = [];
    const ask = (id, section, prompt) => result.push({ id, section, prompt });
    if (profile.importedText && !profile.reviewed) ask('review-import', 'review', 'Compare the suggested details with your original resume. Correct titles, dates, ownership, and results, then confirm the details are accurate. An imported skill name does not establish proficiency.');
    if (!profile.basics.name) ask('basics-name', 'basics', 'What name should employers see on your resume?');
    if (!profile.basics.email && !profile.basics.phone) ask('basics-contact', 'basics', 'What email address and phone number should employers use?');
    if (!profile.basics.location) ask('basics-location', 'basics', 'What city, region, and country should appear on your resume?');
    if (!profile.basics.headline) ask('basics-headline', 'basics', 'What kind of work do you want to be known for? Use a truthful title or a short description of your strengths.');
    if (!profile.basics.summary) ask('basics-summary', 'basics', 'How would you describe your experience, the work you do well, and the value you bring in two or three sentences?');
    if (!profile.experience.length) ask('experience-add', 'experience', 'What jobs, self-employment, military service, internships, or substantial volunteer roles have you held? Add each employer, your actual title, location, and dates.');
    for (const row of profile.experience) {
      const label = row.title || row.employer || 'this position';
      if (!row.title || !row.employer) ask(row.id + '-identity', 'experience', 'For ' + label + ', what was your title and the employer or organization? Were you an employee, owner, contractor, or volunteer?');
      if (!row.start || (!row.current && !row.end)) ask(row.id + '-dates', 'experience', 'When did you start and finish ' + label + '? Include month and year, or mark it as current.');
      if (!row.responsibilities) ask(row.id + '-responsibilities', 'experience', 'In ' + label + ', what did you actually do each week? Describe the workflows you owned, decisions you made, customers you served, and what others handled.');
      if (!row.achievements) ask(row.id + '-achievements', 'experience', 'What changed because of your work in ' + label + '? Give a concrete before-and-after example. Include only numbers you can support; an honest result without a number is useful.');
      if (!row.tools) ask(row.id + '-tools', 'experience', 'Which exact tools, systems, equipment, or platforms did you personally use in ' + label + '? Separate your own work from AI, a coworker, or an outside service.');
      if (!row.teamSize) ask(row.id + '-team', 'experience', 'In ' + label + ', how many people reported directly to you, if any? Distinguish direct reports from total company headcount and explain whether you hired, trained, or scheduled them.');
    }
    if (!profile.education.length) ask('education-add', 'education', 'What schools, training programs, apprenticeships, or military courses have you attended? Record the credential, field, dates, and whether it was completed; leave this section empty if it does not apply.');
    for (const row of profile.education) {
      if (!row.school || !row.degree || !row.end) ask(row.id + '-details', 'education', 'For ' + (row.school || 'this education entry') + ', what credential and field did you study? Was it completed, in progress, or coursework only, and when?');
    }
    if (!profile.skills.length) ask('skills-add', 'skills', 'What tools and skills have you used at work, school, or in projects? AI, accounting, programming, trades, creative work, and any other skill are welcome; we will break each one into specific tasks.');
    for (const skill of profile.skills) {
      if (!skillEntry(skill.name)) ask(skill.id + '-scope', 'skills', skillInterviewQuestions(skill)[0]);
      const unanswered = skillTasks(skill.name).filter(task => !skill.tasks[task]);
      if (unanswered.length) ask(skill.id + '-tasks', 'skills', 'For ' + (skill.name || 'this skill') + ', mark whether you can do each task independently, with AI or human help, are learning, or have not done it: ' + unanswered.join('; ') + '.');
      const used = Object.values(skill.tasks).some(level => ['independent', 'assisted'].includes(level));
      if (used && !skill.evidence) ask(skill.id + '-evidence', 'skills', 'Describe a real example using ' + skill.name + ': the problem, what you personally did, the result, and what you could explain or repeat in an interview.');
      if (used && !skill.years) ask(skill.id + '-years', 'skills', 'How long and how often have you actually used ' + skill.name + '? Distinguish occasional practice from regular work.');
      if (used && !skill.lastUsed) ask(skill.id + '-recency', 'skills', 'When did you last use ' + skill.name + ' on a real task?');
      if (used && !skill.context) ask(skill.id + '-context', 'skills', 'Where did you use ' + skill.name + ' (work, school, personal project), which product or version, and at what scale? Explain any help you needed, especially for AI-assisted work.');
    }
    const quantified = /\$\s*\d|\b\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?\s*(?:%|percent\b|hours?\b|customers?\b|clients?\b|employees?\b|staff\b|people\b|locations?\b|users?\b|orders?\b|units?\b|dollars?\b)|\b(?:revenue|sales|budget|savings|spend|reduced|grew|increased)\b[^.!?\n]{0,70}\d/i;
    const claims = [
      { id: 'summary', label: 'your summary', text: profile.basics.summary },
      ...profile.experience.map(row => ({ id: row.id, label: row.title || row.employer || 'this position', text: [row.responsibilities, row.achievements, row.teamSize].filter(Boolean).join('\n') })),
      ...profile.skills.map(skill => ({ id: skill.id, label: 'your ' + skill.name + ' example', text: skill.evidence })),
      { id: 'projects', label: 'your projects', text: profile.extras.projects }
    ];
    for (const claim of claims) {
      if (quantified.test(claim.text)) ask('review-' + claim.id + '-metrics', 'review', 'For the numbers in ' + claim.label + ', what is the source and time period, how were they measured, and what part was your personal contribution? Distinguish individual results from team or company results, direct reports from total headcount, and estimates from measured figures. Correct or omit anything you cannot support.');
    }
    const narrative = [profile.basics.headline, ...claims.map(claim => claim.text), ...profile.experience.map(row => row.tools), !profile.reviewed ? profile.importedText : ''].filter(Boolean).join('\n');
    if (profile.importedText && !profile.reviewed && quantified.test(profile.importedText) && !claims.some(claim => quantified.test(claim.text))) ask('review-import-metrics', 'review', 'Your original resume contains numbers or measurable claims. Which results were yours, over what time period, and what record supports each one? Bring only confirmed figures into the structured resume.');
    for (const name of ['Excel', 'Python', 'SQL', 'JavaScript']) {
      const advancedClaim = new RegExp('\\b(?:advanced|expert|proficient|mastery)\\b[^.!?\\n]{0,45}\\b' + name + '\\b|\\b' + name + '\\b[^.!?\\n]{0,45}\\b(?:advanced|expert|proficient|mastery)\\b', 'i');
      if (!advancedClaim.test(narrative)) continue;
      const pattern = catalog.find(entry => entry.name === name).pattern;
      const skill = profile.skills.find(entry => pattern.test(entry.name));
      const advancedTasks = name === 'Excel' ? /vlookup|xlookup|pivot|power query|macros|vba/i : /debug|optimize|schema|window|deploy|test|join/i;
      const established = Object.entries(skill ? skill.tasks : {}).some(([task, level]) => advancedTasks.test(task) && level === 'independent');
      if (!established) ask('review-' + name.toLowerCase() + '-depth', 'review', 'Your narrative describes advanced or proficient ' + name + ', but independent advanced tasks are not confirmed. Which exact tasks can you repeat without AI or human help? Update the task ratings or soften the claim to match what you can demonstrate.');
    }
    if (/\b(?:python|sql|javascript|coding|programming)\b/i.test(narrative) || /\b(?:built|developed|created)\b[^.!?\n]{0,65}\b(?:software|apps?|applications?|automations?|apis?)\b/i.test(narrative)) ask('review-code-ownership', 'review', 'For the coding or software work in your resume, who wrote, tested, and debugged it? Separate what you did independently from AI, templates, or a developer. What could you change or troubleshoot yourself, and was it a personal project, an internal tool, or work delivered to customers?');
    if (/\b(?:ai|chatgpt|claude|llm|copilot)\b/i.test(narrative)) ask('review-ai-scope', 'review', 'For AI-assisted work, what did you personally decide, build, and verify? Who actually used the result, and was it completed or only planned? Keep prompting, independent coding, staff adoption, and delivery to customers distinct.');
    if (profile.extras.certifications) ask('review-credentials', 'review', 'Are the certifications and licenses listed actually earned and current? Verify the exact credential, issuing body, completion date, expiry, and any scope restrictions; separate training attendance from a professional license.');
    for (const [name, prompt] of Object.entries({ certifications: 'Which certifications or licenses do you hold? Include issuer, date, expiry, and current status. Omit credentials you have not earned.', projects: 'What projects have you actually completed? Describe your contribution, tools, users, and result. Distinguish a working project from an idea.', languages: 'Which languages do you use, and at what speaking, reading, and writing level?', volunteering: 'What volunteer or community work should employers know about? Include your contribution and dates.', awards: 'Which awards have you received? Include the exact name, issuer, year, and who received the award.' })) {
      if (!profile.extras[name]) ask('extras-' + name, 'extras', prompt + ' This section is optional.');
    }
    if (!profile.preferences.roles) ask('preferences-roles', 'preferences', 'Which job titles or kinds of work do you want next? List a few options, including roles you would consider as a fallback.');
    if (!profile.preferences.location) ask('preferences-location', 'preferences', 'Where can you work? Include your location or eligible regions, commute limits, and any relocation constraints. Remote jobs can still restrict location.');
    if (!profile.preferences.minSalary) ask('preferences-pay', 'preferences', 'What minimum annual base salary would you accept, and in which currency? Leave it blank if you do not want a salary filter.');
    if (!profile.preferences.schedule) ask('preferences-schedule', 'preferences', 'What schedules, shifts, travel, or weekend work can you accept?');
    return result;
  }

  function resumeSections(raw) {
    const p = normalizeProfile(raw);
    if (p.importedText && !p.reviewed) return [];
    const result = [];
    const add = (heading, content) => { const body = content.filter(Boolean); if (body.length) result.push({ heading, lines: body }); };
    add('', [p.basics.name, p.basics.headline, [p.basics.email, p.basics.phone, p.basics.location].filter(Boolean).join(' | '), ...lines(p.basics.links)]);
    add('Summary', lines(p.basics.summary));
    const work = [];
    for (const row of p.experience) {
      if (![row.title, row.employer, row.responsibilities, row.achievements].some(Boolean)) continue;
      work.push([row.title, row.employer, row.location].filter(Boolean).join(' | '));
      work.push([row.start, row.current ? 'Present' : row.end].filter(Boolean).join(' – '));
      work.push(...lines(row.responsibilities).map(line => '• ' + line), ...lines(row.achievements).map(line => '• ' + line));
      if (row.tools) work.push('Tools used: ' + row.tools);
      if (row.teamSize) work.push('Team scope: ' + row.teamSize);
      work.push('');
    }
    add('Experience', work);
    add('Education', p.education.flatMap(row => [
      [row.school, [row.degree, row.field].filter(Boolean).join(', ')].filter(Boolean).join(' | '),
      [row.start, row.end].filter(Boolean).join(' – '), ...lines(row.details)
    ]));
    add('Skills', p.skills.flatMap(skill => {
      if (!skill.name) return [];
      const independent = Object.entries(skill.tasks).filter(([, level]) => level === 'independent').map(([task]) => task);
      const assisted = Object.entries(skill.tasks).filter(([, level]) => level === 'assisted').map(([task]) => task);
      if (!independent.length && !assisted.length) return [];
      const output = [];
      if (independent.length) output.push(skill.name + ': ' + independent.join('; '));
      if (assisted.length) output.push(skill.name + ' (with AI or human assistance): ' + assisted.join('; '));
      if (skill.evidence) output.push('Example: ' + skill.evidence);
      return output;
    }));
    for (const [key, heading] of Object.entries({ certifications: 'Certifications', projects: 'Projects', languages: 'Languages', volunteering: 'Volunteering', awards: 'Awards' })) add(heading, lines(p.extras[key]));
    return result;
  }

  function resumeText(profile) {
    return resumeSections(profile).map(section => [section.heading ? section.heading.toUpperCase() : '', ...section.lines].filter(Boolean).join('\n')).join('\n\n');
  }

  function resumeHtml(profile) {
    const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const sections = resumeSections(profile);
    if (!sections.length) return '';
    return '<article class="resume-document">' + sections.map(section => '<section>' + (section.heading ? '<h2>' + escape(section.heading) + '</h2>' : '') + section.lines.map((line, index) => !section.heading && index === 0 ? '<h1>' + escape(line) + '</h1>' : '<p>' + escape(line).replace(/\n/g, '<br>') + '</p>').join('') + '</section>').join('') + '</article>';
  }

  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'our', 'are', 'you', 'will', 'job', 'work', 'team', 'using', 'have', 'has', 'can', 'other', 'years', 'experience']);
  const wordTokens = text => unique(clean(text).toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').split(' ').filter(word => word.length > 2 && !stopWords.has(word)));
  const comparable = text => clean(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function contains(haystack, needle) {
    const part = comparable(needle);
    return Boolean(part) && (' ' + comparable(haystack) + ' ').includes(' ' + part + ' ');
  }

  function salaryRange(value) {
    const pay = clean(value).replace(/,/g, '');
    if (!pay || /\b(?:est\.?|estimated|typical|ote|commission|bonus|hour|hr|weekly|monthly|day)\b|\/\s*h\b/i.test(pay)) return null;
    const values = [...pay.matchAll(/(?:\$|USD\s*)?(\d+(?:\.\d+)?)\s*(k)?/gi)];
    if (!values.length) return null;
    const thousandRange = values.some(match => match[2]) && values.every(match => Number(match[1]) < 1000);
    const numbers = values.map(match => Number(match[1]) * (match[2] || thousandRange ? 1000 : 1)).filter(number => number >= 10000 && number < 10000000);
    const unbounded = /\+|\b(?:from|starting at|or more|and up)\b/i.test(pay);
    return numbers.length ? { low: Math.min(...numbers), high: unbounded ? Infinity : Math.max(...numbers) } : null;
  }

  function namedCity(value) {
    // A freeform preference such as "Texas, within 30 miles" is not a city declaration.
    const match = clean(value).match(/^([A-Za-z .'-]+),\s*([A-Z]{2})(?:\b|$)/);
    return match ? comparable(match[1]) : '';
  }

  function matchJobs(raw, jobs) {
    const original = normalizeProfile(raw);
    const awaitingReview = Boolean(original.importedText && !original.reviewed);
    const profile = awaitingReview ? { ...blankProfile(), preferences: original.preferences } : original;
    const pref = profile.preferences;
    const independentSkills = profile.skills.filter(skill => Object.values(skill.tasks).includes('independent'));
    const candidateText = [profile.basics.headline, ...profile.experience.flatMap(row => [row.title, row.responsibilities, row.achievements]), ...independentSkills.map(skill => skill.name)].join(' ');
    const candidateWords = wordTokens(candidateText);
    const targetRoles = pref.roles.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
    const exclusions = pref.excluded.split(/[,;\n]/).map(value => value.trim().replace(/^(?:no|exclude|avoid)\s+/i, '')).filter(Boolean);
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const validDeadline = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + 'T12:00:00Z').getTime()) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
    const result = [];
    const taskPatterns = [
      { skill: 'Excel', task: /vlookup/i, pattern: /\bvlookup\b/i, label: 'VLOOKUP' },
      { skill: 'Excel', task: /xlookup/i, pattern: /\bxlookup\b/i, label: 'XLOOKUP' },
      { skill: 'Excel', task: /pivot/i, pattern: /\bpivot tables?\b/i, label: 'Pivot tables' },
      { skill: 'Excel', task: /power query/i, pattern: /\bpower query\b/i, label: 'Power Query' },
      { skill: 'Excel', task: /macros|vba/i, pattern: /\b(?:macros?|vba)\b/i, label: 'Macros / VBA' },
      { skill: 'SQL', task: /join/i, pattern: /\bjoins?\b/i, label: 'SQL JOINs' },
      { skill: 'SQL', task: /window/i, pattern: /\bwindow functions?\b/i, label: 'SQL window functions' },
      { skill: 'Python', task: /pandas/i, pattern: /\bpandas\b/i, label: 'Python / pandas' }
    ];
    for (const input of Array.isArray(jobs) ? jobs : []) {
      if (!input || typeof input !== 'object') continue;
      const job = input;
      const linkStatus = clean(job.link_status).toUpperCase();
      if (['DEAD', 'CLOSED', 'EMPLOYER-GONE', 'WATCH', 'SEARCH-URL'].includes(linkStatus)) continue;
      let url;
      try { url = new URL(job.link || job.url); } catch { continue; }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      const role = clean(job.role || job.title);
      if (!role || /\b(?:no posting|watch for repost|direct approach|talent community|talent pool|expression of interest)\b/i.test(role)) continue;
      const deadline = clean(job.application_deadline);
      if (validDeadline(deadline) && deadline < today) continue;
      // Old fit, notes, why-qualified, pursuit decisions, and application stages belong to another candidate.
      const description = [job.description, job.requirements, job.qualifications].map(value => clean(value)).filter(Boolean).join('\n');
      const postingText = [role, clean(job.lane), description].join(' ');
      const practicalText = [role, description, clean(job.location), clean(job.employment_type), clean(job.schedule)].join(' ');
      if (exclusions.some(term => contains(practicalText, term))) continue;
      const workMode = comparable(job.work_mode || job.workMode);
      const location = clean(job.location);
      const remote = workMode === 'remote' || /\b(?:fully remote|remote)\b/i.test(location) && !/\b(?:not remote|no remote|hybrid)\b/i.test(location);
      const hybrid = workMode === 'hybrid' || /\bhybrid\b/i.test(location);
      const onsite = workMode === 'onsite' || workMode === 'on site' || /\bon[ -]site\b/i.test(location);
      if (pref.workMode === 'remote' && (hybrid || onsite)) continue;
      if (pref.workMode === 'onsite' && remote) continue;
      if (pref.workMode === 'hybrid' && (onsite || remote)) continue;
      const preferredCity = namedCity(pref.location);
      const jobCity = namedCity(location);
      // Different city names can be inside one commute area. Only a city-only instruction is an exclusion.
      if (!remote && /\bonly\b/i.test(pref.location) && preferredCity && jobCity && preferredCity !== jobCity) continue;
      const jobEmployment = comparable(job.employment_type);
      if (pref.employmentType && jobEmployment && !contains(jobEmployment, pref.employmentType)) continue;
      const salary = salaryRange(clean(job.pay || job.salary));
      const salaryMinimum = Number(pref.minSalary.replace(/[$,\s]/g, '').replace(/k$/i, '')) * (/k$/i.test(pref.minSalary) ? 1000 : 1);
      const payText = clean(job.pay || job.salary);
      const payCurrency = clean(job.currency).toUpperCase() || (payText.match(/\b(?:USD|CAD|AUD|EUR|GBP|NZD)\b/i)?.[0].toUpperCase()) || (/\bUS\$/i.test(payText) ? 'USD' : '');
      const comparableSalary = salary && pref.currency.toUpperCase() === payCurrency;
      if (comparableSalary && salaryMinimum > 0 && salary.high < salaryMinimum) continue;
      const matched = [], gaps = [], cautions = [];
      if (awaitingReview) cautions.push('Review the imported resume before experience and skills can inform matching.');
      let score = 0;
      const roleWords = wordTokens(role);
      const requested = targetRoles.find(target => contains(role, target) || contains(target, role));
      const targetOverlap = unique(targetRoles.flatMap(wordTokens)).filter(word => roleWords.includes(word));
      if (requested) { score += 35; matched.push('Target role: ' + requested); }
      else if (targetOverlap.length) { score += Math.min(24, targetOverlap.length * 8); matched.push('Role keywords: ' + targetOverlap.join(', ')); }
      const postingWords = wordTokens(postingText);
      const overlapping = candidateWords.filter(word => postingWords.includes(word));
      if (overlapping.length) { score += Math.min(30, overlapping.length * 5); matched.push('Experience keywords: ' + overlapping.slice(0, 7).join(', ')); }
      const mentionedSkills = detectSkills(description);
      for (const name of mentionedSkills) {
        const skill = profile.skills.find(entry => comparable(entry.name) === comparable(name) || catalog.find(item => item.name === name).pattern.test(entry.name));
        if (skill && Object.values(skill.tasks).includes('independent')) { score += 7; matched.push(name + ': some independent tasks reported; check the required depth'); }
        else if (skill && Object.values(skill.tasks).includes('assisted')) gaps.push(name + ': assistance reported; independent ability is not established');
        else gaps.push(name + ': no independent tasks confirmed');
      }
      for (const requirement of taskPatterns) {
        if (!requirement.pattern.test(description)) continue;
        const pattern = catalog.find(entry => entry.name === requirement.skill).pattern;
        const skill = profile.skills.find(entry => comparable(entry.name) === comparable(requirement.skill) || pattern.test(entry.name));
        const levelsFound = Object.entries(skill ? skill.tasks : {}).filter(([task]) => requirement.task.test(task)).map(([, level]) => level);
        if (levelsFound.includes('independent')) { score += 5; matched.push(requirement.label + ': independent task reported'); }
        else gaps.push(requirement.label + (levelsFound.includes('assisted') ? ': assistance only; independent proficiency not established' : ': independent proficiency not confirmed'));
      }
      if (/\badvanced\b.{0,30}\bexcel\b|\bexcel\b.{0,30}\badvanced\b/i.test(description)) {
        const excel = profile.skills.find(skill => /\bexcel\b/i.test(skill.name));
        const advanced = Object.entries(excel ? excel.tasks : {}).some(([task, level]) => /vlookup|xlookup|pivot|power query|macros|vba/i.test(task) && level === 'independent');
        if (!advanced) gaps.push('Advanced Excel is requested; independent advanced tasks are not confirmed');
        else cautions.push('Confirm what the employer means by advanced Excel against your specific task experience.');
      }
      if (/\b(?:bachelor(?:'s)?|baccalaureate)\b.{0,55}\b(?:required|must)\b|\b(?:require[sd]?|must have)\b.{0,55}\bbachelor(?:'s)?\b/i.test(description) && !profile.education.some(row => /\b(?:bachelor|b\.?[as]\.?)\b/i.test(row.degree) && !/\b(?:in progress|expected|incomplete|coursework|not completed|did not complete)\b/i.test([row.degree, row.details, row.end].join(' ')))) gaps.push('Required bachelor’s degree is not confirmed; check whether the posting allows an equivalent');
      if (!description) cautions.push('Full posting requirements are not available in this board. Read the employer posting before judging eligibility.');
      else cautions.push('Keyword relevance only. Check every required credential, years of experience, and task against the employer posting.');
      if (!['LIVE', 'NEW'].includes(linkStatus)) cautions.push('Posting availability is unverified; check the employer page.');
      if (deadline && !validDeadline(deadline)) cautions.push('The application deadline needs confirmation.');
      if (!salary || !payCurrency) cautions.push('Annual base salary is unknown or not comparable; verify pay and currency.');
      else if (!comparableSalary) cautions.push('Pay currency differs from your preference; salary has not been converted.');
      else if (salaryMinimum > 0 && salary.low < salaryMinimum) cautions.push('The advertised range starts below your minimum; a qualifying base offer is not guaranteed.');
      if (!location) cautions.push('Job location is unknown.');
      else if (remote) cautions.push('Remote location eligibility and time-zone requirements need confirmation.');
      else if (pref.location && !contains(location, pref.location) && !contains(pref.location, location)) cautions.push('Confirm the work address, commute, and relocation requirements against your preferred location.');
      if (pref.workMode !== 'any' && !remote && !hybrid && !onsite) cautions.push('Work arrangement is not explicit; confirm ' + pref.workMode + ' availability.');
      if (pref.schedule) cautions.push('Confirm the actual schedule, shifts, and travel against your availability.');
      if (pref.employmentType && !jobEmployment) cautions.push('Employment type is not confirmed.');
      if (!candidateWords.length && !targetRoles.length) cautions.push('Add your experience, target roles, and task-level skills to personalize relevance.');
      score = Math.max(0, Math.min(100, score - Math.min(30, unique(gaps).length * 4)));
      result.push({ job, score, matched: unique(matched), gaps: unique(gaps), cautions: unique(cautions), label: score >= 55 ? 'Higher relevance' : score >= 25 ? 'Some relevance' : 'Limited evidence' });
    }
    return result.sort((left, right) => right.score - left.score || clean(left.job.employer).localeCompare(clean(right.job.employer)) || clean(left.job.role).localeCompare(clean(right.job.role)));
  }

  return { blankProfile, normalizeProfile, skillTasks, skillInterviewQuestions, guidedInterviewReply, normalizeSkillTaskLabel, isSafeSkillTaskLabel, detectSkills, importText, questions, resumeText, resumeHtml, matchJobs };
}

module.exports = { ...createResumeModel(), browserSource: 'const ResumeModel = (' + createResumeModel.toString() + ')();' };
