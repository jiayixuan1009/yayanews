import { NextResponse } from 'next/server';
import { getArticleSitemapCount, getAuthorsForSitemap, getCategories, getTagsForSitemap, getTopicsForSitemap } from '@/lib/queries';
import { buildSitemapIndex, type SitemapIndexEntry } from '@/lib/sitemap-xml';
import { siteConfig } from '@yayanews/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const CHUNK_SIZE = 1000;

function baseUrl(): string {
  return (siteConfig.siteUrl || '').replace(/\/$/, '');
}

function chunkCount(count: number): number {
  return Math.max(0, Math.ceil(count / CHUNK_SIZE));
}

function chunkUrl(kind: string, page: number): string {
  return `${baseUrl()}/sitemap-chunk/${kind}/${page}`;
}

export async function GET() {
  const now = new Date();
  const [articleCount, categories, topics, tags, authors] = await Promise.all([
    getArticleSitemapCount().catch(() => 0),
    getCategories().catch(() => []),
    getTopicsForSitemap().catch(() => []),
    getTagsForSitemap().catch(() => []),
    getAuthorsForSitemap().catch(() => []),
  ]);

  const entries: SitemapIndexEntry[] = [
    { loc: chunkUrl('static', 0), lastmod: now },
  ];

  if (categories.length > 0) entries.push({ loc: chunkUrl('categories', 0), lastmod: now });
  if (authors.length > 0) entries.push({ loc: chunkUrl('authors', 0), lastmod: now });

  for (let page = 0; page < chunkCount(articleCount); page += 1) {
    entries.push({ loc: chunkUrl('articles', page), lastmod: now });
  }

  for (let page = 0; page < chunkCount(topics.length); page += 1) {
    entries.push({ loc: chunkUrl('topics', page), lastmod: now });
  }

  for (let page = 0; page < chunkCount(tags.length); page += 1) {
    entries.push({ loc: chunkUrl('tags', page), lastmod: now });
  }

  return new NextResponse(buildSitemapIndex(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
