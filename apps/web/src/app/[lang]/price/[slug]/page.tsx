import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import PriceDetailClient from './PriceDetailClient';

async function fetchCoinMeta(slug: string) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(slug)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as { name?: string; symbol?: string };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const j = await fetchCoinMeta(params.slug);
  const name = j?.name ?? params.slug;
  const sym = j?.symbol?.toUpperCase() ?? '';
  const title = sym ? `${name} (${sym}) 价格行情` : `${name} 价格行情`;
  return {
    title,
    description: `${name} 实时价格、市值与 24 小时涨跌 · YayaNews 行情`,
    alternates: { canonical: `/price/${params.slug}` },
    openGraph: { title: `${title} | YayaNews`, description: '加密货币实时价格与市场数据' },
  };
}

export const revalidate = 120;

export default function PricePage({ params }: { params: { slug: string } }) {
  return (
    <div className="container-main py-6 sm:py-8">
      <nav className="yn-meta mb-6 flex flex-wrap gap-x-2 gap-y-1 text-slate-500">
        <LocalizedLink href="/" className="hover:text-slate-300">
          首页
        </LocalizedLink>
        <span aria-hidden>/</span>
        <LocalizedLink href="/markets" className="hover:text-slate-300">
          行情
        </LocalizedLink>
        <span aria-hidden>/</span>
        <span className="text-slate-400">{params.slug}</span>
      </nav>
      <PriceDetailClient slug={params.slug} />
    </div>
  );
}
