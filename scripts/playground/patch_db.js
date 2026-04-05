const { Client } = require('pg');

const client = new Client('postgresql://yayanews:REDACTED@127.0.0.1:5432/yayanews');

async function run() {
  try {
    await client.connect();
    const res = await client.query("UPDATE topics SET cover_image = REPLACE(cover_image, '.png', '.jpg')");
    console.log(`Updated ${res.rowCount} rows`);
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
