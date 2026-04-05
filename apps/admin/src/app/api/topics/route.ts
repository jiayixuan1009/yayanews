import { NextRequest, NextResponse } from 'next/server';
import * as db from '@yayanews/database';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** GET /api/topics - 获取所有专题（含文章数量） */
export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const topics = await db.queryAll(`
      SELECT t.*,
        COALESCE(t.name_zh, t.title) as name_zh,
        COALESCE(t.name_en, t.title) as name_en,
        (SELECT COUNT(*)::int FROM articles a WHERE a.topic_id = t.id AND a.status = 'published') as article_count
      FROM topics t
      ORDER BY t.sort_order, t.created_at DESC
    `);
    return NextResponse.json({ topics });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** POST /api/topics - 创建新专题 */
export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { 
      slug, name_zh, name_en, description_zh, description_en, status = 'draft', category_id, cover_image,
      topic_type, market, keywords, related_tickers, hero_summary_zh, hero_summary_en, faq_items, meta_title, meta_description
    } = body;

    if (!slug || !name_zh || !name_en) {
      return NextResponse.json({ error: 'slug, name_zh, name_en 为必填项' }, { status: 400 });
    }
    if (status === 'active' && (!description_zh || description_zh.length < 50 || !description_en || description_en.length < 50)) {
      return NextResponse.json({ error: '激活专题时，双语定义文本至少需要 50 字符' }, { status: 400 });
    }
    // Slug 格式校验
    if (!/^[a-z0-9-]{2,120}$/.test(slug)) {
      return NextResponse.json({ error: 'Slug 只能包含小写字母、数字和连字符，长度 2-120' }, { status: 400 });
    }

    const existing = await db.queryGet('SELECT id FROM topics WHERE slug = $1', [slug]);
    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" 已被使用` }, { status: 409 });
    }

    const rows = await db.queryAll<{ id: number }>(
      `INSERT INTO topics (
        slug, name_zh, name_en, title, description_zh, description_en, description, status, category_id, cover_image, sort_order,
        topic_type, market, keywords, related_tickers, hero_summary_zh, hero_summary_en, faq_items, meta_title, meta_description,
        created_at, updated_at
       )
       VALUES ($1, $2, $3, $2, $4, $5, $4, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
       RETURNING id`,
      [
        slug, name_zh, name_en, description_zh || '', description_en || '', status, category_id || null, cover_image || null,
        topic_type || 'narrative', market || null, 
        Array.isArray(keywords) ? keywords : [], 
        Array.isArray(related_tickers) ? related_tickers : [],
        hero_summary_zh || null, hero_summary_en || null,
        faq_items ? JSON.stringify(faq_items) : '[]',
        meta_title || null, meta_description || null
      ]
    );

    return NextResponse.json({ id: rows[0]?.id, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
