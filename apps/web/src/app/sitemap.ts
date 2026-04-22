import { MetadataRoute } from 'next';
import { getRecentArticlesForSitemap, getTopicsForSitemap, getCategories, getTagsForSitemap } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';

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
    // /search is noindex — excluded from sitemap
    ...localize('/topics', new Date(), 'daily', 0.7),
    ...localize('/about', new Date(), 'monthly', 0.4),
    ...localize('/editorial', new Date(), 'monthly', 0.5),
    ...localize('/contact', new Date(), 'monthly', 0.4),
    ...localize('/privacy', new Date(), 'monthly', 0.4),
  ];

  const [categories, articles, topics, tagRows] = await Promise.all([
    getCategories().catch(() => []),
    getRecentArticlesForSitemap().catch(() => []),
    getTopicsForSitemap().catch(() => []),
    getTagsForSitemap().catch(() => []),
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap(c => 
    localize(`/news/${c.slug}`, new Date(), 'hourly', 0.8)
  );

  const articlePages: MetadataRoute.Sitemap = articles
    .filter((a: any) => {
      // short articles are noindex — exclude from sitemap entirely
      if (a.article_type === 'short') return false;
      return !a.slug.includes('&') && (!a.sibling_slug || !a.sibling_slug.includes('&'));
    })
    .map((a: any) => {
    const isEn = a.lang === 'en';
    const langPrefix = isEn ? '/en' : '/zh';
    const zhPath = `/zh/article/${isEn ? (a.sibling_slug || a.slug) : a.slug}`;
    const enPath = `/en/article/${isEn ? a.slug : (a.sibling_slug || a.slug + '-en')}`;
    const encodedPath = safeEncodeURI(`/article/${a.slug}`);
    // deep-dive articles are higher value — boost priority
    const priority = a.article_type === 'deep' ? 0.75 : 0.6;
    return {
      url: `${baseUrl}${langPrefix}${encodedPath}`,
      lastModified: safeDate(a.updated_at),
      changeFrequency: 'weekly',
      priority,
      alternates: {
        languages: {
          zh: `${baseUrl}${safeEncodeURI(zhPath)}`,
          en: `${baseUrl}${safeEncodeURI(enPath)}`,
        }
      }
    };
  });

  const topicPages: MetadataRoute.Sitemap = topics
    .filter(t => !t.slug.includes('&'))
    .flatMap(t =>
    localize(`/topics/${t.slug}`, safeDate(t.updated_at), 'daily', 0.8)
  );

  const tagPages: MetadataRoute.Sitemap = tagRows
    .filter(t => !t.slug.includes('&'))
    .flatMap(t => 
      localize(`/tag/${t.slug}`, safeDate(t.updated_at), 'daily', 0.55)
    );

  // Flash detail pages excluded from sitemap (noindex thin content)

  return [...staticPages, ...categoryPages, ...articlePages, ...topicPages, ...tagPages];
}
