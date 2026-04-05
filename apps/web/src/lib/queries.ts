import * as db from '@yayanews/database';
import type { Article, FlashNews, Category, Topic, Guide, Tag } from '@yayanews/types';
import { CATEGORY_DISPLAY_ORDER } from './constants';

export async function getCategories(): Promise<Category[]> {
  return await db.queryAll('SELECT * FROM categories ORDER BY sort_order') as Category[];
}

/** 强制安全的日期格式化器，无论传来 Date 还是 String 都能防爆 */
function safeDateStr(d: any): any {
  if (!d) return d;
  if (typeof d === 'string') return d.replace('T', ' ');
  if (typeof d?.toISOString === 'function') {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return String(d);
}

function formatArticleDates(a: any) {
  if (!a) return a;
  return { 
    ...a, 
    published_at: safeDateStr(a.published_at), 
    created_at: safeDateStr(a.created_at),
    updated_at: safeDateStr(a.updated_at)
  };
}

/** 按固定栏目顺序排序：快讯、美股、港股、衍生品、加密货币、其他（未在顺序中的排在最后） */
export async function getCategoriesOrdered(): Promise<Category[]> {
  const list = await getCategories();
  const order = CATEGORY_DISPLAY_ORDER;
  return [...list].sort((a, b) => {
    const i = order.indexOf(a.slug);
    const j = order.indexOf(b.slug);
    if (i === -1 && j === -1) return 0;
    if (i === -1) return 1;
    if (j === -1) return -1;
    return i - j;
  });
}

export async function getPublishedArticles(lang: string = 'zh', limit = 20, offset = 0, categorySlug?: string, subcategory?: string, articleType?: string): Promise<Article[]> {
  let sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.lang = $1
  `;
  const params: unknown[] = [lang];
  let paramIdx = 2;

  if (categorySlug) {
    sql += ` AND c.slug = $${paramIdx++}`;
    params.push(categorySlug);
  }

  if (subcategory) {
    sql += ` AND a.subcategory = $${paramIdx++}`;
    params.push(subcategory);
  }

  if (articleType) {
    sql += ` AND a.article_type = $${paramIdx++}`;
    params.push(articleType);
  }

  sql += ` ORDER BY a.published_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);

  const articles = await db.queryAll<Article>(sql, params);
  const result: Article[] = [];
  for (const a of articles) {
    result.push(formatArticleDates({ ...a, tags: await getArticleTags(a.id) }));
  }
  return result;
}

export async function getArticleCountByType(categorySlug?: string, articleType?: string): Promise<number> {
  let sql = "SELECT COUNT(*)::int as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published' AND a.audit_status = 'approved'";
  const params: unknown[] = [];
  let paramIdx = 1;
  if (categorySlug) { sql += ` AND c.slug = $${paramIdx++}`; params.push(categorySlug); }
  if (articleType) { sql += ` AND a.article_type = $${paramIdx++}`; params.push(articleType); }
  
  const res = await db.queryGet<{ count: number }>(sql, params);
  return res?.count || 0;
}

