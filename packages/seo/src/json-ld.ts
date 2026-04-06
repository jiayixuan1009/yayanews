import { siteConfig, type Article } from '@yayanews/types';

export function buildNewsArticleJsonLd(article: Article, topic?: any, lang?: string): Record<string, any> {
  // Deep analysis articles use AnalysisNewsArticle for richer SERP treatment
  const articleType = (article as any).article_type === 'deep' ? 'AnalysisNewsArticle' : 'NewsArticle';
  const isEn = lang === 'en';

  const publisherDesc = isEn
    ? 'YayaNews — Asia\'s fastest financial news. 24/7 coverage of US stocks, HK markets, crypto and derivatives.'
    : '鸭鸭财经新闻 — 比市场快一步，7×24小时实时追踪全球财经脉动';

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': articleType,
    headline: article.title,
    description: article.summary || article.title,
    image: article.cover_image || undefined,
    datePublished: article.published_at ? new Date(article.published_at).toISOString() : undefined,
    dateModified: article.updated_at ? new Date(article.updated_at).toISOString() : undefined,
    author: {
      '@type': 'Person',
      name: article.author || 'YayaNews',
      url: `${siteConfig.siteUrl}/about`,
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: siteConfig.siteName,
      description: publisherDesc,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.siteUrl}/brand/logo-square.png`,
        width: 512,
        height: 512,
      },
      url: siteConfig.siteUrl,
      sameAs: [
        'https://twitter.com/YayaNewsAsia',
      ],
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.siteUrl}/article/${article.slug}`,
    },
    isAccessibleForFree: true,
    articleSection: article.category_name ? [article.category_name] : undefined,
  };

  if (topic) {
    const topicName = (isEn ? topic.name_en : topic.name_zh) || topic.title || topic.slug;
    jsonLd.about = {
      '@type': 'Thing',
      name: topicName,
      url: `${siteConfig.siteUrl}/topics/${topic.slug}`
    };
    if (jsonLd.articleSection) {
      jsonLd.articleSection.push(topicName);
    } else {
      jsonLd.articleSection = [topicName];
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

