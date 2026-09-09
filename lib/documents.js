'use strict';

// Documents are parsed and generated in bounded workers. Uploaded bytes never
// touch disk, and all customers share this process-wide concurrency limit.
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 200000;
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
const MAX_DOCUMENT_JOBS = 2;
let activeJobs = 0;

class DocumentError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; this.status = statusCode; }
}

function cleanText(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/^\uFEFF/, '').trim();
}

function decodeUpload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.name !== 'string' || typeof body.data !== 'string') {
    throw new DocumentError(400, 'Choose a resume file to upload.');
  }
  const name = path.basename(body.name.replace(/\\/g, '/'));
  if (!name || name.length > 255 || /[\u0000-\u001f]/.test(name)) throw new DocumentError(400, 'Use a valid file name.');
  const extension = path.extname(name).toLowerCase();
  if (!['.pdf', '.docx', '.txt'].includes(extension)) throw new DocumentError(415, 'Upload a PDF, DOCX, or UTF-8 TXT resume. Older .doc files are not supported.');
  if (body.data.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4) throw new DocumentError(413, 'The resume must be 8 MB or smaller.');
  if (!body.data || body.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw new DocumentError(400, 'The upload is not valid base64 data. Choose the file again.');
  const buffer = Buffer.from(body.data, 'base64');
  if (!buffer.length) throw new DocumentError(400, 'This file is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new DocumentError(413, 'The resume must be 8 MB or smaller.');
  if (buffer.toString('base64') !== body.data) throw new DocumentError(400, 'The upload is not valid base64 data. Choose the file again.');
  if (extension === '.pdf' && !buffer.subarray(0, 8).toString('ascii').startsWith('%PDF-')) throw new DocumentError(422, 'This file is not a valid PDF. Export your resume as PDF again.');
  if (extension === '.docx') validateDocxArchive(buffer);
  if (extension === '.txt' && (buffer.includes(0) || buffer.subarray(0, 5).toString('ascii') === '%PDF-' || buffer.subarray(0, 4).equals(Buffer.from('PK\x03\x04')))) {
    throw new DocumentError(422, 'This file is not a plain UTF-8 text resume. Use its original PDF or DOCX file instead.');
  }
  return { name, extension, buffer };
}

function validateDocxArchive(buffer, verifyExpanded = false) {
  const invalid = () => new DocumentError(422, 'This DOCX is corrupt or is not a Word document. Save a new DOCX and try again.');
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw invalid();
  const count = buffer.readUInt16LE(end + 10);
  const centralStart = buffer.readUInt32LE(end + 16);
  const centralSize = buffer.readUInt32LE(end + 12);
  if (!count || count > 5000 || buffer.readUInt16LE(end + 8) !== count || centralStart + centralSize !== end) throw invalid();
  let offset = centralStart;
  let expanded = 0;
  const names = new Set();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if (flags & 1 || ![0, 8].includes(method) || offset + 46 + nameLength + extraLength + commentLength > end) throw invalid();
    expanded += size;
    if (expanded > MAX_EXPANDED_BYTES) throw new DocumentError(413, 'This DOCX expands to more than 32 MB. Remove large embedded files and try again.');
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    if (!name || names.has(name) || /(^\/|\\|\u0000|(?:^|\/)\.\.(?:\/|$))/.test(name)) throw invalid();
    names.add(name);
    if (local + 30 > centralStart || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 6) !== flags || buffer.readUInt16LE(local + 8) !== method) throw invalid();
    const localNameLength = buffer.readUInt16LE(local + 26);
    const localExtraLength = buffer.readUInt16LE(local + 28);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    if (dataStart + compressed > centralStart || !buffer.subarray(local + 30, local + 30 + localNameLength).equals(nameBytes)) throw invalid();
    if (verifyExpanded) {
      try {
        const packed = buffer.subarray(dataStart, dataStart + compressed);
        // The size recorded in ZIP metadata can lie. Verify real expansion with
        // an output ceiling before passing the archive to the document parser.
        const unpacked = method === 0 ? packed : require('node:zlib').inflateRawSync(packed, { maxOutputLength: Math.max(1, size) });
        if (unpacked.length !== size) throw invalid();
      } catch (error) { if (error instanceof DocumentError) throw error; throw invalid(); }
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end || !names.has('[Content_Types].xml') || !names.has('word/document.xml')) throw invalid();
}

