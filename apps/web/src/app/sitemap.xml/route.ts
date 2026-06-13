import { NextResponse } from 'next/server';
import { getArticleSitemapCount, getAuthorsForSitemap, getCategories, getGuidesForSitemap, getIndexableFlashForSitemap, getTagsForSitemap, getTopicsForSitemap } from '@/lib/queries';
import { buildSitemapIndex, type SitemapIndexEntry } from '@/lib/sitemap-xml';
import { CATEGORY_DISPLAY_ORDER } from '@/lib/constants';
import { siteConfig } from '@yayanews/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const CHUNK_SIZE = 1000;
const INDEXABLE_CATEGORY_SLUGS = new Set(CATEGORY_DISPLAY_ORDER);

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
  const [articleCount, categories, topics, tags, authors, guides, flashes] = await Promise.all([
    getArticleSitemapCount().catch(() => 0),
    getCategories().catch(() => []),
    getTopicsForSitemap().catch(() => []),
    getTagsForSitemap().catch(() => []),
    getAuthorsForSitemap().catch(() => []),
    getGuidesForSitemap().catch(() => []),
    getIndexableFlashForSitemap(1).catch(() => []),
  ]);

  const entries: SitemapIndexEntry[] = [
    { loc: chunkUrl('static', 0), lastmod: now },
  ];

  if (categories.some(category => INDEXABLE_CATEGORY_SLUGS.has(category.slug))) {
    entries.push({ loc: chunkUrl('categories', 0), lastmod: now });
  }
  if (authors.length > 0) entries.push({ loc: chunkUrl('authors', 0), lastmod: now });
  if (guides.length > 0) entries.push({ loc: chunkUrl('guides', 0), lastmod: now });
  if (flashes.length > 0) entries.push({ loc: chunkUrl('flash', 0), lastmod: now });

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
