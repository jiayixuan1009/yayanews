import type { Viewport } from 'next';
import { siteConfig } from '@yayanews/types';
import { createMetadata, getSiteVerificationMeta } from '@yayanews/seo';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import '../globals.css';
import { getDictionary } from '@/lib/dictionaries';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f3ee',
};

export const metadata = createMetadata({
  title: `${siteConfig.siteName} - 专业金融新闻资讯平台`,
  description: siteConfig.description,
  type: 'website',
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
