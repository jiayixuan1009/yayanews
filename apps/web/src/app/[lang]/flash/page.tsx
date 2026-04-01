import type { Metadata } from 'next';
import { createMetadata } from '@yayanews/seo';
import FlashPageClient from './FlashPageClient';

export const revalidate = 30;

export function generateMetadata({ params: { lang } }: { params: { lang: 'zh' | 'en' } }): Metadata {
  return createMetadata({
    title: lang === 'en' ? '24H Flash News' : '7×24快讯',
    description: lang === 'en' 
      ? '24/7 rolling financial flash news covering US stocks, Hong Kong stocks, crypto, and derivatives.' 
      : '7×24小时滚动金融快讯，覆盖美股、港股、加密货币、衍生品市场实时动态。',
    url: '/flash',
    lang,
    type: 'website',
  });
}

export default function FlashPage({ params, searchParams }: { params: { lang: 'zh' | 'en' }, searchParams: { cat?: string } }) {
  return <FlashPageClient initialCat={searchParams.cat || ''} lang={params.lang} />;
}
