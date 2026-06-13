#!/usr/bin/env node

const DEFAULT_FETCH_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_EXPECTED_ORIGIN = 'https://yayanews.cryptooptiontool.com';

const CHECKS = [
  { path: '/zh', index: true, cache: 'cacheable' },
  { path: '/en', index: true, cache: 'cacheable' },
  { path: '/zh/news', index: true, cache: 'cacheable' },
  { path: '/en/news', index: true, cache: 'cacheable' },
  { path: '/zh/news/us-stock', index: true, cache: 'cacheable' },
  { path: '/en/news/us-stock', index: true, cache: 'cacheable' },
  { path: '/zh/flash', index: true, cache: 'cacheable' },
  { path: '/en/flash', index: true, cache: 'cacheable' },
  { path: '/zh/markets', index: true, cache: 'cacheable' },
  { path: '/en/markets', index: true, cache: 'cacheable' },
  { path: '/zh/topics', index: true, cache: 'cacheable' },
  { path: '/en/topics', index: true, cache: 'cacheable' },
  { path: '/zh/authors', index: true, cache: 'cacheable' },
  { path: '/en/authors', index: true, cache: 'cacheable' },
  { path: '/zh/guide', index: true, cache: 'cacheable' },
  { path: '/en/guide', index: true, cache: 'cacheable' },
  { path: '/zh/about', index: true, cache: 'cacheable' },
  { path: '/en/about', index: true, cache: 'cacheable' },
  { path: '/zh/editorial', index: true, cache: 'cacheable' },
  { path: '/en/editorial', index: true, cache: 'cacheable' },
  { path: '/zh/editorial-policy', index: true, cache: 'cacheable' },
  { path: '/en/editorial-policy', index: true, cache: 'cacheable' },
  { path: '/zh/privacy', index: true, cache: 'cacheable' },
  { path: '/en/privacy', index: true, cache: 'cacheable' },
  { path: '/zh/contact', index: true, cache: 'cacheable' },
  { path: '/en/contact', index: true, cache: 'cacheable' },
  { path: '/zh/terms', index: true, cache: 'cacheable' },
  { path: '/en/terms', index: true, cache: 'cacheable' },
  { path: '/zh/risk-disclosure', index: true, cache: 'cacheable' },
  { path: '/en/risk-disclosure', index: true, cache: 'cacheable' },
  { path: '/zh/corrections', index: true, cache: 'cacheable' },
  { path: '/en/corrections', index: true, cache: 'cacheable' },
  { path: '/zh/advertising-policy', index: true, cache: 'cacheable' },
  { path: '/en/advertising-policy', index: true, cache: 'cacheable' },
  { path: '/zh/search', index: false, cache: 'no-store-ok' },
  { path: '/en/search', index: false, cache: 'no-store-ok' },
];

const RESOURCE_CHECKS = [
  {
    path: '/brand/og-default.png',
    contentType: 'image/png',
    cache: 'cacheable',
  },
  {
    path: '/sitemap.xml',
    contentType: 'xml',
    cache: 'cacheable',
    resourceKind: 'sitemap-index',
  },
  {
    path: '/sitemap-chunk/static/0',
    contentType: 'xml',
    cache: 'cacheable',
    resourceKind: 'sitemap-urlset',
  },
  {
    path: '/sitemap-news.xml',
    contentType: 'xml',
    cache: 'cacheable',
    resourceKind: 'news-sitemap',
  },
  {
    path: '/feed-news.xml',
    contentType: 'rss+xml',
    cache: 'cacheable',
    resourceKind: 'rss',
  },
  {
    path: '/robots.txt',
    contentType: 'text/plain',
    cache: 'cacheable',
    resourceKind: 'robots',
  },
];

const DEFAULT_OG_PATH = '/brand/og-default.png';
const JSON_LD_SELECTOR = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const NEWS_SITEMAP_MAX_ITEMS = 100;
const NEWS_SITEMAP_MAX_ITEMS_PER_TOPIC = 24;
const NEWS_SITEMAP_MAX_ITEMS_PER_TITLE_PREFIX = 3;

function usage() {
  return [
    'Usage: node scripts/verify/seo-metadata-check.mjs [--base <url>] [--expected-origin <url>] [--paths <csv>] [--article-paths <csv>] [--sample-article-urls <n>] [--probe-sitemap-urls <n>] [--sample-sitemap-kinds <kind:n,...>]',
    '',
    `Default fetch base: ${DEFAULT_FETCH_BASE_URL}`,
    `Default expected origin: ${DEFAULT_EXPECTED_ORIGIN}`,
    'Example: npm run verify:seo -- --base https://yayanews.cryptooptiontool.com',
    'Example: npm run verify:seo -- --base http://127.0.0.1:3000 --expected-origin https://yayanews.cryptooptiontool.com',
    'Example: npm run verify:seo -- --paths /zh/privacy,/en/privacy,/brand/og-default.png',
    'Example: npm run verify:seo -- --article-paths /zh/article/example-slug,/en/article/example-slug',
    'Example: npm run verify:seo -- --base https://yayanews.cryptooptiontool.com --sample-article-urls 5',
    'Example: npm run verify:seo -- --base https://yayanews.cryptooptiontool.com --probe-sitemap-urls 20',
    'Example: npm run verify:seo -- --base https://yayanews.cryptooptiontool.com --sample-sitemap-kinds authors:2,topics:2,tags:2,guides:2',
  ].join('\n');
}

