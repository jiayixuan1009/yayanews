#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

import { readRequiredEnvValue } from '../lib/read-env.mjs';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
const DEFAULT_LIMIT = 5000;
const ASCII_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
    'Usage: node scripts/verify/check-article-slug-policy.mjs [options]',
    '',
    'Options:',
    `  --env <path>       Env file containing DATABASE_URL. Default: ${DEFAULT_ENV_PATH}`,
    `  --limit <n>        Max rows to scan. Default: ${DEFAULT_LIMIT}`,
    '  -h, --help         Show this help.',
  ].join('\n');
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function parseArgs(argv) {
  const options = {
    envPath: DEFAULT_ENV_PATH,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
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

function tokens(slug) {
  return String(slug || '').toLowerCase().split('-').filter(Boolean);
}

function looksLikePinyinSlug(slug) {
  const parts = tokens(slug).map((part) => part.replace(/^\d+|\d+$/g, '')).filter(Boolean);
  if (parts.length < 6) return false;
  const hintCount = parts.filter((part) => PINYIN_HINTS.has(part)).length;
  const shortCount = parts.filter((part) => part.length <= 4).length;
  return hintCount >= 4 && hintCount / parts.length >= 0.4 && shortCount / parts.length >= 0.6;
}

function policyReasons(row) {
  const reasons = [];
  const slug = String(row.slug || '');
  const lang = String(row.lang || '').toLowerCase();

  if (!ASCII_SLUG_RE.test(slug)) {
    reasons.push('not_lowercase_ascii_slug');
  }

  if (lang === 'en') {
    if (looksLikePinyinSlug(slug)) {
      reasons.push('english_slug_looks_pinyin');
    }
    if (slug.endsWith('-en') && looksLikePinyinSlug(slug.slice(0, -3))) {
      reasons.push('english_slug_has_pinyin_en_suffix');
    }
  }

  return reasons;
}

async function loadArticles(client, limit) {
  const { rows } = await client.query(
    `
      SELECT id, title, slug, lang, status, audit_status, published_at, created_at
      FROM articles
      WHERE deleted_at IS NULL
        AND lang IN ('zh', 'en')
        AND NULLIF(TRIM(slug), '') IS NOT NULL
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT $1::int
    `,
    [limit]
  );
  return rows;
}

function printViolations(violations, checked) {
  console.log(`Checked ${checked} article slug(s). Violations: ${violations.length}.`);
  for (const item of violations.slice(0, 80)) {
    console.log(`- #${item.id} [${item.lang}] ${item.reasons.join(',')}`);
    console.log(`  slug: ${item.slug}`);
    console.log(`  title: ${String(item.title || '').slice(0, 140)}`);
  }
  if (violations.length > 80) {
    console.log(`... ${violations.length - 80} more omitted.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL || readRequiredEnvValue(options.envPath, 'DATABASE_URL');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const articles = await loadArticles(client, options.limit);
    const violations = articles
      .map((row) => ({ ...row, reasons: policyReasons(row) }))
      .filter((row) => row.reasons.length > 0);

    printViolations(violations, articles.length);
    if (violations.length > 0) process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
