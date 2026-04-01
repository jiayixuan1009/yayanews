'use client';

import { useEffect, useState } from 'react';

interface CoinData {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
}

interface TickerItem {
  label: string;
  price: string;
  change: number;
}

const COIN_IDS = 'bitcoin,ethereum,solana,ripple';
const REFRESH_INTERVAL = 30_000;

export default function LiveTicker({ title = '实时行情' }: { title?: string }) {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchPrices() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&sparkline=false`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data: CoinData[] = await res.json();

        const LABELS: Record<string, string> = {
          bitcoin: 'BTC',
          ethereum: 'ETH',
          solana: 'SOL',
          ripple: 'XRP',
        };

        if (mounted) {
          setTickers(
            data.map(c => ({
              label: LABELS[c.id] || c.symbol.toUpperCase(),
              price: c.current_price >= 1000
                ? `$${c.current_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : `$${c.current_price.toFixed(2)}`,
              change: c.price_change_percentage_24h ?? 0,
            }))
          );
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchPrices();
    const timer = setInterval(fetchPrices, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-6 overflow-x-auto py-3 scrollbar-hide text-sm">
        <span className="flex-shrink-0 font-bold text-[#1d5c4f]">{title}</span>
        {[1, 2, 3, 4].map(i => (
          <span key={i} className="flex-shrink-0 h-4 w-20 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 overflow-x-auto py-3 scrollbar-hide text-[13px]">
      <span className="flex-shrink-0 font-bold text-[#1d5c4f] uppercase tracking-widest text-[12px]">{title}</span>
      {tickers.map(t => {
        const isUp = t.change >= 0;
        const bgClass = isUp ? 'bg-[#e0f1e5] text-[#0d5930]' : 'bg-[#fce5e6] text-[#c72626]';
        const arrow = isUp ? '+' : '';
        return (
          <span key={t.label} className="flex-shrink-0 flex items-center gap-2">
            <span className="font-bold text-[#89908a]">{t.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${bgClass}`}>
              {arrow}{(t.change || 0).toFixed(1)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}
