import { NextRequest, NextResponse } from 'next/server';
import { getFlashNews, getCategories, getFlashMaxId } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cat = sp.get('cat') || undefined;
  const limit = Math.min(Number(sp.get('limit')) || 100, 200);
  const lang = sp.get('lang') || 'zh';

  try {
    const items = await getFlashNews(lang, limit, cat);
    const categories = await getCategories();
    const maxId = await getFlashMaxId(lang, cat);
    return NextResponse.json({ items, categories, maxId });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
