#!/usr/bin/env node
import { defaultEnvPath, withClient } from '../loop/lib.mjs';

const defaults = {
  gscBatches: [
    'gsc-yayanews-2026-06-19-2026-07-02',
    'gsc-domain-2026-06-19-2026-07-02',
  ],
  ga4Batch: 'ga4-traffic-2026-06-19-2026-07-02',
  envPath: defaultEnvPath,
};

function parseArgs(argv) {
  const options = { ...defaults, gscBatches: [...defaults.gscBatches] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--gsc-batch') {
      options.gscBatches = [argv[index + 1]];
      index += 1;
      continue;
    }
    if (arg.startsWith('--gsc-batch=')) {
      options.gscBatches = [arg.slice('--gsc-batch='.length)];
      continue;
    }
    if (arg === '--gsc-batches') {
      options.gscBatches = argv[index + 1].split(',').map((item) => item.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg.startsWith('--gsc-batches=')) {
      options.gscBatches = arg.slice('--gsc-batches='.length).split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--ga4-batch') {
      options.ga4Batch = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--ga4-batch=')) {
      options.ga4Batch = arg.slice('--ga4-batch='.length);
      continue;
    }
    if (arg === '--env') {
      options.envPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envPath = arg.slice('--env='.length);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await withClient(options, async (client) => {
    const gsc = await client.query(
      `
      SELECT import_batch,
             dimension,
             COUNT(*)::int AS rows,
             COALESCE(SUM(clicks), 0)::float AS clicks,
             COALESCE(SUM(impressions), 0)::float AS impressions,
             MIN(date_start)::text AS date_start,
             MAX(date_end)::text AS date_end
      FROM seo_feedback_snapshots
      WHERE source = 'gsc_performance'
        AND import_batch = ANY($1)
      GROUP BY import_batch, dimension
      ORDER BY import_batch, dimension
      `,
      [options.gscBatches],
    );

    const ga4Events = await client.query(
      `
      SELECT event_type,
             COUNT(*)::int AS rows,
             COALESCE(SUM(metric_value), 0)::float AS sessions,
             COALESCE(SUM((raw->>'activeUsers')::numeric), 0)::float AS active_users,
             COALESCE(SUM((raw->>'screenPageViews')::numeric), 0)::float AS screen_page_views,
             MIN(date_start)::text AS date_start,
             MAX(date_end)::text AS date_end
      FROM loop_feedback_events
      WHERE source = 'ga4'
        AND import_batch = $1
      GROUP BY event_type
      ORDER BY event_type
      `,
      [options.ga4Batch],
    );

    const ga4Hosts = await client.query(
      `
      SELECT entity_value AS host,
             COUNT(*)::int AS rows,
             COALESCE(SUM(metric_value), 0)::float AS sessions,
             COALESCE(SUM((raw->>'activeUsers')::numeric), 0)::float AS active_users,
             COALESCE(SUM((raw->>'screenPageViews')::numeric), 0)::float AS screen_page_views
      FROM loop_feedback_events
      WHERE source = 'ga4'
        AND import_batch = $1
        AND event_type = 'traffic_daily_host'
      GROUP BY entity_value
      ORDER BY sessions DESC
      `,
      [options.ga4Batch],
    );

    const topPages = await client.query(
      `
      SELECT url,
             COALESCE(SUM(metric_value), 0)::float AS sessions,
             COALESCE(SUM((raw->>'screenPageViews')::numeric), 0)::float AS screen_page_views
      FROM loop_feedback_events
      WHERE source = 'ga4'
        AND import_batch = $1
        AND event_type = 'traffic_daily_page'
      GROUP BY url
      ORDER BY sessions DESC, screen_page_views DESC
      LIMIT 10
      `,
      [options.ga4Batch],
    );

    console.log(JSON.stringify({
      gsc: gsc.rows,
      ga4Events: ga4Events.rows,
      ga4Hosts: ga4Hosts.rows,
      topPages: topPages.rows,
    }, null, 2));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