async function parseDocument({ extension, buffer }) {
  buffer = Buffer.from(buffer);
  let text;
  const warnings = [];
  if (extension === '.txt') {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new DocumentError(422, 'This text file is not UTF-8. Save it as UTF-8 TXT or upload PDF or DOCX.'); }
  } else if (extension === '.docx') {
    validateDocxArchive(buffer, true);
    try {
      const result = await require('mammoth').extractRawText({ buffer }, { externalFileAccess: false });
      text = result.value;
      if (result.messages.length) warnings.push('Some document formatting could not be read. Review the extracted text before continuing.');
    } catch { throw new DocumentError(422, 'This DOCX could not be read. Save a new DOCX and try again.'); }
  } else {
    let parser;
    try {
      const { PDFParse } = require('pdf-parse');
      parser = new PDFParse({ data: buffer, verbosity: 0, isEvalSupported: false });
      const info = await parser.getInfo();
      if (info.total > 50) throw new DocumentError(413, 'Please upload a resume of 50 pages or fewer.');
      text = (await parser.getText()).pages.map(page => page.text).join('\n\n');
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      if (error.name === 'PasswordException') throw new DocumentError(422, 'This PDF is password protected. Upload an unlocked copy.');
      throw new DocumentError(422, 'This PDF could not be read. It may be corrupt. Export a new PDF or upload DOCX or TXT.');
    } finally { if (parser) await parser.destroy().catch(() => {}); }
    if (!String(text || '').trim()) throw new DocumentError(422, 'This PDF has no selectable text and may be scanned. Run OCR first, or upload DOCX or paste your resume text.');
  }
  if (String(text || '').length > MAX_TEXT_CHARS) throw new DocumentError(413, 'This document contains too much text. Upload a resume with fewer than 200,000 characters.');
  text = cleanText(text);
  if (!text) throw new DocumentError(422, 'No resume text was found. Try another file or paste your resume text.');
  return { text, warnings };
}

async function generateDocx(text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
  const headings = new Set(['SUMMARY', 'PROFESSIONAL SUMMARY', 'EXPERIENCE', 'WORK EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS', 'PROJECTS', 'LANGUAGES', 'VOLUNTEERING', 'VOLUNTEER EXPERIENCE', 'AWARDS']);
  const document = new Document({
    creator: 'Job Search CRM', title: 'Resume', description: 'Resume built from reviewed details.',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 100 } } } } },
    sections: [{ properties: { page: { margin: { top: 900, right: 1000, bottom: 900, left: 1000 } } }, children: text.split(/\r?\n/).map((line, index) => {
      const heading = index === 0 ? HeadingLevel.TITLE : headings.has(line.trim().toUpperCase()) ? HeadingLevel.HEADING_1 : undefined;
      return new Paragraph({ heading, children: [new TextRun({ text: line, ...(heading ? { bold: true } : {}) })] });
    }) }]
  });
  return Packer.toBuffer(document);
}

async function runWorker(operation, payload, timeoutMs) {
  if (activeJobs >= MAX_DOCUMENT_JOBS) throw new DocumentError(429, 'The document service is busy. Please try again shortly.');
  activeJobs++;
  let worker;
  let timer;
  try {
    worker = new Worker(__filename, { workerData: { operation, ...payload }, resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32 } });
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new DocumentError(422, 'This document took too long to process. Try a smaller file or less resume text.')), timeoutMs);
      worker.once('message', result => result.error ? reject(new DocumentError(result.statusCode || 422, result.error)) : resolve(result));
      worker.once('error', () => reject(new DocumentError(422, 'This document could not be processed safely. Try a smaller file or paste the resume text.')));
      worker.once('exit', () => reject(new DocumentError(422, 'The document service stopped. Please try again.')));
    });
  } finally {
    clearTimeout(timer);
    // A timed-out worker retains its slot until termination has completed.
    if (worker) await worker.terminate().catch(() => {});
    activeJobs--;
  }
}

function processingTimeout(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.min(value, 30000) : fallback;
}

async function extractResume(body, { timeoutMs = 15000 } = {}) {
  if (activeJobs >= MAX_DOCUMENT_JOBS) throw new DocumentError(429, 'The document service is busy. Please try again shortly.');
  const upload = decodeUpload(body);
  const result = await runWorker('extract', { extension: upload.extension, buffer: upload.buffer }, processingTimeout(timeoutMs, 15000));
  return { name: upload.name, ...result };
}

async function createDocx(reviewedText, { timeoutMs = 15000 } = {}) {
  if (typeof reviewedText !== 'string' || !reviewedText.trim()) throw new DocumentError(400, 'Provide a reviewed resume to export.');
  if (reviewedText.length > MAX_TEXT_CHARS || reviewedText.split('\n').length > 3000) throw new DocumentError(413, 'This resume is too large to export.');
  const text = cleanText(reviewedText);
  if (!text) throw new DocumentError(400, 'Provide a reviewed resume to export.');
  const result = await runWorker('docx', { text }, processingTimeout(timeoutMs, 15000));
  return Buffer.from(result.buffer);
}

if (!isMainThread && ['extract', 'docx'].includes(workerData?.operation)) {
  const action = workerData.operation === 'extract' ? parseDocument(workerData) : generateDocx(workerData.text).then(buffer => ({ buffer }));
  action.then(result => parentPort.postMessage(result), error => parentPort.postMessage({ error: error instanceof DocumentError ? error.message : 'This document could not be processed. Please try again.', statusCode: error.statusCode || 422 }));
}

module.exports = { extractResume, createDocx, decodeUpload, MAX_UPLOAD_BYTES, MAX_TEXT_CHARS, MAX_EXPANDED_BYTES, MAX_DOCUMENT_JOBS };