export async function getArticleBySlug(slug: string): Promise<(Article & { sibling_slug?: string }) | undefined> {
  const article = await db.queryGet<{ sibling_slug?: string }>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
           sib.slug as sibling_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN articles sib ON (a.lang = 'zh' AND sib.parent_id = a.id) OR (a.lang = 'en' AND sib.id = a.parent_id)
    WHERE a.slug = $1 AND a.status = 'published'
  `, [slug]) as (Article & { sibling_slug?: string }) | undefined;

  if (article) {
    article.tags = await getArticleTags(article.id);
    await db.queryAll('UPDATE articles SET view_count = view_count + 1 WHERE id = $1', [article.id]);
  }
  return formatArticleDates(article);
}

export async function getArticleTags(articleId: number): Promise<Tag[]> {
  return await db.queryAll(`
    SELECT t.* FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = $1
  `, [articleId]) as Tag[];
}

export async function getRelatedArticles(articleId: number, categoryId: number | null, limit = 5): Promise<Article[]> {
  if (categoryId) {
    const list = await db.queryAll(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id != $1 AND a.status = 'published' AND a.category_id = $2
      ORDER BY a.published_at DESC LIMIT $3
    `, [articleId, categoryId, limit]) as Article[];
    return list.map(formatArticleDates);
  }
  const list2 = await db.queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.id != $1 AND a.status = 'published'
    ORDER BY a.published_at DESC LIMIT $2
  `, [articleId, limit]) as Article[];
  return list2.map(formatArticleDates);
}

export async function getFlashMaxId(lang: string = 'zh', categorySlug?: string): Promise<number> {
  if (categorySlug) {
    const row = await db.queryGet<{ m: number | null }>(
      `SELECT MAX(f.id) as m FROM flash_news f
       JOIN categories c ON f.category_id = c.id WHERE c.slug = $1 AND f.lang = $2`,
      [categorySlug, lang]
    );
    return row?.m ?? 0;
  }
  const row = await db.queryGet<{ m: number | null }>('SELECT MAX(id) as m FROM flash_news WHERE lang = $1', [lang]);
  return row?.m ?? 0;
}

export async function getPublishedArticleMaxId(lang: string = 'zh'): Promise<number> {
  const row = await db.queryGet<{ m: number | null }>(
    `SELECT MAX(id) as m FROM articles WHERE status = 'published' AND audit_status = 'approved' AND lang = $1`,
    [lang]
  );
  return row?.m ?? 0;
}

export async function getFlashNews(lang: string = 'zh', limit = 50, categorySlug?: string): Promise<FlashNews[]> {
  if (categorySlug) {
    let list = await db.queryAll(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE c.slug = $1 AND f.lang = $2
      ORDER BY f.published_at DESC LIMIT $3
    `, [categorySlug, lang, limit]) as FlashNews[];
    if (list.length === 0 && lang !== 'zh') {
      list = await db.queryAll(`
        SELECT f.*, c.name as category_name
        FROM flash_news f
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE c.slug = $1 AND f.lang = 'zh'
        ORDER BY f.published_at DESC LIMIT $3
      `, [categorySlug, limit]) as FlashNews[];
    }
    return list.map(formatArticleDates);
  }
  let list2 = await db.queryAll(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.lang = $1
    ORDER BY f.published_at DESC LIMIT $2
  `, [lang, limit]) as FlashNews[];
  if (list2.length === 0 && lang !== 'zh') {
    list2 = await db.queryAll(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.lang = 'zh'
      ORDER BY f.published_at DESC LIMIT $2
    `, [limit]) as FlashNews[];
  }
  return list2.map(formatArticleDates);
}

export async function getFlashNewsById(id: number | string): Promise<FlashNews | undefined> {
  const flash = await db.queryGet<FlashNews>(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.id = $1
  `, [id]);
  return flash ? formatArticleDates(flash) : undefined;
}

export async function getRecentFlashForSitemap(limit = 1000): Promise<{ id: number; title: string; updated_at: string }[]> {
  const list = await db.queryAll<{ id: number; title: string; published_at: Date | string; updated_at?: Date | string }>(`
    SELECT id, title, published_at, updated_at FROM flash_news
    ORDER BY published_at DESC LIMIT $1
  `, [limit]);
  return list.map(f => ({
    id: f.id,
    title: f.title,
    updated_at: safeDateStr(f.updated_at || f.published_at)
  }));
}

/** \u83b7\u53d6\u6240\u6709 active \u4e13\u9898\u5217\u8868\uff0c\u9644\u5e26\u6587\u7ae0\u8ba1\u6570 */
export async function getTopics(limit = 20): Promise<Topic[]> {
  const rows = await db.queryAll(`
    SELECT t.*,
      COALESCE(t.name_zh, t.title) as name_zh,
      COALESCE(t.name_en, t.title) as name_en,
      (
        SELECT COUNT(*)::int
        FROM articles a
        WHERE a.topic_id = t.id AND a.status = 'published'
      ) as article_count
    FROM topics t
    WHERE t.status = 'active'
    ORDER BY t.sort_order, t.created_at DESC
    LIMIT $1::int
  `, [limit]);
  return rows as Topic[];
}

/** \u83b7\u53d6\u4e13\u9898\u8be6\u60c5\uff0c\u652f\u6301\u5206\u9875\u548c\u7cbe\u9009\u6587\u7ae0 */
export async function getTopicBySlug(
  slug: string,
  page = 1,
  pageSize = 20
): Promise<(Topic & { articles: Article[]; featured_articles: Article[]; total_count: number }) | undefined> {
  const topic = await db.queryGet<Topic>(
    `SELECT *, COALESCE(name_zh, title) as name_zh, COALESCE(name_en, title) as name_en
     FROM topics WHERE slug = $1::text AND status IN ('active', 'archive')`,
    [slug]
  );
  if (!topic) return undefined;

  const offset = (page - 1) * pageSize;

  // \u5168\u90e8\u6587\u7ae0\u5206\u9875\uff08\u6309 topic_id \u5173\u8054\uff09
  const articles = await db.queryAll<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.topic_id = $1 AND a.status = 'published' AND a.published_at <= NOW()
    ORDER BY a.published_at DESC
    LIMIT $2 OFFSET $3
  `, [topic.id, pageSize, offset]);

  // \u6587\u7ae0\u603b\u6570
  const countRow = await db.queryGet<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM articles WHERE topic_id = $1 AND status = 'published' AND audit_status = 'approved'`,
    [topic.id]
  );

  // \u7cbe\u9009\u6587\u7ae0\uff08\u4f18\u5148\u4f7f\u7528 topic_featured_articles\uff0c\u5982\u65e7\u8868\u5b58\u5728\u5219 fallback topic_articles\uff09
  let featured: Article[] = [];
  try {
    featured = await db.queryAll<Article>(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM topic_featured_articles tfa
      JOIN articles a ON a.id = tfa.article_id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE tfa.topic_id = $1 AND a.status = 'published'
      ORDER BY tfa.sort_order ASC
      LIMIT 6
    `, [topic.id]);
  } catch {
    // topic_featured_articles \u8868\u5c1a\u672a\u521b\u5efa\uff0c\u4f7f\u7528\u65e7\u7cbe\u9009\u6216\u6b22\u8fce\u4e3a\u7a7a
    featured = [];
  }

  return {
    ...topic,
    articles: articles.map(formatArticleDates),
    featured_articles: featured.map(formatArticleDates),
    total_count: countRow?.count || 0,
  };
}

