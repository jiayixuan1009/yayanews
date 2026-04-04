import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryGet, queryRun } from '@yayanews/database';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** PUT /api/topics/[id] - 更新专题 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const body = await req.json();
    const { 
      name_zh, name_en, description_zh, description_en, status, cover_image, sort_order,
      topic_type, market, keywords, related_tickers, hero_summary_zh, hero_summary_en, faq_items, meta_title, meta_description
    } = body;

    // 激活时校验定义文本
    if (status === 'active' && (!description_zh || description_zh.length < 50)) {
      return NextResponse.json({ error: '激活专题前请填写中文定义文本（至少 50 字）' }, { status: 400 });
    }

    await queryRun(
      `UPDATE topics SET
        name_zh = COALESCE($1, name_zh),
        name_en = COALESCE($2, name_en),
        title = COALESCE($1, name_zh),
        description_zh = COALESCE($3, description_zh),
        description_en = COALESCE($4, description_en),
        description = COALESCE($3, description_zh),
        status = COALESCE($5, status),
        cover_image = COALESCE($6, cover_image),
        sort_order = COALESCE($7, sort_order),
        topic_type = COALESCE($8, topic_type),
        market = COALESCE($9, market),
        keywords = COALESCE($10, keywords),
        related_tickers = COALESCE($11, related_tickers),
        hero_summary_zh = COALESCE($12, hero_summary_zh),
        hero_summary_en = COALESCE($13, hero_summary_en),
        faq_items = COALESCE($14, faq_items),
        meta_title = COALESCE($15, meta_title),
        meta_description = COALESCE($16, meta_description),
        updated_at = NOW()
      WHERE id = $17`,
      [
        name_zh || null, name_en || null, description_zh || null, description_en || null,
        status || null, cover_image || null, sort_order ?? null,
        topic_type || null, market || null,
        Array.isArray(keywords) ? keywords : null,
        Array.isArray(related_tickers) ? related_tickers : null,
        hero_summary_zh || null, hero_summary_en || null,
        faq_items ? JSON.stringify(faq_items) : null,
        meta_title || null, meta_description || null,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** GET /api/topics/[id] - 获取单个专题（含精选文章列表） */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const topic = await queryGet(
      `SELECT *, COALESCE(name_zh, title) as name_zh, COALESCE(name_en, title) as name_en
       FROM topics WHERE id = $1`,
      [id]
    );
    if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 精选文章
    let featured: unknown[] = [];
    try {
      featured = await queryAll(
        `SELECT a.id, a.title, a.slug, a.published_at, tfa.sort_order
         FROM topic_featured_articles tfa
         JOIN articles a ON a.id = tfa.article_id
         WHERE tfa.topic_id = $1 AND a.status = 'published'
         ORDER BY tfa.sort_order ASC`,
        [id]
      );
    } catch { featured = []; }

    return NextResponse.json({ topic, featured });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
