import { MetadataRoute } from 'next';
import { getRecentArticlesForSitemap, getTopics, getCategories, getTagsForSitemap, getRecentFlashForSitemap } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';
import { encodeFlashSlug } from '@/lib/ui-utils';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.siteUrl;

  function localize(
    path: string,
    lastModified?: Date,
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
    priority?: number
  ): MetadataRoute.Sitemap {
    const zhUrl = `${baseUrl}/zh${path === '/' ? '' : path}`;
    const enUrl = `${baseUrl}/en${path === '/' ? '' : path}`;
    const alternates = { languages: { zh: zhUrl, en: enUrl } };
    return [
      { url: zhUrl, lastModified, changeFrequency, priority, alternates },
      { url: enUrl, lastModified, changeFrequency, priority, alternates },
    ];
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
    getTopics(100).catch(() => []),
    getTagsForSitemap().catch(() => []),
    getRecentFlashForSitemap(2000).catch(() => []),
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap(c => 
    localize(`/news/${c.slug}`, new Date(), 'hourly', 0.8)
  );

  const articlePages: MetadataRoute.Sitemap = articles.flatMap(a => 
    localize(`/article/${a.slug}`, new Date(a.updated_at), 'weekly', 0.6)
  );

  const topicPages: MetadataRoute.Sitemap = topics.flatMap(t => 
    localize(`/topics/${t.slug}`, new Date(), 'daily', 0.7)
  );

  const tagPages: MetadataRoute.Sitemap = tagRows.flatMap(t => 
    localize(`/tag/${t.slug}`, new Date(t.updated_at), 'daily', 0.55)
  );

  const flashPages: MetadataRoute.Sitemap = flashes.flatMap(f => 
    localize(`/flash/${encodeFlashSlug(f as any)}`, new Date(f.updated_at), 'weekly', 0.5)
  );

  return [...staticPages, ...categoryPages, ...articlePages, ...topicPages, ...tagPages, ...flashPages];
}