function parseSitemapKindSamples(value) {
  if (!value) return [];
  const validKinds = new Set(['static', 'categories', 'articles', 'authors', 'topics', 'tags', 'guides', 'flash']);
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [kind, rawLimit = '1'] = entry.split(':');
      const limit = Number(rawLimit);
      if (!validKinds.has(kind)) {
        throw new Error(`Unknown sitemap sample kind: ${kind}`);
      }
      if (!Number.isFinite(limit) || limit < 1) {
        throw new Error(`Invalid sitemap sample limit for ${kind}: ${rawLimit}`);
      }
      return { kind, limit: Math.floor(limit) };
    });
}

function parseArgs(argv) {
  let fetchBase = process.env.SEO_BASE_URL || DEFAULT_FETCH_BASE_URL;
  let expectedOrigin = process.env.SEO_EXPECTED_ORIGIN || DEFAULT_EXPECTED_ORIGIN;
  let paths = process.env.SEO_PATHS || '';
  let articlePaths = process.env.SEO_ARTICLE_PATHS || '';
  let sampleArticleUrls = Number(process.env.SEO_SAMPLE_ARTICLE_URLS || 0);
  let probeSitemapUrls = Number(process.env.SEO_PROBE_SITEMAP_URLS || 0);
  let sampleSitemapKinds = process.env.SEO_SAMPLE_SITEMAP_KINDS || '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--base') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --base');
      fetchBase = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--base=')) {
      fetchBase = arg.slice('--base='.length);
      continue;
    }
    if (arg === '--expected-origin') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --expected-origin');
      expectedOrigin = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--expected-origin=')) {
      expectedOrigin = arg.slice('--expected-origin='.length);
      continue;
    }
    if (arg === '--paths') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --paths');
      paths = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--paths=')) {
      paths = arg.slice('--paths='.length);
      continue;
    }
    if (arg === '--article-paths') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --article-paths');
      articlePaths = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--article-paths=')) {
      articlePaths = arg.slice('--article-paths='.length);
      continue;
    }
    if (arg === '--sample-article-urls') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --sample-article-urls');
      sampleArticleUrls = Number(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--sample-article-urls=')) {
      sampleArticleUrls = Number(arg.slice('--sample-article-urls='.length));
      continue;
    }
    if (arg === '--probe-sitemap-urls') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --probe-sitemap-urls');
      probeSitemapUrls = Number(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--probe-sitemap-urls=')) {
      probeSitemapUrls = Number(arg.slice('--probe-sitemap-urls='.length));
      continue;
    }
    if (arg === '--sample-sitemap-kinds') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --sample-sitemap-kinds');
      sampleSitemapKinds = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--sample-sitemap-kinds=')) {
      sampleSitemapKinds = arg.slice('--sample-sitemap-kinds='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(probeSitemapUrls) || probeSitemapUrls < 0) {
    throw new Error('--probe-sitemap-urls must be a non-negative number');
  }
  if (!Number.isFinite(sampleArticleUrls) || sampleArticleUrls < 0) {
    throw new Error('--sample-article-urls must be a non-negative number');
  }

  return {
    fetchBaseUrl: new URL(fetchBase.replace(/\/+$/, '')),
    expectedBaseUrl: new URL(expectedOrigin.replace(/\/+$/, '')),
    paths: paths
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean),
    articlePaths: articlePaths
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean),
    sampleArticleUrls: Math.floor(sampleArticleUrls),
    probeSitemapUrls: Math.floor(probeSitemapUrls),
    sampleSitemapKindSpecs: parseSitemapKindSamples(sampleSitemapKinds),
  };
}

function selectChecks(paths, articlePaths) {
  const checks = [...CHECKS, ...RESOURCE_CHECKS];
  const articleChecks = articlePaths.map((path) => ({
    path,
    index: true,
    cache: 'cacheable',
    article: true,
  }));

  if (paths.length === 0) return [...checks, ...articleChecks];

  const byPath = new Map(checks.map((check) => [check.path, check]));
  const selected = paths.map((path) => {
    const check = byPath.get(path);
    if (!check) throw new Error(`No SEO check is configured for path: ${path}`);
    return check;
  });
  return [...selected, ...articleChecks];
}

function checkFromSitemapPath(path) {
  const check = {
    path,
    index: true,
    cache: 'cacheable',
    allowCustomOgImage: true,
  };

  if (/^\/(zh|en)\/article\//.test(path)) {
    return { ...check, article: true };
  }
  if (/^\/(zh|en)\/flash\/[^/]+/.test(path)) {
    return { ...check, article: true, allowSingleLanguageAlternates: true };
  }
  if (/^\/(zh|en)\/authors\/[^/]+/.test(path)) {
    return { ...check, jsonLdTypes: ['ProfilePage'] };
  }
  if (/^\/(zh|en)\/guide\/[^/]+/.test(path)) {
    return { ...check, jsonLdTypes: ['HowTo'] };
  }
  if (/^\/(zh|en)\/(?:news|topics|tag)(?:\/|$)/.test(path)) {
    return {
      ...check,
      jsonLdTypes: ['CollectionPage'],
      allowPartialAlternates: /^\/(zh|en)\/tag\//.test(path),
    };
  }
  return check;
}

