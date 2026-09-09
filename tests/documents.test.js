'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Document, Packer, Paragraph } = require('docx');
const { extractResume, createDocx, decodeUpload, MAX_UPLOAD_BYTES, MAX_TEXT_CHARS, MAX_DOCUMENT_JOBS } = require('../lib/documents');

const upload = (name, data) => ({ name, data: Buffer.from(data).toString('base64') });
const wordFixture = (text = 'Taylor Example\nExcel basic formulas') => Packer.toBuffer(new Document({ sections: [{ children: text.split('\n').map(line => new Paragraph(line)) }] }));

function pdfFixture(text = '', pages = 1) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [' + Array.from({ length: pages }, (_, index) => (4 + index * 2) + ' 0 R').join(' ') + '] /Count ' + pages + ' >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  for (let index = 0; index < pages; index++) {
    const content = text ? 'BT /F1 12 Tf 50 750 Td (' + text.replace(/[()\\]/g, '\\$&') + ') Tj ET' : '';
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + index * 2) + ' 0 R >>');
    objects.push('<< /Length ' + Buffer.byteLength(content) + ' >>\nstream\n' + content + '\nendstream');
  }
  let data = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(data)); data += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'; });
  const xref = Buffer.byteLength(data);
  data += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  data += offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  data += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(data);
}

function centralRecord(buffer, filename) {
  let index = 0;
  while ((index = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), index)) >= 0) {
    const length = buffer.readUInt16LE(index + 28);
    if (buffer.subarray(index + 46, index + 46 + length).toString() === filename) return index;
    index += 46 + length + buffer.readUInt16LE(index + 30) + buffer.readUInt16LE(index + 32);
  }
  throw new Error('Missing ZIP fixture entry');
}

test('real TXT, PDF, and DOCX imports extract text and identify the uploaded file', async () => {
  const txt = await extractResume(upload('../Resume.TXT', '\uFEFFTaylor Example\nExcel: basic formulas'));
  assert.equal(txt.name, 'Resume.TXT');
  assert.equal(txt.text, 'Taylor Example\nExcel: basic formulas');
  assert.deepEqual(txt.warnings, []);
  assert.match((await extractResume(upload('resume.pdf', pdfFixture('Taylor Example - Excel basics')))).text, /Taylor Example - Excel basics/);
  assert.match((await extractResume(upload('resume.docx', await wordFixture()))).text, /Excel basic formulas/);
});

test('unreadable documents report specific actionable errors without parser internals', async () => {
  await assert.rejects(extractResume(upload('scan.pdf', pdfFixture())), error => error.statusCode === 422 && /no selectable text.*scanned/.test(error.message));
  await assert.rejects(extractResume(upload('corrupt.pdf', '%PDF-1.7\nnot a document')), /could not be read.*corrupt/);
  await assert.rejects(extractResume(upload('encoding.txt', Buffer.from([255, 254, 128]))), /not UTF-8/);
  await assert.rejects(extractResume(upload('empty.txt', '\n\t ')), /No resume text/);
  for (const [name, data] of [['wrong.pdf', 'A text file'], ['broken.docx', 'PK\x03\x04broken'], ['binary.txt', Buffer.from([0, 1, 2])], ['old.doc', 'old word']]) {
    assert.throws(() => decodeUpload(upload(name, data)), error => [415, 422].includes(error.statusCode));
  }
  assert.throws(() => decodeUpload({ name: 'resume.txt', data: 'YWJ=' }), /not valid base64/);
});

test('upload bytes, text output, PDF pages, and advertised DOCX expansion are bounded', async () => {
  assert.throws(() => decodeUpload(upload('large.txt', Buffer.alloc(MAX_UPLOAD_BYTES + 1, 65))), error => error.statusCode === 413);
  await assert.rejects(extractResume(upload('text.txt', 'A'.repeat(MAX_TEXT_CHARS + 1))), error => error.statusCode === 413);
  await assert.rejects(extractResume(upload('long.pdf', pdfFixture('Resume', 51))), error => error.statusCode === 413 && /50 pages/.test(error.message));
  const expanded = await wordFixture();
  expanded.writeUInt32LE(33 * 1024 * 1024, centralRecord(expanded, 'word/document.xml') + 24);
  assert.throws(() => decodeUpload(upload('expanded.docx', expanded)), error => error.statusCode === 413 && /32 MB/.test(error.message));
});

test('DOCX expansion is verified instead of trusting forged ZIP metadata', async () => {
  const forged = await wordFixture('A'.repeat(50000));
  forged.writeUInt32LE(1, centralRecord(forged, 'word/document.xml') + 24);
  // The cheap metadata check passes, but actual decompression has a hard cap.
  assert.ok(decodeUpload(upload('forged.docx', forged)));
  await assert.rejects(extractResume(upload('forged.docx', forged)), error => error.statusCode === 422 && /corrupt/.test(error.message));
});

test('import and export share a concurrency cap and timed-out workers release capacity', async () => {
  assert.equal(MAX_DOCUMENT_JOBS, 2);
  const work = [extractResume(upload('one.txt', 'Resume'), { timeoutMs: 1 }), createDocx('Resume', { timeoutMs: 1 })];
  await assert.rejects(extractResume(upload('three.txt', 'Resume')), error => error.statusCode === 429 && /busy/.test(error.message));
  const results = await Promise.allSettled(work);
  assert.ok(results.every(result => result.status === 'rejected' && result.reason.statusCode === 422));
  assert.equal((await extractResume(upload('four.txt', 'Ready again'))).text, 'Ready again');
});

test('Word download preserves the reviewed text rather than rebuilding facts from a mutable profile', async () => {
  const reviewed = 'Taylor Example <script>alert(1)</script>\nSUMMARY\nOperations coordinator with Excel basics.\nSKILLS\nExcel: formulas and filters\nAWARDS\nService Award, 2024';
  const bytes = await createDocx(reviewed);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  const imported = await extractResume(upload('reviewed.docx', bytes));
  assert.equal(imported.text.replace(/\n\n/g, '\n'), reviewed);
  const html = (await require('mammoth').convertToHtml({ buffer: bytes })).value;
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<h1>(?:<strong>)?AWARDS/);
  await assert.rejects(createDocx({ profile: {} }), error => error.statusCode === 400);
  await assert.rejects(createDocx('\u0000'), error => error.statusCode === 400);
  await assert.rejects(createDocx('A'.repeat(MAX_TEXT_CHARS + 1)), error => error.statusCode === 413);
  await assert.rejects(createDocx('A\n'.repeat(3001)), error => error.statusCode === 413);
});
