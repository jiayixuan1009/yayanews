#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  defaultEnvPath,
  formatPct,
  requireValue,
  withClient,
} from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/report-loop-results.mjs [options]',
    '',
    'Writes a Markdown summary of Loop Engine runs, opportunities, and actions.',
    '',
    'Options:',
    '  --days <n>       Reporting window. Default: 14.',
    '  --limit <n>      Rows per section. Default: 20.',
    '  --output <path>  Optional Markdown output path.',
    '  --env <path>     Env file containing DATABASE_URL. Default: .env.',
    '  -h, --help       Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: defaultEnvPath,
    days: 14,
    limit: 20,
    output: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--days') {
      options.days = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--days=')) {
      options.days = Number(arg.slice('--days='.length));
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--output') {
      options.output = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
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

  if (!Number.isFinite(options.days) || options.days < 1) throw new Error(`Invalid --days: ${options.days}`);
  if (!Number.isFinite(options.limit) || options.limit < 1) throw new Error(`Invalid --limit: ${options.limit}`);
  options.days = Math.floor(options.days);
  options.limit = Math.floor(options.limit);
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const markdown = await withClient(options, async (client) => {
    const runs = await client.query(
      `
      SELECT run_type, mode, status, started_at, finished_at, stats
      FROM loop_runs
      WHERE started_at >= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
      ORDER BY started_at DESC
      LIMIT $2
      `,
      [options.days, options.limit],
    );
    const summaries = await client.query(
      `
      SELECT opportunity_type, status, COUNT(*)::int AS count, MAX(last_seen_at) AS last_seen_at
      FROM content_opportunities
      WHERE last_seen_at >= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
      GROUP BY opportunity_type, status
      ORDER BY count DESC, opportunity_type
      `,
      [options.days],
    );
    const opportunities = await client.query(
      `
      SELECT opportunity_type, priority, score, status, entity_kind, entity_value, lang, title, reason, metrics, url
      FROM content_opportunities
      WHERE status = 'open'
      ORDER BY priority DESC, score DESC, last_seen_at DESC
      LIMIT $1
      `,
      [options.limit],
    );
    const actions = await client.query(
      `
      SELECT action_type, status, risk_level, target_kind, target_id, target_value, target_url, result, updated_at
      FROM loop_actions
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $1
      `,
      [options.limit],
    );
    const translations = await client.query(
      `
      SELECT a.id, o.priority, o.score, a.status, a.target_id, a.target_value, a.target_url
      FROM loop_actions a
      JOIN content_opportunities o ON o.id = a.opportunity_id
      WHERE a.action_type = 'translate_en_priority'
        AND a.status IN ('queued', 'executed')
      ORDER BY a.updated_at DESC
      LIMIT $1
      `,
      [options.limit],
    );

    return renderMarkdown({
      options,
      runs: runs.rows,
      summaries: summaries.rows,
      opportunities: opportunities.rows,
      actions: actions.rows,
      translations: translations.rows,
    });
  });

  if (options.output) {
    const out = path.resolve(options.output);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown, 'utf8');
  }
  console.log(markdown);
}

function renderMarkdown({ options, runs, summaries, opportunities, actions, translations }) {
  const lines = [];
  lines.push('# Loop Engine Report');
  lines.push('');
  lines.push(`- Window: last ${options.days} days`);
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Opportunity Summary');
  if (summaries.length === 0) {
    lines.push('- No opportunities in this window.');
  } else {
    lines.push('| Type | Status | Count | Last seen |');
    lines.push('| --- | --- | ---: | --- |');
    for (const row of summaries) {
      lines.push(`| ${md(row.opportunity_type)} | ${md(row.status)} | ${row.count} | ${md(formatDate(row.last_seen_at))} |`);
    }
  }
  lines.push('');

  lines.push('## Top Open Opportunities');
  if (opportunities.length === 0) {
    lines.push('- No open opportunities.');
  } else {
    lines.push('| Priority | Type | Target | Metrics | Reason |');
    lines.push('| ---: | --- | --- | --- | --- |');
    for (const row of opportunities) {
      const metrics = row.metrics || {};
      const metricText = [
        metrics.impressions !== undefined ? `${metrics.impressions} imp` : '',
        metrics.clicks !== undefined ? `${metrics.clicks} clicks` : '',
        metrics.ctr !== undefined ? formatPct(Number(metrics.ctr)) : '',
        metrics.position ? `pos ${Number(metrics.position).toFixed(1)}` : '',
      ].filter(Boolean).join(', ');
      lines.push(`| ${row.priority} | ${md(row.opportunity_type)} | ${md(row.entity_value || row.title)} | ${md(metricText)} | ${md(row.reason)} |`);
    }
  }
  lines.push('');

  lines.push('## Recent Actions');
  if (actions.length === 0) {
    lines.push('- No actions yet.');
  } else {
    lines.push('| Status | Type | Target | Updated |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of actions) {
      lines.push(`| ${md(row.status)} | ${md(row.action_type)} | ${md(row.target_value || row.target_url || '')} | ${md(formatDate(row.updated_at))} |`);
    }
  }
  lines.push('');

  lines.push('## English Translation Queue');
  if (translations.length === 0) {
    lines.push('- No queued translation priorities.');
  } else {
    lines.push('| Priority | Article ID | Target | Status |');
    lines.push('| ---: | ---: | --- | --- |');
    for (const row of translations) {
      lines.push(`| ${row.priority ?? ''} | ${row.target_id ?? ''} | ${md(row.target_value || '')} | ${md(row.status)} |`);
    }
  }
  lines.push('');

  lines.push('## Recent Runs');
  if (runs.length === 0) {
    lines.push('- No loop runs in this window.');
  } else {
    lines.push('| Started | Type | Mode | Status | Stats |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const row of runs) {
      lines.push(`| ${md(formatDate(row.started_at))} | ${md(row.run_type)} | ${md(row.mode)} | ${md(row.status)} | ${md(shortStats(row.stats))} |`);
    }
  }
  lines.push('');

  lines.push('## Guardrails');
  lines.push('- This v1 loop does not directly change canonical, noindex, redirects, robots, or published article body fields.');
  lines.push('- CTR and internal-link actions are briefs/results; publishable text changes still need an explicit editing step.');
  lines.push('- Translation priority actions are intentionally low-risk because Agent 6 still applies existing article quality and duplicate guards.');
  lines.push('');

  return lines.join('\n');
}

function shortStats(stats) {
  if (!stats || typeof stats !== 'object') return '';
  const pairs = Object.entries(stats)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 5)
    .map(([key, value]) => `${key}=${value}`);
  return pairs.join(', ');
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function md(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
