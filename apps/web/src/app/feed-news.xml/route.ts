import { NextResponse } from 'next/server';
import { getNewsArticlesLast48h, getFlashNews } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';
import { encodeFlashSlug } from '@/lib/ui-utils';

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

export async function GET() {
  const articles = await getNewsArticlesLast48h();
  const flashes = await getFlashNews('zh', 100);

  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const recentFlashes = flashes.filter(f => new Date(f.published_at) >= fortyEightHoursAgo);

  const articleItems = articles.map(a => {
    // Per-article locale prefix — EN articles live at /en/article/..., sending them
    // under /zh/article/... would 404 and create a redirect loop for crawlers.
    const lang = a.lang === 'en' ? 'en' : 'zh';
    const articleUrl = `${siteConfig.siteUrl}/${lang}/article/${a.slug}`;
    return `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(articleUrl)}</link>
      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
      <pubDate>${new Date(a.published_at || a.created_at).toUTCString()}</pubDate>
      <author>${escapeXml(a.author || siteConfig.siteName)}</author>
      <description><![CDATA[${a.summary || a.title}]]></description>
      ${a.category_name ? `<category>${escapeXml(a.category_name)}</category>` : ''}
    </item>`;
  }).join('');

  const flashItems = recentFlashes.map(f => `
    <item>
      <title>${escapeXml(f.title)}</title>
      <link>${escapeXml(`${siteConfig.siteUrl}/zh/flash/${encodeFlashSlug(f)}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${siteConfig.siteUrl}/zh/flash/${encodeFlashSlug(f)}`)}</guid>
      <pubDate>${new Date(f.published_at).toUTCString()}</pubDate>
      <author>${escapeXml(siteConfig.siteName)}</author>
      <description><![CDATA[${f.content || f.title}]]></description>
      <category>7x24快讯</category>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteConfig.siteName)}</title>
    <link>${escapeXml(siteConfig.siteUrl)}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>zh-cn</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteConfig.siteUrl}/feed-news.xml`)}" rel="self" type="application/rss+xml"/>
    ${articleItems}
    ${flashItems}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
