'use client';

import { useEffect, useState, useRef } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

interface TickerItem {
  id: string;
  label: string;
  price: string;
  change: number;
}

const US_TICKERS = '^GSPC,^IXIC,AAPL,MSFT,NVDA,TSLA,AMZN,META,MSTR,COIN';
const APAC_TICKERS = '^HSI,0700.HK,9988.HK,3690.HK,1810.HK,2318.HK';
const COIN_IDS = 'bitcoin,ethereum,solana,ripple,dogecoin,avalanche-2,cardano';
const REFRESH_INTERVAL = 60_000;

function MarqueeRow({ items, title, reverse = false, paused = false }: { items: TickerItem[], title: string, reverse?: boolean; paused?: boolean }) {
  if (items.length === 0) return null;
  // Duplicate for seamless loop effect
  const displayItems = [...items, ...items, ...items];
  
  return (
    <div className="flex w-full overflow-hidden whitespace-nowrap py-1 items-center relative">
      <div className="flex-shrink-0 font-bold text-[#1d5c4f] uppercase tracking-widest text-[11px] w-[75px] sm:w-[85px] z-20 bg-white shadow-[8px_0_12px_#ffffff] h-full flex items-center">
        {title}
      </div>
      <div className={`flex w-max shrink-0 items-center gap-6 ${reverse ? 'animate-[marquee_60s_linear_infinite_reverse]' : 'animate-[marquee_60s_linear_infinite]'} hover:[animation-play-state:paused]`} style={{ animationPlayState: paused ? 'paused' : undefined }}>
        {displayItems.map((t, i) => {
          const isUp = t.change >= 0;
          const bgClass = isUp ? 'bg-[#e0f1e5] text-[#0d5930]' : 'bg-[#fce5e6] text-[#c72626]';
          const arrow = isUp ? '+' : '';
          return (
            <span key={`${t.label}-${i}`} className="flex-shrink-0 flex items-center gap-1.5 min-w-max cursor-default truncate">
              <span className="font-semibold text-[#68746c] transition-colors hover:text-[#1d5c4f]">{t.label}</span>
              <span className="font-medium text-[#4b5563] ml-1">{t.price}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${bgClass}`}>
                {arrow}{(t.change || 0).toFixed(1)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function LiveTicker({ title = 'Live Ticker', tickerUs = 'US Markets', tickerApac = 'APAC', tickerCrypto = 'Crypto' }: { title?: string, tickerUs?: string, tickerApac?: string, tickerCrypto?: string }) {
  const [us, setUs] = useState<TickerItem[]>([]);
  const [apac, setApac] = useState<TickerItem[]>([]);
  const [crypto, setCrypto] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerRef, isIntersecting] = useIntersectionObserver();
  const isIntersectingRef = useRef(isIntersecting);
  isIntersectingRef.current = isIntersecting;

  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
      try {
        const [resUs, resApac, resCrypto] = await Promise.all([
          fetch(`/api/markets/yahoo?tickers=${US_TICKERS}`),
          fetch(`/api/markets/yahoo?tickers=${APAC_TICKERS}`),
          fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&sparkline=false`)
        ]);

        if (!mounted) return;

        const safeNum = (v: unknown, d = 0) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : d;
        };
        const safePrice = (v: unknown) => {
          const n = Number(v);
          return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00';
        };
        const rowFromYahoo = (c: any, i: number): TickerItem => ({
          id: String(c?.id ?? c?.symbol ?? `t-${i}`),
          label: String(c?.name || c?.symbol || '—'),
          price: safePrice(c?.current_price),
          change: safeNum(c?.price_change_percentage_24h, 0),
        });

        if (resUs.ok) {
          const data = await resUs.json();
          if (Array.isArray(data.items)) {
            setUs(data.items.map((c: any, i: number) => rowFromYahoo(c, i)));
          }
        }

        if (resApac.ok) {
          const data = await resApac.json();
          if (Array.isArray(data.items)) {
            setApac(data.items.map((c: any, i: number) => rowFromYahoo(c, i)));
          }
        }

        if (resCrypto.ok) {
          const data = await resCrypto.json();
          const LABELS: Record<string, string> = {
            bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP',
            dogecoin: 'DOGE', 'avalanche-2': 'AVAX', cardano: 'ADA'
          };
          const list = Array.isArray(data) ? data : [];
          setCrypto(
            list.map((c: any) => {
              const id = String(c?.id ?? '');
              const sym = c?.symbol != null ? String(c.symbol) : '';
              const label = LABELS[id] || (sym ? sym.toUpperCase() : String(c?.name || id || '—'));
              return {
                id,
                label,
                price: safePrice(c?.current_price),
                change: safeNum(c?.price_change_percentage_24h, 0),
              };
            })
          );
        }

        setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchAll();
    const timer = setInterval(() => {
      if (isIntersectingRef.current) fetchAll();
    }, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-1 overflow-x-hidden py-1 text-sm">
        {[1, 2, 3].map(row => (
          <div key={row} className="flex items-center gap-6 py-1.5 opacity-40">
            <span className="h-4 w-[60px] animate-pulse rounded bg-slate-200" />
            {[1, 2, 3, 4, 5, 6].map(i => <span key={i} className="h-4 w-24 animate-pulse rounded bg-slate-200" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-[2px] text-[12px] relative w-full overflow-hidden mb-1 mt-1">
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      <MarqueeRow items={us} title={tickerUs} paused={!isIntersecting} />
      <MarqueeRow items={apac} title={tickerApac} paused={!isIntersecting} />
      <MarqueeRow items={crypto} title={tickerCrypto} paused={!isIntersecting} />
    </div>
  );
}
