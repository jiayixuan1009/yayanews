import type { Metadata } from 'next';
import { createMetadata } from '@yayanews/seo';
import MarketsClient from './MarketsClient';

export const revalidate = 60;

export function generateMetadata({ params: { lang } }: { params: { lang: 'zh' | 'en' } }): Metadata {
  return createMetadata({
    title: lang === 'en' ? 'Global Markets Live | US Stocks, Crypto, Gold & Oil' : '全球市场实时行情看板 | 美股·港股·加密·大宗商品',
    description: lang === 'en'
      ? 'YayaNews global markets dashboard — live prices and performance for US stocks, Hong Kong equities, Bitcoin, Ethereum and commodities including gold and crude oil, with macro trend analysis.'
      : '鸭鸭财经全球市场行情看板——实时追踪纳斯达克、道指、恒生指数、比特币、以太坊及黄金原油等核心资产价格走势与涨跌幅，助您快速掌握全局市场动态。',
    url: '/markets',
    lang,
    type: 'website',
  });
}

export default function MarketsPage() {
  return <MarketsClient />;
}