/** \u83b7\u53d6\u6587\u7ae0\u6240\u5c5e\u4e13\u9898\uff08\u542b\u540c\u4e13\u9898\u6700\u65b03\u7bc7\uff0c\u7528\u4e8e\u6587\u7ae0\u9875\u5e95\u90e8\u6a21\u5757\uff09 */
export async function getArticleTopic(
  articleId: number,
  topicId: number | null | undefined
): Promise<(Topic & { recent_articles: Article[] }) | null> {
  if (!topicId) return null;

  const topic = await db.queryGet<Topic>(
    `SELECT *, COALESCE(name_zh, title) as name_zh, COALESCE(name_en, title) as name_en
     FROM topics WHERE id = $1 AND status = 'active'`,
    [topicId]
  );
  if (!topic) return null;

  const recent = await db.queryAll<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.topic_id = $1 AND a.status = 'published'
      AND a.id != $2 AND a.published_at <= NOW()
    ORDER BY a.published_at DESC
    LIMIT 3
  `, [topicId, articleId]);

  return {
    ...topic,
    recent_articles: recent.map(formatArticleDates),
  };
}

/** \u4e13\u9898\u9875\u7528\uff1a\u83b7\u53d6 sitemap \u8f93\u51fa \u2014 \u53ea\u53d6 active \u4e13\u9898 */
export async function getTopicsForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const topics = await db.queryAll<{ slug: string; updated_at: Date | string }>(
    `SELECT slug, updated_at FROM topics WHERE status = 'active' ORDER BY updated_at DESC`
  );
  return topics.map(t => ({ slug: t.slug, updated_at: safeDateStr(t.updated_at) }));
}



export async function getArticleCount(): Promise<number> {
  const row = await db.queryGet<{ count: number }>("SELECT COUNT(*)::int as count FROM articles WHERE status = 'published' AND audit_status = 'approved'");
  return row?.count || 0;
}

export async function getRecentArticlesForSitemap(): Promise<{ slug: string; updated_at: string; lang: string; sibling_slug?: string }[]> {
  const articles = await db.queryAll<{ slug: string; updated_at: Date | string; lang: string; sibling_slug?: string }>(`
    SELECT a.slug, a.updated_at, a.lang,
           sib.slug as sibling_slug
    FROM articles a
    LEFT JOIN articles sib ON (a.lang = 'zh' AND sib.parent_id = a.id) OR (a.lang = 'en' AND sib.id = a.parent_id)
    WHERE a.status = 'published' ORDER BY a.published_at DESC
  `);
  return articles.map(a => ({
    slug: a.slug,
    lang: a.lang,
    sibling_slug: a.sibling_slug,
    updated_at: safeDateStr(a.updated_at)
  }));
}

export async function getNewsArticlesLast48h(): Promise<Article[]> {
  const articles = await db.queryAll<Article>(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND a.updated_at >= (NOW() - INTERVAL '48 hours')
    ORDER BY a.updated_at DESC
    LIMIT 1000
  `);
  return articles.map(formatArticleDates);
}

