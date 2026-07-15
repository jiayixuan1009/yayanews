#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';

import { readEnvFile } from '../lib/read-env.mjs';
import {
  DEFAULT_SITE_ORIGIN,
  analyzeUrl,
  createLoopRun,
  defaultEnvPath,
  finishLoopRun,
  makeKey,
  requireValue,
  withClient,
} from './lib.mjs';

const METRICS = [
  { name: 'sessions' },
  { name: 'activeUsers' },
  { name: 'screenPageViews' },
];

function usage() {
  return [
    'Usage: node scripts/loop/import-ga4-traffic.mjs [options]',
    '',
    'Fetches GA4 traffic and imports it into loop_feedback_events.',
    '',
    'Options:',
    '  --date-start <date>      Required data window start, YYYY-MM-DD.',
    '  --date-end <date>        Required data window end, YYYY-MM-DD.',
    '  --batch <key>            Batch key. Default: ga4-traffic-<date-start>-<date-end>.',
    '  --site-origin <url>      Expected YayaNews origin. Default: https://yayanews.cryptooptiontool.com.',
    '  --out-dir <path>         Output evidence dir. Default: outputs/ga4-traffic/ga4-<date-start>-<date-end>.',
    '  --page-limit <n>         Max GA4 page rows. Default: 5000.',
    '  --env <path>             Env file containing DB and GA4 credentials. Default: .env.',
    '  -h, --help               Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    dateStart: '',
    dateEnd: '',
    batch: '',
    siteOrigin: DEFAULT_SITE_ORIGIN,
    outDir: '',
    pageLimit: 5000,
    envPath: defaultEnvPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    let matched = false;
    for (const key of ['date-start', 'date-end', 'batch', 'site-origin', 'out-dir', 'page-limit', 'env']) {
      if (arg === `--${key}`) {
        setOption(options, key, requireValue(argv, index, arg));
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
    if (!matched) throw new Error(`Unknown option: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error('Missing or invalid --date-start.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error('Missing or invalid --date-end.');
  if (!Number.isFinite(options.pageLimit) || options.pageLimit < 1) throw new Error(`Invalid --page-limit: ${options.pageLimit}`);
  options.pageLimit = Math.floor(options.pageLimit);
  if (!options.batch) options.batch = `ga4-traffic-${options.dateStart}-${options.dateEnd}`;
  if (!options.outDir) options.outDir = path.join('outputs', 'ga4-traffic', `ga4-${options.dateStart}-${options.dateEnd}`);
  return options;
}

function setOption(options, key, value) {
  const map = {
    'date-start': 'dateStart',
    'date-end': 'dateEnd',
    batch: 'batch',
    'site-origin': 'siteOrigin',
    'out-dir': 'outDir',
    'page-limit': 'pageLimit',
    env: 'envPath',
  };
  options[map[key]] = key === 'page-limit' ? Number(value) : value;
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const [key, value] of readEnvFile(envPath)) {
    if (!process.env[key]) process.env[key] = value;
  }
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

async function runReport(client, property, options, dimensions, limit = 10000) {
  const [response] = await client.runReport({
    property,
    dateRanges: [{ startDate: options.dateStart, endDate: options.dateEnd }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: METRICS,
    limit,
    orderBys: [
      { dimension: { dimensionName: 'date' } },
      { metric: { metricName: 'sessions' }, desc: true },
    ],
  });
  return response.rows || [];
}

function gaDate(value) {
  const text = String(value || '');
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text;
}

function metricValues(row) {
  const values = row.metricValues || [];
  return {
    sessions: Number(values[0]?.value || 0),
    activeUsers: Number(values[1]?.value || 0),
    screenPageViews: Number(values[2]?.value || 0),
  };
}

function rowValue(row, index) {
  return row.dimensionValues?.[index]?.value || '';
}

function pageUrl(hostName, pagePath) {
  if (!hostName || !pagePath) return '';
  if (/^https?:\/\//i.test(pagePath)) return pagePath;
  const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  return `https://${hostName}${normalizedPath}`;
}

function buildEvents(reports, options) {
  const events = [];

  for (const row of reports.daily) {
    const date = gaDate(rowValue(row, 0));
    const metrics = metricValues(row);
    events.push({
      eventType: 'traffic_daily_total',
      dedupeKey: makeKey('ga4', 'traffic_daily_total', date),
      url: null,
      lang: null,
      entityKind: 'site',
      entityValue: 'all',
      metricName: 'sessions',
      metricValue: metrics.sessions,
      dateStart: date,
      dateEnd: date,
      raw: { report: 'daily', date, ...metrics },
    });
  }

  for (const row of reports.hostDaily) {
    const date = gaDate(rowValue(row, 0));
    const hostName = rowValue(row, 1);
    const metrics = metricValues(row);
    events.push({
      eventType: 'traffic_daily_host',
      dedupeKey: makeKey('ga4', 'traffic_daily_host', date, hostName),
      url: hostName ? `https://${hostName}/` : null,
      lang: null,
      entityKind: 'host',
      entityValue: hostName || 'unknown',
      metricName: 'sessions',
      metricValue: metrics.sessions,
      dateStart: date,
      dateEnd: date,
      raw: { report: 'hostDaily', date, hostName, ...metrics },
    });
  }

  for (const row of reports.pageDaily) {
    const date = gaDate(rowValue(row, 0));
    const hostName = rowValue(row, 1);
    const pathValue = rowValue(row, 2);
    const url = pageUrl(hostName, pathValue);
    const info = url ? analyzeUrl(url, options.siteOrigin) : null;
    const metrics = metricValues(row);
    events.push({
      eventType: 'traffic_daily_page',
      dedupeKey: makeKey('ga4', 'traffic_daily_page', date, hostName, pathValue),
      url: info?.url || url || null,
      lang: info?.lang || null,
      entityKind: info?.entityKind || 'page',
      entityValue: info?.entityValue || pathValue || 'unknown',
      metricName: 'sessions',
      metricValue: metrics.sessions,
      dateStart: date,
      dateEnd: date,
      raw: { report: 'pageDaily', date, hostName, pagePath: pathValue, ...metrics },
    });
  }

  return events;
}

function aggregateEvents(events) {
  const byKey = new Map();

  for (const event of events) {
    const key = `${event.eventType}\0${event.dedupeKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...event,
        raw: { ...event.raw, sourceRows: 1 },
      });
      continue;
    }

    existing.metricValue += event.metricValue;
    existing.raw.sessions = Number(existing.raw.sessions || 0) + Number(event.raw.sessions || 0);
    existing.raw.activeUsers = Number(existing.raw.activeUsers || 0) + Number(event.raw.activeUsers || 0);
    existing.raw.screenPageViews = Number(existing.raw.screenPageViews || 0) + Number(event.raw.screenPageViews || 0);
    existing.raw.sourceRows = Number(existing.raw.sourceRows || 1) + 1;
    existing.raw.aggregated = true;
  }

  return [...byKey.values()];
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeEvidence(options, reports, events, stats) {
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'metadata.json'), `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

  const lines = [
    ['event_type', 'date', 'url', 'entity_kind', 'entity_value', 'sessions', 'active_users', 'screen_page_views']
      .map(csvEscape).join(','),
  ];
  for (const event of events) {
    lines.push([
      event.eventType,
      event.dateStart,
      event.url || '',
      event.entityKind,
      event.entityValue,
      event.metricValue,
      event.raw.activeUsers,
      event.raw.screenPageViews,
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(path.join(outDir, 'ga4_events.csv'), `${lines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'raw_counts.json'), `${JSON.stringify({
    daily: reports.daily.length,
    hostDaily: reports.hostDaily.length,
    pageDaily: reports.pageDaily.length,
  }, null, 2)}\n`, 'utf8');
}

async function insertEvents(options, events, stats) {
  await withClient(options, async (client) => {
    const run = await createLoopRun(client, {
      runType: 'import_ga4_traffic',
      mode: 'apply',
      source: 'ga4',
      notes: `batch=${options.batch}`,
    });

    let inserted = 0;
    let updated = 0;
    try {
      for (const event of events) {
        const result = await client.query(
          `
          INSERT INTO loop_feedback_events(
              dedupe_key, source, import_batch, event_type, url, lang, entity_kind, entity_value,
              metric_name, metric_value, date_start, date_end, raw
          )
          VALUES ($1, 'ga4', $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12::jsonb)
          ON CONFLICT (source, import_batch, event_type, dedupe_key)
          DO UPDATE SET
              lang = EXCLUDED.lang,
              entity_kind = EXCLUDED.entity_kind,
              entity_value = EXCLUDED.entity_value,
              url = EXCLUDED.url,
              metric_name = EXCLUDED.metric_name,
              metric_value = EXCLUDED.metric_value,
              date_start = EXCLUDED.date_start,
              date_end = EXCLUDED.date_end,
              raw = EXCLUDED.raw,
              imported_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
          `,
          [
            event.dedupeKey,
            options.batch,
            event.eventType,
            event.url,
            event.lang,
            event.entityKind,
            event.entityValue,
            event.metricName,
            event.metricValue,
            event.dateStart,
            event.dateEnd,
            JSON.stringify(event.raw),
          ],
        );
        if (result.rows[0]?.inserted) inserted += 1;
        else updated += 1;
      }
      await finishLoopRun(client, run.id, { stats: { ...stats, inserted, updated } });
      stats.inserted = inserted;
      stats.updated = updated;
    } catch (error) {
      await finishLoopRun(client, run.id, { status: 'failed', stats: { ...stats, error: error.message } });
      throw error;
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnv(options.envPath);

  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) throw new Error('Missing GA4_PROPERTY_ID.');
  const property = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const client = buildGa4Client();

  const reports = {
    daily: await runReport(client, property, options, ['date'], 1000),
    hostDaily: await runReport(client, property, options, ['date', 'hostName'], 10000),
    pageDaily: await runReport(client, property, options, ['date', 'hostName', 'pagePath'], options.pageLimit),
  };
  const rawEvents = buildEvents(reports, options);
  const events = aggregateEvents(rawEvents);

  const stats = {
    source: 'ga4',
    propertyId,
    batch: options.batch,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    outDir: path.resolve(options.outDir),
    reportRows: {
      daily: reports.daily.length,
      hostDaily: reports.hostDaily.length,
      pageDaily: reports.pageDaily.length,
    },
    rawEvents: rawEvents.length,
    events: events.length,
    aggregatedDuplicates: rawEvents.length - events.length,
  };

  await insertEvents(options, events, stats);
  writeEvidence(options, reports, events, stats);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
