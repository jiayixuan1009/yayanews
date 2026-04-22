/**
 * 清理 BWEnews / 方程式新闻 来源文章的封面图字段
 * 将 cover_image 设为 NULL，前端会自动使用占位图
 *
 * 用法 (在生产机上执行):
 *   DATABASE_URL="postgresql://yayanews:<REDACTED>@127.0.0.1:5432/yayanews" node scripts/clear-bwenews-covers.mjs
 */
import pg from 'pg';
const { Client } = pg;

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('✅ Connected to database');

  // 1. 清理 articles 表
  const articlesResult = await client.query(
    `UPDATE articles SET cover_image = NULL WHERE source ILIKE '%BWEnews%' OR source ILIKE '%方程式%'`
  );
  console.log(`📰 Articles: cleared cover_image for ${articlesResult.rowCount} BWEnews articles`);

  // 2. 查看受影响的文章标题
  const affected = await client.query(
    `SELECT id, title, source FROM articles WHERE source ILIKE '%BWEnews%' OR source ILIKE '%方程式%' ORDER BY id DESC LIMIT 20`
  );
  if (affected.rows.length > 0) {
    console.log('\\n📋 Sample affected articles:');
    affected.rows.forEach(r => console.log(`  #${r.id}: ${r.title} (source: ${r.source})`));
  }

  // 3. 检查 flash_news 表是否有 cover_image 字段
  try {
    const flashResult = await client.query(
      `UPDATE flash_news SET cover_image = NULL WHERE source ILIKE '%BWEnews%' OR source ILIKE '%方程式%'`
    );
    console.log(`⚡ Flash news: cleared cover_image for ${flashResult.rowCount} BWEnews flash items`);
  } catch (e) {
    console.log('⚡ Flash news: table has no cover_image column (OK, skip)');
  }

  await client.end();
  console.log('\\n✅ Done. BWEnews cover images have been cleared.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
