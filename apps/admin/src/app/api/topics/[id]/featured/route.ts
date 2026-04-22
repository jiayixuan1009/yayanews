import { NextRequest, NextResponse } from 'next/server';
import * as db from '@yayanews/database';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** PUT /api/topics/[id]/featured - 更新精选文章列表（替换式写入，最多 6 篇） */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const topicId = parseInt(params.id, 10);
  if (isNaN(topicId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const body = await req.json();
    const articleIds: number[] = body.article_ids || [];

    if (articleIds.length > 6) {
      return NextResponse.json({ error: '精选文章最多 6 篇' }, { status: 400 });
    }

    // 确认文章都属于该专题或已发布
    if (articleIds.length > 0) {
      const valid = await db.queryAll<{ id: number }>(
        `SELECT id FROM articles WHERE id = ANY($1::int[]) AND status = 'published'`,
        [articleIds]
      );
      if (valid.length !== articleIds.length) {
        return NextResponse.json({ error: '部分文章不存在或未发布' }, { status: 400 });
      }
    }

    // 替换式写入
    await db.queryRun('DELETE FROM topic_featured_articles WHERE topic_id = $1', [topicId]);
    for (let i = 0; i < articleIds.length; i++) {
      await db.queryRun(
        'INSERT INTO topic_featured_articles (topic_id, article_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [topicId, articleIds[i], (i + 1) * 10]
      );
    }

    return NextResponse.json({ success: true, count: articleIds.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
