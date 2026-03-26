import { NextRequest, NextResponse } from 'next/server';
import { getAdminArticles } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  try {
    const result = getAdminArticles({
      page: Number(sp.get('page')) || 1,
      pageSize: Math.min(Number(sp.get('pageSize')) || 20, 100),
      category: sp.get('category') || undefined,
      subcategory: sp.get('subcategory') || undefined,
      status: sp.get('status') || undefined,
      search: sp.get('search') || undefined,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
