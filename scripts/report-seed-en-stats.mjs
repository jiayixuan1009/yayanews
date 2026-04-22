/**
 * 比对仓库内唯一全量种子 data/cloud_seed.sql 中英文快讯/英文文章规模与最新时间戳。
 * 用法: node scripts/report-seed-en-stats.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'data', 'cloud_seed.sql');

function maxTimestamps(lines) {
  let max = '';
  for (const L of lines) {
    const re = /'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'/g;
    let m;
    while ((m = re.exec(L)) !== null) {
      if (m[1] > max) max = m[1];
    }
  }
  return max;
}

function main() {
  if (!fs.existsSync(seedPath)) {
    console.error('缺少 data/cloud_seed.sql，请执行: git checkout HEAD -- data/cloud_seed.sql');
    process.exit(1);
  }
  const s = fs.readFileSync(seedPath, 'utf8');
  const lines = s.split(/\r?\n/);
  const enFlash = [];
  const zhFlash = [];
  const flashRe = /^INSERT INTO public\.flash_news VALUES/;

  for (const line of lines) {
    if (flashRe.test(line)) {
      if (/, 'en', '[^']*'\) ON CONFLICT/.test(line)) enFlash.push(line);
      else if (/, 'zh', '[^']*'\) ON CONFLICT/.test(line)) zhFlash.push(line);
    }
  }

  /** articles 存在多行 INSERT，按语句块解析语言（lang 在尾部 approved 之前若干字段） */
  const articleBlocks = [];
  let from = 0;
  while (true) {
    const a = s.indexOf('INSERT INTO public.articles VALUES', from);
    if (a < 0) break;
    const b = s.indexOf('ON CONFLICT DO NOTHING;', a);
    if (b < 0) break;
    articleBlocks.push(s.slice(a, b + 'ON CONFLICT DO NOTHING;'.length));
    from = b + 1;
  }
  let enArticles = 0;
  let zhArticles = 0;
  for (const block of articleBlocks) {
    const tail = block.slice(-Math.min(900, block.length));
    const langEn = /, 'en', '(neutral|bullish|bearish)',/.test(tail);
    const langZh = /, 'zh', '(neutral|bullish|bearish)',/.test(tail);
    if (langEn) enArticles += 1;
    else if (langZh) zhArticles += 1;
    else if (/, 'en',/.test(tail)) enArticles += 1;
    else if (/, 'zh',/.test(tail)) zhArticles += 1;
  }

  const dumpMeta = s.match(/-- Dumped from database version ([^\n]+)/);
  const pgDumpMeta = s.match(/-- Dumped by pg_dump version ([^\n]+)/);

  const out = {
    推荐恢复文件: 'data/cloud_seed.sql（与 git HEAD 一致；仓库内仅此一份全量 pg_dump 数据）',
    说明: '无其它分支/其它 .sql 含更新全库快照；schema 类脚本不含业务数据。',
    pg_dump: {
      databaseVersion: dumpMeta ? dumpMeta[1].trim() : null,
      pgDumpVersion: pgDumpMeta ? pgDumpMeta[1].trim() : null,
    },
    英文快讯: { 条数: enFlash.length, 行内最新时间戳: maxTimestamps(enFlash) },
    中文快讯: { 条数: zhFlash.length, 行内最新时间戳: maxTimestamps(zhFlash) },
    长文articles总计: articleBlocks.length,
    英文长文articles: {
      条数: enArticles,
      说明: enArticles === 0 ? '本种子中无 lang=en 的长文；英文文章只能从旧库/备份/翻译管线补' : '',
    },
    中文长文articles: { 条数: zhArticles },
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
