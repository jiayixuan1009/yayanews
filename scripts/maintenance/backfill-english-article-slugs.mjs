#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

import { readRequiredEnvValue } from '../lib/read-env.mjs';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_SLUG_LENGTH = 88;
const PINYIN_HINTS = new Set([
  'a', 'ai', 'an', 'ba', 'bao', 'bei', 'bi', 'biao', 'bo', 'bu',
  'cai', 'cang', 'ce', 'cha', 'chang', 'chao', 'cheng', 'chi', 'chu',
  'chuang', 'cong', 'da', 'dan', 'dao', 'de', 'deng', 'di', 'dian',
  'die', 'ding', 'dong', 'du', 'duan', 'dui', 'fa', 'fang', 'fei',
  'fen', 'feng', 'fu', 'gang', 'gao', 'ge', 'gong', 'gu', 'guan',
  'guang', 'guo', 'han', 'hao', 'he', 'heng', 'hong', 'hou', 'hua',
  'huan', 'huang', 'hui', 'ji', 'jia', 'jian', 'jiao', 'jie', 'jin',
  'jing', 'ju', 'jun', 'kan', 'kou', 'kuang', 'kun', 'lang', 'li',
  'lian', 'liang', 'lie', 'liu', 'long', 'lu', 'lun', 'mei', 'mo',
  'na', 'neng', 'nian', 'niu', 'pan', 'pao', 'pian', 'po', 'pu',
  'qi', 'qian', 'qing', 'quan', 'qu', 'ru', 'san', 'shang', 'sheng',
  'shi', 'shou', 'shu', 'su', 'suo', 'tai', 'tan', 'tao', 'te',
  'ti', 'tong', 'tou', 'tu', 'tui', 'wai', 'wei', 'wen', 'xi',
  'xia', 'xian', 'xiang', 'xiao', 'xin', 'xing', 'xiu', 'xu', 'ya',
  'yan', 'yang', 'yao', 'yi', 'yin', 'ying', 'you', 'yu', 'yuan',
  'yue', 'zai', 'zhan', 'zhang', 'zhe', 'zhen', 'zhi', 'zhong',
  'zhou', 'zhu', 'zhuan', 'zi', 'zou',
]);

