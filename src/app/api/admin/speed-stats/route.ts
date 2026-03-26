import { NextRequest, NextResponse } from 'next/server';
import { getSpeedStats } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const stats = getSpeedStats();
    return NextResponse.json(stats);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
