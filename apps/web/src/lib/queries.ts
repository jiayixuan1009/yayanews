import { queryAll, queryGet } from '@yayanews/database';
import type { Article, FlashNews, Category, Topic, Guide, Tag } from '@yayanews/types';
import { CATEGORY_DISPLAY_ORDER } from './constants';

export async function getCategories(): Promise<Category[]> {
  return await queryAll('SELECT * FROM categories ORDER BY sort_order') as Category[];
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

  const articles = await queryAll<Article>(sql, params);
  const result: Article[] = [];
  for (const a of articles) {
    result.push(formatArticleDates({ ...a, tags: await getArticleTags(a.id) }));
  }
  return result;
}

export async function getArticleCountByType(categorySlug?: string, articleType?: string): Promise<number> {
  let sql = "SELECT COUNT(*)::int as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published'";
  const params: unknown[] = [];
  let paramIdx = 1;
  if (categorySlug) { sql += ` AND c.slug = $${paramIdx++}`; params.push(categorySlug); }
  if (articleType) { sql += ` AND a.article_type = $${paramIdx++}`; params.push(articleType); }
  
  const res = await queryGet<{ count: number }>(sql, params);
  return res?.count || 0;
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  const article = await queryGet(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = $1 AND a.status = 'published'
  `, [slug]) as Article | undefined;

  if (article) {
    article.tags = await getArticleTags(article.id);
    await queryAll('UPDATE articles SET view_count = view_count + 1 WHERE id = $1', [article.id]);
  }
  return formatArticleDates(article);
}

export async function getArticleTags(articleId: number): Promise<Tag[]> {
  return await queryAll(`
    SELECT t.* FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = $1
  `, [articleId]) as Tag[];
}

export async function getRelatedArticles(articleId: number, categoryId: number | null, limit = 5): Promise<Article[]> {
  if (categoryId) {
    const list = await queryAll(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id != $1 AND a.status = 'published' AND a.category_id = $2
      ORDER BY a.published_at DESC LIMIT $3
    `, [articleId, categoryId, limit]) as Article[];
    return list.map(formatArticleDates);
  }
  const list2 = await queryAll(`
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
    const row = await queryGet<{ m: number | null }>(
      `SELECT MAX(f.id) as m FROM flash_news f
       JOIN categories c ON f.category_id = c.id WHERE c.slug = $1 AND f.lang = $2`,
      [categorySlug, lang]
    );
    return row?.m ?? 0;
  }
  const row = await queryGet<{ m: number | null }>('SELECT MAX(id) as m FROM flash_news WHERE lang = $1', [lang]);
  return row?.m ?? 0;
}

export async function getPublishedArticleMaxId(lang: string = 'zh'): Promise<number> {
  const row = await queryGet<{ m: number | null }>(
    `SELECT MAX(id) as m FROM articles WHERE status = 'published' AND lang = $1`,
    [lang]
  );
  return row?.m ?? 0;
}

export async function getFlashNews(lang: string = 'zh', limit = 50, categorySlug?: string): Promise<FlashNews[]> {
  if (categorySlug) {
    const list = await queryAll(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE c.slug = $1 AND f.lang = $2
      ORDER BY f.published_at DESC LIMIT $3
    `, [categorySlug, lang, limit]) as FlashNews[];
    return list.map(formatArticleDates);
  }
  const list2 = await queryAll(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.lang = $1
    ORDER BY f.published_at DESC LIMIT $2
  `, [lang, limit]) as FlashNews[];
  return list2.map(formatArticleDates);
}

export async function getFlashNewsById(id: number | string): Promise<FlashNews | undefined> {
  const flash = await queryGet<FlashNews>(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.id = $1
  `, [id]);
  return flash ? formatArticleDates(flash) : undefined;
}

export async function getRecentFlashForSitemap(limit = 1000): Promise<{ id: number; updated_at: string }[]> {
  const list = await queryAll<{ id: number; published_at: Date | string; updated_at?: Date | string }>(`
    SELECT id, published_at, updated_at FROM flash_news
    ORDER BY published_at DESC LIMIT $1
  `, [limit]);
  return list.map(f => ({
    id: f.id,
    updated_at: safeDateStr(f.updated_at || f.published_at)
  }));
}

