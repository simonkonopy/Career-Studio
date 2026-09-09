#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync, backup } = require('node:sqlite');

const productRoot = path.resolve(__dirname, '..');
const inside = (child, parent) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };

function argumentsFor(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') { result.help = true; continue; }
    if (!['--source', '--output'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || result[key.slice(2)]) throw new Error('Use --source FILE and --output FILE, or --help.');
    result[key.slice(2)] = argv[++i];
  }
  return result;
}

async function makeBackup({ source, output }) {
  const sourcePath = fs.realpathSync(source);
  if (!fs.statSync(sourcePath).isFile()) throw new Error('The source must be an existing database file.');
  const outputPath = path.resolve(output);
  if (outputPath === sourcePath || [sourcePath + '-wal', sourcePath + '-shm'].includes(outputPath)) throw new Error('Choose a separate backup destination.');
  const publicPath = path.join(productRoot, 'public');
  if (inside(outputPath, publicPath)) throw new Error('Backups cannot be stored in public assets.');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const parent = fs.realpathSync(path.dirname(outputPath));
  const realOutput = path.join(parent, path.basename(outputPath));
  const realPublic = fs.existsSync(publicPath) ? fs.realpathSync(publicPath) : publicPath;
  if (inside(realOutput, realPublic) || realOutput === sourcePath || [sourcePath + '-wal', sourcePath + '-shm'].includes(realOutput)) throw new Error('Choose a private, separate backup destination.');
  // lstat also rejects dangling symlinks; never overwrite an existing backup.
  try { fs.lstatSync(realOutput); throw new Error('The backup destination already exists. Choose a new filename.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = fs.mkdtempSync(path.join(parent, '.career-backup-'));
  fs.chmodSync(staging, 0o700);
  const temporaryFile = path.join(staging, 'snapshot.sqlite');
  let database;
  try {
    database = new DatabaseSync(sourcePath, { readOnly: true, timeout: 5000 });
    await backup(database, temporaryFile);
    database.close(); database = null;
    fs.chmodSync(temporaryFile, 0o600);
    const verification = new DatabaseSync(temporaryFile, { readOnly: true });
    try {
      const results = verification.prepare('PRAGMA quick_check').all();
      if (results.length !== 1 || Object.values(results[0])[0] !== 'ok') throw new Error('The backup did not pass its integrity check.');
    } finally { verification.close(); }
    const handle = fs.openSync(temporaryFile, 'r');
    try { fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    // A hard link publishes the complete snapshot atomically without replacing
    // a file created by another backup between the existence check and now.
    fs.linkSync(temporaryFile, realOutput);
    return realOutput;
  } finally {
    if (database) database.close();
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function main() {
  const options = argumentsFor(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run backup -- [--source FILE] [--output FILE]\nReads .env without replacing existing environment settings.\nDefault source: DATA_DIR/career.sqlite. Output: BACKUP_PATH or backups/career-TIMESTAMP.sqlite.\nRelative paths are resolved from the product directory. Existing output files are never replaced.');
    return;
  }
  const envFile = path.join(productRoot, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const source = path.resolve(productRoot, options.source || path.join(process.env.DATA_DIR || 'data', 'career.sqlite'));
  const output = path.resolve(productRoot, options.output || process.env.BACKUP_PATH || path.join('backups', `career-${stamp}.sqlite`));
  await makeBackup({ source, output });
  console.log('Backup created and integrity checked. Store it encrypted off the application host and test restoration.');
}

if (require.main === module) main().catch(error => {
  const known = /^(Use --source|The source|Choose a|Backups cannot|The backup)/.test(error.message);
  console.error(known ? error.message : 'Backup failed. Check the database path, destination permissions, disk space, and database availability.');
  process.exitCode = 1;
});
module.exports = { makeBackup, argumentsFor };
