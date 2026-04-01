import type { Metadata } from 'next';
import { createMetadata } from '@yayanews/seo';
import MarketsClient from './MarketsClient';

export const revalidate = 60;

export function generateMetadata({ params: { lang } }: { params: { lang: 'zh' | 'en' } }): Metadata {
  return createMetadata({
    title: lang === 'en' ? 'Global Markets' : '全球市场行情',
    description: lang === 'en' 
      ? 'Global macro indicators, real-time quotes for US stocks, Hong Kong stocks, crypto, pricing trends and market overview.' 
      : '全球宏观指标、美股、港股、加密货币实时行情数据，价格走势与市场总览。',
    url: '/markets',
    lang,
    type: 'website',
  });
}

export default function MarketsPage() {
  return <MarketsClient />;
}
