#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';

import { readEnvFile } from '../lib/read-env.mjs';
import { DEFAULT_SITE_ORIGIN, defaultEnvPath, requireValue } from '../loop/lib.mjs';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function usage() {
  return [
    'Usage: node scripts/verify/google-api-connections.mjs [options]',
    '',
    'Verifies GA4 Data API and GSC Search Analytics connections without printing secrets.',
    '',
    'Options:',
    '  --date-start <date>    Optional GSC window start, YYYY-MM-DD. Default: 8 days ago.',
    '  --date-end <date>      Optional GSC window end, YYYY-MM-DD. Default: 2 days ago.',
    '  --env <path>           Env file. Default: .env.',
    '  -h, --help             Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    dateStart: '',
    dateEnd: '',
    envPath: defaultEnvPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
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

  if (!options.dateStart) options.dateStart = daysAgoIsoDate(8);
  if (!options.dateEnd) options.dateEnd = daysAgoIsoDate(2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error('Invalid --date-start.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error('Invalid --date-end.');
  return options;
}

function daysAgoIsoDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const [key, value] of readEnvFile(envPath)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function envPathExists(key) {
  const value = process.env[key]?.trim();
  return value ? fs.existsSync(value) : false;
}

function parseJsonEnvOrFile(jsonKey, fileKey) {
  if (process.env[jsonKey]) return JSON.parse(process.env[jsonKey]);
  const filePath = process.env[fileKey]?.trim();
  if (filePath) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return null;
}

function buildGa4Client() {
  if (process.env.GA4_CREDENTIALS_BASE64) {
    const credentials = JSON.parse(Buffer.from(process.env.GA4_CREDENTIALS_BASE64, 'base64').toString('utf8'));
    return new BetaAnalyticsDataClient({ credentials });
  }

  if (process.env.GA4_CREDENTIALS_JSON) {
    return new BetaAnalyticsDataClient({ credentials: JSON.parse(process.env.GA4_CREDENTIALS_JSON) });
  }

  const oauth = parseJsonEnvOrFile('GA4_OAUTH_TOKEN_JSON', 'GA4_OAUTH_TOKEN_FILE');
  if (oauth) {
    const authClient = new OAuth2Client({
      clientId: oauth.client_id,
      clientSecret: oauth.client_secret,
    });
    if (oauth.refresh_token) {
      authClient.setCredentials({ refresh_token: oauth.refresh_token });
    } else if (oauth.access_token || oauth.token) {
      authClient.setCredentials({ access_token: oauth.access_token || oauth.token });
    }
    return new BetaAnalyticsDataClient({ authClient });
  }

  return new BetaAnalyticsDataClient();
}

async function verifyGa4() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) throw new Error('Missing GA4_PROPERTY_ID.');

  const client = buildGa4Client();
  const [response] = await client.runReport({
    property: propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`,
    dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }],
    limit: 1,
  });

  return {
    ok: true,
    propertyId,
    rows: response.rows?.length ?? 0,
    credentialSource: process.env.GA4_OAUTH_TOKEN_FILE ? 'GA4_OAUTH_TOKEN_FILE'
      : process.env.GA4_CREDENTIALS_BASE64 ? 'GA4_CREDENTIALS_BASE64'
        : process.env.GA4_CREDENTIALS_JSON ? 'GA4_CREDENTIALS_JSON'
          : process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'GOOGLE_APPLICATION_CREDENTIALS'
            : 'ADC',
  };
}

function serviceAccountFromEnv() {
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const filePath = process.env.GSC_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return null;
}

function oauthCredentialsFromEnv() {
  return parseJsonEnvOrFile('GSC_OAUTH_TOKEN_JSON', 'GSC_OAUTH_TOKEN_FILE')
    || parseJsonEnvOrFile('GSC_OAUTH_TOKEN_JSON', 'GSC_OAUTH_TOKEN_PATH');
}

async function gscAccessToken() {
  if (process.env.GSC_ACCESS_TOKEN) return process.env.GSC_ACCESS_TOKEN.trim();

  const oauth = oauthCredentialsFromEnv();
  if (oauth) {
    if (oauth.refresh_token) {
      const body = new URLSearchParams({
        client_id: oauth.client_id,
        client_secret: oauth.client_secret,
        refresh_token: oauth.refresh_token,
        grant_type: 'refresh_token',
      });
      const response = await fetch(oauth.token_uri || TOKEN_URL, { method: 'POST', body });
      const json = await response.json();
      if (!response.ok) throw new Error(`GSC OAuth refresh failed: ${response.status}`);
      return json.access_token;
    }
    return (oauth.access_token || oauth.token || '').trim();
  }

  const account = serviceAccountFromEnv();
  if (!account?.client_email || !account?.private_key) {
    throw new Error('Missing GSC credentials.');
  }

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  if (process.env.GSC_IMPERSONATE_SUBJECT) claim.sub = process.env.GSC_IMPERSONATE_SUBJECT;

  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify(claim))}`;
  const assertion = `${unsigned}.${base64Url(crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key))}`;
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`GSC service-account token request failed: ${response.status}`);
  return json.access_token;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function verifyGsc(options) {
  const siteUrl = process.env.GSC_SITE_URL || `${DEFAULT_SITE_ORIGIN}/`;
  const pageFilterPrefix = process.env.GSC_PAGE_FILTER_PREFIX || '';
  const token = await gscAccessToken();
  const body = {
    startDate: options.dateStart,
    endDate: options.dateEnd,
    dimensions: ['page'],
    rowLimit: 10,
    type: 'web',
  };
  if (pageFilterPrefix) {
    body.dimensionFilterGroups = [{
      groupType: 'and',
      filters: [{
        dimension: 'page',
        operator: 'contains',
        expression: pageFilterPrefix,
      }],
    }];
  }

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const json = await response.json();
  if (!response.ok) throw new Error(`GSC query failed: ${response.status} ${json.error?.message || ''}`.trim());
  const rows = json.rows || [];

  return {
    ok: true,
    siteUrl,
    pageFilterPrefix,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    rows: rows.length,
    clicks: Math.round(rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0)),
    impressions: Math.round(rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0)),
    credentialSource: process.env.GSC_OAUTH_TOKEN_FILE ? 'GSC_OAUTH_TOKEN_FILE'
      : process.env.GSC_ACCESS_TOKEN ? 'GSC_ACCESS_TOKEN'
        : process.env.GSC_SERVICE_ACCOUNT_JSON ? 'GSC_SERVICE_ACCOUNT_JSON'
          : process.env.GSC_SERVICE_ACCOUNT_FILE ? 'GSC_SERVICE_ACCOUNT_FILE'
            : process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'GOOGLE_APPLICATION_CREDENTIALS'
              : 'unknown',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnv(path.resolve(options.envPath));

  const result = {
    env: path.resolve(options.envPath),
    files: {
      ga4OAuthTokenFile: envPathExists('GA4_OAUTH_TOKEN_FILE'),
      gscOAuthTokenFile: envPathExists('GSC_OAUTH_TOKEN_FILE'),
      googleApplicationCredentials: envPathExists('GOOGLE_APPLICATION_CREDENTIALS'),
    },
    ga4: await verifyGa4(),
    gsc: await verifyGsc(options),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message || String(error),
  }, null, 2));
  process.exit(1);
});
