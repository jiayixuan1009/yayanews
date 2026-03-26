import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader, Public_Sans } from 'next/font/google';
import { siteConfig } from '@/lib/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import './globals.css';

const googleSiteVer = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const bingSiteVer = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

const siteVerification: Metadata['verification'] | undefined =
  googleSiteVer || bingSiteVer
    ? {
        ...(googleSiteVer ? { google: googleSiteVer } : {}),
        ...(bingSiteVer ? { other: { 'msvalidate.01': bingSiteVer } } : {}),
      }
    : undefined;

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  weight: ['400', '600', '700'],
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
  weight: ['400', '500', '600', '700'],
});

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${newsreader.variable} ${publicSans.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        <link rel="preconnect" href="https://api.coingecko.com" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-[#f6f3ee] font-body text-slate-900">
        <Analytics />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
