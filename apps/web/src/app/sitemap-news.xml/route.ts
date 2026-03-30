import { NextResponse } from 'next/server';
import { getNewsArticlesLast48h } from '@/lib/queries';
import { siteConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const articles = await getNewsArticlesLast48h();

  const urls = articles.map(a => `
  <url>
    <loc>${escapeXml(`${siteConfig.siteUrl}/article/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteConfig.siteName)}</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(a.updated_at || a.published_at || a.created_at)}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
