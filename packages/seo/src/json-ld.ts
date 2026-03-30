import { siteConfig, type Article } from '@yayanews/types';

export function buildNewsArticleJsonLd(article: Article): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || article.title,
    image: article.cover_image || undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: { '@type': 'Person', name: article.author || 'YayaNews' },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.siteUrl}/images/yayanews-logo.png`, // Update placeholder if needed
      },
      url: siteConfig.siteUrl,
    },
    mainEntityOfPage: `${siteConfig.siteUrl}/article/${article.slug}`,
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteConfig.siteUrl}${item.url}`,
    })),
  };
}
