import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // Seed category English names
  const catUpdates = [
    ['us-stock', 'US Stocks'],
    ['crypto', 'Crypto & Digital Assets'],
    ['derivatives', 'Derivatives'],
    ['hk-stock', 'HK & Asia Markets'],
    ['ai', 'AI & Tech'],
    ['other', 'Other'],
  ];
  for (const [slug, nameEn] of catUpdates) {
    await pool.query(
      `UPDATE categories SET name_en = $1 WHERE slug = $2 AND (name_en IS NULL OR name_en = '')`,
      [nameEn, slug]
    );
  }
  // Fill name_zh from name where missing
  await pool.query(`UPDATE categories SET name_zh = name WHERE name_zh IS NULL`);

  const cats = await pool.query('SELECT slug, name, name_zh, name_en FROM categories ORDER BY sort_order');
  console.log('Categories:', cats.rows);

  // Seed top tags with English names (best-effort for known tags)
  const tagUpdates = [
    ['mei-gu', 'US Stocks'],
    ['jia-mi-huo-bi', 'Cryptocurrency'],
    ['bi-te-bi', 'Bitcoin'],
    ['ke-ji-gu', 'Tech Stocks'],
    ['yin-han-bo-dong-lu', 'Implied Volatility'],
    ['na-si-da-ke', 'NASDAQ'],
    ['shi-chang-fen-xi', 'Market Analysis'],
    ['qi-quan', 'Options'],
    ['yi-tai-fang', 'Ethereum'],
    ['yan-sheng-pin', 'Derivatives'],
    ['ren-gong-zhi-neng', 'AI'],
    ['huang-jin', 'Gold'],
    ['mei-lian-chu', 'Federal Reserve'],
    ['layer2', 'Layer2'],
    ['gang-gu', 'HK Stocks'],
    ['defi', 'DeFi'],
    ['nft', 'NFT'],
    ['yuan-you', 'Crude Oil'],
    ['wai-hui', 'Forex'],
    ['te-si-la', 'Tesla'],
    ['ping-guo', 'Apple'],
    ['ying-wei-da', 'NVIDIA'],
    ['biao-pu-500', 'S&P 500'],
    ['dao-qiong-si', 'Dow Jones'],
  ];
  for (const [slug, nameEn] of tagUpdates) {
    await pool.query(
      `UPDATE tags SET name_en = $1 WHERE slug = $2 AND (name_en IS NULL OR name_en = '')`,
      [nameEn, slug]
    );
  }
  
  const tags = await pool.query('SELECT slug, name, name_en FROM tags WHERE name_en IS NOT NULL ORDER BY slug LIMIT 30');
  console.log('Tags with name_en:', tags.rows);

  await pool.end();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
