import type { Metadata } from 'next';
import { createMetadata } from '@yayanews/seo';
import { getDictionary } from '@/lib/dictionaries';
import FlashPageClient from './FlashPageClient';

export const revalidate = 30;

export function generateMetadata({ params: { lang } }: { params: { lang: 'zh' | 'en' } }): Metadata {
  return createMetadata({
    title: lang === 'en' ? 'Live Financial Flash News 24/7' : '财经快讯 · 实时滚动播报',
    description: lang === 'en'
      ? 'YayaNews live financial flash feed — the fastest breaking market news on US equities, Hong Kong stocks, Bitcoin, Ethereum, gold and key commodities, updated around the clock every day.'
      : '鸭鸭财经实时快讯流——精选美股、港股、加密货币、衍生品市场每日重要资讯。突发事件秒级推送，7×24全天候覆盖全球市场关键动态，助投资者及时决策。',
    url: '/flash',
    lang,
    type: 'website',
  });
}

export default async function FlashPage({ params, searchParams }: { params: { lang: 'zh' | 'en' }, searchParams: { cat?: string } }) {
  const dict = await getDictionary(params.lang);
  return <FlashPageClient initialCat={searchParams.cat || ''} lang={params.lang} flashDict={dict.flash} />;
}
