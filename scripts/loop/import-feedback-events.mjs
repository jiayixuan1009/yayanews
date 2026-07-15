#!/usr/bin/env node
import {
  DEFAULT_SITE_ORIGIN,
  analyzeUrl,
  createLoopRun,
  findColumn,
  finishLoopRun,
  loadCsvExport,
  makeKey,
  numericMetric,
  parseCsvRecords,
  requireValue,
  withClient,
} from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/import-feedback-events.mjs <csv-or-dir-or-zip> [options]',
    '',
    'Imports generic feedback signals such as GA4, crawl errors, logs, or sitemap quality events.',
    '',
    'Options:',
    '  --source <name>       Required source name, for example ga4, server_logs, crawl_errors.',
    '  --event-type <type>   Required event type, for example page_quality, googlebot_hit, crawl_error.',
    '  --batch <key>         Import batch key. Default: source-event-date.',
    '  --metric-name <name>  Metric name when CSV has a value column. Default: value.',
    '  --date-start <date>   Optional data window start, YYYY-MM-DD.',
    '  --date-end <date>     Optional data window end, YYYY-MM-DD.',
    `  --site-origin <url>   Expected site origin. Default: ${DEFAULT_SITE_ORIGIN}`,
    '  --env <path>          Env file containing DATABASE_URL. Default: .env.',
    '  -h, --help            Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    input: '',
    source: '',
    eventType: '',
    batch: '',
    metricName: 'value',
    dateStart: null,
    dateEnd: null,
    siteOrigin: DEFAULT_SITE_ORIGIN,
    envPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    let matched = false;
    for (const key of ['source', 'event-type', 'batch', 'metric-name', 'date-start', 'date-end', 'site-origin', 'env']) {
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
    if (!arg.startsWith('-') && !options.input) options.input = arg;
  }

  if (!options.input) throw new Error('Missing input.');
  if (!options.source) throw new Error('Missing --source.');
  if (!options.eventType) throw new Error('Missing --event-type.');
  if (options.dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) throw new Error(`Invalid --date-start: ${options.dateStart}`);
  if (options.dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) throw new Error(`Invalid --date-end: ${options.dateEnd}`);
  if (!options.batch) options.batch = `${options.source}-${options.eventType}-${new Date().toISOString().slice(0, 10)}`;
  return options;
}

function knownOption(arg) {
  return ['source', 'event-type', 'batch', 'metric-name', 'date-start', 'date-end', 'site-origin', 'env']
    .some((key) => arg === `--${key}` || arg.startsWith(`--${key}=`));
}

function setOption(options, key, value) {
  const map = {
    source: 'source',
    'event-type': 'eventType',
    batch: 'batch',
    'metric-name': 'metricName',
    'date-start': 'dateStart',
    'date-end': 'dateEnd',
    'site-origin': 'siteOrigin',
    env: 'envPath',
  };
  options[map[key]] = value;
}

function rowsFromFiles(files, options) {
  const rows = [];
  for (const file of files) {
    const { headers, records } = parseCsvRecords(file.text);
    if (headers.length === 0 || records.length === 0) continue;
    const urlColumn = findColumn(headers, ['url', 'page', 'landing page', 'path']);
    const labelColumn = findColumn(headers, ['label', 'query', 'event', 'reason']) || urlColumn;
    const metricColumn = findColumn(headers, [options.metricName, 'value', 'count', 'sessions', 'views', 'errors', 'hits']);

    for (const record of records) {
      const rawUrl = urlColumn ? String(record[urlColumn] || '').trim() : '';
      const rawLabel = labelColumn ? String(record[labelColumn] || '').trim() : '';
      const info = rawUrl ? analyzeUrl(rawUrl, options.siteOrigin) : null;
      rows.push({
        dedupeKey: makeKey(options.source, options.eventType, rawUrl || rawLabel || file.name, options.metricName),
        url: info?.url || rawUrl || null,
        lang: info?.lang || null,
        entityKind: info?.entityKind || null,
        entityValue: info?.entityValue || rawLabel || null,
        metricValue: metricColumn ? numericMetric(record[metricColumn], null) : null,
        raw: { file: file.name, ...record },
      });
    }
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = loadCsvExport(options.input);
  const rows = rowsFromFiles(files, options);
  if (rows.length === 0) throw new Error('No feedback rows found in input.');

  await withClient(options, async (client) => {
    const run = await createLoopRun(client, {
      runType: 'import_feedback_events',
      mode: 'apply',
      source: options.input,
      notes: `source=${options.source} event_type=${options.eventType} batch=${options.batch}`,
    });
    let inserted = 0;
    let updated = 0;
    try {
      for (const row of rows) {
        const result = await client.query(
          `
          INSERT INTO loop_feedback_events(
              dedupe_key, source, import_batch, event_type, url, lang, entity_kind, entity_value,
              metric_name, metric_value, date_start, date_end, raw
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12::date, $13::jsonb)
          ON CONFLICT (source, import_batch, event_type, dedupe_key)
          DO UPDATE SET
              lang = EXCLUDED.lang,
              entity_kind = EXCLUDED.entity_kind,
              entity_value = EXCLUDED.entity_value,
              url = EXCLUDED.url,
              metric_name = EXCLUDED.metric_name,
              metric_value = EXCLUDED.metric_value,
              raw = EXCLUDED.raw,
              imported_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
          `,
          [
            row.dedupeKey,
            options.source,
            options.batch,
            options.eventType,
            row.url,
            row.lang,
            row.entityKind,
            row.entityValue,
            options.metricName,
            row.metricValue,
            options.dateStart,
            options.dateEnd,
            JSON.stringify(row.raw),
          ],
        );
        if (result.rows[0]?.inserted) inserted += 1;
        else updated += 1;
      }
      const stats = { rows: rows.length, inserted, updated, source: options.source, eventType: options.eventType, batch: options.batch };
      await finishLoopRun(client, run.id, { stats });
      console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
      await finishLoopRun(client, run.id, { status: 'failed', stats: { error: error.message } });
      throw error;
    }
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
