import { NextRequest, NextResponse } from 'next/server';
import { log as baseLog } from '@/lib/logger';

const log = baseLog.child({ route: '/api/markets/coingecko' });

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CG_BASE = 'https://api.coingecko.com/api/v3';

/** Query parameters forwarded to CoinGecko (what LiveTicker, Markets and Price pages send). */
const FORWARDED_PARAMS = [
  'vs_currency', 'vs_currencies', 'ids', 'order', 'per_page', 'page', 'sparkline',
  'price_change_percentage', 'include_24hr_change', 'include_market_cap',
  'localization', 'tickers', 'market_data', 'community_data', 'developer_data',
] as const;

function buildHeaders(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY;
  const headers: HeadersInit = { 'Accept': 'application/json' };
  if (key) {
    // Demo key: sent as query param; Pro key: sent as header
    // We handle both via query param (works for both tiers)
  }
  return headers;
}

function appendKey(url: string): string {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x_cg_demo_api_key=${key}`;
}

/**
 * Server-side proxy for CoinGecko API.
 * Uses COINGECKO_API_KEY from env (never exposed to browser).
 *
 * GET /api/markets/coingecko?endpoint=coins/markets&vs_currency=usd&...
 * GET /api/markets/coingecko?endpoint=coins/bitcoin&localization=false&...
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const endpoint = sp.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint param' }, { status: 400 });
  }

  // Allowlist to prevent SSRF — only permit known CoinGecko endpoints
  const ALLOWED_ENDPOINTS = new Set([
    'coins/markets',
    'global',
    'simple/price',
    'coins/list',
  ]);
  const isCoinDetailEndpoint = /^coins\/[a-z0-9][a-z0-9-]*$/i.test(endpoint);
  if (!ALLOWED_ENDPOINTS.has(endpoint) && !isCoinDetailEndpoint) {
    return NextResponse.json({ error: 'Endpoint not allowed' }, { status: 400 });
  }

  // Forward only the parameters the site uses, in a fixed order, so arbitrary extras can't
  // bypass the 60s cache and spend the API quota (one upstream call per unique URL).
  const forwardParams = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) {
    const val = sp.get(key);
    if (val !== null && val.length <= 500) forwardParams.set(key, val);
  }

  const cgUrl = appendKey(`${CG_BASE}/${endpoint}?${forwardParams.toString()}`);
  try {
    const res = await fetch(cgUrl, {
      headers: buildHeaders(),
      next: { revalidate: 60 }, // Cache 60s server-side to reduce CoinGecko calls
    });

    if (!res.ok) {
      const text = await res.text();
      log.error({ endpoint, status: res.status, body: text.slice(0, 200) }, 'coingecko upstream error');
      return NextResponse.json({ error: `CoinGecko error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    log.error({ err }, 'coingecko fetch failed');
    return NextResponse.json({ error: 'Failed to fetch CoinGecko data' }, { status: 502 });
  }
}
