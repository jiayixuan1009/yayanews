import { siteConfig, type Article } from '@yayanews/types';

export function buildNewsArticleJsonLd(article: Article, topic?: any): Record<string, any> {
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || article.title,
    image: article.cover_image || undefined,
    datePublished: article.published_at ? new Date(article.published_at).toISOString() : undefined,
    dateModified: article.updated_at ? new Date(article.updated_at).toISOString() : undefined,
    author: { '@type': 'Person', name: article.author || 'YayaNews' },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.siteUrl}/brand/logo-square.png`,
      },
      url: siteConfig.siteUrl,
    },
    mainEntityOfPage: `${siteConfig.siteUrl}/article/${article.slug}`,
    articleSection: article.category_name ? [article.category_name] : undefined,
  };

  if (topic) {
    jsonLd.about = {
      '@type': 'Thing',
      name: topic.name_zh || topic.title || topic.slug,
      url: `${siteConfig.siteUrl}/topics/${topic.slug}`
    };
    if (jsonLd.articleSection) {
      jsonLd.articleSection.push(topic.name_zh || topic.title || topic.slug);
    } else {
      jsonLd.articleSection = [topic.name_zh || topic.title || topic.slug];
    }
  }

  return jsonLd;
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
