import * as db from '@yayanews/database';
import * as fs from 'fs';
import * as path from 'path';

// 定义需要拦截的大词（不适合做事件专题）
const GLOBAL_BLACKLIST = new Set([
  '比特币', '以太坊', '美股', '美联储', '加密货币', '区块链', 
  '黄金', '原油', '纳斯达克', '标普500', '美国经济', '中国经济',
  '马斯克', '鲍威尔', '币安', 'A股', '港股', '外汇', '期权',
  'bitcoin', 'ethereum', 'crypto', 'fed', 'gold', 'oil'
]);

async function run() {
  console.log('🚀 正在启动 YayaNews 专题自动化雷达 (Nomination Engine)...');

  const sql = `
    WITH tag_counts AS (
      SELECT 
        t.name as tag_name,
        COUNT(a.id) as article_count,
        MIN(a.published_at) as first_seen,
        MAX(a.published_at) as last_seen
      FROM articles a
      JOIN article_tags at ON a.id = at.article_id
      JOIN tags t ON at.tag_id = t.id
      WHERE a.status = 'published' AND a.published_at >= NOW() - INTERVAL '180 days'
      GROUP BY t.name
    )
    SELECT tag_name, article_count::int, 
           DATE(first_seen) as first_date, 
           DATE(last_seen) as last_date,
           EXTRACT(DAY FROM (last_seen - first_seen))::int as span_days
    FROM tag_counts
    WHERE article_count >= 10
    ORDER BY article_count DESC;
  `;

  try {
    const records = await db.queryAll<{
      tag_name: string;
      article_count: number;
      first_date: Date;
      last_date: Date;
      span_days: number;
    }>(sql);

    console.log(`✅ 数据库基础命中 ${records.length} 个候选 Tag。开始校验边界规则...`);

    const candidates = [];
    const discards = [];

    for (const r of records) {
      if (!r.tag_name || r.tag_name.length < 2) continue;

      if (GLOBAL_BLACKLIST.has(r.tag_name) || GLOBAL_BLACKLIST.has(r.tag_name.toLowerCase())) {
        discards.push({ tag: r.tag_name, reason: '触发大词黑名单' });
        continue;
      }

      if (r.span_days < 5 && r.article_count < 25) {
        discards.push({ tag: r.tag_name, reason: `寿命太短 (${r.span_days}天), 且热度不够` });
        continue;
      }

      candidates.push(r);
    }

    console.log(`\n🎯 经过筛选，获得高质量候选专题事件: ${candidates.length} 个。`);
    console.table(candidates.slice(0, 15).map(c => ({
      'Tag名称': c.tag_name,
      '匹配文章数': c.article_count,
      '时间跨度(天)': c.span_days,
      '最近热度': c.last_date ? new Date(c.last_date).toISOString().split('T')[0] : ''
    })));

    // 输出 CSV 供接下来的人工或 GPT 阅读
    const csvLines = ['Tag Name,Article Count,Span Days,Last Seen'];
    for(const c of candidates) {
      csvLines.push(`"${c.tag_name}",${c.article_count},${c.span_days},${c.last_date ? new Date(c.last_date).toISOString().split('T')[0] : ''}`);
    }
    const outPath = path.join(process.cwd(), 'topic_nomination_output.csv');
    fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
    
    console.log(`\n📄 已生成候选全量表格：${outPath}`);
    console.log('⚠️ 被舍弃的典型词条示例：', discards.slice(0, 3));

  } catch (err) {
    console.error('❌ 执行失败:', err);
  }

  process.exit(0);
}

run();
