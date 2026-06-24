import { NextResponse } from 'next/server';
import { getArticleSitemapCount, getAuthorsForSitemap, getCategories, getGuidesForSitemap, getLatestArticleUpdatedAt, getTagsForSitemap, getTopicsForSitemap } from '@/lib/queries';
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

function maxDate(values: Array<string | null | undefined>, fallback: Date): Date {
  let best = 0;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best) : fallback;
}

export async function GET() {
  const now = new Date();
  const [articleCount, categories, topics, tags, authors, guides, latestArticleAt] = await Promise.all([
    getArticleSitemapCount().catch(() => 0),
    getCategories().catch(() => []),
    getTopicsForSitemap().catch(() => []),
    getTagsForSitemap().catch(() => []),
    getAuthorsForSitemap().catch(() => []),
    getGuidesForSitemap().catch(() => []),
    getLatestArticleUpdatedAt().catch(() => null),
  ]);

  // Truthful <lastmod> per chunk: reflect when that content set actually changed,
  // not the current request time (which trains Google to ignore lastmod).
  const articlesLastmod = maxDate([latestArticleAt], now);
  const topicsLastmod = maxDate(topics.map(t => t.updated_at), now);
  const tagsLastmod = maxDate(tags.map(t => t.updated_at), now);
  const authorsLastmod = maxDate(authors.map(a => (a as { latest_at?: string | null }).latest_at), now);
  const guidesLastmod = maxDate(guides.map(g => g.updated_at), now);

  const entries: SitemapIndexEntry[] = [
    // Static pages (homepage, news lists) refresh as new articles publish.
    { loc: chunkUrl('static', 0), lastmod: articlesLastmod },
  ];

  if (categories.some(category => INDEXABLE_CATEGORY_SLUGS.has(category.slug))) {
    entries.push({ loc: chunkUrl('categories', 0), lastmod: articlesLastmod });
  }
  if (authors.length > 0) entries.push({ loc: chunkUrl('authors', 0), lastmod: authorsLastmod });
  if (guides.length > 0) entries.push({ loc: chunkUrl('guides', 0), lastmod: guidesLastmod });

  for (let page = 0; page < chunkCount(articleCount); page += 1) {
    entries.push({ loc: chunkUrl('articles', page), lastmod: articlesLastmod });
  }

  for (let page = 0; page < chunkCount(topics.length); page += 1) {
    entries.push({ loc: chunkUrl('topics', page), lastmod: topicsLastmod });
  }

  for (let page = 0; page < chunkCount(tags.length); page += 1) {
    entries.push({ loc: chunkUrl('tags', page), lastmod: tagsLastmod });
  }

  return new NextResponse(buildSitemapIndex(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
