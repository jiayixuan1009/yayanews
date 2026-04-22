'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@yayanews/types';

type CoinDetail = {
  id: string;
  name: string;
  symbol: string;
  image?: { large?: string };
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_24h?: number;
    high_24h?: { usd?: number };
    low_24h?: { usd?: number };
    sparkline_7d?: { price?: number[] };
  };
};

function fmt(n: number | null | undefined, compact = false) {
  if (n == null || Number.isNaN(n)) return '—';
  if (compact && Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (compact && Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(4);
}

export default function PriceDetailClient({ slug }: { slug: string }) {
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(slug)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`
        );
        if (!res.ok) {
          if (!cancelled) setErr(res.status === 404 ? '未找到该币种（请使用 CoinGecko 的 id，如 bitcoin）' : `请求失败 (${res.status})`);
          return;
        }
        const data = (await res.json()) as CoinDetail;
        if (!cancelled) {
          setCoin(data);
          setErr(null);
        }
      } catch {
        if (!cancelled) setErr('网络错误，请稍后重试');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (err) {
    return (
      <div className="card border border-amber-900/40 bg-amber-950/20 p-6 text-center text-amber-200/90">
        <p>{err}</p>
        <LocalizedLink href="/markets" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
          返回行情列表
        </LocalizedLink>
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500" />
          加载行情…
        </span>
      </div>
    );
  }

  const md = coin.market_data;
  const price = md?.current_price?.usd;
  const pct = md?.price_change_percentage_24h;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {coin.image?.large ? (
            <Image src={coin.image.large} alt={`${coin.name} Logo`} width={56} height={56} className="rounded-full" />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{coin.name}</h1>
            <p className="text-sm uppercase text-slate-500">{coin.symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white">${fmt(price)}</p>
          <p className={`text-sm font-medium ${pct != null && pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'} <span className="text-slate-500">24H</span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">市值</p>
          <p className="mt-1 font-mono text-lg text-slate-200">${fmt(md?.market_cap?.usd, true)}</p>
        </div>
        <div className="card bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">24H 成交量</p>
          <p className="mt-1 font-mono text-lg text-slate-200">${fmt(md?.total_volume?.usd, true)}</p>
        </div>
        <div className="card bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">24H 高</p>
          <p className="mt-1 font-mono text-lg text-slate-200">${fmt(md?.high_24h?.usd)}</p>
        </div>
        <div className="card bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">24H 低</p>
          <p className="mt-1 font-mono text-lg text-slate-200">${fmt(md?.low_24h?.usd)}</p>
        </div>
      </div>

      <div className="card bg-gradient-to-r from-primary-900/40 to-accent-600/20 border-primary-800/30 p-6 text-center">
        <h3 className="text-lg font-bold text-white">交易与深度行情</h3>
        <p className="mt-2 text-sm text-slate-300">PRD：价格详情页承接高意图用户，挂载转化 CTA</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-4 inline-block"
        >
          前往交易平台
        </a>
      </div>

      <p className="text-center text-xs text-slate-600">
        数据来自 CoinGecko · 路由参数为 CoinGecko <code className="text-slate-500">{slug}</code>
      </p>
    </div>
  );
}
