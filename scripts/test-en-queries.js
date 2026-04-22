const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].replace(/["']/g, '').trim();
  }
});

const pool = new Pool({ connectionString: dbUrl });

async function queryGet(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows[0];
}

async function queryAll(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function test() {
  try {
    console.log("1. getPublishedArticles('en', 26)");
    await queryAll(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND a.lang = $1::text
      ORDER BY a.published_at DESC LIMIT $2::int
    `, ['en', 26]);

    console.log("2. getFlashNews('en', 12)");
    await queryAll(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.lang = $1::text
      ORDER BY f.published_at DESC LIMIT $2::int
    `, ['en', 12]);

    console.log("3. getTopics(6)");
    await queryAll(`
      SELECT t.*,
        COALESCE(t.name_zh, t.title) as name_zh,
        COALESCE(t.name_en, t.title) as name_en,
        (
          SELECT COUNT(*)::int
          FROM articles a
          WHERE a.topic_id = t.id AND a.status = 'published'
        ) as article_count,
        (
          SELECT MAX(a.published_at)
          FROM articles a
          WHERE a.topic_id = t.id AND a.status = 'published'
        ) as latest_article_time
      FROM topics t
      WHERE t.status = 'active'
        AND (
          SELECT COUNT(*)
          FROM articles a
          WHERE a.topic_id = t.id AND a.status = 'published'
        ) > 0
      ORDER BY t.sort_order ASC, latest_article_time DESC NULLS LAST, t.created_at DESC
      LIMIT $1::int
    `, [6]);

    console.log("4. getCategoriesOrdered()");
    await queryAll('SELECT *, COALESCE(name_zh, name) as name_zh, COALESCE(name_en, name) as name_en FROM categories ORDER BY sort_order');

    console.log("5. getPopularTags(14)");
    await queryAll(`
      SELECT t.*, COUNT(at.article_id) as article_count
      FROM tags t
      JOIN article_tags at ON t.id = at.tag_id
      JOIN articles a ON at.article_id = a.id
      WHERE a.status = 'published'
        AND a.published_at >= NOW() - INTERVAL '30 days'
      GROUP BY t.id
      ORDER BY article_count DESC
      LIMIT $1::int
    `, [14]);

    console.log("6. getArticleCount()");
    await queryGet("SELECT COUNT(*)::int as count FROM articles WHERE status = 'published' AND audit_status = 'approved'");

    console.log("7. getFlashMaxId('en')");
    await queryGet('SELECT MAX(id) as m FROM flash_news WHERE lang = $1::text', ['en']);

    console.log("8. getPublishedArticleMaxId('en')");
    await queryGet("SELECT MAX(id) as m FROM articles WHERE status = 'published' AND audit_status = 'approved' AND lang = $1::text", ['en']);

    console.log("All queries parsed and completed successfully!");
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await pool.end();
  }
}

test();
