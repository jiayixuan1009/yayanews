import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

/** @type {import('next').NextConfig} */
const imageWildcardHosts = [
  '**.coingecko.com',
  '**.cryptooptiontool.com',
  '**.amazonaws.com',
  '**.cloudfront.net',
  '**.wp.com',
  '**.wordpress.com',
  '**.googleusercontent.com',
  '**.githubusercontent.com',
  '**.medium.com',
  '**.substack.com',
  '**.redditmedia.com',
  '**.unsplash.com',
  '**.pexels.com',
  '**.pixabay.com',
  '**.twimg.com',
  '**.cloudinary.com',
  '**.imgur.com',
  '**.akamaized.net',
  '**.fastly.net',
  '**.shopify.com',
  '**.cloudflare.com',
  '**.prismic.io',
  '**.ctfassets.net',
  '**.cdninstagram.com',
  '**.fbcdn.net',
  '**.wikimedia.org',
  '**.cointelegraph.com',
  '**.cryptoslate.com',
  '**.theblock.co',
  '**.coindesk.com',
  '**.bloomberg.com',
  '**.reuters.com',
  '**.yahoo.com',
  '**.yimg.com',
  '**.cnbc.com',
  '**.wsj.com',
  '**.investopedia.com',
  '**.forbes.com',
  '**.techcrunch.com',
  '**.decrypt.co',
  '**.blockworks.co',
  '**.finbold.com',
  '**.u.today',
  '**.zycrypto.com',
  '**.dailyhodl.com',
  '**.benzinga.com',
  '**.marketwatch.com',
  '**.investing.com',
  '**.fxstreet.com',
  '**.tradingview.com',
];

const imageExactHosts = [
  'yayanews.cryptooptiontool.com',
  'cryptooptiontool.com',
  'assets.coingecko.com',
  'coin-images.coingecko.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'static.seekingalpha.com',
  'i.imgur.com',
  'i.redd.it',
  'preview.redd.it',
];

const remotePatterns = [
  ...imageExactHosts.map((hostname) => ({
    protocol: 'https',
    hostname,
    pathname: '/**',
  })),
  ...imageWildcardHosts.map((hostname) => ({
    protocol: 'https',
    hostname,
    pathname: '/**',
  })),
].slice(0, 50);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' https:",
  "form-action 'self'",
].join('; ');

const htmlCacheHeaders = {
  live: 'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
  realtime: 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  topics: 'public, max-age=120, s-maxage=120, stale-while-revalidate=600',
  standardDetail: 'public, max-age=300, s-maxage=300, stale-while-revalidate=900',
  guide: 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',
  staticPolicy: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
};

const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns,
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/sitemap-chunk/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/sitemap-news.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/news.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/feed-news.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
        ],
      },
      {
        source: '/:lang(zh|en)',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.realtime },
        ],
      },
      {
        source: '/:lang(zh|en)/news',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.realtime },
        ],
      },
      {
        source: '/:lang(zh|en)/news/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.realtime },
        ],
      },
      {
        source: '/:lang(zh|en)/flash',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.live },
        ],
      },
      {
        source: '/:lang(zh|en)/flash/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.realtime },
        ],
      },
      {
        source: '/:lang(zh|en)/markets',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.realtime },
        ],
      },
      {
        source: '/:lang(zh|en)/topics',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.topics },
        ],
      },
      {
        source: '/:lang(zh|en)/topics/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.topics },
        ],
      },
      {
        source: '/:lang(zh|en)/article/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.standardDetail },
        ],
      },
      {
        source: '/:lang(zh|en)/authors',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.standardDetail },
        ],
      },
      {
        source: '/:lang(zh|en)/authors/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.standardDetail },
        ],
      },
      {
        source: '/:lang(zh|en)/tag/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.topics },
        ],
      },
      {
        source: '/:lang(zh|en)/guide',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.guide },
        ],
      },
      {
        source: '/:lang(zh|en)/guide/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.guide },
        ],
      },
      {
        source: '/:lang(zh|en)/price/:path*',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.topics },
        ],
      },
      {
        source: '/:lang(zh|en)/:page(about|advertising-policy|contact|corrections|editorial|editorial-policy|privacy|risk-disclosure|terms)',
        headers: [
          { key: 'Cache-Control', value: htmlCacheHeaders.staticPolicy },
        ],
      },
      {
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
        ],
      },
      {
        source: '/covers/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
