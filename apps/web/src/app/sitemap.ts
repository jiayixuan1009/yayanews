import { MetadataRoute } from 'next';
import { getRecentArticlesForSitemap, getTopics, getCategories, getTagsForSitemap } from '@/lib/queries';
import { siteConfig } from '@yayanews/types';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.siteUrl;

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/flash`, lastModified: new Date(), changeFrequency: 'always', priority: 0.8 },
    { url: `${baseUrl}/markets`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.7 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    { url: `${baseUrl}/topics`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  const [categories, articles, topics, tagRows] = await Promise.all([
    getCategories().catch(() => []),
    getRecentArticlesForSitemap().catch(() => []),
    getTopics(100).catch(() => []),
    getTagsForSitemap().catch(() => []),
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.map(c => ({
    url: `${baseUrl}/news/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${baseUrl}/article/${a.slug}`,
    lastModified: new Date(a.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const topicPages: MetadataRoute.Sitemap = topics.map(t => ({
    url: `${baseUrl}/topics/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const tagPages: MetadataRoute.Sitemap = tagRows.map(t => ({
    url: `${baseUrl}/tag/${t.slug}`,
    lastModified: new Date(t.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.55,
  }));

  return [...staticPages, ...categoryPages, ...articlePages, ...topicPages, ...tagPages];
}
