import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (two levels up from apps/admin/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const remoteHosts = [
  'yayanews.cryptooptiontool.com',
  'cryptooptiontool.com',
  'assets.coingecko.com',
  'coin-images.coingecko.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'i.imgur.com',
  'i.redd.it',
  'preview.redd.it',
];

/** @type {import('next').NextConfig} */
const standaloneOutput = process.env.NEXT_OUTPUT_STANDALONE !== '0';
const distDir = process.env.NEXT_DIST_DIR?.trim();

// Admin-only CSP: 管理台没有任何第三方脚本/样式，只允许同源资源。
// Next.js 会在 HTML 内联 hydration 脚本，故 script-src 需保留 'unsafe-inline'（与 apps/web 现状一致）。
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src 'none'",
  "media-src 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  ...(standaloneOutput ? { output: 'standalone' } : {}),
  ...(distDir ? { distDir } : {}),
  compress: true,
  poweredByHeader: false,
  // Admin runs at /admin path via Nginx proxy
  basePath: '/admin',
  images: {
    remotePatterns: remoteHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
      pathname: '/**',
    })),
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
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
};

export default nextConfig;
