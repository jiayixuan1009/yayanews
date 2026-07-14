#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';

const LOG_RE = /^(?<ip>\S+) - \[(?<time>[^\]]+)\] "(?<method>\S+) (?<path>\S+) (?<protocol>[^"]+)" (?<status>\d{3}) (?<bytes>\d+) rt=(?<requestTime>[0-9.]+) host="(?<host>(?:\\.|[^"])*)" ref="(?<referrer>(?:\\.|[^"])*)" ua="(?<userAgent>(?:\\.|[^"])*)" cf_ray="(?<cfRay>(?:\\.|[^"])*)" cf_edge="(?<cfEdge>(?:\\.|[^"])*)"$/;
const BOT_UA_RE = /bot|crawler|spider|slurp|bingpreview|headless|lighthouse|pagespeed|python|curl|wget/i;
const STATIC_PATH_RE = /(?:^\/_next\/|\.(?:avif|css|gif|ico|jpe?g|js|json|map|png|svg|webp|woff2?)$)/i;

function usage() {
  return [
    'Usage: node scripts/verify/analyze-nginx-traffic.mjs <access-log[.gz]> [options]',
    '',
    'Analyzes the yayanews_cf Nginx access-log format without changing data.',
    '',
    'Options:',
    '  --limit <n>  Rows per top list. Default: 20.',
    '  -h, --help   Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = { input: '', limit: 20 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--limit') {
      options.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.input) throw new Error(`Unexpected extra input: ${arg}`);
    options.input = arg;
  }
  if (!options.input) throw new Error('Missing access-log input.');
  if (!Number.isFinite(options.limit) || options.limit < 1) throw new Error(`Invalid --limit: ${options.limit}`);
  options.limit = Math.floor(options.limit);
  return options;
}

function decodeLogValue(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function increment(map, key, amount = 1) {
  map.set(key || '(empty)', (map.get(key || '(empty)') || 0) + amount);
}

function top(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, requests]) => ({ value, requests }));
}

function createInput(inputPath) {
  const stream = fs.createReadStream(inputPath);
  return inputPath.toLowerCase().endsWith('.gz') ? stream.pipe(zlib.createGunzip()) : stream;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Access log not found: ${inputPath}`);

  const counters = {
    ips: new Map(),
    userAgents: new Map(),
    paths: new Map(),
    statuses: new Map(),
    methods: new Map(),
    referrers: new Map(),
    cloudflareColos: new Map(),
  };
  const ipPaths = new Map();
  let lines = 0;
  let parsed = 0;
  let parseErrors = 0;
  let staticRequests = 0;
  let declaredBotRequests = 0;
  let emptyReferrerRequests = 0;
  let requestTimeTotal = 0;
  let requestTimeMax = 0;

  const reader = readline.createInterface({ input: createInput(inputPath), crlfDelay: Infinity });
  for await (const line of reader) {
    lines += 1;
    const match = line.match(LOG_RE);
    if (!match?.groups) {
      parseErrors += 1;
      continue;
    }
    parsed += 1;
    const row = {
      ...match.groups,
      host: decodeLogValue(match.groups.host),
      referrer: decodeLogValue(match.groups.referrer),
      userAgent: decodeLogValue(match.groups.userAgent),
      cfRay: decodeLogValue(match.groups.cfRay),
    };
    const requestTime = Number(row.requestTime || 0);
    requestTimeTotal += requestTime;
    requestTimeMax = Math.max(requestTimeMax, requestTime);

    increment(counters.ips, row.ip);
    increment(counters.userAgents, row.userAgent);
    increment(counters.paths, row.path);
    increment(counters.statuses, row.status);
    increment(counters.methods, row.method);
    increment(counters.referrers, row.referrer);
    const colo = row.cfRay.includes('-') ? row.cfRay.split('-').at(-1) : '(unknown)';
    increment(counters.cloudflareColos, colo);

    if (!ipPaths.has(row.ip)) ipPaths.set(row.ip, new Set());
    ipPaths.get(row.ip).add(row.path);
    if (STATIC_PATH_RE.test(row.path)) staticRequests += 1;
    if (BOT_UA_RE.test(row.userAgent)) declaredBotRequests += 1;
    if (!row.referrer || row.referrer === '-') emptyReferrerRequests += 1;
  }

  const topIps = top(counters.ips, options.limit).map((item) => ({
    ...item,
    uniquePaths: ipPaths.get(item.value)?.size || 0,
  }));

  console.log(JSON.stringify({
    input: inputPath,
    lines,
    parsed,
    parseErrors,
    uniqueIps: counters.ips.size,
    staticRequests,
    dynamicRequests: parsed - staticRequests,
    declaredBotRequests,
    emptyReferrerRequests,
    averageRequestTimeMs: parsed ? Math.round((requestTimeTotal / parsed) * 1000) : 0,
    maxRequestTimeMs: Math.round(requestTimeMax * 1000),
    topIps,
    topUserAgents: top(counters.userAgents, options.limit),
    topPaths: top(counters.paths, options.limit),
    statuses: top(counters.statuses, options.limit),
    methods: top(counters.methods, options.limit),
    topReferrers: top(counters.referrers, options.limit),
    cloudflareColos: top(counters.cloudflareColos, options.limit),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
