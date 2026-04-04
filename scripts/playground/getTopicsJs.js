const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews' });
pool.query("SELECT t.*, (SELECT COUNT(*)::int FROM articles a WHERE a.topic_id = t.id AND a.status = 'published') as article_count FROM topics t WHERE t.status = 'active' ORDER BY t.sort_order, t.created_at DESC LIMIT 5", (err, res) => {
  if (err) console.error(err);
  console.log(res.rows.map(r => r.cover_image));
  pool.end();
});