function dedupeChecks(checks) {
  const seen = new Set();
  return checks.filter((check) => {
    const key = check.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sampleArticlePaths(fetchBaseUrl, limit) {
  if (limit <= 0) return [];

  const fromNewsSitemap = [];
  const newsResponse = await fetch(new URL('/sitemap-news.xml', fetchBaseUrl), { redirect: 'manual' });
  if (newsResponse.status === 200) {
    const newsXml = await newsResponse.text();
    fromNewsSitemap.push(...xmlElementValues(newsXml, 'loc'));
  }

  const articlePaths = fromNewsSitemap
    .map(decodeXmlEntities)
    .map((loc) => {
      try {
        const url = new URL(loc);
        return `${url.pathname}${url.search}`;
      } catch {
        return null;
      }
    })
    .filter((path) => path && /^\/(zh|en)\/article\//.test(path))
    .slice(0, limit);

  if (articlePaths.length > 0) return articlePaths;

  const sitemapResponse = await fetch(new URL('/sitemap.xml', fetchBaseUrl), { redirect: 'manual' });
  if (sitemapResponse.status !== 200) {
    throw new Error(`Unable to sample articles: /sitemap.xml returned ${sitemapResponse.status}`);
  }

  const sitemapIndex = await sitemapResponse.text();
  const articleChunkUrls = xmlElementValues(sitemapIndex, 'loc')
    .map(decodeXmlEntities)
    .filter((loc) => {
      try {
        return new URL(loc).pathname.includes('/sitemap-chunk/articles/');
      } catch {
        return false;
      }
    });

  for (const chunkUrl of articleChunkUrls.slice(0, 3)) {
    if (articlePaths.length >= limit) break;
    const chunkResponse = await fetch(sameOriginPathUrl(chunkUrl, fetchBaseUrl), { redirect: 'manual' });
    if (chunkResponse.status !== 200) continue;
    const chunkXml = await chunkResponse.text();
    for (const loc of xmlElementValues(chunkXml, 'loc').map(decodeXmlEntities)) {
      try {
        const url = new URL(loc);
        const path = `${url.pathname}${url.search}`;
        if (/^\/(zh|en)\/article\//.test(path) && !articlePaths.includes(path)) {
          articlePaths.push(path);
        }
      } catch {
        // Ignore malformed sitemap URLs; resource checks report structure issues.
      }
      if (articlePaths.length >= limit) break;
    }
  }

  return articlePaths;
}

async function sampleSitemapKindPaths(fetchBaseUrl, specs) {
  const sampled = [];
  const skipped = [];
  const seen = new Set();
  const sitemapResponse = await fetch(new URL('/sitemap.xml', fetchBaseUrl), { redirect: 'manual' });
  if (sitemapResponse.status !== 200) {
    throw new Error(`Unable to sample sitemap kinds: /sitemap.xml returned ${sitemapResponse.status}`);
  }

  const sitemapIndex = await sitemapResponse.text();
  const indexedKinds = new Set(
    xmlElementValues(sitemapIndex, 'loc')
      .map(decodeXmlEntities)
      .map((loc) => {
        try {
          const match = new URL(loc).pathname.match(/\/sitemap-chunk\/([^/]+)\//);
          return match?.[1] ?? null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  for (const { kind, limit } of specs) {
    if (!indexedKinds.has(kind)) {
      skipped.push(`${kind}:not-in-index`);
      continue;
    }

    const response = await fetch(new URL(`/sitemap-chunk/${kind}/0`, fetchBaseUrl), { redirect: 'manual' });
    if (response.status !== 200) {
      throw new Error(`Unable to sample sitemap kind ${kind}: /sitemap-chunk/${kind}/0 returned ${response.status}`);
    }

    const xml = await response.text();
    const paths = xmlElementValues(xml, 'loc')
      .map(decodeXmlEntities)
      .map((loc) => {
        try {
          const url = new URL(loc);
          return `${url.pathname}${url.search}`;
        } catch {
          return null;
        }
      })
      .filter((path) => path && /^\/(zh|en)\//.test(path));

    const kindSamples = [];
    for (const path of paths) {
      if (kindSamples.length >= limit) break;
      if (seen.has(path)) continue;
      seen.add(path);
      kindSamples.push(path);
      sampled.push(path);
    }

    if (kindSamples.length === 0) {
      throw new Error(`Unable to sample sitemap kind ${kind}: no URL loc entries found`);
    }
  }

  return { sampled, skipped };
}

function attrValue(tag, attr) {
  const pattern = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  return tag.match(pattern)?.[1] ?? null;
}

function firstLinkHref(html, rel) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (attrValue(tag, 'rel') === rel) return attrValue(tag, 'href');
  }
  return null;
}

function metaContent(html, selectorName, selectorValue) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (attrValue(tag, selectorName) === selectorValue) return attrValue(tag, 'content');
  }
  return null;
}

function pageTitle(html) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
}

function alternateLinks(html) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  return tags.reduce((links, tag) => {
    if (attrValue(tag, 'rel') !== 'alternate') return links;
    const hrefLang = attrValue(tag, 'hreflang');
    const href = attrValue(tag, 'href');
    if (hrefLang && href) links[hrefLang] = href;
    return links;
  }, {});
}

function pageExpectations(baseUrl, path) {
  const [, lang, ...rest] = path.split('/');
  const cleanPath = `/${rest.join('/')}`;
  const canonical = new URL(path, baseUrl).toString();
  return {
    lang,
    canonical,
    cleanPath,
    locale: lang === 'en' ? 'en_US' : 'zh_CN',
    alternates: {
      zh: new URL(`/zh${cleanPath}`, baseUrl).toString(),
      en: new URL(`/en${cleanPath}`, baseUrl).toString(),
    },
  };
}

function normalizeUrl(url, baseUrl) {
  if (!url) return null;
  return new URL(url, baseUrl).toString();
}

function comparableUrl(url) {
  if (!url) return null;
  const parsed = new URL(url);
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
}

function textLength(text) {
  return Array.from(text || '').length;
}

function assertEqual(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual ?? 'missing'}`);
  }
}

function assertUrlEqual(failures, label, actual, expected) {
  if (comparableUrl(actual) !== comparableUrl(expected)) {
    failures.push(`${label}: expected ${expected}, got ${actual ?? 'missing'}`);
  }
}

function assertTitle(failures, actual, options = {}) {
  if (!actual) {
    failures.push('title: missing');
    return;
  }

  const length = textLength(actual);
  const maxLength = options.article ? 110 : 70;
  if (length < 8) failures.push(`title: too short (${length} chars)`);
  if (length > maxLength) failures.push(`title: too long (${length} chars)`);
}

function assertDescription(failures, actual, lang, options = {}) {
  if (!actual) {
    failures.push('description: missing');
    return;
  }

  const length = textLength(actual);
  const minLength = lang === 'en' ? 50 : 30;
  const maxLength = options.article ? 220 : 180;
  if (length < minLength) failures.push(`description: too short (${length} chars)`);
  if (length > maxLength) failures.push(`description: too long (${length} chars)`);
}

function assertRobots(failures, actual, shouldIndex) {
  if (!actual) {
    failures.push('robots: missing');
    return;
  }

  const lower = actual.toLowerCase();
  const tokens = new Set(lower.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean));
  if (shouldIndex) {
    if (tokens.has('noindex')) failures.push(`robots: expected indexable, got ${actual}`);
  } else if (!tokens.has('noindex')) {
    failures.push(`robots: expected noindex, got ${actual}`);
  }
  if (!tokens.has('follow')) failures.push(`robots: expected follow, got ${actual}`);
}

function assertCacheHeader(failures, actual, policy) {
  if (!policy) return;
  if (!actual) {
    failures.push('cache-control: missing');
    return;
  }

  const lower = actual.toLowerCase();
  if (policy === 'cacheable') {
    if (lower.includes('no-store') || lower.includes('private')) {
      failures.push(`cache-control: expected cacheable HTML/resource, got ${actual}`);
    }
    const ages = Array.from(lower.matchAll(/(?:^|[,;\s])(s-maxage|max-age)=(\d+)/g)).map((match) => Number(match[2]));
    const hasPositiveAge = ages.some((age) => age > 0);
    if (!hasPositiveAge && !lower.includes('immutable')) {
      failures.push(`cache-control: expected positive max-age or s-maxage, got ${actual}`);
    }
    return;
  }

  if (policy === 'no-store') {
    if (!lower.includes('no-store')) failures.push(`cache-control: expected no-store, got ${actual}`);
  }
}

function assertOgImage(failures, actual, expectedBaseUrl, options = {}) {
  const url = normalizeUrl(actual, expectedBaseUrl);
  if (!url) {
    failures.push('og:image: missing');
    return;
  }

  if (options.allowCustom) return;

  const expectedPath = new URL(DEFAULT_OG_PATH, expectedBaseUrl).toString();
  if (url !== expectedPath) {
    failures.push(`og:image: expected ${expectedPath}, got ${url}`);
  }
}

function assertContentType(failures, actual, expected) {
  if (!expected) return;
  if (!actual) {
    failures.push('content-type: missing');
    return;
  }

  const lower = actual.toLowerCase();
  if (expected === 'xml') {
    if (!lower.includes('xml')) failures.push(`content-type: expected XML, got ${actual}`);
    return;
  }

  if (!lower.includes(expected.toLowerCase())) {
    failures.push(`content-type: expected ${expected}, got ${actual}`);
  }
}

function xmlElementValues(xml, tagName) {
  const escapedTag = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
  return Array.from(xml.matchAll(pattern), (match) => match[1].trim());
}

function newsSitemapItems(xml) {
  return Array.from(xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi), (match) => {
    const block = match[1];
    const loc = xmlElementValues(block, 'loc')[0] ?? '';
    const title = xmlElementValues(block, 'news:title')[0] ?? '';
    return {
      loc: decodeXmlEntities(loc),
      title: decodeXmlEntities(title),
    };
  }).filter((item) => item.loc || item.title);
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeNewsTitleForGrouping(title) {
  return title
    .replace(/^EN:\s*/i, '')
    .replace(/[|｜].*$/g, '')
    .replace(/[，,：:；;。.!！?？"'“”‘’()[\]【】《》\s-]+/g, '')
    .toLowerCase();
}

function newsTitlePrefixKey(title) {
  return Array.from(normalizeNewsTitleForGrouping(title)).slice(0, 8).join('');
}

function newsTopicKey(title) {
  if (/黄金|金价|gold/i.test(title)) return 'gold';
  if (/港股|恒指|腾讯|阿里|hk|hang\s*seng/i.test(title)) return 'hk-stock';
  if (/美股|纳指|标普|道指|nasdaq|s&p|dow/i.test(title)) return 'us-stock';
  if (/比特币|以太坊|加密|crypto|bitcoin|ethereum|btc|eth/i.test(title)) return 'crypto';
  if (/原油|油价|crude|oil/i.test(title)) return 'oil';
  if (/期权|期货|衍生品|derivative|option|future/i.test(title)) return 'derivatives';
  return 'general';
}

function assertNewsSitemapDiversity(failures, xml) {
  const items = newsSitemapItems(xml);
  if (items.length === 0) return;
  if (items.length > NEWS_SITEMAP_MAX_ITEMS) {
    failures.push(`news-sitemap: too many news URLs (${items.length}, max ${NEWS_SITEMAP_MAX_ITEMS})`);
  }

  const topicCounts = new Map();
  const prefixCounts = new Map();
  for (const item of items) {
    const topic = newsTopicKey(item.title);
    if (topic !== 'general') {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }

    const prefix = newsTitlePrefixKey(item.title);
    if (prefix) prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }

  const crowdedTopics = Array.from(topicCounts.entries())
    .filter(([, count]) => count > NEWS_SITEMAP_MAX_ITEMS_PER_TOPIC)
    .sort((a, b) => b[1] - a[1]);
  if (crowdedTopics.length > 0) {
    failures.push(
      `news-sitemap: topic concentration too high (${crowdedTopics
        .slice(0, 3)
        .map(([topic, count]) => `${topic}:${count}`)
        .join(', ')}, max ${NEWS_SITEMAP_MAX_ITEMS_PER_TOPIC})`
    );
  }

  const crowdedPrefixes = Array.from(prefixCounts.entries())
    .filter(([, count]) => count > NEWS_SITEMAP_MAX_ITEMS_PER_TITLE_PREFIX)
    .sort((a, b) => b[1] - a[1]);
  if (crowdedPrefixes.length > 0) {
    failures.push(
      `news-sitemap: repeated title prefixes too high (${crowdedPrefixes
        .slice(0, 3)
        .map(([prefix, count]) => `${prefix}:${count}`)
        .join(', ')}, max ${NEWS_SITEMAP_MAX_ITEMS_PER_TITLE_PREFIX})`
    );
  }
}

function assertExpectedOrigin(failures, label, urls, expectedBaseUrl) {
  const invalid = urls
    .map(decodeXmlEntities)
    .filter((url) => {
      try {
        return new URL(url).origin !== expectedBaseUrl.origin;
      } catch {
        return true;
      }
    });

  if (invalid.length > 0) {
    failures.push(`${label}: expected ${expectedBaseUrl.origin} URLs, got ${invalid.slice(0, 3).join(', ')}`);
  }
}

function assertSitemapIndex(failures, xml, expectedBaseUrl) {
  if (!xml.includes('<sitemapindex')) failures.push('sitemap-index: missing <sitemapindex>');
  const locs = xmlElementValues(xml, 'loc');
  if (locs.length === 0) {
    failures.push('sitemap-index: missing sitemap <loc>');
    return;
  }
  if (!locs.some((loc) => decodeXmlEntities(loc).includes('/sitemap-chunk/static/0'))) {
    failures.push('sitemap-index: missing static chunk');
  }
  assertExpectedOrigin(failures, 'sitemap-index loc', locs, expectedBaseUrl);
}

function assertSitemapUrlset(failures, xml, expectedBaseUrl) {
  if (!xml.includes('<urlset')) failures.push('sitemap-urlset: missing <urlset>');
  const locs = xmlElementValues(xml, 'loc');
  if (locs.length === 0) {
    failures.push('sitemap-urlset: missing URL <loc>');
    return;
  }
  assertExpectedOrigin(failures, 'sitemap-urlset loc', locs, expectedBaseUrl);
}

function assertNewsSitemap(failures, xml, expectedBaseUrl) {
  if (!xml.includes('<urlset')) failures.push('news-sitemap: missing <urlset>');
  const locs = xmlElementValues(xml, 'loc');
  if (locs.length === 0) {
    failures.push('news-sitemap: missing URL <loc>');
    return;
  }

  const hasNewsNamespace = xml.includes('schemas/sitemap-news/0.9');
  const hasNewsEntries = xml.includes('<news:news>') && xml.includes('<news:title>');
  const hasFallbackHome = locs.some((loc) => ['/zh', '/en'].some((path) => decodeXmlEntities(loc).endsWith(path)));

  if (hasNewsNamespace && !hasNewsEntries) {
    failures.push('news-sitemap: news namespace present but no news entries');
  }
  if (!hasNewsNamespace && !hasFallbackHome) {
    failures.push('news-sitemap: expected news entries or standard homepage fallback');
  }

  assertExpectedOrigin(failures, 'news-sitemap loc', locs, expectedBaseUrl);
  if (hasNewsEntries) assertNewsSitemapDiversity(failures, xml);
}

function assertRss(failures, xml, expectedBaseUrl) {
  if (!xml.includes('<rss')) failures.push('rss: missing <rss>');
  if (!xml.includes('<channel>')) failures.push('rss: missing <channel>');
  if (!xml.includes('<atom:link')) failures.push('rss: missing self atom:link');

  const link = xmlElementValues(xml, 'link')[0];
  if (!link) {
    failures.push('rss: missing channel link');
  } else {
    assertExpectedOrigin(failures, 'rss channel link', [link], expectedBaseUrl);
  }

  const atomSelf = xml.match(/<atom:link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']self["'][^>]*>/i)
    || xml.match(/<atom:link\b[^>]*rel=["']self["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!atomSelf) {
    failures.push('rss: missing rel=self atom link');
  } else {
    assertExpectedOrigin(failures, 'rss atom self', [atomSelf[1]], expectedBaseUrl);
  }
}

function assertRobotsTxt(failures, text, expectedBaseUrl) {
  if (!/^User-Agent:\s*\*/im.test(text)) failures.push('robots.txt: missing User-Agent: *');
  if (!/^Allow:\s*\//im.test(text)) failures.push('robots.txt: missing Allow: /');
  if (!/^Disallow:\s*\/api\//im.test(text)) failures.push('robots.txt: missing /api/ disallow');

  const sitemapUrls = Array.from(text.matchAll(/^Sitemap:\s*(\S+)/gim), (match) => match[1]);
  if (sitemapUrls.length === 0) {
    failures.push('robots.txt: missing Sitemap directives');
    return;
  }

  for (const requiredPath of ['/sitemap.xml', '/sitemap-news.xml']) {
    if (!sitemapUrls.some((url) => decodeXmlEntities(url).endsWith(requiredPath))) {
      failures.push(`robots.txt: missing Sitemap ${requiredPath}`);
    }
  }
  assertExpectedOrigin(failures, 'robots.txt Sitemap', sitemapUrls, expectedBaseUrl);
}

function assertResourceBody(failures, body, expectedBaseUrl, check) {
  switch (check.resourceKind) {
    case 'sitemap-index':
      assertSitemapIndex(failures, body, expectedBaseUrl);
      break;
    case 'sitemap-urlset':
      assertSitemapUrlset(failures, body, expectedBaseUrl);
      break;
    case 'news-sitemap':
      assertNewsSitemap(failures, body, expectedBaseUrl);
      break;
    case 'rss':
      assertRss(failures, body, expectedBaseUrl);
      break;
    case 'robots':
      assertRobotsTxt(failures, body, expectedBaseUrl);
      break;
  }
}

function sameOriginPathUrl(sourceUrl, targetBaseUrl) {
  const source = new URL(decodeXmlEntities(sourceUrl));
  return new URL(`${source.pathname}${source.search}`, targetBaseUrl);
}

async function probeSitemapUrls(fetchBaseUrl, expectedBaseUrl, limit) {
  if (limit <= 0) return [];

  const failures = [];
  const sitemapResponse = await fetch(new URL('/sitemap.xml', fetchBaseUrl), { redirect: 'manual' });
  if (sitemapResponse.status !== 200) {
    return [`sitemap-probe: expected /sitemap.xml 200, got ${sitemapResponse.status}`];
  }

  const sitemapIndex = await sitemapResponse.text();
  const chunkUrls = xmlElementValues(sitemapIndex, 'loc').map(decodeXmlEntities);
  if (chunkUrls.length === 0) return ['sitemap-probe: no sitemap chunks found'];

  const targetUrls = [];
  for (const chunkUrl of chunkUrls.slice(0, 5)) {
    if (targetUrls.length >= limit) break;

    const chunkResponse = await fetch(sameOriginPathUrl(chunkUrl, fetchBaseUrl), { redirect: 'manual' });
    if (chunkResponse.status !== 200) {
      failures.push(`sitemap-probe: chunk ${chunkUrl} expected 200, got ${chunkResponse.status}`);
      continue;
    }

    const chunkXml = await chunkResponse.text();
    for (const loc of xmlElementValues(chunkXml, 'loc').map(decodeXmlEntities)) {
      targetUrls.push(loc);
      if (targetUrls.length >= limit) break;
    }
  }

  if (targetUrls.length === 0) {
    failures.push('sitemap-probe: no URL loc entries found in sampled chunks');
    return failures;
  }

  for (const targetUrl of targetUrls.slice(0, limit)) {
    let response;
    try {
      response = await fetch(sameOriginPathUrl(targetUrl, fetchBaseUrl), { redirect: 'manual' });
    } catch (error) {
      failures.push(`sitemap-probe: ${targetUrl} fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (response.status !== 200) {
      failures.push(`sitemap-probe: ${targetUrl} expected 200, got ${response.status}`);
      continue;
    }

    const expectedOriginUrl = new URL(targetUrl);
    assertUrlEqual(failures, `sitemap-probe canonical origin ${targetUrl}`, expectedOriginUrl.origin, expectedBaseUrl.origin);
  }

  return failures;
}

function parseJsonLd(html) {
  const items = [];
  for (const match of html.matchAll(JSON_LD_SELECTOR)) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      items.push(JSON.parse(raw));
    } catch {
      // Hydration markers may occasionally make third-party parsers unhappy;
      // report absence of required schema instead of failing on one bad blob.
    }
  }
  return items;
}

