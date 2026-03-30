/**
 * 与 next.config 中 images.remotePatterns 保持一致。
 * 仅在这些域名上使用 next/image 优化（WebP/AVIF、按需尺寸）；其余仍用 unoptimized 避免运行时报错。
 */
const HOST_SUFFIXES = [
  'coingecko.com',
  'cryptooptiontool.com',
  'amazonaws.com',
  'cloudfront.net',
  'wp.com',
  'wordpress.com',
  'googleusercontent.com',
  'githubusercontent.com',
  'medium.com',
  'substack.com',
  'redditmedia.com',
  'redd.it',
  'reddit.com',
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'twimg.com',
  'cloudinary.com',
  'imgur.com',
  'akamaized.net',
  'fastly.net',
  'shopify.com',
  'cloudflare.com',
  'prismic.io',
  'ctfassets.net',
  'cdninstagram.com',
  'fbcdn.net',
  'wikimedia.org',
];

const EXACT_HOSTS = new Set([
  'yayanews.cryptooptiontool.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'images.pexels.com',
  'static.seekingalpha.com',
  'i.imgur.com',
]);

export function isRemoteImageOptimizable(src: string | null | undefined): boolean {
  if (!src?.trim()) return false;
  const t = src.trim();
  if (t.startsWith('/')) return true;
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const { hostname } = new URL(t);
    const h = hostname.toLowerCase();
    if (EXACT_HOSTS.has(h)) return true;
    for (const s of HOST_SUFFIXES) {
      if (h === s || h.endsWith('.' + s)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
