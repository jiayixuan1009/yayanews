const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL || 'postgresql://yayanews_super:<REDACTED>@localhost:5432/yayanews');

async function main() {
  await client.connect();

  console.log("=== TOPICS COUNT ===");
  const res1 = await client.query(`
    SELECT t.id, t.title, t.status, t.cover_image,
      (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id AND a.status='published' AND a.audit_status='approved') as approved_articles
    FROM topics t
    ORDER BY approved_articles DESC, t.id ASC
  `);
  console.table(res1.rows);

  console.log("\n=== CATEGORY IMAGES ===");
  const res2 = await client.query(`
    SELECT id, slug, name, cover_image FROM categories ORDER BY id
  `);
  console.table(res2.rows);

  await client.end();
}

main().catch(console.error);
