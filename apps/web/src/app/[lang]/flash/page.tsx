import type { Metadata } from 'next';
import { buildBreadcrumbJsonLd, createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';
import { getDictionary } from '@/lib/dictionaries';
import { getFlashNews } from '@/lib/queries';
import { encodeFlashSlug } from '@/lib/ui-utils';
import FlashPageClient from './FlashPageClient';

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ lang: 'zh' | 'en' }> }): Promise<Metadata> {
  const { lang } = await params;
  return createMetadata({
    title: lang === 'en' ? 'Live Financial Flash News 24/7' : '财经快讯 · 实时滚动播报',
    description: lang === 'en'
      ? 'Live market flash updates from YayaNews covering US stocks, Hong Kong equities, Bitcoin, Ethereum, gold and key commodities around the clock.'
      : '鸭鸭财经实时快讯流——精选美股、港股、加密货币、衍生品市场每日重要资讯。突发事件秒级推送，7×24全天候覆盖全球市场关键动态，助投资者及时决策。',
    url: '/flash',
    lang,
    type: 'website',
  });
}

export default async function FlashPage({ params, searchParams }: { params: Promise<{ lang: 'zh' | 'en' }>, searchParams: Promise<{ cat?: string }> }) {
  const [{ lang }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const [dict, flashItems] = await Promise.all([
    getDictionary(lang),
    getFlashNews(lang, 30, resolvedSearchParams.cat || undefined),
  ]);
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: dict.flash.pageTitle,
    description: dict.flash.pageSubtitle,
    url: `${siteConfig.siteUrl}/${lang}/flash`,
    inLanguage: lang === 'en' ? 'en' : 'zh-CN',
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: flashItems.length,
      itemListElement: flashItems.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.title,
        url: `${siteConfig.siteUrl}/${lang}/flash/${encodeFlashSlug(item)}`,
      })),
    },
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: dict.nav.home, url: `/${lang}` },
    { name: dict.nav.flash, url: `/${lang}/flash` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <FlashPageClient initialCat={resolvedSearchParams.cat || ''} lang={lang} flashDict={dict.flash} />
    </>
  );
}
