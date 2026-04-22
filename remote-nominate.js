const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: 'postgresql://yayanews:<REDACTED>@127.0.0.1:5432/yayanews' });

const GLOBAL_BLACKLIST = new Set([
  '比特币', '以太坊', '美股', '美联储', '加密货币', '区块链', 
  '黄金', '原油', '纳斯达克', '标普500', '美国经济', '中国经济',
  '马斯克', '鲍威尔', '币安', 'A股', '港股', '外汇', '期权',
  'bitcoin', 'ethereum', 'crypto', 'fed', 'gold', 'oil'
]);

const sql = `
WITH tag_counts AS (
  SELECT 
    trim(both ' ' from unnest(string_to_array(tags, ','))) as tag_name,
    COUNT(*) as article_count,
    MIN(published_at) as first_seen,
    MAX(published_at) as last_seen
  FROM articles 
  WHERE status = 'published' AND published_at >= NOW() - INTERVAL '180 days'
  GROUP BY tag_name
)
SELECT tag_name, article_count::int, 
       DATE(first_seen) as first_date, 
       DATE(last_seen) as last_date,
       EXTRACT(DAY FROM (last_seen - first_seen))::int as span_days
FROM tag_counts
WHERE article_count >= 10
ORDER BY article_count DESC;
`;

pool.query(sql).then(res => {
  const records = res.rows;
  console.log('✅ 数据库基础命中 %d 个候选 Tag。开始校验边界规则...', records.length);
  
  const candidates = [];
  const discards = [];

  for (const r of records) {
    if (!r.tag_name || r.tag_name.length < 2) continue;
    if (GLOBAL_BLACKLIST.has(r.tag_name) || GLOBAL_BLACKLIST.has(r.tag_name.toLowerCase())) {
      discards.push({ tag: r.tag_name, reason: '大词黑名单' });
      continue;
    }
    if (r.span_days < 5 && r.article_count < 25) {
      discards.push({ tag: r.tag_name, reason: '事件太短热度不够' });
      continue;
    }
    candidates.push(r);
  }

  console.log('\n🎯 经过筛选，获得高质量候选专题事件: %d 个。', candidates.length);
  console.table(candidates.slice(0, 15).map(c => ({
    'Tag名称': c.tag_name,
    '匹配文章': c.article_count,
    '时间跨度': c.span_days,
    '最近热度': c.last_date ? c.last_date.toISOString().split('T')[0] : ''
  })));

  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
