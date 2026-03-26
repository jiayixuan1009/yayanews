/**
 * 根据文章内容为 SQLite 中的文章写入 cover_image（远程图库 URL）。
 *
 * 安全：API Key 仅从环境变量 / 项目根目录 .env 读取，禁止写入仓库。
 * 使用：在 biyanews 目录执行
 *   node scripts/assign-article-covers.mjs
 *   node scripts/assign-article-covers.mjs --dry-run
 *   node scripts/assign-article-covers.mjs --force        # 覆盖已有封面
 *   node scripts/assign-article-covers.mjs --limit=10
 *
 * 依赖：PEXELS_API_KEY、UNSPLASH_ACCESS_KEY、PIXABAY_API_KEY 至少配置一个。
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadEnvFile() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  let limit = null;
  const limArg = process.argv.find(a => a.startsWith('--limit='));
  if (limArg) {
    const n = parseInt(limArg.split('=')[1], 10);
    if (Number.isFinite(n) && n > 0) limit = n;
  }
  return { dryRun, force, limit };
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 栏目默认英文检索词（图库对英文检索更稳） */
const CATEGORY_QUERY = {
  'us-stock': 'wall street stock market',
  'hk-stock': 'hong kong finance skyline',
  crypto: 'cryptocurrency digital finance',
  derivatives: 'commodity futures trading chart',
  ai: 'artificial intelligence technology',
  other: 'global business economy',
};

const TITLE_HINTS = [
  [/比特币|BTC|\bbtc\b/i, 'bitcoin'],
  [/以太坊|ETH|\beth\b/i, 'ethereum'],
  [/黄金/i, 'gold investment'],
  [/原油|石油|WTI|布伦特/i, 'crude oil energy'],
  [/美联储|降息|加息|FOMC/i, 'federal reserve economy'],
  [/A股|沪指|沪深|上证/i, 'shanghai stock exchange'],
  [/港股|恒生/i, 'hong kong stock market'],
  [/AI|人工智能|算力|芯片/i, 'semiconductor technology'],
  [/期货|期权|大宗商品/i, 'commodities trading'],
  [/美元|美债|国债/i, 'us dollar treasury'],
  [/日元|欧元/i, 'foreign exchange currency'],
  [/IPO|上市/i, 'ipo stock listing'],
  [/比特币ETF|现货ETF/i, 'bitcoin etf'],
];

function buildSearchQuery(row) {
  const hints = new Set();
  const blob = `${row.title || ''} ${row.summary || ''} ${stripHtml(row.content || '')}`;
  for (const [re, term] of TITLE_HINTS) {
    if (re.test(blob)) hints.add(term);
  }
  const catSlug = row.category_slug || '';
  const base = CATEGORY_QUERY[catSlug] || CATEGORY_QUERY.other;
  const hintPart = [...hints].slice(0, 3).join(' ');
  let q = [hintPart, base].filter(Boolean).join(' ').trim();
  if (q.length > 120) q = q.slice(0, 120);
  if (!q) q = 'business finance news';
  return q;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPexels(query, apiKey) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.photos?.[0];
  return p?.src?.large2x || p?.src?.large || p?.src?.original || null;
}

async function fetchUnsplash(query, accessKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.results?.[0];
  return p?.urls?.regular || p?.urls?.full || null;
}

async function fetchPixabay(query, apiKey) {
  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const h = data.hits?.[0];
  return h?.largeImageURL || h?.webformatURL || null;
}

async function resolveImageUrl(query, keys) {
  if (keys.pexels) {
    try {
      const u = await fetchPexels(query, keys.pexels);
      if (u) return { url: u, source: 'pexels' };
    } catch {
      /* */
    }
  }
  if (keys.unsplash) {
    try {
      const u = await fetchUnsplash(query, keys.unsplash);
      if (u) return { url: u, source: 'unsplash' };
    } catch {
      /* */
    }
  }
  if (keys.pixabay) {
    try {
      const u = await fetchPixabay(query, keys.pixabay);
      if (u) return { url: u, source: 'pixabay' };
    } catch {
      /* */
    }
  }
  return null;
}

function main() {
  loadEnvFile();
  const { dryRun, force, limit } = parseArgs();

  const keys = {
    pexels: process.env.PEXELS_API_KEY?.trim(),
    unsplash: process.env.UNSPLASH_ACCESS_KEY?.trim(),
    pixabay: process.env.PIXABAY_API_KEY?.trim(),
  };
  if (!keys.pexels && !keys.unsplash && !keys.pixabay) {
    console.error(
      '[covers] 未找到 API Key。请在 .env 中至少配置其一：PEXELS_API_KEY、UNSPLASH_ACCESS_KEY、PIXABAY_API_KEY'
    );
    process.exit(1);
  }

  const dbPath = join(ROOT, 'data', 'yayanews.db');
  if (!existsSync(dbPath)) {
    console.error('[covers] 数据库不存在:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  let sql = `
    SELECT a.id, a.slug, a.title, a.summary, a.content, a.cover_image, c.slug AS category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
  `;
  if (!force) {
    sql += ` AND (a.cover_image IS NULL OR trim(a.cover_image) = '')`;
  }
  sql += ` ORDER BY CASE WHEN a.published_at IS NULL THEN 1 ELSE 0 END, a.published_at DESC, a.id DESC`;

  let rows = db.prepare(sql).all();
  if (limit) rows = rows.slice(0, limit);

  console.log(`[covers] 待处理 ${rows.length} 篇${dryRun ? '（dry-run）' : ''}${force ? '（含覆盖已有封面）' : ''}`);

  const update = db.prepare(`UPDATE articles SET cover_image = ?, updated_at = datetime('now') WHERE id = ?`);

  (async () => {
    let ok = 0;
    let skip = 0;
    for (const row of rows) {
      const q = buildSearchQuery(row);
      const resolved = await resolveImageUrl(q, keys);
      if (!resolved) {
        console.warn(`[covers] 跳过（无图） slug=${row.slug} query=${JSON.stringify(q)}`);
        skip += 1;
        await sleep(400);
        continue;
      }
      if (dryRun) {
        console.log(`[covers] dry-run slug=${row.slug} <- ${resolved.source} query=${JSON.stringify(q)}`);
      } else {
        update.run(resolved.url, row.id);
        console.log(`[covers] 已更新 id=${row.id} slug=${row.slug} (${resolved.source})`);
        ok += 1;
      }
      await sleep(500);
    }
    db.close();
    console.log(`[covers] 完成：写入 ${ok}，跳过 ${skip}${dryRun ? '（dry-run 未写库）' : ''}`);
  })().catch(e => {
    console.error('[covers] 失败:', e.message);
    db.close();
    process.exit(1);
  });
}

main();
