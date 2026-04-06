import type { Viewport } from 'next';
import { siteConfig } from '@yayanews/types';
import { createMetadata, getSiteVerificationMeta } from '@yayanews/seo';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import '../globals.css';
import { getDictionary } from '@/lib/dictionaries';
import dynamic from 'next/dynamic';

import { Inter, Public_Sans, Inter_Tight, Noto_Sans_SC } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' });
const notoSansSC = Noto_Sans_SC({ 
  weight: ['400', '600', '700'], 
  subsets: ['latin'], 
  preload: false, 
  variable: '--font-noto-sans-sc',
  display: 'swap' 
});

// ── Lazy-loaded: don't participate in first paint ────────────────────────
const Toaster = dynamic(
  () => import('sonner').then(m => ({ default: m.Toaster })),
  { ssr: false }
);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f3ee',
};

export const metadata = createMetadata({
  title: `${siteConfig.siteName} - 专业金融新闻资讯平台`,
  description: siteConfig.description,
  type: 'website',
  url: '/',
});
metadata.verification = getSiteVerificationMeta();

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const dict = await getDictionary(params.lang as any);
  return (
    <html lang={params.lang} className={`${inter.variable} ${publicSans.variable} ${interTight.variable} ${notoSansSC.variable}`}>
      <head>
        {/* Preconnect to external data APIs used by LiveTicker */}
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        <link rel="dns-prefetch" href="https://assets.coingecko.com" />
      </head>
      <body className="flex min-h-screen flex-col bg-[#f6f3ee] font-body text-slate-900 overflow-x-hidden w-full">
        <Analytics />
        <Header lang={params.lang} dict={dict.nav} />
        <main className="flex-1">{children}</main>
        <Footer lang={params.lang} dict={dict.footer} />
        <Toaster position="bottom-right" theme="dark" closeButton />
      </body>
    </html>
  );
}
