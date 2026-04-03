import { MetadataRoute } from 'next';
import { getRecentArticlesForSitemap, getTopicsForSitemap, getCategories, getTagsForSitemap, getRecentFlashForSitemap } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';
import { encodeFlashSlug } from '@/lib/ui-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour to prevent timeout on large datasets

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.siteUrl;

  function safeEncodeURI(uri: string) {
    return encodeURI(uri).replace(/&/g, '%26').replace(/</g, '%3C').replace(/>/g, '%3E');
  }

  function localize(
    path: string,
    lastModified?: Date,
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
    priority?: number
  ): MetadataRoute.Sitemap {
    // Encode non-ASCII characters (e.g. Chinese tag slugs) in URL path
    const encodedPath = path === '/' ? '' : safeEncodeURI(path);
    const zhUrl = `${baseUrl}/zh${encodedPath}`;
    const enUrl = `${baseUrl}/en${encodedPath}`;
    const alternates = { languages: { zh: zhUrl, en: enUrl } };
    return [
      { url: zhUrl, lastModified, changeFrequency, priority, alternates },
      { url: enUrl, lastModified, changeFrequency, priority, alternates },
    ];
  }

  /** Safe date parser — returns valid Date or current date as fallback */
  function safeDate(d: any): Date {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const staticPages: MetadataRoute.Sitemap = [
    ...localize('/', new Date(), 'hourly', 1.0),
    ...localize('/news', new Date(), 'hourly', 0.9),
    ...localize('/flash', new Date(), 'always', 0.8),
    ...localize('/markets', new Date(), 'hourly', 0.7),
    ...localize('/search', new Date(), 'daily', 0.5),
    ...localize('/topics', new Date(), 'daily', 0.7),
    ...localize('/about', new Date(), 'monthly', 0.4),
    ...localize('/contact', new Date(), 'monthly', 0.4),
    ...localize('/privacy', new Date(), 'monthly', 0.4),
  ];

  const [categories, articles, topics, tagRows, flashes] = await Promise.all([
    getCategories().catch(() => []),
    getRecentArticlesForSitemap().catch(() => []),
    getTopicsForSitemap().catch(() => []),
    getTagsForSitemap().catch(() => []),
    getRecentFlashForSitemap(2000).catch(() => []),
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap(c => 
    localize(`/news/${c.slug}`, new Date(), 'hourly', 0.8)
  );

  const articlePages: MetadataRoute.Sitemap = articles.map((a: any) => {
    const isEn = a.lang === 'en';
    const langPrefix = isEn ? '/en' : '/zh';
    const zhPath = `/zh/article/${isEn ? (a.sibling_slug || a.slug) : a.slug}`;
    const enPath = `/en/article/${isEn ? a.slug : (a.sibling_slug || a.slug + '-en')}`;
    const encodedPath = safeEncodeURI(`/article/${a.slug}`);
    return {
      url: `${baseUrl}${langPrefix}${encodedPath}`,
      lastModified: safeDate(a.updated_at),
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: {
        languages: {
          zh: `${baseUrl}${safeEncodeURI(zhPath)}`,
          en: `${baseUrl}${safeEncodeURI(enPath)}`,
        }
      }
    };
  });

  const topicPages: MetadataRoute.Sitemap = topics.flatMap(t =>
    localize(`/topics/${t.slug}`, safeDate(t.updated_at), 'daily', 0.8)
  );

  const tagPages: MetadataRoute.Sitemap = tagRows.flatMap(t => 
    localize(`/tag/${t.slug}`, safeDate(t.updated_at), 'daily', 0.55)
  );

  const flashPages: MetadataRoute.Sitemap = flashes.flatMap(f => 
    localize(`/flash/${encodeFlashSlug(f as any)}`, safeDate(f.updated_at), 'weekly', 0.5)
  );

  return [...staticPages, ...categoryPages, ...articlePages, ...topicPages, ...tagPages, ...flashPages];
}
