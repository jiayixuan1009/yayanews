import { NextRequest, NextResponse } from 'next/server';
import { getAdminArticleById, deleteArticle } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';
import * as db from '@yayanews/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const article = await getAdminArticleById(Number(params.id));
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(article);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const ok = await deleteArticle(Number(params.id));
    return NextResponse.json({ success: ok });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** PATCH /api/articles/[id] - 更新文章的专题绑定或状态 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const id = Number(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const body = await req.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if ('topic_id' in body) {
      fields.push(`topic_id = $${idx++}`);
      values.push(body.topic_id ?? null);
    }
    if ('status' in body) {
      fields.push(`status = $${idx++}`);
      values.push(body.status);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);
    await db.queryRun(`UPDATE articles SET ${fields.join(', ')} WHERE id = $${idx}`, values);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
