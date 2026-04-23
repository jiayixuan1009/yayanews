import { siteConfig, type Article } from '@yayanews/types';

function localePrefix(lang?: string): '/zh' | '/en' {
  return lang === 'en' ? '/en' : '/zh';
}

/** Strip HTML tags and count words for wordCount schema field */
function estimateWordCount(content?: string | null): number | undefined {
  if (!content) return undefined;
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Chinese characters count as 1 word each; space-separated tokens for Latin scripts
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const latinCount = text.split(/\s+/).filter(w => /[a-zA-Z0-9]/.test(w)).length;
  const total = cjkCount + latinCount;
  return total > 0 ? total : undefined;
}

export function buildNewsArticleJsonLd(article: Article, topic?: any, lang?: string): Record<string, any> {
  // Deep analysis articles use AnalysisNewsArticle for richer SERP treatment
  const articleType = (article as any).article_type === 'deep' ? 'AnalysisNewsArticle' : 'NewsArticle';
  const isEn = lang === 'en';
  const loc = localePrefix(lang);
  const inLanguage = isEn ? 'en' : 'zh-CN';

  const publisherDesc = isEn
    ? 'YayaNews — Asia\'s fastest financial news. 24/7 coverage of US stocks, HK markets, crypto and derivatives.'
    : '鸭鸭财经新闻 — 比市场快一步，7×24小时实时追踪全球财经脉动';

  // Build keywords from article tags and tickers
  const tagKeywords = (article.tags || []).map(t => isEn ? (t.name_en || t.name) : t.name);
  const tickerKeywords = article.tickers
    ? article.tickers.split(',').map(t => t.trim()).filter(Boolean)
    : [];
  const allKeywords = [...new Set([...tagKeywords, ...tickerKeywords])];

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': articleType,
    headline: article.title,
    description: article.summary || article.title,
    image: article.cover_image || undefined,
    inLanguage,
    datePublished: article.published_at ? new Date(article.published_at).toISOString() : undefined,
    dateModified: article.updated_at ? new Date(article.updated_at).toISOString() : undefined,
    wordCount: estimateWordCount(article.content),
    ...(allKeywords.length > 0 ? { keywords: allKeywords.join(', ') } : {}),
    // speakable: helps Google Assistant and AI engines extract key content for voice / citations
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.article-summary', '.article-key-points'],
    },
    author: {
      '@type': 'Person',
      name: article.author || 'YayaNews',
      url: `${siteConfig.siteUrl}${loc}/about`,
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
      sameAs: Object.values(siteConfig.socialLinks),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.siteUrl}${loc}/article/${article.slug}`,
    },
    isAccessibleForFree: true,
    articleSection: article.category_name ? [article.category_name] : undefined,
    // citation: if article cites an original source, expose it for AI engines
    ...(article.source_url ? {
      citation: {
        '@type': 'CreativeWork',
        url: article.source_url,
        ...(article.source ? { name: article.source } : {}),
      },
    } : {}),
  };

  if (topic) {
    const topicName = (isEn ? topic.name_en : topic.name_zh) || topic.title || topic.slug;
    jsonLd.about = {
      '@type': 'Thing',
      name: topicName,
      url: `${siteConfig.siteUrl}${loc}/topics/${topic.slug}`,
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

/**
 * NewsMediaOrganization schema — inject in homepage and About page.
 * AI search engines (Perplexity, ChatGPT, Claude) use this to verify
 * publisher authority and determine citation eligibility.
 */
export function buildOrganizationJsonLd(lang?: string): Record<string, any> {
  const isEn = lang === 'en';
  const loc = localePrefix(lang);
  const description = isEn
    ? 'YayaNews — Asia\'s fastest financial news platform. 24/7 AI-powered coverage of US stocks, Hong Kong markets, cryptocurrency, Bitcoin, Ethereum, derivatives and global macro for professional investors.'
    : '鸭鸭财经（YayaNews）—— 亚洲最快财经资讯平台，7×24小时 AI 驱动，实时覆盖美股、港股、加密货币、比特币、以太坊、衍生品及全球宏观市场动态。';

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': `${siteConfig.siteUrl}/#organization`,
    name: isEn ? 'YayaNews' : siteConfig.siteName,
    alternateName: isEn ? ['鸭鸭财经', '鸭鸭新闻'] : ['YayaNews', 'Yaya Financial News'],
    description,
    url: siteConfig.siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteConfig.siteUrl}/brand/logo-square.png`,
      width: 512,
      height: 512,
    },
    foundingDate: '2024',
    areaServed: 'Worldwide',
    knowsAbout: isEn
      ? ['US Stocks', 'Hong Kong Stocks', 'Cryptocurrency', 'Bitcoin', 'Ethereum', 'Derivatives', 'Financial Markets', 'Investment', 'Global Macro']
      : ['美股', '港股', '加密货币', '比特币', '以太坊', '衍生品', '金融市场', '投资分析', '全球宏观'],
    sameAs: Object.values(siteConfig.socialLinks),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial',
      url: `${siteConfig.siteUrl}${loc}/contact`,
    },
  };
}

/**
 * WebSite schema with SearchAction — inject in homepage only.
 * The url must be the canonical root domain (not locale-prefixed).
 */
export function buildWebSiteJsonLd(lang?: string): Record<string, any> {
  const isEn = lang === 'en';
  const loc = localePrefix(lang);
  const origin = (() => {
    try { return new URL(siteConfig.siteUrl).origin; } catch { return siteConfig.siteUrl; }
  })();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: isEn ? 'YayaNews' : siteConfig.siteName,
    url: origin,
    description: isEn
      ? 'YayaNews — The Fastest Financial News. 24/7 coverage of US stocks, HK markets, crypto and derivatives.'
      : siteConfig.description,
    inLanguage: isEn ? 'en' : 'zh-CN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}${loc}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * ItemList schema for the homepage "top stories" list.
 * Google News uses this to qualify the site for Top Stories carousels
 * and to understand editorial ranking of articles on the homepage.
 */
export function buildItemListJsonLd(
  articles: Array<Pick<Article, 'slug' | 'title' | 'published_at'>>,
  lang?: string,
): Record<string, any> {
  const loc = localePrefix(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteConfig.siteUrl}${loc}/article/${a.slug}`,
      name: a.title,
    })),
  };
}

