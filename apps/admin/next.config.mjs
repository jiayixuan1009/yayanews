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
};

export default nextConfig;