function flattenJsonLd(items) {
  const flat = [];
  const visit = (item) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    flat.push(item);
    if (Array.isArray(item['@graph'])) visit(item['@graph']);
  };
  visit(items);
  return flat;
}

function jsonLdTypes(item) {
  const type = item?.['@type'];
  return Array.isArray(type) ? type : type ? [type] : [];
}

function assertArticleJsonLd(failures, html) {
  const items = flattenJsonLd(parseJsonLd(html));
  const articleSchema = items.find((item) => {
    const types = jsonLdTypes(item);
    return types.includes('NewsArticle') || types.includes('AnalysisNewsArticle');
  });

  if (!articleSchema) {
    failures.push('json-ld: missing NewsArticle or AnalysisNewsArticle');
    return;
  }

  for (const field of ['headline', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage']) {
    if (!articleSchema[field]) failures.push(`json-ld: missing ${field}`);
  }
  if (!articleSchema.image) failures.push('json-ld: missing image');
}

function assertJsonLdTypes(failures, html, requiredTypes = []) {
  if (requiredTypes.length === 0) return;
  const items = flattenJsonLd(parseJsonLd(html));
  for (const requiredType of requiredTypes) {
    const found = items.some((item) => jsonLdTypes(item).includes(requiredType));
    if (!found) failures.push(`json-ld: missing ${requiredType}`);
  }
}

function assertAlternateLinks(failures, alternates, expected, expectedBaseUrl, check) {
  if (check.allowSingleLanguageAlternates) {
    const currentLangHref = normalizeUrl(alternates[expected.lang], expectedBaseUrl);
    assertUrlEqual(failures, `hreflang ${expected.lang}`, currentLangHref, expected.canonical);

    if (alternates['x-default']) {
      assertUrlEqual(
        failures,
        'hreflang x-default',
        normalizeUrl(alternates['x-default'], expectedBaseUrl),
        expected.canonical
      );
    }

    return;
  }

  if (check.allowPartialAlternates) {
    const currentLangHref = normalizeUrl(alternates[expected.lang], expectedBaseUrl);
    assertUrlEqual(failures, `hreflang ${expected.lang}`, currentLangHref, expected.canonical);

    const validAlternateUrls = new Set();
    for (const hrefLang of ['zh', 'en']) {
      if (!alternates[hrefLang]) continue;
      const normalized = normalizeUrl(alternates[hrefLang], expectedBaseUrl);
      assertUrlEqual(failures, `hreflang ${hrefLang}`, normalized, expected.alternates[hrefLang]);
      if (normalized) validAlternateUrls.add(comparableUrl(normalized));
    }

    if (alternates['x-default']) {
      const normalizedDefault = normalizeUrl(alternates['x-default'], expectedBaseUrl);
      if (!validAlternateUrls.has(comparableUrl(normalizedDefault))) {
        failures.push(`hreflang x-default: expected one of current alternate URLs, got ${normalizedDefault ?? 'missing'}`);
      }
    }

    return;
  }

  if (!check.article) {
    assertUrlEqual(failures, 'hreflang zh', normalizeUrl(alternates.zh, expectedBaseUrl), expected.alternates.zh);
    assertUrlEqual(failures, 'hreflang en', normalizeUrl(alternates.en, expectedBaseUrl), expected.alternates.en);
    return;
  }

  const currentLangHref = normalizeUrl(alternates[expected.lang], expectedBaseUrl);
  if (currentLangHref) {
    assertUrlEqual(failures, `hreflang ${expected.lang}`, currentLangHref, expected.canonical);
  }

  for (const [hrefLang, href] of Object.entries(alternates)) {
    const normalized = normalizeUrl(href, expectedBaseUrl);
    if (!normalized) {
      failures.push(`hreflang ${hrefLang}: invalid URL`);
      continue;
    }

    const expectedPrefix = hrefLang === 'en' ? '/en/article/' : hrefLang === 'zh' ? '/zh/article/' : null;
    if (expectedPrefix && new URL(normalized).pathname.startsWith(expectedPrefix)) continue;
    if (hrefLang === 'x-default' && comparableUrl(normalized) === comparableUrl(expected.canonical)) continue;

    failures.push(`hreflang ${hrefLang}: unexpected article alternate ${normalized}`);
  }
}

async function checkPage(fetchBaseUrl, expectedBaseUrl, check) {
  const url = new URL(check.path, fetchBaseUrl);
  const response = await fetch(url, { redirect: 'manual' });
  const failures = [];

  if (response.status !== 200) {
    failures.push(`status: expected 200, got ${response.status}`);
    return { path: check.path, failures };
  }

  const html = await response.text();
  const expected = pageExpectations(expectedBaseUrl, check.path);
  const title = pageTitle(html);
  const description = metaContent(html, 'name', 'description');
  const canonical = normalizeUrl(firstLinkHref(html, 'canonical'), expectedBaseUrl);
  const ogUrl = normalizeUrl(metaContent(html, 'property', 'og:url'), expectedBaseUrl);
  const ogLocale = metaContent(html, 'property', 'og:locale');
  const ogImage = metaContent(html, 'property', 'og:image');
  const robots = metaContent(html, 'name', 'robots');
  const alternates = alternateLinks(html);
  const cacheControl = response.headers.get('cache-control');

  assertTitle(failures, title, { article: Boolean(check.article) });
  assertDescription(failures, description, expected.lang, { article: Boolean(check.article) });
  assertEqual(failures, 'canonical', canonical, expected.canonical);
  assertEqual(failures, 'og:url', ogUrl, expected.canonical);
  assertEqual(failures, 'og:locale', ogLocale, expected.locale);
  assertOgImage(failures, ogImage, expectedBaseUrl, { allowCustom: Boolean(check.article || check.allowCustomOgImage) });
  assertAlternateLinks(failures, alternates, expected, expectedBaseUrl, check);
  assertRobots(failures, robots, check.index);
  if (check.cache !== 'no-store-ok') assertCacheHeader(failures, cacheControl, check.cache);
  if (check.article) assertArticleJsonLd(failures, html);
  if (check.jsonLdTypes) assertJsonLdTypes(failures, html, check.jsonLdTypes);

  return { path: check.path, failures };
}

async function checkResource(fetchBaseUrl, expectedBaseUrl, check) {
  const url = new URL(check.path, fetchBaseUrl);
  const response = await fetch(url, { redirect: 'manual' });
  const failures = [];

  if (response.status !== 200) {
    failures.push(`status: expected 200, got ${response.status}`);
    return { path: check.path, failures };
  }

  assertContentType(failures, response.headers.get('content-type'), check.contentType);
  assertCacheHeader(failures, response.headers.get('cache-control'), check.cache);
  if (check.resourceKind) {
    assertResourceBody(failures, await response.text(), expectedBaseUrl, check);
  }
  return { path: check.path, failures };
}

async function main() {
  const {
    fetchBaseUrl,
    expectedBaseUrl,
    paths,
    articlePaths,
    sampleArticleUrls: articleSampleLimit,
    probeSitemapUrls: sitemapProbeLimit,
    sampleSitemapKindSpecs,
  } = parseArgs(process.argv.slice(2));
  const sampledArticlePaths = articleSampleLimit > 0
    ? await sampleArticlePaths(fetchBaseUrl, articleSampleLimit)
    : [];
  const sitemapKindSamples = sampleSitemapKindSpecs.length > 0
    ? await sampleSitemapKindPaths(fetchBaseUrl, sampleSitemapKindSpecs)
    : { sampled: [], skipped: [] };
  const sampledSitemapPaths = sitemapKindSamples.sampled;
  if (articleSampleLimit > 0 && sampledArticlePaths.length === 0) {
    throw new Error('Unable to sample article URLs from news or article sitemaps');
  }
  const effectiveArticlePaths = [...new Set([...articlePaths, ...sampledArticlePaths])];
  const checks = dedupeChecks([
    ...selectChecks(paths, effectiveArticlePaths),
    ...sampledSitemapPaths.map(checkFromSitemapPath),
  ]);
  console.log(`Checking SEO metadata at ${fetchBaseUrl.origin}`);
  console.log(`Expected canonical origin: ${expectedBaseUrl.origin}`);
  if (paths.length > 0) console.log(`Filtered paths: ${paths.join(', ')}`);
  if (articleSampleLimit > 0) console.log(`Sampled article paths: ${sampledArticlePaths.join(', ')}`);
  if (articlePaths.length > 0) console.log(`Article sample paths: ${articlePaths.join(', ')}`);
  if (sampleSitemapKindSpecs.length > 0) {
    console.log(`Sampled sitemap paths: ${sampledSitemapPaths.join(', ')}`);
    if (sitemapKindSamples.skipped.length > 0) {
      console.log(`Skipped sitemap kinds: ${sitemapKindSamples.skipped.join(', ')}`);
    }
  }
  if (sitemapProbeLimit > 0) console.log(`Sitemap URL probe limit: ${sitemapProbeLimit}`);

  let failed = 0;
  for (const check of checks) {
    try {
      const result = 'index' in check
        ? await checkPage(fetchBaseUrl, expectedBaseUrl, check)
        : await checkResource(fetchBaseUrl, expectedBaseUrl, check);
      if (result.failures.length > 0) {
        failed += 1;
        console.error(`FAIL ${result.path}`);
        for (const failure of result.failures) console.error(`  - ${failure}`);
      } else {
        console.log(`OK   ${result.path}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${check.path}`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (sitemapProbeLimit > 0) {
    const failures = await probeSitemapUrls(fetchBaseUrl, expectedBaseUrl, sitemapProbeLimit);
    if (failures.length > 0) {
      failed += 1;
      console.error('FAIL sitemap URL probe');
      for (const failure of failures) console.error(`  - ${failure}`);
    } else {
      console.log(`OK   sitemap URL probe (${sitemapProbeLimit} URLs)`);
    }
  }

  if (failed > 0) {
    console.error(`SEO metadata check failed: ${failed}/${checks.length} checks failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`SEO metadata check passed: ${checks.length}/${checks.length} checks OK.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
