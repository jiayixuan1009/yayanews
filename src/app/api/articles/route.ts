import { NextRequest, NextResponse } from 'next/server';
import { getPublishedArticles } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') || undefined;
  const subcategory = sp.get('subcategory') || undefined;
  const limit = Math.min(Number(sp.get('limit') || 30), 100);

  try {
    const articles = getPublishedArticles(limit, 0, category, subcategory);
    return NextResponse.json({ articles });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
