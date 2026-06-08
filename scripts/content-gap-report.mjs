/**
 * Connect to the configured database and report common content gaps.
 *
 * Usage:
 *   node scripts/content-gap-report.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readRequiredEnvValue } from './lib/read-env.mjs';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function main() {
  const connectionString = readRequiredEnvValue(path.join(root, '.env'), 'DATABASE_URL');
  const pool = new Pool({ connectionString });

  const rows = async (sql, params = []) => (await pool.query(sql, params)).rows;

  try {
    const [enArt, zhArt, enFlash, zhFlash, enPending, zhPending] = await Promise.all([
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'en' AND status = 'published' AND audit_status = 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'zh' AND status = 'published' AND audit_status = 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM flash_news WHERE lang = 'en'`),
      rows(`SELECT COUNT(*)::int AS n FROM flash_news WHERE lang = 'zh'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'en' AND status = 'published' AND COALESCE(audit_status,'') <> 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'zh' AND status = 'published' AND COALESCE(audit_status,'') <> 'approved'`),
    ]);

    const report = {
      currentDatabaseStats: {
        enPublishedApprovedArticles: enArt[0].n,
        zhPublishedApprovedArticles: zhArt[0].n,
        enFlashNews: enFlash[0].n,
        zhFlashNews: zhFlash[0].n,
        enPublishedButNotApprovedArticles: enPending[0].n,
        zhPublishedButNotApprovedArticles: zhPending[0].n,
      },
      possibleGapsAndActions: [],
    };

    if (enArt[0].n === 0) {
      report.possibleGapsAndActions.push({
        area: 'English long-form articles',
        note: 'No published and approved English articles were found.',
        actions: [
          'Restore English articles from an older database backup if one exists.',
          'Run the translation pipeline to create English versions linked by parent_id.',
          'Manually create and approve a small seed set from the admin UI.',
        ],
      });
    }

    if (enFlash[0].n === 0 && zhFlash[0].n > 0) {
      report.possibleGapsAndActions.push({
        area: 'English flash news',
        note: 'Chinese flash news exists, but English flash news is empty.',
        actions: [
          'Confirm the translation pipeline writes flash_news.lang=en.',
          'Restore recommended seed data if appropriate for this environment.',
        ],
      });
    }

    if (enPending[0].n > 0 || zhPending[0].n > 0) {
      report.possibleGapsAndActions.push({
        area: 'Article audit status',
        note: 'Some published articles are not approved and may be hidden from the public site.',
        actions: [
          'Review and approve the articles from the admin UI, or run a targeted SQL update after business confirmation.',
        ],
      });
    }

    if (report.possibleGapsAndActions.length === 0) {
      report.possibleGapsAndActions.push({
        area: 'No obvious gaps detected',
        note: 'The common zero-content and audit-status checks did not find a clear issue.',
        actions: ['Run this report periodically and compare counts against editorial expectations.'],
      });
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
