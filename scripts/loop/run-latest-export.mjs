#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_SITE_ORIGIN, defaultEnvPath, requireValue } from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/run-latest-export.mjs [options]',
    '',
    'Finds the newest local GSC Performance export and runs the full Loop Engine sequence.',
    '',
    'Options:',
    '  --input <path>             Explicit export dir/zip/csv. Overrides --search-dir.',
    '  --search-dir <path>        Directory containing dated GSC exports. Default: outputs/gsc-performance',
    '  --batch <key>              Batch key. Default: gsc-<date>-<export-name>.',
    '  --date-start <date>        Optional data window start, YYYY-MM-DD.',
    '  --date-end <date>          Optional data window end, YYYY-MM-DD.',
    `  --site-origin <url>        Expected site origin. Default: ${DEFAULT_SITE_ORIGIN}`,
    '  --min-impressions <n>      Minimum impressions for CTR opportunities. Default: 20.',
    '  --low-ctr <decimal>        CTR threshold for reachable rankings. Default: 0.02.',
    '  --reachable-position <n>   Max average position for CTR opportunities. Default: 15.',
    '  --limit <n>                Max rows/actions per step. Default: 300.',
    '  --report-dir <path>        Report directory. Default: outputs/loop.',
    '  --env <path>               Env file containing DATABASE_URL. Default: .env.',
    '  --dry-run                  Import runs, but score/execute do not write actions. Default: apply.',
    '  -h, --help                 Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    input: '',
    searchDir: path.join('outputs', 'gsc-performance'),
    envPath: defaultEnvPath,
    batch: '',
    dateStart: '',
    dateEnd: '',
    siteOrigin: DEFAULT_SITE_ORIGIN,
    minImpressions: '20',
    lowCtr: '0.02',
    reachablePosition: '15',
    limit: '300',
    reportDir: path.join('outputs', 'loop'),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--apply') {
      options.dryRun = false;
      continue;
    }
    if (arg === '--input') {
      options.input = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
      continue;
    }
    if (arg === '--search-dir') {
      options.searchDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--search-dir=')) {
      options.searchDir = arg.slice('--search-dir='.length);
      continue;
    }
    if (arg === '--env') {
      options.envPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envPath = arg.slice('--env='.length);
      continue;
    }
    if (arg === '--batch') {
      options.batch = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--batch=')) {
      options.batch = arg.slice('--batch='.length);
      continue;
    }
    if (arg === '--date-start') {
      options.dateStart = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--date-start=')) {
      options.dateStart = arg.slice('--date-start='.length);
      continue;
    }
    if (arg === '--date-end') {
      options.dateEnd = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--date-end=')) {
      options.dateEnd = arg.slice('--date-end='.length);
      continue;
    }
    if (arg === '--site-origin') {
      options.siteOrigin = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--site-origin=')) {
      options.siteOrigin = arg.slice('--site-origin='.length);
      continue;
    }
    if (arg === '--min-impressions') {
      options.minImpressions = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--min-impressions=')) {
      options.minImpressions = arg.slice('--min-impressions='.length);
      continue;
    }
    if (arg === '--low-ctr') {
      options.lowCtr = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--low-ctr=')) {
      options.lowCtr = arg.slice('--low-ctr='.length);
      continue;
    }
    if (arg === '--reachable-position') {
      options.reachablePosition = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--reachable-position=')) {
      options.reachablePosition = arg.slice('--reachable-position='.length);
      continue;
    }
    if (arg === '--limit') {
      options.limit = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = arg.slice('--limit='.length);
      continue;
    }
    if (arg === '--report-dir') {
      options.reportDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.input) throw new Error(`Unexpected extra input: ${arg}`);
    options.input = arg;
  }

  if (options.dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error(`Invalid --date-start: ${options.dateStart}`);
  if (options.dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error(`Invalid --date-end: ${options.dateEnd}`);
  return options;
}

function safeSlug(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'gsc';
}

function directoryContainsCsv(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && directoryContainsCsv(fullPath)) return true;
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) return true;
  }
  return false;
}

function isSupportedExport(entry, root) {
  const fullPath = path.join(root, entry.name);
  if (entry.isDirectory()) return directoryContainsCsv(fullPath);
  const ext = path.extname(entry.name).toLowerCase();
  return ext === '.csv' || ext === '.zip';
}

function newestExport(searchDir) {
  const root = path.resolve(searchDir);
  if (!fs.existsSync(root)) throw new Error(`Search directory does not exist: ${searchDir}`);

  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => isSupportedExport(entry, root))
    .map((entry) => {
      const fullPath = path.join(root, entry.name);
      const stat = fs.statSync(fullPath);
      return { fullPath, name: entry.name, mtimeMs: stat.mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No GSC export directories, .zip files, or .csv files found under ${searchDir}`);
  }
  return candidates[0];
}

async function runLoop(args) {
  console.log(`[loop:latest] node ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`loop:run failed with exit code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = options.input
    ? { fullPath: path.resolve(options.input), name: path.basename(options.input) }
    : newestExport(options.searchDir);

  if (!fs.existsSync(selected.fullPath)) throw new Error(`GSC export input does not exist: ${selected.fullPath}`);

  const datePart = options.dateEnd || new Date().toISOString().slice(0, 10);
  const batch = options.batch || `gsc-${datePart}-${safeSlug(selected.name)}`;
  const reportOutput = path.join(options.reportDir, `loop-report-${batch}.md`);
  fs.mkdirSync(options.reportDir, { recursive: true });

  const args = [
    path.join('scripts', 'loop', 'run-loop.mjs'),
    selected.fullPath,
    '--batch',
    batch,
    '--site-origin',
    options.siteOrigin,
    '--min-impressions',
    options.minImpressions,
    '--low-ctr',
    options.lowCtr,
    '--reachable-position',
    options.reachablePosition,
    '--limit',
    options.limit,
    '--report-output',
    reportOutput,
    '--env',
    options.envPath,
  ];
  if (options.dateStart) args.push('--date-start', options.dateStart);
  if (options.dateEnd) args.push('--date-end', options.dateEnd);
  if (options.dryRun) args.push('--dry-run');

  console.log(`[loop:latest] selected: ${selected.fullPath}`);
  console.log(`[loop:latest] batch: ${batch}`);
  await runLoop(args);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