export async function getAdjacentArticles(articleId: number): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
  const prev = await db.queryGet(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id < $1
    ORDER BY id DESC LIMIT 1
  `, [articleId]) as { slug: string; title: string } | undefined;
  const next = await db.queryGet(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id > $1
    ORDER BY id ASC LIMIT 1
  `, [articleId]) as { slug: string; title: string } | undefined;
  return { prev: prev || null, next: next || null };
}

export async function getPopularTags(limit = 15): Promise<Tag[]> {
  const tags = await db.queryAll(`
    SELECT t.*, COUNT(at.article_id) as usage_count
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT $1
  `, [limit]) as Tag[];

  if (tags.length < limit) {
    const fallbacks: Tag[] = [
      { id: -1, name: '美股', slug: 'us-stocks' },
      { id: -2, name: 'AI人工智能', slug: 'ai' },
      { id: -3, name: '加密货币', slug: 'crypto' },
      { id: -4, name: '港股', slug: 'hk-stocks' },
      { id: -5, name: '美联储', slug: 'federal-reserve' },
      { id: -6, name: '财报', slug: 'earnings' },
    ];
    const existingSlugs = new Set(tags.map(t => t.slug));
    for (const fb of fallbacks) {
      if (!existingSlugs.has(fb.slug)) {
        tags.push(fb);
        existingSlugs.add(fb.slug);
      }
      if (tags.length >= limit) break;
    }
  }

  return tags;
}

export async function getTagBySlug(slug: string): Promise<Tag | undefined> {
  return await db.queryGet<Tag>('SELECT * FROM tags WHERE slug = $1', [slug]);
}

export async function getPublishedArticlesByTagSlug(tagSlug: string, limit = 48, offset = 0): Promise<Article[]> {
  const articles = await db.queryAll<Article>(
      `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE t.slug = $1 AND a.status = 'published'
    ORDER BY a.published_at DESC
    LIMIT $2 OFFSET $3
  `,
    [tagSlug, limit, offset]
  );
  
  const result: Article[] = [];
  for (const a of articles) {
    result.push({ ...a, tags: await getArticleTags(a.id) });
  }
  return result;
}

export async function getArticleCountByTagSlug(tagSlug: string): Promise<number> {
  const row = await db.queryGet<{ count: number }>(
      `
    SELECT COUNT(*)::int as count FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    WHERE t.slug = $1 AND a.status = 'published'
  `,
    [tagSlug]
  );
  return row?.count || 0;
}

/** 有已发布稿件关联的标签，用于 sitemap */
export async function getTagsForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const tags = await db.queryAll<{ slug: string; updated_at: Date | string }>(
      `
    SELECT t.slug, MAX(a.updated_at) as updated_at
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    JOIN articles a ON a.id = at.article_id
    WHERE a.status = 'published'
    GROUP BY t.id
  `
  );
  return tags.map(t => ({
    slug: t.slug,
    updated_at: safeDateStr(t.updated_at)
  }));
}

export async function getGuides(limit = 20): Promise<Guide[]> {
  try {
    return await db.queryAll<Guide>(
      'SELECT * FROM guides ORDER BY sort_order, created_at DESC LIMIT $1', [limit]
    );
  } catch {
    return [];
  }
}

export async function getGuideBySlug(slug: string): Promise<Guide | undefined> {
  try {
    return await db.queryGet<Guide>('SELECT * FROM guides WHERE slug = $1', [slug]);
  } catch {
    return undefined;
  }
}

export async function searchArticles(query: string, limit = 20): Promise<Article[]> {
  const q = `%${query}%`;
  const articles = await db.queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND (a.title ILIKE $1 OR a.summary ILIKE $2 OR a.content ILIKE $3)
    ORDER BY a.published_at DESC LIMIT $4
  `, [q, q, q, limit]) as Article[];
  return articles.map(formatArticleDates);
}
