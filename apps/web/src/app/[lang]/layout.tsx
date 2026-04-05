import type { Viewport } from 'next';
import { siteConfig } from '@yayanews/types';
import { createMetadata, getSiteVerificationMeta } from '@yayanews/seo';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import '../globals.css';
import { getDictionary } from '@/lib/dictionaries';
import dynamic from 'next/dynamic';
import { Inter, Public_Sans, Newsreader } from 'next/font/google';

// ── Self-hosted fonts (eliminates render-blocking external CSS) ──────────
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-public-sans',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-newsreader',
});

// ── Lazy-loaded client components that don't participate in first paint ──
const Toaster = dynamic(
  () => import('sonner').then(m => ({ default: m.Toaster })),
  { ssr: false }
);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f3ee',
};

// NOTE: per-page metadata (article, flash, category) passes their own `url`.
// This layout-level metadata is only used as a fallback base.
export const metadata = createMetadata({
  title: `${siteConfig.siteName} - 专业金融新闻资讯平台`,
  description: siteConfig.description,
  type: 'website',
  url: '/',  // ensures canonical resolves to the siteUrl root, not a sub-path
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
    <html lang={params.lang} className={`${inter.variable} ${publicSans.variable} ${newsreader.variable}`}>
      <head>
        {/* Preconnect to external data APIs used by LiveTicker */}
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        <link rel="dns-prefetch" href="https://assets.coingecko.com" />
        {/* hreflang alternates are managed per-page via createMetadata().alternates.languages */}
      </head>
      <body className="flex min-h-screen flex-col bg-[#f6f3ee] font-body text-slate-900">
        <Analytics />
        <Header lang={params.lang} dict={dict.nav} />
        <main className="flex-1">{children}</main>
        <Footer lang={params.lang} dict={dict.footer} />
        <Toaster position="bottom-right" theme="dark" closeButton />
      </body>
    </html>
  );
}
