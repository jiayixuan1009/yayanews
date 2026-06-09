import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { siteConfig } from '@yayanews/types';
import { createMetadata, getSiteVerificationMeta } from '@yayanews/seo';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import AppToaster from '@/components/AppToaster';
import '../globals.css';
import { getDictionary } from '@/lib/dictionaries';

// Google fonts fetching is blocked by the server firewall/GFW during build.
// Falling back to standard generic system fonts in globals.css.
const inter = { variable: 'font-inter' };
const publicSans = { variable: 'font-public_sans' };
const interTight = { variable: 'font-inter_tight' };
const notoSansSC = { variable: 'font-noto_sans_sc' };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f3ee',
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const isEn = locale === 'en';
  const meta = createMetadata({
    title: isEn
      ? `${siteConfig.siteName} - Professional Financial News Platform`
      : `${siteConfig.siteName} - 专业金融新闻资讯平台`,
    description: isEn
      ? 'YayaNews - The fastest financial news. 24/7 coverage of US stocks, HK markets, crypto and derivatives.'
      : siteConfig.description,
    type: 'website',
    url: '/',
    lang: locale,
  });
  (meta as Metadata).verification = getSiteVerificationMeta();
  return meta;
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const dict = await getDictionary(locale);
  return (
    <html lang={locale} className={`${inter.variable} ${publicSans.variable} ${interTight.variable} ${notoSansSC.variable}`}>
      <head>
        <link rel="preconnect" href="https://assets.coingecko.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.coingecko.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="alternate" type="application/rss+xml" title={`${siteConfig.siteName} - News Feed`} href="/feed-news.xml" />
      </head>
      <body className="flex min-h-screen flex-col bg-[#f6f3ee] font-body text-slate-900 overflow-x-hidden w-full">
        <Analytics />
        <Header lang={locale} dict={dict.nav} />
        <main className="flex-1">{children}</main>
        <Footer lang={locale} dict={dict.footer} />
        <AppToaster />
      </body>
    </html>
  );
}
