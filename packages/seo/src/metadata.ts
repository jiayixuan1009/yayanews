import type { Metadata } from 'next';
import { siteConfig } from '@yayanews/types';

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
}

export function createMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title,
    description = siteConfig.description,
    image = '/images/article-placeholder.svg',
    url,
    canonical,
    type = 'website',
    authors,
    publishedTime,
    modifiedTime,
    section,
    keywords,
    noIndex = false,
  } = options;

  const finalTitle = title ? title : `${siteConfig.siteName} - 专业金融新闻资讯平台`;
  const fullUrl = url ? `${siteConfig.siteUrl}${url.startsWith('/') ? url : `/${url}`}` : siteConfig.siteUrl;

  const metadata: Metadata = {
    title: {
      default: finalTitle,
      template: `%s | ${siteConfig.siteName}`,
    },
    description,
    keywords: keywords || ['金融新闻', '美股', '港股', '加密货币', '比特币', '衍生品', 'AI资讯', '行情', 'YayaNews', 'BiyaPay'],
    metadataBase: new URL(siteConfig.siteUrl),
    alternates: {
      canonical: canonical || url || '/',
    },
    openGraph: {
      type: type as any,
      locale: 'zh_CN',
      siteName: siteConfig.siteName,
      title: finalTitle,
      description,
      url: fullUrl,
      images: [
        {
          url: image,
          width: 1200,
          height: 675,
          alt: title || siteConfig.siteName,
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
      title: finalTitle,
      description,
      images: [image],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
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
