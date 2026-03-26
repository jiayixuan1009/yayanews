import { NextRequest, NextResponse } from 'next/server';
import { getAdminArticleById, deleteArticle } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const article = getAdminArticleById(Number(params.id));
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(article);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const ok = deleteArticle(Number(params.id));
    return NextResponse.json({ success: ok });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
