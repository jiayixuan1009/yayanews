#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

import { readRequiredEnvValue } from '../lib/read-env.mjs';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
const DEFAULT_LIMIT = 200;

function usage() {
  return [
    'Usage: node scripts/maintenance/backfill-review-metadata.mjs [options]',
    '',
    'Backfills reviewer_id/reviewed_at only for articles that already carry an approved audit signal.',
    'Default mode is dry-run; pass --apply to update rows.',
    '',
    'Options:',
    `  --env <path>       Env file containing DATABASE_URL. Default: ${DEFAULT_ENV_PATH}`,
    `  --limit <n>        Max rows to inspect/update. Default: ${DEFAULT_LIMIT}`,
    '  --apply            Update rows. Default is dry-run.',
    '  -h, --help         Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: DEFAULT_ENV_PATH,
    limit: DEFAULT_LIMIT,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
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
    if (arg === '--limit') {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) {
    throw new Error(`Invalid --limit: ${options.limit}`);
  }
  options.limit = Math.floor(options.limit);
  return options;
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL || readRequiredEnvValue(options.envPath, 'DATABASE_URL');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const reviewer = await client.query("SELECT id, display_name FROM authors WHERE slug = 'yayanews-editorial' LIMIT 1");
    if (reviewer.rowCount === 0) throw new Error('Missing yayanews-editorial author row.');

    const auditReasonColumn = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'articles'
          AND column_name = 'audit_reason'
      ) AS exists
      `,
    );
    const hasAuditReason = Boolean(auditReasonColumn.rows[0]?.exists);
    const reviewerId = reviewer.rows[0].id;
    if (!hasAuditReason) {
      console.log(JSON.stringify({
        mode: options.apply ? 'apply' : 'dry-run',
        reviewer: {
          id: reviewerId,
          displayName: reviewer.rows[0].display_name,
        },
        inspectedLimit: options.limit,
        candidateCount: 0,
        updatedCount: 0,
        note: 'audit_reason column is missing; historical review metadata was not inferred.',
      }, null, 2));
      return;
    }

    const candidates = await client.query(
      `
      SELECT id, lang, slug, title, published_at, audit_reason
      FROM articles
      WHERE status = 'published'
        AND audit_status = 'approved'
        AND reviewed_at IS NULL
        AND reviewer_id IS NULL
        AND NULLIF(TRIM(COALESCE(audit_reason, '')), '') IS NOT NULL
      ORDER BY id DESC
      LIMIT $1
      `,
      [options.limit],
    );

    const result = {
      mode: options.apply ? 'apply' : 'dry-run',
      reviewer: {
        id: reviewerId,
        displayName: reviewer.rows[0].display_name,
      },
      inspectedLimit: options.limit,
      candidateCount: candidates.rowCount,
      examples: candidates.rows.slice(0, 10).map((row) => ({
        id: row.id,
        lang: row.lang,
        slug: row.slug,
        title: row.title,
        published_at: row.published_at,
        audit_reason: row.audit_reason,
      })),
      updatedCount: 0,
    };

    if (options.apply && candidates.rowCount > 0) {
      const ids = candidates.rows.map((row) => row.id);
      const update = await client.query(
        `
        UPDATE articles
        SET reviewer_id = COALESCE(reviewer_id, $1),
            reviewed_at = COALESCE(reviewed_at, updated_at, published_at, created_at, CURRENT_TIMESTAMP)
        WHERE id = ANY($2::int[])
        RETURNING id
        `,
        [reviewerId, ids],
      );
      result.updatedCount = update.rowCount;
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
