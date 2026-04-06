'use client';

import { useEffect, useState } from 'react';

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

function MarqueeRow({ items, title, reverse = false }: { items: TickerItem[], title: string, reverse?: boolean }) {
  if (items.length === 0) return null;
  // Duplicate for seamless loop effect
  const displayItems = [...items, ...items, ...items];
  
  return (
    <div className="flex w-full overflow-hidden whitespace-nowrap py-1 items-center relative">
      <div className="flex-shrink-0 font-bold text-[#1d5c4f] uppercase tracking-widest text-[11px] w-[75px] sm:w-[85px] z-20 bg-white shadow-[8px_0_12px_#ffffff] h-full flex items-center">
        {title}
      </div>
      <div className={`flex w-max shrink-0 items-center gap-6 ${reverse ? 'animate-[marquee_60s_linear_infinite_reverse]' : 'animate-[marquee_60s_linear_infinite]'} hover:[animation-play-state:paused]`}>
        {displayItems.map((t, i) => {
          const isUp = t.change >= 0;
          const bgClass = isUp ? 'bg-[#e0f1e5] text-[#0d5930]' : 'bg-[#fce5e6] text-[#c72626]';
          const arrow = isUp ? '+' : '';
          return (
            <span key={`${t.label}-${i}`} className="flex-shrink-0 flex items-center gap-1.5 min-w-max cursor-default truncate">
              <span className="font-semibold text-[#89908a] transition-colors hover:text-[#1d5c4f]">{t.label}</span>
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

        if (resUs.ok) {
          const data = await resUs.json();
          if (data.items) {
            setUs(data.items.map((c: any) => ({
              id: c.id,
              label: c.name || c.symbol,
              price: `$${c.current_price?.toFixed(2) ?? '0.00'}`,
              change: c.price_change_percentage_24h ?? 0
            })));
          }
        }

        if (resApac.ok) {
           const data = await resApac.json();
           if (data.items) {
             setApac(data.items.map((c: any) => ({
               id: c.id,
               label: c.name || c.symbol,
               price: `$${c.current_price?.toFixed(2) ?? '0.00'}`,
               change: c.price_change_percentage_24h ?? 0
             })));
           }
        }

        if (resCrypto.ok) {
          const data = await resCrypto.json();
          const LABELS: Record<string, string> = {
            bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP',
            dogecoin: 'DOGE', 'avalanche-2': 'AVAX', cardano: 'ADA'
          };
          setCrypto(data.map((c: any) => ({
            id: c.id,
            label: LABELS[c.id] || c.symbol.toUpperCase(),
            price: `$${c.current_price?.toFixed(2) ?? '0.00'}`,
            change: c.price_change_percentage_24h ?? 0
          })));
        }

        setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_INTERVAL);
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
    <div className="flex flex-col gap-[2px] text-[12px] relative w-full overflow-hidden mb-1 mt-1">
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      <MarqueeRow items={us} title={tickerUs} />
      <MarqueeRow items={apac} title={tickerApac} />
      <MarqueeRow items={crypto} title={tickerCrypto} />
    </div>
  );
}
