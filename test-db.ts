import { queryAll } from './packages/database/src/index.ts';

async function run() {
  const result = await queryAll(`
    WITH tag_counts AS (
      SELECT 
        trim(both ' ' from unnest(string_to_array(tags, ','))) as tag_name,
        COUNT(*) as article_count,
        MIN(published_at) as first_seen,
        MAX(published_at) as last_seen
      FROM articles 
      WHERE status = 'published' AND published_at >= NOW() - INTERVAL '365 days'
      GROUP BY tag_name
    )
    SELECT tag_name, article_count::int, 
           DATE(first_seen) as first_date, 
           DATE(last_seen) as last_date,
           (DATE(last_seen) - DATE(first_seen)) as span_days
    FROM tag_counts
    WHERE article_count >= 10
    ORDER BY article_count DESC 
    LIMIT 20;
  `);
  console.table(result);
  process.exit(0);
}
run();
