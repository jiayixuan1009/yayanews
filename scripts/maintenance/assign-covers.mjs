import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const { Client } = pg;

// Target localhost 5432 because production postgres is not exposed externally.
dbUrl = 'postgresql://yayanews_super:<REDACTED>@127.0.0.1:5432/yayanews';

async function main() {
  if (!dbUrl) throw new Error('DATABASE_URL not found');
  console.log(`Connecting to ${dbUrl.replace(/:[^:@]+@/, ':***@')}...`);
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  const res = await client.query(`SELECT id, title, lang FROM articles WHERE status = 'published' AND cover_image IS NULL`);
  console.log(`Found ${res.rowCount} articles with missing cover images.`);
  
  for (const row of res.rows) {
    const seed = Math.floor(Math.random() * 100000);
    // Use an unoptimized domain that works perfectly as a fallback
    const new_url = `https://images.unsplash.com/photo-1628151015968-3a4429e9efee?q=80&w=1200&auto=format&fit=crop&sig=${seed}`;
    await client.query(`UPDATE articles SET cover_image = $1 WHERE id = $2`, [new_url, row.id]);
    console.log(`Updated [${row.lang}] Article ${row.id}: ${row.title.slice(0, 30)}...`);
  }
  
  console.log('Done.');
  await client.end();
}

main().catch(console.error);
