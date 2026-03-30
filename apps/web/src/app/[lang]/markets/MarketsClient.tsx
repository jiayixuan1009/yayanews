'use client';

import { useEffect, useState, useCallback } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { siteConfig } from '@yayanews/types';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
}

interface GlobalData {
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
}

const TABS = [
  { id: 'crypto', label: '加密货币' },
  { id: 'trending', label: '热门币种' },
] as const;

function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
}

function PctBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">-</span>;
  const isUp = value >= 0;
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
      {isUp ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function MiniSparkline({ prices, change }: { prices?: number[]; change: number }) {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const step = w / (prices.length - 1);
  const points = prices.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(' ');
  const color = change >= 0 ? '#34d399' : '#f87171';
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function MarketsClient() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [tab, setTab] = useState<'crypto' | 'trending'>('crypto');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [coinsRes, globalRes] = await Promise.all([
        fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d',
          { cache: 'no-store' }
        ),
        fetch('https://api.coingecko.com/api/v3/global', { cache: 'no-store' }),
      ]);
      if (coinsRes.ok) {
        setCoins(await coinsRes.json());
      }
      if (globalRes.ok) {
        const gd = await globalRes.json();
        setGlobal(gd.data);
      }
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const displayCoins = tab === 'trending'
    ? [...coins].sort((a, b) => Math.abs(b.price_change_percentage_24h ?? 0) - Math.abs(a.price_change_percentage_24h ?? 0)).slice(0, 20)
    : coins;

  return (
    <div className="container-main py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">实时行情</h1>
          <p className="mt-1 text-sm text-gray-400">全球加密货币市场数据总览</p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            更新于 {lastUpdate}
          </div>
        )}
      </div>

      {/* Global stats — fixed min-h to prevent CLS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 min-h-[88px]">
        {global ? (
          <>
            <div className="card px-4 py-3">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">总市值</span>
              <p className="text-lg font-bold text-white mt-0.5">{fmt(global.total_market_cap?.usd ?? 0, 1)}</p>
              <PctBadge value={global.market_cap_change_percentage_24h_usd} />
            </div>
            <div className="card px-4 py-3">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">24H 交易量</span>
              <p className="text-lg font-bold text-white mt-0.5">{fmt(global.total_volume?.usd ?? 0, 1)}</p>
            </div>
            <div className="card px-4 py-3">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">BTC 占比</span>
              <p className="text-lg font-bold text-white mt-0.5">{(global.market_cap_percentage?.btc ?? 0).toFixed(1)}%</p>
            </div>
            <div className="card px-4 py-3">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">ETH 占比</span>
              <p className="text-lg font-bold text-white mt-0.5">{(global.market_cap_percentage?.eth ?? 0).toFixed(1)}%</p>
            </div>
          </>
        ) : (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="card px-4 py-3 animate-pulse">
              <div className="h-3 w-16 rounded bg-slate-700 mb-2" />
              <div className="h-6 w-24 rounded bg-slate-700" />
            </div>
          ))
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`badge cursor-pointer ${tab === t.id ? 'bg-primary-600/30 text-primary-300' : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Coin table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden min-h-[600px]">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 w-6 rounded bg-slate-700" />
                <div className="h-6 w-6 rounded-full bg-slate-700" />
                <div className="h-4 w-32 rounded bg-slate-700" />
                <div className="ml-auto h-4 w-20 rounded bg-slate-700" />
                <div className="h-4 w-16 rounded bg-slate-700" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-3 font-medium w-10">#</th>
                  <th className="text-left px-4 py-3 font-medium">币种</th>
                  <th className="text-right px-4 py-3 font-medium">价格</th>
                  <th className="text-right px-4 py-3 font-medium">24H</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">7D</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">市值</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">24H 成交量</th>
                  <th className="text-center px-4 py-3 font-medium hidden lg:table-cell w-24">7D 走势</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {displayCoins.map(coin => (
                  <tr key={coin.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 text-xs">{coin.market_cap_rank}</td>
                    <td className="px-4 py-3">
                      <LocalizedLink
                        href={`/price/${coin.id}`}
                        className="flex items-center gap-2.5 rounded-md outline-none hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-emerald-500/50 -m-1 p-1"
                      >
                        <Image
                          src={coin.image}
                          alt={coin.name}
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded-full"
                          loading="lazy"
                        />
                        <div>
                          <span className="font-medium text-white">{coin.name}</span>
                          <span className="ml-1.5 text-xs text-slate-500 uppercase">{coin.symbol}</span>
                        </div>
                      </LocalizedLink>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      ${coin.current_price >= 1 ? coin.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : coin.current_price.toPrecision(4)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctBadge value={coin.price_change_percentage_24h} />
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <PctBadge value={coin.price_change_percentage_7d_in_currency ?? null} />
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-slate-400">
                      {fmt(coin.market_cap, 1)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-400">
                      {fmt(coin.total_volume, 1)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex justify-center">
                        <MiniSparkline prices={coin.sparkline_in_7d?.price} change={coin.price_change_percentage_24h} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8 card bg-gradient-to-r from-primary-900/40 to-accent-600/20 border-primary-800/30 p-6 text-center">
        <h3 className="text-lg font-bold text-white">想要交易这些资产？</h3>
        <p className="mt-2 text-sm text-gray-300">支持加密货币、美股、港股一站式交易</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-4 inline-block"
        >
          立即开始交易
        </a>
      </div>
    </div>
  );
}
