import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maps Yahoo Finance tickers to friendly display names
const TICKER_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^DJI': '道琼斯',
  '^IXIC': '纳斯达克',
  '^VIX': 'VIX 恐慌指数',
  'DX-Y.NYB': '美元指数',
  '^TNX': '美国10年期国债',
  'GC=F': '黄金',
  'CL=F': 'WTI 原油',
  'SI=F': '白银',
  'EURUSD=X': 'EUR/USD',
  'JPY=X': 'USD/JPY',
  // US Stocks
  'AAPL': 'Apple',
  'MSFT': 'Microsoft',
  'NVDA': 'NVIDIA',
  'TSLA': 'Tesla',
  'AMZN': 'Amazon',
  'GOOGL': 'Alphabet',
  'META': 'Meta',
  'COIN': 'Coinbase',
  'MSTR': 'MicroStrategy',
  'MELI': 'MercadoLibre',
  // HK Stocks
  '^HSI': '恒生指数',
  '^HSCEI': '国企指数',
  '0700.HK': '腾讯控股',
  '9988.HK': '阿里巴巴',
  '3690.HK': '美团',
  '1810.HK': '小米集团',
  '9618.HK': '京东集团',
  '1024.HK': '快手',
  '2318.HK': '中国平安',
};

interface YahooMeta {
  symbol: string;
  regularMarketPrice: number;
  previousClose: number;
  currency: string;
  shortName?: string;
  longName?: string;
}

interface YahooChart {
  chart: {
    result: {
      meta: YahooMeta;
      timestamp: number[];
      indicators: {
        quote: { close: (number | null)[] }[];
      };
    }[];
    error?: { code: string; description: string };
  };
}

async function fetchTicker(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=7d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`Yahoo Finance ${ticker}: ${res.status}`);
    const json = (await res.json()) as YahooChart;
    const result = json.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${ticker}`);

    const meta = result.meta;
    const closes = result.indicators.quote[0]?.close ?? [];
    const sparkline = closes.filter((v): v is number => v !== null && !isNaN(v));
    const prev = meta.previousClose ?? sparkline[sparkline.length - 2] ?? meta.regularMarketPrice;
    const pct = prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;

    return {
      id: ticker,
      symbol: ticker,
      name: TICKER_NAMES[ticker] ?? meta.shortName ?? meta.longName ?? ticker,
      current_price: meta.regularMarketPrice,
      price_change_percentage_24h: pct,
      currency: meta.currency ?? 'USD',
      sparkline_in_7d: { price: sparkline },
    };
  } catch (err) {
    // Fallback to avoid empty ticker UI on server IP blocks
    return {
      id: ticker,
      symbol: ticker,
      name: TICKER_NAMES[ticker] ?? ticker,
      current_price: '--',
      price_change_percentage_24h: 0,
      currency: 'USD',
      sparkline_in_7d: { price: [] },
    };
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') || '';
  const tickers = raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 30);

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'No tickers specified' }, { status: 400 });
  }

  const results = await Promise.allSettled(tickers.map(fetchTicker));
  const items = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchTicker>>> => r.status === 'fulfilled')
    .map(r => r.value);

  return NextResponse.json({ items });
}
