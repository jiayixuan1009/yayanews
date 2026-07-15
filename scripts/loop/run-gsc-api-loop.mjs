#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

import { DEFAULT_SITE_ORIGIN, defaultEnvPath, requireValue } from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/run-gsc-api-loop.mjs --date-start YYYY-MM-DD --date-end YYYY-MM-DD [options]',
    '',
    'Fetches GSC Performance via API, then runs the full Loop Engine sequence.',
    '',
    'Options:',
    `  --site-url <url>       GSC property URL. Default: ${DEFAULT_SITE_ORIGIN}/`,
    '  --date-start <date>    Required data window start, YYYY-MM-DD.',
    '  --date-end <date>      Required data window end, YYYY-MM-DD.',
    '  --out-dir <path>       Export directory. Default: outputs/gsc-performance/gsc-<date-end>.',
    '  --batch <key>          Batch key. Default: gsc-api-<date-start>-<date-end>.',
    '  --row-limit <n>        API rowLimit per dimension. Default: 25000.',
    '  --page-filter-prefix <url>  Optional page URL prefix filter, useful with Domain properties.',
    '  --limit <n>            Max rows/actions per loop step. Default: 300.',
    '  --env <path>           Env file containing DB and GSC credentials. Default: .env.',
    '  --dry-run              Import runs, but score/execute do not write actions. Default: apply.',
    '  -h, --help             Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    siteUrl: '',
    dateStart: '',
    dateEnd: '',
    outDir: '',
    batch: '',
    rowLimit: '25000',
    pageFilterPrefix: null,
    limit: '300',
    envPath: defaultEnvPath,
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
    let matched = false;
    for (const key of ['site-url', 'date-start', 'date-end', 'out-dir', 'batch', 'row-limit', 'page-filter-prefix', 'limit', 'env']) {
      if (arg === `--${key}`) {
        const value = requireValue(argv, index, arg);
        setOption(options, key, value);
        index += 1;
        matched = true;
        break;
      }
      if (arg.startsWith(`--${key}=`)) {
        setOption(options, key, arg.slice(key.length + 3));
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (arg.startsWith('-') && !knownOption(arg)) throw new Error(`Unknown option: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error('Missing or invalid --date-start.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error('Missing or invalid --date-end.');
  if (!options.outDir) options.outDir = path.join('outputs', 'gsc-performance', `gsc-${options.dateEnd}`);
  if (!options.batch) options.batch = `gsc-api-${options.dateStart}-${options.dateEnd}`;
  return options;
}

function knownOption(arg) {
  return ['--dry-run', '--apply'].includes(arg)
    || ['site-url', 'date-start', 'date-end', 'out-dir', 'batch', 'row-limit', 'page-filter-prefix', 'limit', 'env']
      .some((key) => arg === `--${key}` || arg.startsWith(`--${key}=`));
}

function setOption(options, key, value) {
  const map = {
    'site-url': 'siteUrl',
    'date-start': 'dateStart',
    'date-end': 'dateEnd',
    'out-dir': 'outDir',
    batch: 'batch',
    'row-limit': 'rowLimit',
    'page-filter-prefix': 'pageFilterPrefix',
    limit: 'limit',
    env: 'envPath',
  };
  options[map[key]] = value;
}

async function run(label, args) {
  console.log(`\n[loop:gsc] ${label}`);
  console.log(`[loop:gsc] node ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
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
  const fetchArgs = [
    path.join('scripts', 'loop', 'fetch-gsc-performance.mjs'),
    '--date-start',
    options.dateStart,
    '--date-end',
    options.dateEnd,
    '--out-dir',
    options.outDir,
    '--row-limit',
    options.rowLimit,
    '--env',
    options.envPath,
  ];
  if (options.siteUrl) fetchArgs.push('--site-url', options.siteUrl);
  if (options.pageFilterPrefix !== null) fetchArgs.push('--page-filter-prefix', options.pageFilterPrefix);
  await run('fetch GSC performance', fetchArgs);

  const runArgs = [
    path.join('scripts', 'loop', 'run-loop.mjs'),
    options.outDir,
    '--batch',
    options.batch,
    '--date-start',
    options.dateStart,
    '--date-end',
    options.dateEnd,
    '--limit',
    options.limit,
    '--env',
    options.envPath,
  ];
  if (options.dryRun) runArgs.push('--dry-run');
  await run('run Loop Engine', runArgs);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
