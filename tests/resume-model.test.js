'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Resume = require('../lib/resume-model');

// These checks exercise user-visible distinctions, including the shared browser
// model, without depending on a provider or making claims about AI quality.
test('AI, accounting, and programming get concrete task breakdowns without assumed proficiency', () => {
  for (const [name, expected] of [
    ['AI', /prompts|AI-generated/], ['Accounting', /Reconcile|month-end/],
    ['Programming', /Debug|automated tests/], ['programing', /Debug|automated tests/]
  ]) {
    assert.match(Resume.skillTasks(name).join('\n'), expected);
    const p = Resume.normalizeProfile({ skills: [{ name }] });
    assert.deepEqual(p.skills[0].tasks, {});
    assert.equal(Resume.resumeText(p), '');
    const questions = Resume.skillInterviewQuestions(p.skills[0]);
    assert.equal(questions.length, 3);
    assert.match(questions.join('\n'), /independently|without AI/);
    assert.match(questions.join('\n'), /last use|how often/);
    assert.ok(!questions.join('\n').includes('Excel'));
  }
  assert.ok(Resume.detectSkills('I do programing and accounting using AI tools.').includes('Programming'));
});

test('an unfamiliar skill starts with customer tasks and methods, then evidence and recency', () => {
  const questions = Resume.skillInterviewQuestions('Harp restoration');
  assert.match(questions[0], /Harp restoration/);
  assert.match(questions[0], /specific activities|actual tasks/);
  assert.match(questions[0], /tools or methods/);
  assert.match(questions[1], /real example/);
  assert.match(questions[1], /without AI or another person/);
  assert.match(questions[2], /last use|how often/);
  assert.equal(Resume.skillInterviewQuestions('').length, 1);
  const followUp = Resume.skillInterviewQuestions({ name: 'Harp restoration', tasks: { 'Regulate a pedal mechanism': 'assisted' } });
  assert.match(followUp[0], /Regulate a pedal mechanism/);
  assert.match(followUp[0], /where is help still needed/);
});

test('follow-up questions respect existing evidence and recorded task boundaries', () => {
  const skill = {
    name: 'Accounting', tasks: Object.fromEntries(Resume.skillTasks('Accounting').map(task => [task, 'independent'])),
    evidence: 'I reconcile accounts each month.', years: 'Three years', lastUsed: 'This week', context: 'Work'
  };
  skill.tasks['Complete month-end close'] = 'assisted';
  const questions = Resume.skillInterviewQuestions(skill);
  assert.match(questions[0], /month-end close/);
  assert.match(questions[0], /where is help still needed/);
  assert.match(questions[1], /how did you check/);
  assert.ok(!questions.join('\n').includes('When did you last use'));
});

test('custom task labels survive normalization and resumes preserve assistance across domains', () => {
  const p = Resume.normalizeProfile({ skills: [
    { name: 'AI', tasks: { 'Check a summary against source documents': 'independent', 'Connect a model to a CRM': 'assisted', 'Train a neural network': 'learning' } },
    { name: 'Accounting', tasks: { 'Match invoices to supplier statements': 'assisted' } },
    { name: 'Programming', tasks: { 'Fix input validation in Python': 'assisted' } },
    { name: 'Harp restoration', tasks: { 'Regulate a pedal mechanism': 'assisted', 'Replace a soundboard': 'none' } }
  ] });
  assert.equal(p.skills[3].tasks['Regulate a pedal mechanism'], 'assisted');
  const text = Resume.resumeText(p);
  assert.match(text, /AI: Check a summary against source documents/);
  for (const name of ['AI', 'Accounting', 'Programming', 'Harp restoration']) {
    assert.ok(text.includes(name + ' (with AI or human assistance):'));
  }
  assert.ok(!text.includes('Train a neural network'));
  assert.ok(!text.includes('Replace a soundboard'));
});

test('task label normalization blocks transformed unsafe keys and remains bounded', () => {
  const tasks = Object.fromEntries([
    [' __proto__ ', 'independent'], ['constructor independently', 'assisted'],
    ['safe.prototype', 'learning'], ['<script>bad</script>', 'independent'],
    ['hidden\nclaim', 'independent'], ['x'.repeat(201), 'independent'],
    ['Use Node.js', 'assisted'], ['Check joints independently', 'independent']
  ]);
  const p = Resume.normalizeProfile({ skills: [{ name: 'Custom', tasks }] });
  assert.deepEqual(p.skills[0].tasks, { 'Use Node.js': 'assisted', 'Check joints': 'independent' });
  assert.equal({}.polluted, undefined);
  for (const label of ['', 'prototype', ' constructor ', 'nested.__proto__', '\u0000bad', 'x'.repeat(201)]) {
    assert.equal(Resume.isSafeSkillTaskLabel(label), false);
  }
  const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, i) => ['Task ' + i, 'independent']));
  assert.equal(Object.keys(Resume.normalizeProfile({ skills: [{ name: 'Custom', tasks: tooMany }] }).skills[0].tasks).length, 100);
});

