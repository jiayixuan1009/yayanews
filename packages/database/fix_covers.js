const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://yayanews:<REDACTED>@127.0.0.1:5432/yayanews' });
  await client.connect();
  
  const res = await client.query(`SELECT id FROM articles WHERE source LIKE '%BWEnews%'`);
  console.log(`Found ${res.rowCount} BWEnews articles`);
  
  for (const row of res.rows) {
    const seed = Math.floor(Math.random() * 100000);
    const new_url = `https://loremflickr.com/1200/630/finance,crypto,business/all?lock=${seed}`;
    await client.query(`UPDATE articles SET cover_image = $1 WHERE id = $2`, [new_url, row.id]);
    console.log(`Updated article ${row.id} cover -> ${new_url}`);
  }
  
  await client.end();
}

main().catch(console.error);
