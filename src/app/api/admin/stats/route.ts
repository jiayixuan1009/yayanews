import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const lang = sp.get('lang') || undefined;

  try {
    const stats = await getDashboardStats(lang);
    return NextResponse.json(stats);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