test('browser source exposes the same arbitrary-skill interview and safe-label rules', () => {
  const browser = vm.runInNewContext(Resume.browserSource + '; ResumeModel;');
  assert.deepEqual(Array.from(browser.skillTasks('programing')), Resume.skillTasks('programing'));
  assert.deepEqual(Array.from(browser.skillInterviewQuestions('Harp restoration')), Resume.skillInterviewQuestions('Harp restoration'));
  assert.equal(browser.isSafeSkillTaskLabel(' nested.prototype '), false);
});

test('uploaded Skills lists preserve unfamiliar names, normalize aliases, and infer no task ratings', () => {
  const p = Resume.importText('Sam Example\nSKILLS\nAI, ChatGPT, Accounting, QuickBooks, programing, Harp restoration\n• harp restoration\nI worked with a colleague to repair instruments.\nEXPERIENCE\nRestorer | Sample Workshop | Chicago\n2020 - Present\n• Tuned instruments for events.');
  const names = p.skills.map(skill => skill.name.toLowerCase());
  for (const name of ['ai tools', 'accounting', 'programming', 'harp restoration']) assert.ok(names.includes(name));
  assert.equal(names.filter(name => name === 'harp restoration').length, 1);
  assert.ok(!names.some(name => name.includes('colleague') || name.includes('instruments') || name.includes('chicago')));
  for (const skill of p.skills) assert.deepEqual(skill.tasks, {});
  assert.equal(p.reviewed, false);
  assert.equal(Resume.resumeText(p), '');
  assert.ok(Resume.questions(p).some(item => item.section === 'review'));
});

test('long custom names still produce distinct rateable task labels within storage limits', () => {
  const name = 'Z'.repeat(200);
  const tasks = Resume.skillTasks(name);
  assert.equal(new Set(tasks).size, tasks.length);
  for (const task of tasks) assert.ok(Resume.isSafeSkillTaskLabel(task));
  const profile = Resume.normalizeProfile({ skills: [{ name, tasks: Object.fromEntries(tasks.map(task => [task, 'assisted'])) }] });
  assert.equal(Object.keys(profile.skills[0].tasks).length, tasks.length);
});

test('canonical task labels preserve an existing rating when a normalized alias collides', () => {
  assert.equal(Resume.normalizeSkillTaskLabel('  Reconcile accounts independently  '), 'Reconcile accounts');
  assert.equal(Resume.normalizeSkillTaskLabel('  constructor independently  '), '');
  for (const tasks of [
    { 'Reconcile accounts': 'independent', 'Reconcile accounts independently': 'assisted' },
    { 'Reconcile accounts independently': 'assisted', 'Reconcile accounts': 'independent' }
  ]) {
    assert.deepEqual(Resume.normalizeProfile({ skills: [{ name: 'Accounting', tasks }] }).skills[0].tasks, { 'Reconcile accounts': 'independent' });
  }
  const browser = vm.runInNewContext(Resume.browserSource + '; ResumeModel;');
  assert.equal(browser.normalizeSkillTaskLabel('  Check joints independently  '), 'Check joints');
});

test('guided questions cover any chosen skill without inferring proficiency or modifying a profile', () => {
  for (const name of ['AI', 'Accounting', 'programing', 'Harp restoration']) {
    const profile = Resume.normalizeProfile({ skills: [{ name }] });
    const before = JSON.stringify(profile);
    const first = Resume.guidedInterviewReply({ profile, topic: name, message: "Let's explore my skill: " + name });
    assert.match(first.message, /Guided interview \(no AI\)/);
    assert.equal(first.questions.length, 1);assert.ok(first.questions[0].question.includes(name));assert.equal(first.step, 0);
    const second = Resume.guidedInterviewReply({ profile, message: 'I do this with help.', previous: first });
    assert.equal(second.topic, name);assert.equal(second.step, 1);assert.match(second.questions[0].question, /real example/);
    const third = Resume.guidedInterviewReply({ profile, message: 'A colleague checked the result.', previous: second });
    assert.equal(third.step, 2);assert.match(third.questions[0].question, /last use|how often/);
    assert.equal(JSON.stringify(profile), before);assert.deepEqual(profile.skills[0].tasks, {});
    assert.equal(first.proposals, undefined);
  }
});

test('guided selection can ask for clarification, restart a topic, or retain a custom skill without AI inference', () => {
  const unclear = Resume.guidedInterviewReply({ message: 'I have worked for many years.' });
  assert.equal(unclear.topic, '');assert.match(unclear.questions[0].question, /Which skill or tool/);
  const custom = Resume.guidedInterviewReply({ message: 'Harp restoration', previous: unclear });
  assert.equal(custom.topic, 'Harp restoration');assert.match(custom.questions[0].question, /specific activities/);
  const reset = Resume.guidedInterviewReply({ topic: 'AI', message: "Let's explore my skill: AI", previous: { topic: 'AI', step: 5 } });
  assert.equal(reset.step, 0);assert.match(reset.questions[0].question, /prompts/);
  const answer = Resume.guidedInterviewReply({ message: 'I know how to check the output', previous: reset });
  assert.equal(answer.topic, 'AI');assert.equal(answer.step, 1);
  const browser = vm.runInNewContext(Resume.browserSource + '; ResumeModel;');
  assert.equal(browser.guidedInterviewReply({ topic: 'Accounting', message: 'Explore accounting' }).questions[0].question, Resume.guidedInterviewReply({ topic: 'Accounting', message: 'Explore accounting' }).questions[0].question);
});
