import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envContent = fs.readFileSync(path.join(root, '.env'), 'utf8');
const dbUrl = envContent.match(/DATABASE_URL=["']?([^"'\n]+)/)[1].trim();

const pool = new pg.Pool({ connectionString: dbUrl });

async function main() {
  // 1. Article count by lang + status
  const stats = await pool.query(`
    SELECT lang, status, audit_status, COUNT(*)::int as n 
    FROM articles 
    GROUP BY lang, status, audit_status 
    ORDER BY lang, status, audit_status
  `);
  console.log('=== Article counts by lang/status/audit ===');
  console.table(stats.rows);

  // 2. Latest 10 EN published articles
  const latest = await pool.query(`
    SELECT id, LEFT(slug,60) as slug, LEFT(title,50) as title, lang, status, audit_status,
           published_at, cover_image IS NOT NULL as has_cover
    FROM articles 
    WHERE lang='en' AND status='published' AND audit_status='approved'
    ORDER BY published_at DESC 
    LIMIT 10
  `);
  console.log('\n=== Latest 10 EN published+approved articles ===');
  console.table(latest.rows);

  // 3. Any queued/draft/pending EN articles?
  const pending = await pool.query(`
    SELECT id, LEFT(slug,60) as slug, LEFT(title,50) as title, status, audit_status, published_at
    FROM articles 
    WHERE lang='en' AND (status != 'published' OR audit_status != 'approved')
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log('\n=== Unpublished/unapproved EN articles ===');
  console.log('Count:', pending.rows.length);
  if (pending.rows.length > 0) console.table(pending.rows);

  // 4. Check how homepage query works - it uses getPublishedArticles with lang='en'
  const homeQuery = await pool.query(`
    SELECT COUNT(*)::int as n 
    FROM articles a 
    LEFT JOIN categories c ON a.category_id = c.id 
    WHERE a.status = 'published' AND a.audit_status = 'approved' AND a.lang = 'en'
  `);
  console.log('\n=== Homepage query count (lang=en, published, approved) ===');
  console.log('Total:', homeQuery.rows[0].n);

  // 5. Check cover_image status for EN articles
  const covers = await pool.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(cover_image)::int as with_cover,
      COUNT(*) FILTER (WHERE cover_image IS NULL OR cover_image = '')::int as no_cover
    FROM articles 
    WHERE lang='en' AND status='published' AND audit_status='approved'
  `);
  console.log('\n=== EN article cover images ===');
  console.table(covers.rows);

  // 6. Check parent_id linking
  const links = await pool.query(`
    SELECT 
      COUNT(*)::int as total_en,
      COUNT(parent_id)::int as with_parent_id,
      COUNT(*) FILTER (WHERE parent_id IS NULL)::int as without_parent_id
    FROM articles 
    WHERE lang='en' AND status='published' AND audit_status='approved'
  `);
  console.log('\n=== EN article parent_id links ===');
  console.table(links.rows);

  // 7. Sample cover images from ZH vs EN
  const zhCovers = await pool.query(`
    SELECT id, LEFT(slug,50) as slug, LEFT(cover_image,80) as cover_image
    FROM articles WHERE lang='zh' AND status='published' AND audit_status='approved' AND cover_image IS NOT NULL
    ORDER BY published_at DESC LIMIT 5
  `);
  console.log('\n=== Sample ZH article cover images ===');
  console.table(zhCovers.rows);

  const enCovers = await pool.query(`
    SELECT id, LEFT(slug,50) as slug, LEFT(cover_image,80) as cover_image
    FROM articles WHERE lang='en' AND status='published' AND audit_status='approved'
    ORDER BY published_at DESC LIMIT 5
  `);
  console.log('\n=== Sample EN article cover images ===');
  console.table(enCovers.rows);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