function usage() {
  return [
    'Usage: node scripts/maintenance/backfill-english-article-slugs.mjs [options]',
    '',
    'Options:',
    `  --env <path>             Env file containing DATABASE_URL. Default: ${DEFAULT_ENV_PATH}`,
    `  --limit <n>              Max rows to process. Default: ${DEFAULT_LIMIT}`,
    '  --apply                  Update articles and insert redirect mappings. Default is dry-run.',
    '  --include-ok             Process all English rows, not only low-quality slugs.',
    '  -h, --help               Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: DEFAULT_ENV_PATH,
    limit: DEFAULT_LIMIT,
    apply: false,
    includeOk: false,
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
    if (arg === '--include-ok') {
      options.includeOk = true;
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

function stripBrandSuffix(title) {
  return String(title || '')
    .replace(/\s*\|\s*YayaNews\s*$/i, '')
    .replace(/\s+[-–—]\s+YayaNews\s*$/i, '')
    .trim();
}

function slugifyTitle(title) {
  const normalized = stripBrandSuffix(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  const clipped = normalized.slice(0, DEFAULT_MAX_SLUG_LENGTH).replace(/-+$/g, '');
  return clipped || '';
}

function tokens(slug) {
  return String(slug || '').toLowerCase().split('-').filter(Boolean);
}

function hasNonAsciiOrMojibake(value) {
  return /[^\x00-\x7F]|�|锟|浠|骞|缇|鍖|鑲|鏍|棰|勬|祴|杈/.test(String(value || ''));
}

function looksLikePinyinSlug(slug) {
  const parts = tokens(slug);
  if (parts.length < 8) return false;
  const hintCount = parts.filter((part) => PINYIN_HINTS.has(part)).length;
  const shortCount = parts.filter((part) => part.length <= 4).length;
  return hintCount >= 6 && hintCount / parts.length >= 0.4 && shortCount / parts.length >= 0.65;
}

function slugQualityReasons(slug) {
  const reasons = [];
  if (hasNonAsciiOrMojibake(slug)) reasons.push('non_ascii_or_mojibake');
  if (looksLikePinyinSlug(slug)) reasons.push('pinyin_like');
  if (String(slug || '').endsWith('-en') && looksLikePinyinSlug(String(slug).slice(0, -3))) {
    reasons.push('pinyin_like_en_suffix');
  }
  return reasons;
}

function sameSlug(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

async function uniqueSlug(client, baseSlug, articleId) {
  let candidate = baseSlug;
  let suffix = 2;
  while (true) {
    const { rows } = await client.query(
      'SELECT id FROM articles WHERE slug = $1::text AND id <> $2::bigint LIMIT 1',
      [candidate, articleId]
    );
    if (rows.length === 0) return candidate;

    const suffixText = `-${suffix}`;
    candidate = `${baseSlug.slice(0, DEFAULT_MAX_SLUG_LENGTH - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
    suffix += 1;
  }
}

async function loadCandidates(client, limit) {
  const { rows } = await client.query(
    `
      SELECT id, title, slug, lang, status, audit_status, published_at
      FROM articles
      WHERE lang = 'en'
        AND deleted_at IS NULL
        AND NULLIF(TRIM(title), '') IS NOT NULL
        AND NULLIF(TRIM(slug), '') IS NOT NULL
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT $1::int
    `,
    [limit]
  );
  return rows;
}

async function applyPlan(client, plan) {
  await client.query('BEGIN');
  try {
    for (const item of plan) {
      await client.query(
        `
          INSERT INTO article_slug_redirects (old_slug, article_id, new_slug, lang, reason, updated_at)
          VALUES ($1::text, $2::bigint, $3::text, 'en', $4::text, CURRENT_TIMESTAMP)
          ON CONFLICT (old_slug) DO UPDATE SET
            article_id = EXCLUDED.article_id,
            new_slug = EXCLUDED.new_slug,
            lang = EXCLUDED.lang,
            reason = EXCLUDED.reason,
            updated_at = CURRENT_TIMESTAMP
        `,
        [item.oldSlug, item.id, item.newSlug, item.reason]
      );
      await client.query(
        `
          UPDATE articles
          SET slug = $1::text, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2::bigint AND slug = $3::text
        `,
        [item.newSlug, item.id, item.oldSlug]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

function printPlan(plan, options) {
  const mode = options.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`${mode}: ${plan.length} English article slug update(s) planned.`);
  for (const item of plan.slice(0, 40)) {
    console.log(`- #${item.id} [${item.reason}]`);
    console.log(`  ${item.oldSlug}`);
    console.log(`  -> ${item.newSlug}`);
  }
  if (plan.length > 40) console.log(`... ${plan.length - 40} more omitted from preview.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL || readRequiredEnvValue(options.envPath, 'DATABASE_URL');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const candidates = await loadCandidates(client, options.limit);
    const plan = [];
    const reserved = new Set();

    for (const row of candidates) {
      const reasons = slugQualityReasons(row.slug);
      if (!options.includeOk && reasons.length === 0) continue;

      const baseSlug = slugifyTitle(row.title);
      if (!baseSlug || sameSlug(baseSlug, row.slug)) continue;

      const unique = await uniqueSlug(client, baseSlug, row.id);
      let newSlug = unique;
      let suffix = 2;
      while (reserved.has(newSlug)) {
        const suffixText = `-${suffix}`;
        newSlug = `${baseSlug.slice(0, DEFAULT_MAX_SLUG_LENGTH - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
        suffix += 1;
      }
      reserved.add(newSlug);

      plan.push({
        id: row.id,
        title: row.title,
        oldSlug: row.slug,
        newSlug,
        reason: reasons.join(',') || 'include_ok',
      });
    }

    printPlan(plan, options);
    if (options.apply && plan.length > 0) {
      await applyPlan(client, plan);
      console.log(`Applied ${plan.length} slug update(s).`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
