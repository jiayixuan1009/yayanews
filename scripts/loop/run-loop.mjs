#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_SITE_ORIGIN, defaultEnvPath, requireValue } from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/run-loop.mjs <gsc-export-dir-or-zip-or-csv> [options]',
    '',
    'Runs the v1 Loop Engine sequence: import GSC -> score -> execute -> report.',
    '',
    'Options:',
    '  --batch <key>              Batch key. Default: loop-YYYY-MM-DD.',
    '  --date-start <date>        Optional data window start, YYYY-MM-DD.',
    '  --date-end <date>          Optional data window end, YYYY-MM-DD.',
    `  --site-origin <url>        Expected site origin. Default: ${DEFAULT_SITE_ORIGIN}`,
    '  --min-impressions <n>      Minimum impressions for CTR opportunities. Default: 20.',
    '  --low-ctr <decimal>        CTR threshold for reachable rankings. Default: 0.02.',
    '  --reachable-position <n>   Max average position for CTR opportunities. Default: 15.',
    '  --limit <n>                Max rows/actions per step. Default: 300.',
    '  --report-output <path>     Markdown report path. Default: outputs/loop/loop-report-<batch>.md.',
    '  --env <path>               Env file containing DATABASE_URL. Default: .env.',
    '  --dry-run                  Import runs, but score/execute do not write actions. Default: apply.',
    '  -h, --help                 Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    input: '',
    envPath: defaultEnvPath,
    batch: `loop-${new Date().toISOString().slice(0, 10)}`,
    dateStart: '',
    dateEnd: '',
    siteOrigin: DEFAULT_SITE_ORIGIN,
    minImpressions: '20',
    lowCtr: '0.02',
    reachablePosition: '15',
    limit: '300',
    reportOutput: '',
    apply: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--dry-run') {
      options.apply = false;
      continue;
    }
    if (arg === '--apply') {
      options.apply = true;
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
    if (arg === '--report-output') {
      options.reportOutput = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--report-output=')) {
      options.reportOutput = arg.slice('--report-output='.length);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.input) throw new Error(`Unexpected extra input: ${arg}`);
    options.input = arg;
  }

  if (!options.input) throw new Error('Missing GSC export input.');
  if (options.dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error(`Invalid --date-start: ${options.dateStart}`);
  if (options.dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error(`Invalid --date-end: ${options.dateEnd}`);
  if (!options.reportOutput) options.reportOutput = path.join('outputs', 'loop', `loop-report-${options.batch}.md`);
  return options;
}

function scriptPath(name) {
  return path.join('scripts', 'loop', name);
}

async function runStep(label, args) {
  console.log(`\n[loop:run] ${label}`);
  console.log(`[loop:run] node ${args.join(' ')}`);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(path.resolve(options.reportOutput)), { recursive: true });

  const importArgs = [
    scriptPath('import-gsc-performance.mjs'),
    options.input,
    '--batch',
    options.batch,
    '--site-origin',
    options.siteOrigin,
    '--env',
    options.envPath,
  ];
  if (options.dateStart) importArgs.push('--date-start', options.dateStart);
  if (options.dateEnd) importArgs.push('--date-end', options.dateEnd);

  const scoreArgs = [
    scriptPath('score-opportunities.mjs'),
    '--batch',
    options.batch,
    '--limit',
    options.limit,
    '--min-impressions',
    options.minImpressions,
    '--low-ctr',
    options.lowCtr,
    '--reachable-position',
    options.reachablePosition,
    '--env',
    options.envPath,
  ];
  if (options.apply) scoreArgs.push('--apply');

  const executeArgs = [
    scriptPath('execute-actions.mjs'),
    '--limit',
    options.limit,
    '--env',
    options.envPath,
  ];
  if (options.apply) executeArgs.push('--apply');

  const reportArgs = [
    scriptPath('report-loop-results.mjs'),
    '--limit',
    options.limit,
    '--output',
    options.reportOutput,
    '--env',
    options.envPath,
  ];

  await runStep('import GSC performance', importArgs);
  await runStep('score opportunities', scoreArgs);
  await runStep('execute actions', executeArgs);
  await runStep('write report', reportArgs);

  console.log(`\n[loop:run] done. Report: ${options.reportOutput}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
