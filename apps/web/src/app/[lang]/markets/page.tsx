import type { Metadata } from 'next';
import MarketsClient from './MarketsClient';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '实时行情',
  description: '加密货币、美股、港股、衍生品实时行情数据，价格走势与市场概览',
  alternates: { canonical: '/markets' },
  openGraph: { title: '实时行情 | YayaNews', description: '加密货币实时行情、全球市场数据总览' },
};

export default function MarketsPage() {
  return <MarketsClient />;
}
