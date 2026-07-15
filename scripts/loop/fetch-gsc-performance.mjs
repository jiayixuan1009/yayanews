#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_SITE_ORIGIN, defaultEnvPath, requireValue } from './lib.mjs';
import { readEnvFile } from '../lib/read-env.mjs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function usage() {
  return [
    'Usage: node scripts/loop/fetch-gsc-performance.mjs [options]',
    '',
    'Fetches Search Console Performance data and writes CSV files compatible with loop:run.',
    '',
    'Options:',
    `  --site-url <url>       GSC property URL. Default: ${DEFAULT_SITE_ORIGIN}/`,
    '  --date-start <date>    Required data window start, YYYY-MM-DD.',
    '  --date-end <date>      Required data window end, YYYY-MM-DD.',
    '  --out-dir <path>       Output directory. Default: outputs/gsc-performance/gsc-<date-end>.',
    '  --row-limit <n>        API rowLimit per dimension. Default: 25000.',
    '  --page-filter-prefix <url>  Optional page URL prefix filter, useful with Domain properties.',
    '  --env <path>           Env file for credentials. Default: .env.',
    '  -h, --help             Show this help.',
    '',
    'Credentials:',
    '  Prefer GOOGLE_APPLICATION_CREDENTIALS=<service-account-json-path>.',
    '  Also supports GSC_SERVICE_ACCOUNT_JSON=<json>, GSC_OAUTH_TOKEN_FILE=<path>, GSC_OAUTH_TOKEN_JSON=<json>, or GSC_ACCESS_TOKEN=<token>.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    siteUrl: '',
    dateStart: '',
    dateEnd: '',
    outDir: '',
    rowLimit: 25000,
    pageFilterPrefix: null,
    envPath: defaultEnvPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--site-url') {
      options.siteUrl = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--site-url=')) {
      options.siteUrl = arg.slice('--site-url='.length);
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
    if (arg === '--out-dir') {
      options.outDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
      continue;
    }
    if (arg === '--row-limit') {
      options.rowLimit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--row-limit=')) {
      options.rowLimit = Number(arg.slice('--row-limit='.length));
      continue;
    }
    if (arg === '--page-filter-prefix') {
      options.pageFilterPrefix = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--page-filter-prefix=')) {
      options.pageFilterPrefix = arg.slice('--page-filter-prefix='.length);
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error('Missing or invalid --date-start.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error('Missing or invalid --date-end.');
  if (!Number.isFinite(options.rowLimit) || options.rowLimit < 1 || options.rowLimit > 25000) {
    throw new Error(`Invalid --row-limit: ${options.rowLimit}`);
  }
  options.rowLimit = Math.floor(options.rowLimit);
  if (!options.outDir) options.outDir = path.join('outputs', 'gsc-performance', `gsc-${options.dateEnd}`);
  return options;
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const [key, value] of readEnvFile(envPath)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function serviceAccountFromEnv() {
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  }
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GSC_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

function oauthCredentialsFromEnv() {
  if (process.env.GSC_OAUTH_TOKEN_JSON) {
    return JSON.parse(process.env.GSC_OAUTH_TOKEN_JSON);
  }
  const filePath = process.env.GSC_OAUTH_TOKEN_FILE || process.env.GSC_OAUTH_TOKEN_PATH;
  if (filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

async function oauthAccessToken() {
  const credentials = oauthCredentialsFromEnv();
  if (!credentials) return '';

  if (credentials.refresh_token) {
    if (!credentials.client_id || !credentials.client_secret) {
      throw new Error('GSC OAuth credentials require client_id and client_secret when refresh_token is used.');
    }
    const body = new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    });
    const response = await fetch(credentials.token_uri || TOKEN_URL, { method: 'POST', body });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(`GSC OAuth refresh failed: ${response.status} ${JSON.stringify(json)}`);
    }
    return json.access_token;
  }

  return (credentials.access_token || credentials.token || '').trim();
}

async function accessToken() {
  if (process.env.GSC_ACCESS_TOKEN) return process.env.GSC_ACCESS_TOKEN.trim();

  const oauthToken = await oauthAccessToken();
  if (oauthToken) return oauthToken;

  const account = serviceAccountFromEnv();
  if (!account?.client_email || !account?.private_key) {
    throw new Error('Missing GSC credentials. Set GSC_ACCESS_TOKEN, GSC_OAUTH_TOKEN_FILE, GOOGLE_APPLICATION_CREDENTIALS, or GSC_SERVICE_ACCOUNT_JSON.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  if (process.env.GSC_IMPERSONATE_SUBJECT) claim.sub = process.env.GSC_IMPERSONATE_SUBJECT;

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(TOKEN_URL, { method: 'POST', body });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`GSC token request failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function queryDimension(token, options, dimension) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(options.siteUrl)}/searchAnalytics/query`;
  const body = {
    startDate: options.dateStart,
    endDate: options.dateEnd,
    dimensions: [dimension],
    rowLimit: options.rowLimit,
    type: 'web',
  };
  if (options.pageFilterPrefix) {
    body.dimensionFilterGroups = [{
      groupType: 'and',
      filters: [{
        dimension: 'page',
        operator: 'contains',
        expression: options.pageFilterPrefix,
      }],
    }];
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`GSC ${dimension} query failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.rows || [];
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, firstColumn, rows) {
  const lines = [[firstColumn, 'Clicks', 'Impressions', 'CTR', 'Position'].map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push([
      row.keys?.[0] || '',
      Math.round(Number(row.clicks || 0)),
      Math.round(Number(row.impressions || 0)),
      Number(row.ctr || 0),
      row.position === undefined ? '' : Number(row.position || 0),
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnv(options.envPath);
  if (!options.siteUrl) options.siteUrl = process.env.GSC_SITE_URL || `${DEFAULT_SITE_ORIGIN}/`;
  if (options.pageFilterPrefix === null) options.pageFilterPrefix = process.env.GSC_PAGE_FILTER_PREFIX || '';

  const token = await accessToken();
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const pages = await queryDimension(token, options, 'page');
  const queries = await queryDimension(token, options, 'query');
  writeCsv(path.join(outDir, 'Pages.csv'), 'Page', pages);
  writeCsv(path.join(outDir, 'Queries.csv'), 'Top queries', queries);

  const meta = {
    siteUrl: options.siteUrl,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    rowLimit: options.rowLimit,
    pageFilterPrefix: options.pageFilterPrefix,
    pages: pages.length,
    queries: queries.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outDir, ...meta }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
