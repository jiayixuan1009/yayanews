import { NextResponse } from 'next/server';
import { getNewsArticlesForNewsSitemap } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';
import { log as baseLog } from '@/lib/logger';

const log = baseLog.child({ route: '/sitemap-news.xml' });

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
  const t = title.trim();
  if (!t.length) return 'zh-cn';
  // Heuristic: mostly ASCII = English
  const asciiRatio = (t.match(/[\x20-\x7E]/g) || []).length / t.length;
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

function buildNewsSitemapXml(articleUrls: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articleUrls}
</urlset>`;
}

/**
 * GSC：带 news 命名空间的 urlset 下必须至少有一个 <url>；无稿时用标准 sitemap（无 news 命名空间）+ 首页，避免「缺少 url」。
 */
function buildStandardHomeSitemapXml(baseUrl: string): string {
  const b = baseUrl.replace(/\/$/, '');
  const zh = escapeXml(`${b}/zh`);
  const en = escapeXml(`${b}/en`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${zh}</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${en}</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

export async function GET() {
  const baseUrl = (siteConfig.siteUrl || '').replace(/\/$/, '');

  try {
    const articles = await getNewsArticlesForNewsSitemap();

    // Filter: need slug + non-empty title; skip pipeline error titles (null-safe)
    const validArticles = articles.filter(a => {
      const slug = typeof a.slug === 'string' ? a.slug.trim() : '';
      const titleRaw = typeof a.title === 'string' ? a.title : '';
      return Boolean(slug) && Boolean(titleRaw.trim()) && !isErrorArticle(titleRaw);
    });

    const articleUrls = validArticles.map(a => {
      const title = (a.title as string).replace(/^EN:\s*/i, ''); // Remove EN: prefix
      const lang = detectLang(title, a.lang);
      const langPrefix = lang === 'en' ? 'en' : 'zh';
      return `
  <url>
    <loc>${escapeXml(`${baseUrl}/${langPrefix}/article/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteConfig.siteName)}</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${toW3CDate(a.published_at || a.updated_at || a.created_at)}</news:publication_date>
      <news:title>${escapeXml(title)}</news:title>
    </news:news>
  </url>`;
    }).join('');

    // P0 SEO：快讯在 flash_news 表，此处 articles 已不含快讯；无新闻稿时勿输出空 news urlset
    const xml =
      validArticles.length > 0 ? buildNewsSitemapXml(articleUrls) : buildStandardHomeSitemapXml(baseUrl);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (e) {
    log.error({ err: e }, 'sitemap-news generation failed');
    const xml = buildStandardHomeSitemapXml(baseUrl);
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  }
}