export async function getTopics(limit = 20): Promise<Topic[]> {
  return await queryAll(`
    SELECT t.*, COUNT(ta.article_id) as article_count
    FROM topics t
    LEFT JOIN topic_articles ta ON t.id = ta.topic_id
    WHERE t.status = 'active'
    GROUP BY t.id
    ORDER BY t.sort_order, t.created_at DESC
    LIMIT $1
  `, [limit]) as Topic[];
}

export async function getTopicBySlug(slug: string): Promise<(Topic & { articles: Article[] }) | undefined> {
  const topic = await queryGet<Topic>('SELECT * FROM topics WHERE slug = $1 AND status = $2', [slug, 'active']);
  if (!topic) return undefined;

  const articles = await queryAll<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN topic_articles ta ON a.id = ta.article_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE ta.topic_id = $1 AND a.status = 'published'
    ORDER BY ta.sort_order, a.published_at DESC
  `, [topic.id]);

  return { ...topic, articles: articles.map(formatArticleDates) };
}


export async function getArticleCount(): Promise<number> {
  const row = await queryGet<{ count: number }>("SELECT COUNT(*)::int as count FROM articles WHERE status = 'published'");
  return row?.count || 0;
}

export async function getRecentArticlesForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const articles = await queryAll<{ slug: string; updated_at: Date | string }>(`
    SELECT slug, updated_at FROM articles
    WHERE status = 'published' ORDER BY published_at DESC
  `);
  return articles.map(a => ({
    slug: a.slug,
    updated_at: safeDateStr(a.updated_at)
  }));
}

export async function getNewsArticlesLast48h(): Promise<Article[]> {
  const articles = await queryAll<Article>(`
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
  const prev = await queryGet(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id < $1
    ORDER BY id DESC LIMIT 1
  `, [articleId]) as { slug: string; title: string } | undefined;
  const next = await queryGet(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id > $1
    ORDER BY id ASC LIMIT 1
  `, [articleId]) as { slug: string; title: string } | undefined;
  return { prev: prev || null, next: next || null };
}

export async function getPopularTags(limit = 15): Promise<Tag[]> {
  const tags = await queryAll(`
    SELECT t.*, COUNT(at.article_id) as usage_count
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT $1
  `, [limit]) as Tag[];

  if (tags.length < limit) {
    const fallbacks: Tag[] = [
      { id: -1, name: '美股', slug: 'us-stocks', created_at: new Date().toISOString() },
      { id: -2, name: 'AI人工智能', slug: 'ai', created_at: new Date().toISOString() },
      { id: -3, name: '加密货币', slug: 'crypto', created_at: new Date().toISOString() },
      { id: -4, name: '港股', slug: 'hk-stocks', created_at: new Date().toISOString() },
      { id: -5, name: '美联储', slug: 'federal-reserve', created_at: new Date().toISOString() },
      { id: -6, name: '财报', slug: 'earnings', created_at: new Date().toISOString() },
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
  return await queryGet<Tag>('SELECT * FROM tags WHERE slug = $1', [slug]);
}

export async function getPublishedArticlesByTagSlug(tagSlug: string, limit = 48, offset = 0): Promise<Article[]> {
  const articles = await queryAll<Article>(
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
  const row = await queryGet<{ count: number }>(
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
  const tags = await queryAll<{ slug: string; updated_at: Date | string }>(
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
    return await queryAll<Guide>(
      'SELECT * FROM guides ORDER BY sort_order, created_at DESC LIMIT $1', [limit]
    );
  } catch {
    return [];
  }
}

export async function getGuideBySlug(slug: string): Promise<Guide | undefined> {
  try {
    return await queryGet<Guide>('SELECT * FROM guides WHERE slug = $1', [slug]);
  } catch {
    return undefined;
  }
}

export async function searchArticles(query: string, limit = 20): Promise<Article[]> {
  const q = `%${query}%`;
  const articles = await queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND (a.title ILIKE $1 OR a.summary ILIKE $2 OR a.content ILIKE $3)
    ORDER BY a.published_at DESC LIMIT $4
  `, [q, q, q, limit]) as Article[];
  return articles.map(formatArticleDates);
}
