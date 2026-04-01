'use client';

import { useEffect, useState, useCallback } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { siteConfig } from '@yayanews/types';

// ─── Type Definitions ───────────────────────────────────────────────────────

interface AssetItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  currency?: string;
  market_cap?: number;
  total_volume?: number;
  market_cap_rank?: number;
  image?: string;
  sparkline_in_7d?: { price: number[] };
}

interface GlobalData {
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
}

// ─── Tab / Ticker Configuration ─────────────────────────────────────────────

type TabId = 'macro' | 'us' | 'hk' | 'crypto';

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'macro', label: '宏观数据', emoji: '🌐' },
  { id: 'us',    label: '美股市场', emoji: '🇺🇸' },
  { id: 'hk',    label: '港股市场', emoji: '🇭🇰' },
  { id: 'crypto', label: '加密货币', emoji: '₿' },
];

const YAHOO_TICKERS: Record<Exclude<TabId, 'crypto'>, string[]> = {
  macro: ['^GSPC', '^DJI', '^IXIC', '^VIX', 'DX-Y.NYB', '^TNX', 'GC=F', 'CL=F', 'SI=F', 'EURUSD=X'],
  us:    ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'COIN', 'MSTR'],
  hk:    ['^HSI', '^HSCEI', '0700.HK', '9988.HK', '3690.HK', '1810.HK', '9618.HK', '1024.HK', '2318.HK'],
};

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
}

function fmtPrice(item: AssetItem): string {
  const cur = item.currency;
  const isFx = cur && ['HKD', 'CNY', 'EUR', 'JPY'].includes(cur) && !item.id.startsWith('^');
  const prefix = isFx && cur === 'HKD' ? 'HK$' : isFx && cur === 'EUR' ? '€' : '$';
  const p = item.current_price;
  if (p === 0) return '—';
  if (p >= 1) return `${prefix}${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${prefix}${p.toPrecision(4)}`;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function PctBadge({ value }: { value: number | null | undefined }) {
  if (value == null || isNaN(value)) return <span className="text-slate-500">—</span>;
  const isUp = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function MiniSparkline({ prices, change }: { prices?: number[]; change: number }) {
  if (!prices || prices.length < 2) return <span className="text-slate-600 text-xs">—</span>;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80; const h = 28;
  const step = w / (prices.length - 1);
  const pts = prices.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(' ');
  const color = change >= 0 ? '#34d399' : '#f87171';
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-800/40">
      <td className="px-4 py-3"><div className="h-4 w-6 rounded bg-slate-700/60" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-slate-700/60" /></td>
      <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-24 rounded bg-slate-700/60" /></td>
      <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-16 rounded bg-slate-700/60" /></td>
      <td className="px-4 py-3 text-center hidden lg:table-cell"><div className="mx-auto h-[28px] w-[80px] rounded bg-slate-700/60" /></td>
    </tr>
  );
}

function GlobalCryptoStats({ global }: { global: GlobalData | null }) {
  if (!global) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[1,2,3,4].map(i => (
        <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 animate-pulse">
          <div className="h-3 w-16 rounded bg-slate-700 mb-2" />
          <div className="h-6 w-24 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: '加密总市值', value: fmt(global.total_market_cap?.usd ?? 0, 1), sub: <PctBadge value={global.market_cap_change_percentage_24h_usd} /> },
        { label: '24H 总成交量', value: fmt(global.total_volume?.usd ?? 0, 1), sub: null },
        { label: 'BTC 市占率', value: `${(global.market_cap_percentage?.btc ?? 0).toFixed(1)}%`, sub: null },
        { label: 'ETH 市占率', value: `${(global.market_cap_percentage?.eth ?? 0).toFixed(1)}%`, sub: null },
      ].map(card => (
        <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">{card.label}</span>
          <p className="text-lg font-bold text-white mt-0.5 tabular-nums">{card.value}</p>
          {card.sub}
        </div>
      ))}
    </div>
  );
}

// ─── Tab Label Pill ───────────────────────────────────────────────────────────

