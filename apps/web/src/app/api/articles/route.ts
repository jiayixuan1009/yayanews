import { NextRequest, NextResponse } from 'next/server';
import { getPublishedArticles } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') || undefined;
  const subcategory = sp.get('subcategory') || undefined;
  const limitParam = Number.parseInt(sp.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
  const lang = sp.get('lang') || 'zh';

  try {
    const articles = await getPublishedArticles(lang, limit, 0, category, subcategory);
    return NextResponse.json({ articles });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
