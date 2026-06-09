/**
 * Keep this in sync with the first 50 entries produced by next.config.mjs.
 * Return true only for hosts that Next's image optimizer is configured to accept.
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
  'cointelegraph.com',
  'cryptoslate.com',
  'theblock.co',
  'coindesk.com',
  'bloomberg.com',
  'reuters.com',
  'yahoo.com',
  'yimg.com',
  'cnbc.com',
  'wsj.com',
  'investopedia.com',
  'forbes.com',
];

const EXACT_HOSTS = new Set([
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
