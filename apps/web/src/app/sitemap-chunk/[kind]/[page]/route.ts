import { NextResponse } from 'next/server';
import { getAuthorsForSitemap, getCategories, getRecentArticlesForSitemap, getTagsForSitemap, getTopicsForSitemap } from '@/lib/queries';
import { buildUrlset, type SitemapUrlEntry } from '@/lib/sitemap-xml';
import { CATEGORY_DISPLAY_ORDER } from '@/lib/constants';
import { siteConfig } from '@yayanews/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const CHUNK_SIZE = 1000;
const VALID_KINDS = new Set(['static', 'categories', 'articles', 'authors', 'topics', 'tags']);
const INDEXABLE_CATEGORY_SLUGS = new Set(CATEGORY_DISPLAY_ORDER);

function baseUrl(): string {
  return (siteConfig.siteUrl || '').replace(/\/$/, '');
}

function safeEncodeURI(uri: string): string {
  return encodeURI(uri).replace(/&/g, '%26').replace(/</g, '%3C').replace(/>/g, '%3E');
}

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function localize(
  path: string,
  lastmod: Date | string,
  changefreq: SitemapUrlEntry['changefreq'],
  priority: number
): SitemapUrlEntry[] {
  const encodedPath = path === '/' ? '' : safeEncodeURI(path);
  const zhUrl = `${baseUrl()}/zh${encodedPath}`;
  const enUrl = `${baseUrl()}/en${encodedPath}`;
  const alternates = { zh: zhUrl, en: enUrl, 'x-default': zhUrl };
  return [
    { loc: zhUrl, lastmod, changefreq, priority, alternates },
    { loc: enUrl, lastmod, changefreq, priority, alternates },
  ];
}

function staticEntries(): SitemapUrlEntry[] {
  const now = new Date();
  return [
    ...localize('/', now, 'hourly', 1.0),
    ...localize('/news', now, 'hourly', 0.9),
    ...localize('/flash', now, 'always', 0.8),
    ...localize('/markets', now, 'hourly', 0.7),
    ...localize('/topics', now, 'daily', 0.7),
    ...localize('/about', now, 'monthly', 0.4),
    ...localize('/authors', now, 'weekly', 0.5),
    ...localize('/editorial', now, 'monthly', 0.5),
    ...localize('/editorial-policy', now, 'monthly', 0.5),
    ...localize('/corrections', now, 'monthly', 0.4),
    ...localize('/risk-disclosure', now, 'monthly', 0.4),
    ...localize('/advertising-policy', now, 'monthly', 0.4),
    ...localize('/contact', now, 'monthly', 0.4),
    ...localize('/privacy', now, 'monthly', 0.4),
    ...localize('/terms', now, 'monthly', 0.3),
  ];
}

function articleEntry(article: { slug: string; updated_at: string; lang: string; article_type?: string; sibling_slug?: string }): SitemapUrlEntry {
  const lang = article.lang === 'en' ? 'en' : 'zh';
  const siblingLang = lang === 'en' ? 'zh' : 'en';
  const loc = `${baseUrl()}/${lang}${safeEncodeURI(`/article/${article.slug}`)}`;
  const alternates: Record<string, string> = {
    [lang]: loc,
    'x-default': loc,
  };

  if (article.sibling_slug) {
    alternates[siblingLang] = `${baseUrl()}/${siblingLang}${safeEncodeURI(`/article/${article.sibling_slug}`)}`;
  }

  return {
    loc,
    lastmod: safeDate(article.updated_at),
    changefreq: 'weekly',
    priority: article.article_type === 'deep' ? 0.75 : 0.6,
    alternates,
  };
}

async function entriesFor(kind: string, page: number): Promise<SitemapUrlEntry[]> {
  const offset = page * CHUNK_SIZE;
  switch (kind) {
    case 'static':
      return page === 0 ? staticEntries() : [];
    case 'categories': {
      if (page !== 0) return [];
      const categories = await getCategories().catch(() => []);
      return categories
        .filter(category => INDEXABLE_CATEGORY_SLUGS.has(category.slug))
        .flatMap(category => localize(`/news/${category.slug}`, new Date(), 'hourly', 0.8));
    }
    case 'articles': {
      const articles = await getRecentArticlesForSitemap(CHUNK_SIZE, offset).catch(() => []);
      return articles
        .filter(article => article.article_type !== 'short')
        .filter(article => !article.slug.includes('&') && (!article.sibling_slug || !article.sibling_slug.includes('&')))
        .map(articleEntry);
    }
    case 'authors': {
      if (page !== 0) return [];
      const authors = await getAuthorsForSitemap().catch(() => []);
      return authors
        .filter(author => !author.slug.includes('&'))
        .flatMap(author => localize(`/authors/${author.slug}`, safeDate(author.latest_at), 'weekly', author.slug === 'yayanews-editorial' ? 0.55 : 0.45));
    }
    case 'topics': {
      const topics = await getTopicsForSitemap().catch(() => []);
      return topics
        .filter(topic => !topic.slug.includes('&'))
        .slice(offset, offset + CHUNK_SIZE)
        .flatMap(topic => localize(`/topics/${topic.slug}`, safeDate(topic.updated_at), 'daily', 0.8));
    }
    case 'tags': {
      const tags = await getTagsForSitemap().catch(() => []);
      return tags
        .filter(tag => !tag.slug.includes('&'))
        .slice(offset, offset + CHUNK_SIZE)
        .flatMap(tag => localize(`/tag/${tag.slug}`, safeDate(tag.updated_at), 'daily', 0.55));
    }
    default:
      return [];
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; page: string }> }
) {
  const { kind, page } = await params;
  const pageNumber = Number.parseInt(page, 10);

  if (!VALID_KINDS.has(kind) || !Number.isFinite(pageNumber) || pageNumber < 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const entries = await entriesFor(kind, pageNumber);
  return new NextResponse(buildUrlset(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
