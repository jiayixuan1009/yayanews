import { siteConfig } from '@yayanews/types';

const FALLBACK_SITE_ORIGIN = 'https://yayanews.cryptooptiontool.com';

export function getMetadataBase(): URL {
  const raw = (siteConfig.siteUrl || '').trim() || FALLBACK_SITE_ORIGIN;
  try {
    return new URL(raw.replace(/\/+$/, ''));
  } catch {
    return new URL(FALLBACK_SITE_ORIGIN);
  }
}
