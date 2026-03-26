import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/types';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: [
      `${siteConfig.siteUrl}/sitemap.xml`,
      `${siteConfig.siteUrl}/sitemap-news.xml`,
    ],
  };
}
