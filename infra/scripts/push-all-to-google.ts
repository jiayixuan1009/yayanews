import 'dotenv/config';
import { queryAll } from '@yayanews/database';

function titleToSlug(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u00c0-\u024f\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/, '');
}

function encodeFlashSlug(flash: { id: number; title: string; published_at: Date }): string {
    const slug = titleToSlug(flash.title);
    if (slug) return `${slug}-${flash.id}`;
    
    // Fallback
    const dtStr = flash.published_at.toISOString();
    let cleaned = dtStr.replace(/[-T:Z.\s]/g, '');
    const yyyymmddhh = cleaned.slice(0, 10);
    const paddedId = String(flash.id).padStart(4, '0');
    return `${yyyymmddhh}${paddedId}`;
}

const BASE_URL = 'https://yayanews.cryptooptiontool.com';

async function main() {
  console.log('Fetching latest pages from database...');
  
  // Get latest 50 articles
  const resArt = await queryAll(`
    SELECT slug FROM articles 
    WHERE status='published'
    ORDER BY published_at DESC LIMIT 50
  `);
  
  // Get latest 50 flash news
  const resFlash = await queryAll(`
    SELECT id, title, published_at FROM flash_news 
    ORDER BY published_at DESC LIMIT 50
  `);

  const urlsToPush: string[] = [];
  resArt.forEach((art: any) => {
    urlsToPush.push(`/zh/article/${encodeURIComponent(art.slug)}`);
    urlsToPush.push(`/en/article/${encodeURIComponent(art.slug)}`);
  });

  resFlash.forEach((flash: any) => {
    const flashSlug = encodeFlashSlug(flash);
    urlsToPush.push(`/zh/flash/${encodeURIComponent(flashSlug)}`);
    urlsToPush.push(`/en/flash/${encodeURIComponent(flashSlug)}`);
  });

  console.log(`Prepared ${urlsToPush.length} URLs. Sending to webhook...`);

  const WEBHOOK_URL = process.env.INDEXING_WEBHOOK_URL || 'https://yayanews.cryptooptiontool.com/api/webhooks/indexing';
  const SECRET = process.env.INDEXING_WEBHOOK_SECRET?.trim();
  if (!SECRET) {
    throw new Error('INDEXING_WEBHOOK_SECRET is required to push indexing updates.');
  }

  // Chunk to 50 URLs per request to avoid payload too large or timeouts
  const chunkSize = 50;
  let successCount = 0;
  
  for (let i = 0; i < urlsToPush.length; i += chunkSize) {
      const chunk = urlsToPush.slice(i, i + chunkSize);
      try {
        const resp = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SECRET}`
            },
            body: JSON.stringify({ urls: chunk })
        });
        
        const data = await resp.json();
        if (resp.ok) {
            console.log(`✅ Sent chunk ${i/chunkSize + 1} successfully: `, data.results?.length, 'URLs processed by Google API.');
            successCount += chunk.length;
        } else {
            console.error(`❌ Error sending chunk ${i/chunkSize + 1}: `, data);
            if (data.error && data.error.includes('Quota')) {
                console.log('⚠️ Hit Google Indexing API Quota!');
                break;
            }
        }
      } catch (e: any) {
          console.error(`❌ Network error sending chunk ${i/chunkSize + 1}:`, e.message);
      }
  }

  console.log(`\n\nPush Summary`);
  console.log(`- URLs pushed to Webhook: ${successCount} / ${urlsToPush.length}`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
