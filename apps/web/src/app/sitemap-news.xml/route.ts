import { NextResponse } from 'next/server';
import { getNewsArticlesLast48h } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeXml(s: any): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Convert date to W3C DateTime (ISO 8601) format required by Google News Sitemap */
function toW3CDate(dateStr: any): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/** Detect article language from title heuristic */
function detectLang(title: string, lang?: string): string {
  if (lang === 'en') return 'en';
  if (lang === 'zh') return 'zh-cn';
  // Heuristic: mostly ASCII = English
  const asciiRatio = (title.match(/[\x20-\x7E]/g) || []).length / title.length;
  return asciiRatio > 0.8 ? 'en' : 'zh-cn';
}

/** Check if article title indicates a generation error */
function isErrorArticle(title: string): boolean {
  const errorPatterns = [
    'Unable to Produce',
    'Factual Error',
    'Error generating',
    '无法生成',
  ];
  return errorPatterns.some(p => title.includes(p));
}

export async function GET() {
  const articles = await getNewsArticlesLast48h();

  // Filter out error articles and clean titles
  const validArticles = articles.filter(a => !isErrorArticle(a.title));

  const articleUrls = validArticles.map(a => {
    const title = a.title.replace(/^EN:\s*/i, ''); // Remove EN: prefix
    const lang = detectLang(title, a.lang);
    const langPrefix = lang === 'en' ? 'en' : 'zh';
    return `
  <url>
    <loc>${escapeXml(`${siteConfig.siteUrl}/${langPrefix}/article/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteConfig.siteName)}</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${toW3CDate(a.updated_at || a.published_at || a.created_at)}</news:publication_date>
      <news:title>${escapeXml(title)}</news:title>
    </news:news>
  </url>`;
  }).join('');

  // P0 SEO: Flash news excluded from News Sitemap (thin content, no editorial depth)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articleUrls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
