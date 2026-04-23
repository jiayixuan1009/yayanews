'use client';

import { useEffect, useState, useCallback } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { siteConfig } from '@yayanews/types';

// ─── Type Definitions ────────────────────────────────────────────────────────

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

// ─── Configuration ───────────────────────────────────────────────────────────

type TabId = 'all' | 'macro' | 'us' | 'hk' | 'crypto';

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'all',    label: '全部',    emoji: '📊' },
  { id: 'macro',  label: '宏观数据', emoji: '🌐' },
  { id: 'us',     label: '美股市场', emoji: '🇺🇸' },
  { id: 'hk',     label: '港股市场', emoji: '🇭🇰' },
  { id: 'crypto', label: '加密货币', emoji: '₿' },
];

const YAHOO_TICKERS: Record<'macro' | 'us' | 'hk', string[]> = {
  macro: ['^GSPC', '^DJI', '^IXIC', '^VIX', 'DX-Y.NYB', '^TNX', 'GC=F', 'CL=F', 'SI=F', 'EURUSD=X'],
  us:    ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'COIN', 'MSTR'],
  hk:    ['^HSI', '^HSCEI', '0700.HK', '9988.HK', '3690.HK', '1810.HK', '9618.HK', '1024.HK', '2318.HK'],
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(decimals)}M`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
}

function fmtPrice(item: AssetItem): string {
  const cur = item.currency;
  const isFx = cur && ['HKD', 'CNY', 'EUR', 'JPY'].includes(cur) && !item.id.startsWith('^');
  const prefix = isFx && cur === 'HKD' ? 'HK$' : isFx && cur === 'EUR' ? '€' : '$';
  const p = item.current_price;
  if (p == null || isNaN(Number(p))) return '—';
  if (p === 0) return '—';
  if (p >= 1) return `${prefix}${Number(p).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${prefix}${Number(p).toPrecision(4)}`;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

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
        <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 animate-pulse">
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
        <div key={card.label} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">{card.label}</span>
          <p className="text-lg font-bold text-white mt-0.5 tabular-nums">{card.value}</p>
          {card.sub}
        </div>
      ))}
    </div>
  );
}

// ─── Section Header ── used in "全部" view ────────────────────────────────────

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-4 first:mt-0">
      <span className="text-2xl">{emoji}</span>
      <div>
        <h2 className="text-lg font-bold text-white leading-none">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent ml-2" />
    </div>
  );
}

// ─── Asset Table ─────────────────────────────────────────────────────────────

interface TableProps {
  items: AssetItem[];
  loading: boolean;
  isCrypto?: boolean;
  /** limit rows — used in 全部 mode to keep sections compact */
  limit?: number;
}

function AssetTable({ items, loading, isCrypto = false, limit }: TableProps) {
  const rows = limit ? items.slice(0, limit) : items;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700 bg-slate-800/80 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold w-10">#</th>
              <th className="text-left px-4 py-3 font-semibold">名称</th>
              <th className="text-right px-4 py-3 font-semibold">最新价</th>
              <th className="text-right px-4 py-3 font-semibold">24H 涨跌</th>
              {isCrypto && <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">7D</th>}
              {isCrypto && <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">市值</th>}
              {isCrypto && <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">成交量</th>}
              <th className="text-center px-4 py-3 font-semibold hidden lg:table-cell w-24">7D 走势</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading
              ? [...Array(limit ?? 8)].map((_, i) => <SkeletonRow key={i} />)
              : rows.map((item, idx) => (
                <tr key={item.id} className="text-slate-200 hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                    {item.market_cap_rank ?? idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    {isCrypto ? (
                      <LocalizedLink href={`/price/${item.id}`} className="flex items-center gap-2.5 -m-1 p-1 rounded-md hover:bg-slate-800/40">
                        {item.image && (
                          <Image src={item.image} alt={item.name} width={22} height={22} className="h-[22px] w-[22px] rounded-full" loading="lazy" />
                        )}
                        <span className="font-semibold text-white">{item.name}</span>
                        <span className="text-[11px] text-slate-500 uppercase">{item.symbol}</span>
                      </LocalizedLink>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{item.name}</span>
                        <span className="text-[11px] text-slate-500 uppercase">{item.symbol}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{fmtPrice(item)}</td>
                  <td className="px-4 py-3 text-right"><PctBadge value={item.price_change_percentage_24h} /></td>
                  {isCrypto && (
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <PctBadge value={item.price_change_percentage_7d_in_currency} />
                    </td>
                  )}
                  {isCrypto && (
                    <td className="px-4 py-3 text-right hidden md:table-cell text-slate-400 tabular-nums">
                      {item.market_cap ? fmt(item.market_cap, 1) : '—'}
                    </td>
                  )}
                  {isCrypto && (
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-400 tabular-nums">
                      {item.total_volume ? fmt(item.total_volume, 1) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex justify-center">
                      <MiniSparkline prices={item.sparkline_in_7d?.price} change={item.price_change_percentage_24h} />
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketsClient() {
  const [tab, setTab] = useState<TabId>('all');

  // Per-section data (used in both 全部 and individual tabs)
  const [macroItems, setMacroItems] = useState<AssetItem[]>([]);
  const [usItems,    setUsItems]    = useState<AssetItem[]>([]);
  const [hkItems,    setHkItems]    = useState<AssetItem[]>([]);
  const [cryptoItems, setCryptoItems] = useState<AssetItem[]>([]);
  const [globalCrypto, setGlobalCrypto] = useState<GlobalData | null>(null);

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  // ── fetch helpers ──
  const fetchYahoo = useCallback(async (tickers: string[]) => {
    const res = await fetch(`/api/markets/yahoo?tickers=${tickers.join(',')}`);
    const data = await res.json();
    return (data.items ?? []) as AssetItem[];
  }, []);

  const fetchCryptoData = useCallback(async () => {
    // Route through server proxy: adds API key, enforces 60s ISR cache,
    // avoids client-side 429 rate limits from CoinGecko free tier.
    const [coinsRes, globalRes] = await Promise.all([
      fetch('/api/markets/coingecko?endpoint=coins/markets&vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d'),
      fetch('/api/markets/coingecko?endpoint=global'),
    ]);
    const coins = coinsRes.ok ? await coinsRes.json() : [];
    if (globalRes.ok) {
      const gd = await globalRes.json();
      setGlobalCrypto(gd.data);
    }
    return coins as AssetItem[];
  }, []);

  // ── fetch strategy by tab ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [macro, us, hk, crypto] = await Promise.all([
        fetchYahoo(YAHOO_TICKERS.macro),
        fetchYahoo(YAHOO_TICKERS.us),
        fetchYahoo(YAHOO_TICKERS.hk),
        fetchCryptoData(),
      ]);
      setMacroItems(macro);
      setUsItems(us);
      setHkItems(hk);
      setCryptoItems(crypto);
    } catch { /* keep stale */ }
    finally {
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [fetchYahoo, fetchCryptoData]);

  const fetchSingle = useCallback(async (activeTab: Exclude<TabId, 'all'>) => {
    setLoading(true);
    try {
      if (activeTab === 'macro') setMacroItems(await fetchYahoo(YAHOO_TICKERS.macro));
      else if (activeTab === 'us') setUsItems(await fetchYahoo(YAHOO_TICKERS.us));
      else if (activeTab === 'hk') setHkItems(await fetchYahoo(YAHOO_TICKERS.hk));
      else if (activeTab === 'crypto') setCryptoItems(await fetchCryptoData());
    } catch { /* keep stale */ }
    finally {
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [fetchYahoo, fetchCryptoData]);

  useEffect(() => {
    if (tab === 'all') fetchAll();
    else fetchSingle(tab);
    const interval = setInterval(() => {
      if (tab === 'all') fetchAll();
      else fetchSingle(tab);
    }, 60_000);
    return () => clearInterval(interval);
  }, [tab, fetchAll, fetchSingle]);

  // helper to decide which items to show in single-tab mode
  const singleTabItems = tab === 'macro' ? macroItems : tab === 'us' ? usItems : tab === 'hk' ? hkItems : cryptoItems;

  return (
    <div className="container-main py-8">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            全球市场行情
          </h1>
          <p className="mt-1.5 text-sm text-slate-300">
            {tab === 'all'    && '宏观指数 · 美股 · 港股 · 加密货币 — 实时综合行情'}
            {tab === 'macro'  && '全球宏观 — 指数、商品与外汇'}
            {tab === 'us'     && '美股 — 科技与重要成长股'}
            {tab === 'hk'     && '港股 — 核心蓝筹与互联网'}
            {tab === 'crypto' && '加密货币 — 市值排行'}
          </p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            更新于 {lastUpdate}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-3 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap
              ${tab === t.id
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          全部视图 — 分区展示
      ══════════════════════════════════════════════════════ */}
      {tab === 'all' ? (
        <div>
          {/* 宏观 */}
          <SectionHeader emoji="🌐" title="宏观数据" subtitle="全球指数、大宗商品与外汇" />
          <AssetTable items={macroItems} loading={loading && macroItems.length === 0} limit={10} />

          {/* 美股 */}
          <SectionHeader emoji="🇺🇸" title="美股市场" subtitle="科技领军股与重要成长股" />
          <AssetTable items={usItems} loading={loading && usItems.length === 0} limit={9} />

          {/* 港股 */}
          <SectionHeader emoji="🇭🇰" title="港股市场" subtitle="核心蓝筹与互联网龙头" />
          <AssetTable items={hkItems} loading={loading && hkItems.length === 0} limit={9} />

          {/* 加密 */}
          <SectionHeader emoji="₿" title="加密货币" subtitle="主流数字资产市值排行" />
          <GlobalCryptoStats global={globalCrypto} />
          <AssetTable items={cryptoItems} loading={loading && cryptoItems.length === 0} isCrypto limit={20} />
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════
            单标签视图
        ══════════════════════════════════════════════════════ */
        <div>
          {tab === 'crypto' && <GlobalCryptoStats global={globalCrypto} />}
          <AssetTable items={singleTabItems} loading={loading} isCrypto={tab === 'crypto'} />
        </div>
      )}

      {/* ── CTA ── */}
      <div className="mt-10 rounded-2xl bg-gradient-to-r from-emerald-900/40 to-teal-900/30 border border-emerald-700/40 p-6 text-center shadow-inner">
        <h3 className="text-xl font-bold text-white">想交易这些资产？</h3>
        <p className="mt-2 text-sm text-slate-300">支持加密货币、美股、港股一站式交易</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg bg-emerald-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors shadow-md"
        >
          立即开始交易
        </a>
      </div>
    </div>
  );
}
