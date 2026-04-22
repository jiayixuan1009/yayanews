import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CG_BASE = 'https://api.coingecko.com/api/v3';

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
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: 'Endpoint not allowed' }, { status: 400 });
  }

  // Forward all query params except 'endpoint' itself
  const forwardParams = new URLSearchParams();
  sp.forEach((val, key) => {
    if (key !== 'endpoint') forwardParams.append(key, val);
  });

  const cgUrl = appendKey(`${CG_BASE}/${endpoint}?${forwardParams.toString()}`);
  try {
    const res = await fetch(cgUrl, {
      headers: buildHeaders(),
      next: { revalidate: 60 }, // Cache 60s server-side to reduce CoinGecko calls
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[CoinGecko proxy] ${endpoint} → HTTP ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json({ error: `CoinGecko error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error('[CoinGecko proxy] fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch CoinGecko data' }, { status: 502 });
  }
}
