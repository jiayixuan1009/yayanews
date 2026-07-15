#!/usr/bin/env node
import {
  DEFAULT_SITE_ORIGIN,
  analyzeUrl,
  createLoopRun,
  ctrMetric,
  findColumn,
  findPerformanceDimensionColumn,
  finishLoopRun,
  loadCsvExport,
  numericMetric,
  parseCsvRecords,
  performanceDimensionName,
  requireValue,
  withClient,
} from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/import-gsc-performance.mjs <gsc-export-dir-or-zip-or-csv> [options]',
    '',
    'Imports Search Console Performance exports into seo_feedback_snapshots.',
    '',
    'Options:',
    `  --site-origin <url>   Expected site origin. Default: ${DEFAULT_SITE_ORIGIN}`,
    '  --batch <key>         Import batch key. Default: derived from input path and current date.',
    '  --date-start <date>   Optional data window start, YYYY-MM-DD.',
    '  --date-end <date>     Optional data window end, YYYY-MM-DD.',
    '  --env <path>          Env file containing DATABASE_URL. Default: .env',
    '  -h, --help            Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    input: '',
    siteOrigin: DEFAULT_SITE_ORIGIN,
    batch: '',
    dateStart: null,
    dateEnd: null,
    envPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
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
    if (arg === '--env') {
      options.envPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envPath = arg.slice('--env='.length);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.input) throw new Error(`Unexpected extra input: ${arg}`);
    options.input = arg;
  }

  if (!options.input) throw new Error('Missing GSC export input.');
  if (options.dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateStart)) {
    throw new Error(`Invalid --date-start: ${options.dateStart}`);
  }
  if (options.dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(options.dateEnd)) {
    throw new Error(`Invalid --date-end: ${options.dateEnd}`);
  }
  if (!options.batch) {
    const safeInput = options.input.replace(/[\\/:\s]+/g, '-').replace(/^-+|-+$/g, '').slice(-80);
    options.batch = `${new Date().toISOString().slice(0, 10)}-${safeInput || 'gsc'}`;
  }
  return options;
}

function performanceRows(files, siteOrigin) {
  const rows = [];
  for (const file of files) {
    const { headers, records } = parseCsvRecords(file.text);
    if (headers.length === 0 || records.length === 0) continue;

    const clicksColumn = findColumn(headers, ['Clicks']);
    const impressionsColumn = findColumn(headers, ['Impressions']);
    if (!clicksColumn || !impressionsColumn) continue;

    const ctrColumn = findColumn(headers, ['CTR', 'Click-through rate', 'Click through rate']);
    const positionColumn = findColumn(headers, ['Position', 'Average position', 'Avg position']);
    const dimensionColumn = findPerformanceDimensionColumn(headers);
    if (!dimensionColumn) continue;

    const dimension = performanceDimensionName(file.name, dimensionColumn);
    for (const record of records) {
      const label = String(record[dimensionColumn] || '').trim();
      const clicks = numericMetric(record[clicksColumn]);
      const impressions = numericMetric(record[impressionsColumn]);
      if (!label && clicks === 0 && impressions === 0) continue;

      const ctr = ctrMetric(record[ctrColumn], clicks, impressions);
      const position = positionColumn ? numericMetric(record[positionColumn], null) : null;
      const urlInfo = dimension === 'Pages' ? analyzeUrl(label, siteOrigin) : null;
      rows.push({
        file: file.name,
        dimension,
        label,
        clicks,
        impressions,
        ctr,
        position,
        url: urlInfo?.url || null,
        lang: urlInfo?.lang || null,
        entityKind: urlInfo?.entityKind || null,
        entityValue: urlInfo?.entityValue || null,
        raw: record,
      });
    }
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = loadCsvExport(options.input);
  const rows = performanceRows(files, options.siteOrigin);
  if (rows.length === 0) throw new Error('No Search Console Performance rows found in input.');

  await withClient(options, async (client) => {
    const run = await createLoopRun(client, {
      runType: 'import_gsc_performance',
      mode: 'apply',
      source: options.input,
      notes: `batch=${options.batch}`,
    });

    let inserted = 0;
    let updated = 0;
    try {
      for (const row of rows) {
        const result = await client.query(
          `
          INSERT INTO seo_feedback_snapshots(
              source, import_batch, dimension, label, url, lang, entity_kind, entity_value,
              clicks, impressions, ctr, position, date_start, date_end, raw
          )
          VALUES (
              'gsc_performance', $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12::date, $13::date, $14::jsonb
          )
          ON CONFLICT (source, import_batch, dimension, label)
          DO UPDATE SET
              url = EXCLUDED.url,
              lang = EXCLUDED.lang,
              entity_kind = EXCLUDED.entity_kind,
              entity_value = EXCLUDED.entity_value,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              ctr = EXCLUDED.ctr,
              position = EXCLUDED.position,
              date_start = EXCLUDED.date_start,
              date_end = EXCLUDED.date_end,
              raw = EXCLUDED.raw,
              imported_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
          `,
          [
            options.batch,
            row.dimension,
            row.label,
            row.url,
            row.lang,
            row.entityKind,
            row.entityValue,
            row.clicks,
            row.impressions,
            row.ctr,
            row.position,
            options.dateStart,
            options.dateEnd,
            JSON.stringify({ file: row.file, ...row.raw }),
          ],
        );
        if (result.rows[0]?.inserted) inserted += 1;
        else updated += 1;
      }

      const stats = {
        input: options.input,
        batch: options.batch,
        files: files.length,
        rows: rows.length,
        inserted,
        updated,
        dimensions: [...new Set(rows.map((row) => row.dimension))].sort(),
      };
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
