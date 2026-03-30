import type { Metadata } from 'next';
import FlashPageClient from './FlashPageClient';

export const revalidate = 30;

export const metadata: Metadata = {
  title: '7×24快讯',
  description: '7×24小时滚动金融快讯，覆盖美股、港股、加密货币、衍生品市场实时动态',
  alternates: { canonical: '/flash' },
  openGraph: { title: '7×24快讯 | YayaNews', description: '全球金融市场7×24小时实时快讯' },
};

export default function FlashPage({ searchParams }: { searchParams: { cat?: string } }) {
  return <FlashPageClient initialCat={searchParams.cat || ''} />;
}
