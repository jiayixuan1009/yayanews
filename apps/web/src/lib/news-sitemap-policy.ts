export const MAX_NEWS_SITEMAP_ITEMS = 48;
export const MAX_ITEMS_PER_TOPIC = 10;
export const MAX_ITEMS_PER_TITLE_PREFIX = 2;

export interface NewsSitemapCandidate {
  title?: unknown;
  category_name?: unknown;
  category_slug?: unknown;
  subcategory?: unknown;
}

export function normalizeTitleForGrouping(title: string): string {
  return title
    .replace(/^EN:\s*/i, '')
    .replace(/[|｜].*$/g, '')
    .replace(/[，,：:；;。.!！?？"'“”‘’()[\]【】《》\s-]+/g, '')
    .toLowerCase();
}

export function titlePrefixKey(title: string): string {
  const normalized = normalizeTitleForGrouping(title);
  return Array.from(normalized).slice(0, 8).join('');
}

export function topicKey(article: NewsSitemapCandidate): string {
  const title = typeof article.title === 'string' ? article.title : '';
  const category = typeof article.category_slug === 'string'
    ? article.category_slug
    : typeof article.category_name === 'string'
      ? article.category_name
      : '';
  const subcategory = typeof article.subcategory === 'string' ? article.subcategory : '';
  const haystack = `${title} ${category} ${subcategory}`;

  if (/黄金|金价|gold/i.test(haystack)) return 'gold';
  if (/港股|恒指|腾讯|阿里|hk|hang\s*seng/i.test(haystack)) return 'hk-stock';
  if (/美股|纳指|标普|道指|nasdaq|s&p|dow/i.test(haystack)) return 'us-stock';
  if (/比特币|以太坊|加密|crypto|bitcoin|ethereum|btc|eth/i.test(haystack)) return 'crypto';
  if (/原油|油价|crude|oil/i.test(haystack)) return 'oil';
  if (/期权|期货|衍生品|derivative|option|future/i.test(haystack)) return 'derivatives';
  return category || 'general';
}

export function diversifyNewsArticles<T extends NewsSitemapCandidate>(articles: T[]): T[] {
  const topicCounts = new Map<string, number>();
  const prefixCounts = new Map<string, number>();
  const selected: T[] = [];

  for (const article of articles) {
    if (selected.length >= MAX_NEWS_SITEMAP_ITEMS) break;

    const title = typeof article.title === 'string' ? article.title : '';
    const prefix = titlePrefixKey(title);
    const topic = topicKey(article);
    const topicCount = topicCounts.get(topic) || 0;
    const prefixCount = prefix ? (prefixCounts.get(prefix) || 0) : 0;

    if (topicCount >= MAX_ITEMS_PER_TOPIC) continue;
    if (prefix && prefixCount >= MAX_ITEMS_PER_TITLE_PREFIX) continue;

    selected.push(article);
    topicCounts.set(topic, topicCount + 1);
    if (prefix) prefixCounts.set(prefix, prefixCount + 1);
  }

  return selected;
}
