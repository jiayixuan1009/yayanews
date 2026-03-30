import type { Metadata, Viewport } from 'next';
import { siteConfig } from '@yayanews/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import '../globals.css';
import { getDictionary } from '@/lib/dictionaries';

const googleSiteVer = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const bingSiteVer = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

const siteVerification: Metadata['verification'] | undefined =
  googleSiteVer || bingSiteVer
    ? {
        ...(googleSiteVer ? { google: googleSiteVer } : {}),
        ...(bingSiteVer ? { other: { 'msvalidate.01': bingSiteVer } } : {}),
      }
    : undefined;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f3ee',
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.siteName} - 专业金融新闻资讯平台`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: siteConfig.description,
  keywords: ['金融新闻', '美股', '港股', '加密货币', '比特币', '衍生品', 'AI资讯', '行情', 'YayaNews', 'BiyaPay'],
  metadataBase: new URL(siteConfig.siteUrl),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: siteConfig.siteName,
    title: `${siteConfig.siteName} - 专业金融新闻资讯平台`,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    images: [{ url: '/images/article-placeholder.svg', width: 1200, height: 675, alt: siteConfig.siteName }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.siteName,
    description: siteConfig.description,
    images: ['/images/article-placeholder.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  other: {
    google: 'notranslate',
  },
  ...(siteVerification ? { verification: siteVerification } : {}),
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const dict = await getDictionary(params.lang as any);
  return (
    <html lang={params.lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:wght@400;600;700&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        <link rel="preconnect" href="https://api.coingecko.com" crossOrigin="anonymous" />
        <link rel="alternate" hrefLang="zh-CN" href={`${siteConfig.siteUrl}/zh`} />
        <link rel="alternate" hrefLang="en-US" href={`${siteConfig.siteUrl}/en`} />
        <link rel="alternate" hrefLang="x-default" href={`${siteConfig.siteUrl}/zh`} />
      </head>
      <body className="flex min-h-screen flex-col bg-[#f6f3ee] font-body text-slate-900">
        <Analytics />
        <Header lang={params.lang} dict={dict.nav} />
        <main className="flex-1">{children}</main>
        <Footer lang={params.lang} dict={dict.footer} />
      </body>
    </html>
  );
}
