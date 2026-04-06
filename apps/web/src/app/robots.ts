import { MetadataRoute } from 'next';
import { siteConfig } from '@yayanews/types';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/*/search'],
      },
    ],
    sitemap: [
      `${siteConfig.siteUrl}/sitemap.xml`,
      `${siteConfig.siteUrl}/sitemap-news.xml`,
    ],
  };
}
