/**
 * 连接 .env 中的 DATABASE_URL，列出当前库与「理想状态」相比可能缺失的内容，便于后续补齐。
 * 用法: node scripts/content-gap-report.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readDatabaseUrl() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('缺少 .env，无法读取 DATABASE_URL');
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^DATABASE_URL=(.+)$/);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  throw new Error('.env 中未找到 DATABASE_URL');
}

async function main() {
  const connectionString = readDatabaseUrl();
  const pool = new Pool({ connectionString });

  const rows = async (sql, params = []) => (await pool.query(sql, params)).rows;

  try {
    const [
      enArt,
      zhArt,
      enFlash,
      zhFlash,
      enPending,
      zhPending,
    ] = await Promise.all([
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'en' AND status = 'published' AND audit_status = 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'zh' AND status = 'published' AND audit_status = 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM flash_news WHERE lang = 'en'`),
      rows(`SELECT COUNT(*)::int AS n FROM flash_news WHERE lang = 'zh'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'en' AND status = 'published' AND COALESCE(audit_status,'') <> 'approved'`),
      rows(`SELECT COUNT(*)::int AS n FROM articles WHERE lang = 'zh' AND status = 'published' AND COALESCE(audit_status,'') <> 'approved'`),
    ]);

    const report = {
      当前库统计: {
        英文长文_已发布已审核: enArt[0].n,
        中文长文_已发布已审核: zhArt[0].n,
        英文快讯: enFlash[0].n,
        中文快讯: zhFlash[0].n,
        英文长文_待审核或非approved: enPending[0].n,
        中文长文_待审核或非approved: zhPending[0].n,
      },
      可能缺失与补齐方式: [],
    };

    if (enArt[0].n === 0) {
      report.可能缺失与补齐方式.push({
        项: '英文长文 (articles, lang=en, 前台列表用)',
        说明: 'Git 种子 cloud_seed.sql 不含英文长文；当前库也为 0。',
        后续补齐: [
          '若有旧服务器/RDS：对该库 pg_dump 后只合并 articles（及 article_tags）里 lang=en 的行',
          '若无备份：用现有翻译/Pipeline 从中文稿生成英文稿并写库（parent_id 关联中文母稿）',
          '少量稿件可在 Admin 后台手工创建英文版本并发布、审核通过',
        ],
      });
    }

    if (enFlash[0].n === 0 && zhFlash[0].n > 0) {
      report.可能缺失与补齐方式.push({
        项: '英文快讯',
        说明: '有中文快讯但无英文快讯。',
        后续补齐: [
          '执行 npm run db:restore:recommended 或 db:restore:cloud-seed 导入种子中的英文快讯',
          '确认线上 Pipeline / 翻译任务是否写入 flash_news.lang=en',
        ],
      });
    }

    if (enPending[0].n > 0 || zhPending[0].n > 0) {
      report.可能缺失与补齐方式.push({
        项: '审核状态',
        说明: '存在已发布但未 approved 的稿件，前台若只展示 approved 会看不到。',
        后续补齐: [
          '在 Admin 审核通过，或批量 UPDATE articles SET audit_status = \'approved\' WHERE ...（需业务确认）',
        ],
      });
    }

    if (report.可能缺失与补齐方式.length === 0) {
      report.可能缺失与补齐方式.push({
        项: '(未检出明显缺口)',
        说明: '按当前规则未发现英文长文为 0、或英文快讯全空等典型问题；仍建议对照运营目标核对篇数。',
        后续补齐: ['定期执行本脚本: npm run db:gap-report'],
      });
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
