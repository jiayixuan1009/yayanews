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
      // Explicitly allow all major AI search / training crawlers so content
      // is eligible to be cited in ChatGPT, Perplexity, Claude, Gemini etc.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'GoogleOther', allow: '/' },
      { userAgent: 'Googlebot-News', allow: '/' },
      { userAgent: 'YouBot', allow: '/' },
    ],
    sitemap: [
      `${siteConfig.siteUrl}/sitemap.xml`,
      `${siteConfig.siteUrl}/sitemap-news.xml`,
    ],
  };
}
