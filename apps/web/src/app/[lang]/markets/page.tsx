import type { Metadata } from 'next';
import MarketsClient from './MarketsClient';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '全球市场行情',
  description: '全球宏观指标、美股、港股、加密货币实时行情数据，价格走势与市场总览 — YayaNews',
  alternates: { canonical: '/markets' },
  openGraph: { title: '全球市场行情 | YayaNews', description: '宏观指数、美股、港股、加密货币实时行情数据总览' },
};

export default function MarketsPage() {
  return <MarketsClient />;
}