function TabLabel({ id }: { id: TabId }) {
  const map: Record<TabId, string> = {
    macro: '全球宏观 — 指数、商品与外汇',
    us:    '美股 — 科技与重要成长股',
    hk:    '港股 — 核心蓝筹与互联网',
    crypto: '加密货币 — 市值排行',
  };
  return <p className="mt-1 text-sm text-slate-400">{map[id]}</p>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketsClient() {
  const [tab, setTab] = useState<TabId>('macro');
  const [items, setItems] = useState<AssetItem[]>([]);
  const [globalCrypto, setGlobalCrypto] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchYahoo = useCallback(async (tickers: string[]) => {
    const res = await fetch(`/api/markets/yahoo?tickers=${tickers.join(',')}`);
    const data = await res.json();
    return (data.items ?? []) as AssetItem[];
  }, []);

  const fetchCrypto = useCallback(async () => {
    const [coinsRes, globalRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d', { cache: 'no-store' }),
      fetch('https://api.coingecko.com/api/v3/global', { cache: 'no-store' }),
    ]);
    const coins = coinsRes.ok ? await coinsRes.json() : [];
    if (globalRes.ok) {
      const gd = await globalRes.json();
      setGlobalCrypto(gd.data);
    }
    return coins as AssetItem[];
  }, []);

  const fetchData = useCallback(async (activeTab: TabId) => {
    setLoading(true);
    try {
      let data: AssetItem[];
      if (activeTab === 'crypto') {
        data = await fetchCrypto();
      } else {
        data = await fetchYahoo(YAHOO_TICKERS[activeTab]);
      }
      setItems(data);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, [fetchCrypto, fetchYahoo]);

  useEffect(() => {
    setItems([]);
    fetchData(tab);
    const timer = setInterval(() => fetchData(tab), 60_000);
    return () => clearInterval(timer);
  }, [tab, fetchData]);

  return (
    <div className="container-main py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">全球市场行情</h1>
          <TabLabel id={tab} />
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            更新于 {lastUpdate}
          </div>
        )}
      </div>

      {/* Crypto global stats — only shown on crypto tab */}
      {tab === 'crypto' && <GlobalCryptoStats global={globalCrypto} />}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all
              ${tab === t.id
                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden min-h-[480px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/80 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium w-10">#</th>
                <th className="text-left px-4 py-3 font-medium">名称</th>
                <th className="text-right px-4 py-3 font-medium">最新价</th>
                <th className="text-right px-4 py-3 font-medium">24H 涨跌</th>
                {tab === 'crypto' && (
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">7D</th>
                )}
                {tab === 'crypto' && (
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">市值</th>
                )}
                {tab === 'crypto' && (
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">成交量</th>
                )}
                <th className="text-center px-4 py-3 font-medium hidden lg:table-cell w-24">7D 走势</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading
                ? [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
                : items.map((item, idx) => (
                  <tr key={item.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors group">
                    {/* # */}
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                      {item.market_cap_rank ?? idx + 1}
                    </td>
                    {/* Name */}
                    <td className="px-4 py-3">
                      {tab === 'crypto' ? (
                        <LocalizedLink
                          href={`/price/${item.id}`}
                          className="flex items-center gap-2.5 -m-1 p-1 rounded-md hover:bg-slate-800/40"
                        >
                          {item.image && (
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={22}
                              height={22}
                              className="h-[22px] w-[22px] rounded-full"
                              loading="lazy"
                            />
                          )}
                          <span className="font-medium text-white">{item.name}</span>
                          <span className="text-[11px] text-slate-500 uppercase">{item.symbol}</span>
                        </LocalizedLink>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{item.name}</span>
                          <span className="text-[11px] text-slate-500 uppercase">{item.symbol}</span>
                        </div>
                      )}
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                      {fmtPrice(item)}
                    </td>
                    {/* 24H % */}
                    <td className="px-4 py-3 text-right">
                      <PctBadge value={item.price_change_percentage_24h} />
                    </td>
                    {/* Crypto-only columns */}
                    {tab === 'crypto' && (
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <PctBadge value={item.price_change_percentage_7d_in_currency} />
                      </td>
                    )}
                    {tab === 'crypto' && (
                      <td className="px-4 py-3 text-right hidden md:table-cell text-slate-400 tabular-nums">
                        {item.market_cap ? fmt(item.market_cap, 1) : '—'}
                      </td>
                    )}
                    {tab === 'crypto' && (
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-400 tabular-nums">
                        {item.total_volume ? fmt(item.total_volume, 1) : '—'}
                      </td>
                    )}
                    {/* 7D Sparkline */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex justify-center">
                        <MiniSparkline
                          prices={item.sparkline_in_7d?.price}
                          change={item.price_change_percentage_24h}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-800/30 p-6 text-center">
        <h3 className="text-lg font-bold text-white">想交易这些资产？</h3>
        <p className="mt-2 text-sm text-slate-300">支持加密货币、美股、港股一站式交易</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
        >
          立即开始交易
        </a>
      </div>
    </div>
  );
}
