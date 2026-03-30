import { NextRequest, NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePropertyId(id: string): string {
  const t = id.trim();
  return t.startsWith('properties/') ? t : `properties/${t}`;
}

function buildClient(): BetaAnalyticsDataClient | null {
  const b64 = process.env.GA4_CREDENTIALS_BASE64;
  if (b64) {
    try {
      const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      return new BetaAnalyticsDataClient({ credentials: creds });
    } catch {
      return null;
    }
  }
  const raw = process.env.GA4_CREDENTIALS_JSON;
  if (raw) {
    try {
      return new BetaAnalyticsDataClient({ credentials: JSON.parse(raw) });
    } catch {
      return null;
    }
  }
  try {
    return new BetaAnalyticsDataClient();
  } catch {
    return null;
  }
}

function formatGaDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const propertyRaw = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyRaw) {
    return NextResponse.json({
      configured: false,
      message:
        '未配置 GA4_PROPERTY_ID。请在 GA4「管理 → 媒体资源设置」查看数字资源 ID，并配置服务账号凭据（见 .env.example）。',
    });
  }

  const daysParam = req.nextUrl.searchParams.get('days');
  const days = Math.min(90, Math.max(7, Number(daysParam) || 14));
  const startExpr = `${days}daysAgo`;

  const client = buildClient();
  if (!client) {
    return NextResponse.json({
      configured: false,
      message:
        '无法初始化 Google Analytics 客户端。请设置 GA4_CREDENTIALS_BASE64（推荐）或 GA4_CREDENTIALS_JSON，或在服务器设置 GOOGLE_APPLICATION_CREDENTIALS 指向服务账号 JSON 文件。',
    });
  }

  try {
    const [resp] = await client.runReport({
      property: normalizePropertyId(propertyRaw),
      dateRanges: [{ startDate: startExpr, endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const rows = resp.rows ?? [];
    const series = rows.map((row) => {
      const d = row.dimensionValues?.[0]?.value ?? '';
      const m = row.metricValues ?? [];
      return {
        dateRaw: d,
        date: formatGaDate(d),
        sessions: Number(m[0]?.value ?? 0),
        activeUsers: Number(m[1]?.value ?? 0),
        screenPageViews: Number(m[2]?.value ?? 0),
      };
    });

    const totals = series.reduce(
      (acc, p) => ({
        sessions: acc.sessions + p.sessions,
        activeUsers: acc.activeUsers + p.activeUsers,
        screenPageViews: acc.screenPageViews + p.screenPageViews,
      }),
      { sessions: 0, activeUsers: 0, screenPageViews: 0 }
    );

    return NextResponse.json({
      configured: true,
      days,
      series,
      totals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        configured: true,
        error: msg,
        hint:
          '请确认：1) 已在 GA4 中将服务账号邮箱添加为「查看者」；2) GA4_PROPERTY_ID 为数字资源 ID；3) 凭据 JSON 对应同一 GCP 项目且已启用 Google Analytics Data API。',
      },
      { status: 200 }
    );
  }
}
