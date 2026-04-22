import type { Metadata } from 'next';
import { siteConfig, SITE_NAME_ZH, SITE_SLOGAN_ZH, SITE_SLOGAN_EN } from '@yayanews/types';

export interface MetadataOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  type?: 'website' | 'article';
  authors?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  keywords?: string[];
  noIndex?: boolean;
  lang?: 'zh' | 'en';
  alternatesLanguages?: Record<string, string>;
}

const DEFAULT_KEYWORDS_ZH = [
  '鸭鸭新闻', 'YayaNews', '财经资讯', '金融新闻', '亚洲最快财经资讯',
  '美股', '港股', '加密货币', '比特币', '以太坊', '衍生品', '期货', '期权',
  '实时行情', '7×24快讯', 'AI资讯', '投资分析',
];

const DEFAULT_KEYWORDS_EN = [
  'YayaNews', 'financial news', "Asia's fastest financial news",
  'US stocks', 'HK stocks', 'cryptocurrency', 'Bitcoin', 'Ethereum',
  'derivatives', 'market data', 'live financial news', 'investment',
];

// The default OG/Twitter image should be the site's official OG card.
// When not available, fall back to the article placeholder.
const DEFAULT_OG_IMAGE = '/brand/logo-square.png';

const FALLBACK_SITE_ORIGIN = 'https://yayanews.cryptooptiontool.com';

function safeMetadataBase(): URL {
  const raw = (siteConfig.siteUrl || '').trim() || FALLBACK_SITE_ORIGIN;
  const normalized = raw.replace(/\/+$/, '');
  try {
    return new URL(normalized);
  } catch {
    return new URL(FALLBACK_SITE_ORIGIN);
  }
}

export function createMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title,
    description,
    image,
    url,
    canonical,
    type = 'website',
    authors,
    publishedTime,
    modifiedTime,
    section,
    keywords,
    noIndex = false,
    lang = 'zh',
  } = options;

  const isZh = lang !== 'en';
  const brandName = isZh ? `${SITE_NAME_ZH}（YayaNews）` : 'YayaNews';
  const slogan = isZh ? SITE_SLOGAN_ZH : SITE_SLOGAN_EN;
  const defaultDesc = isZh
    ? `${SITE_NAME_ZH}（YayaNews）—— ${slogan}，7×24小时覆盖美股、港股、加密货币、衍生品市场实时快讯与深度分析。`
    : `YayaNews — ${SITE_SLOGAN_EN}. 24/7 coverage of US stocks, HK markets, crypto and derivatives.`;

  const finalDesc = description ?? defaultDesc;
  const finalTitle = title ?? `${brandName} — ${slogan}`;
  const finalImage = image ?? DEFAULT_OG_IMAGE;
  const localePrefix = isZh ? '/zh' : '/en';
  // Strip any existing locale prefix if accidentally passed
  const cleanUrl = url ? (url.startsWith('/') ? url : `/${url}`).replace(/^\/(zh|en)(\/|$)/, '$2') : '';
  const finalCanonical = canonical ?? `${localePrefix}${cleanUrl}`;

  const metadataBaseUrl = safeMetadataBase();
  const fullUrl = `${metadataBaseUrl.origin}${finalCanonical}`;
  const defaultKeywords = isZh ? DEFAULT_KEYWORDS_ZH : DEFAULT_KEYWORDS_EN;

  const metadata: Metadata = {
    title: {
      default: finalTitle,
      template: `%s | ${isZh ? SITE_NAME_ZH : 'YayaNews'}`,
    },
    description: finalDesc,
    keywords: keywords ?? defaultKeywords,
    metadataBase: metadataBaseUrl,
    alternates: {
      canonical: finalCanonical,
      languages: options.alternatesLanguages || {
        'zh': `/zh${cleanUrl}`,
        'en': `/en${cleanUrl}`,
      },
    },
    openGraph: {
      type: type as any,
      locale: isZh ? 'zh_CN' : 'en_US',
      alternateLocale: isZh ? ['en_US'] : ['zh_CN'],
      siteName: isZh ? `${SITE_NAME_ZH} (YayaNews)` : 'YayaNews',
      title: finalTitle,
      description: finalDesc,
      url: fullUrl,
      images: [
        {
          url: finalImage,
          width: 1200,
          height: 630,
          alt: title ?? `${brandName} — ${slogan}`,
          type: 'image/png',
        },
      ],
      ...(type === 'article' && {
        publishedTime,
        modifiedTime,
        authors,
        section,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      site: '@YayaNewsAsia',
      creator: '@YayaNewsAsia',
      title: finalTitle,
      description: finalDesc,
      images: [
        {
          url: finalImage,
          alt: title ?? `${brandName} — ${slogan}`,
        },
      ],
    },
    robots: {
      index: !noIndex,
      follow: true, // Always follow links — even noindex pages should pass link equity
      googleBot: {
        index: !noIndex,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    other: {
      google: 'notranslate',
    },
  };

  return metadata;
}

export function getSiteVerificationMeta(): Metadata['verification'] | undefined {
  const googleSiteVer = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bingSiteVer = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

  if (googleSiteVer || bingSiteVer) {
    return {
      ...(googleSiteVer ? { google: googleSiteVer } : {}),
      ...(bingSiteVer ? { other: { 'msvalidate.01': bingSiteVer } } : {}),
    };
  }
  return undefined;
}
