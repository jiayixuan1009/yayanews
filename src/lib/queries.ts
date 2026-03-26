import { queryAll, queryGet } from './db';
import type { Article, FlashNews, Category, Topic, Guide, Tag } from './types';
import { CATEGORY_DISPLAY_ORDER } from './constants';

export async function getCategories(): Category[] {
  return await queryAll('SELECT * FROM categories ORDER BY sort_order') as Category[];
}

/** 按固定栏目顺序排序：快讯、美股、港股、衍生品、加密货币、其他（未在顺序中的排在最后） */
export async function getCategoriesOrdered(): Category[] {
  const list = getCategories();
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

export async function getPublishedArticles(lang: string = 'zh', limit = 20, offset = 0, categorySlug?: string, subcategory?: string, articleType?: string): Article[] {
  let sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.lang = $1
  `;
  const params: unknown[] = [lang];

  if (categorySlug) {
    sql += ' AND c.slug = ?';
    params.push(categorySlug);
  }

  if (subcategory) {
    sql += ' AND a.subcategory = ?';
    params.push(subcategory);
  }

  if (articleType) {
    sql += ' AND a.article_type = ?';
    params.push(articleType);
  }

  sql += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const articles = db.prepare(sql).all(...params) as Article[];
  return articles.map(a => ({ ...a, tags: getArticleTags(a.id) }));
}

export async function getArticleCountByType(categorySlug?: string, articleType?: string): number {
  let sql = "SELECT COUNT(*) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published'";
  const params: unknown[] = [];
  if (categorySlug) { sql += ' AND c.slug = ?'; params.push(categorySlug); }
  if (articleType) { sql += ' AND a.article_type = ?'; params.push(articleType); }
  return (db.prepare(sql).get(...params) as { count: number }).count;
}

export async function getArticleBySlug(slug: string): Article | undefined {
  const article = await queryGet(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = $1 AND a.status = 'published'
  `, [slug]) as Article | undefined;

  if (article) {
    article.tags = getArticleTags(article.id);
    await queryAll('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [article.id]);
  }
  return article;
}

export async function getArticleTags(articleId: number): Tag[] {
  return await queryAll(`
    SELECT t.* FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = $1
  `, [articleId]) as Tag[];
}

export async function getRelatedArticles(articleId: number, categoryId: number | null, limit = 5): Article[] {
  if (categoryId) {
    return await queryAll(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id != $1 AND a.status = 'published' AND a.category_id = $2
      ORDER BY a.published_at DESC LIMIT $3
    `, [articleId, categoryId, limit]) as Article[];
  }
  return await queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.id != $1 AND a.status = 'published'
    ORDER BY a.published_at DESC LIMIT $2
  `, [articleId, limit]) as Article[];
}

export async function getFlashMaxId(lang: string = 'zh', categorySlug?: string): number {
  if (categorySlug) {
    const row = db
      .prepare(
        `SELECT MAX(f.id) as m FROM flash_news f
         JOIN categories c ON f.category_id = c.id WHERE c.slug = $1 AND f.lang = $2`
      )
      .get(categorySlug, lang) as { m: number | null };
    return row.m ?? 0;
  }
  const row = db.prepare('SELECT MAX(id) as m FROM flash_news WHERE lang = ?').get(lang) as { m: number | null };
  return row.m ?? 0;
}

export async function getPublishedArticleMaxId(lang: string = 'zh'): number {
  const row = getDb()
    .prepare(`SELECT MAX(id) as m FROM articles WHERE status = 'published' AND lang = $1`)
    .get(lang) as { m: number | null };
  return row.m ?? 0;
}

export async function getFlashNews(lang: string = 'zh', limit = 50, categorySlug?: string): FlashNews[] {
  if (categorySlug) {
    return await queryAll(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE c.slug = $1 AND f.lang = $2
      ORDER BY f.published_at DESC LIMIT $3
    `, [categorySlug, lang, limit]) as FlashNews[];
  }
  return await queryAll(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.lang = $1
    ORDER BY f.published_at DESC LIMIT $2
  `, [lang, limit]) as FlashNews[];
}

export async function getTopics(limit = 20): Topic[] {
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

export async function getTopicBySlug(slug: string): (Topic & { articles: Article[] }) | undefined {
  const topic = db.prepare('SELECT * FROM topics WHERE slug = ? AND status = ?').get(slug, 'active') as Topic | undefined;
  if (!topic) return undefined;

  const articles = await queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN topic_articles ta ON a.id = ta.article_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE ta.topic_id = $1 AND a.status = 'published'
    ORDER BY ta.sort_order, a.published_at DESC
  `, [topic.id]) as Article[];

  return { ...topic, articles };
}


export async function getArticleCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published'").get() as { count: number };
  return row.count;
}

export async function getRecentArticlesForSitemap(): { slug: string; updated_at: string }[] {
  return await queryAll(`
    SELECT slug, updated_at FROM articles
    WHERE status = 'published' ORDER BY published_at DESC
  `) as { slug: string; updated_at: string }[];
}

export async function getNewsArticlesLast48h(): Article[] {
  return await queryAll(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND a.updated_at >= datetime('now', '+8 hours', '-48 hours')
    ORDER BY a.updated_at DESC
    LIMIT 1000
  `) as Article[];
}

export async function getAdjacentArticles(articleId: number): { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null } {
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

export async function getPopularTags(limit = 15): Tag[] {
  return await queryAll(`
    SELECT t.*, COUNT(at.article_id) as usage_count
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT $1
  `, [limit]) as Tag[];
}

export async function getTagBySlug(slug: string): Tag | undefined {
  return await queryGet('SELECT * FROM tags WHERE slug = ?', [slug]) as Tag | undefined;
}

export async function getPublishedArticlesByTagSlug(tagSlug: string, limit = 48, offset = 0): Article[] {
  const articles = getDb()
    .prepare(
      `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE t.slug = $1 AND a.status = 'published'
    ORDER BY a.published_at DESC
    LIMIT $2 OFFSET $3
  `
    )
    .all(tagSlug, limit, offset) as Article[];
  return articles.map(a => ({ ...a, tags: getArticleTags(a.id) }));
}

export async function getArticleCountByTagSlug(tagSlug: string): number {
  const row = getDb()
    .prepare(
      `
    SELECT COUNT(*) as count FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    WHERE t.slug = $1 AND a.status = 'published'
  `
    )
    .get(tagSlug) as { count: number };
  return row.count;
}

/** 有已发布稿件关联的标签，用于 sitemap */
export async function getTagsForSitemap(): { slug: string; updated_at: string }[] {
  return getDb()
    .prepare(
      `
    SELECT t.slug, MAX(a.updated_at) as updated_at
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    JOIN articles a ON a.id = at.article_id
    WHERE a.status = 'published'
    GROUP BY t.id
  `
    )
    .all() as { slug: string; updated_at: string }[];
}

export async function getGuides(limit = 20): Guide[] {
  try {
    return getDb().prepare(
      'SELECT * FROM guides ORDER BY sort_order, created_at DESC LIMIT ?'
    ).all(limit) as Guide[];
  } catch {
    return [];
  }
}

export async function getGuideBySlug(slug: string): Guide | undefined {
  try {
    return await queryGet('SELECT * FROM guides WHERE slug = ?', [slug]) as Guide | undefined;
  } catch {
    return undefined;
  }
}

export async function searchArticles(query: string, limit = 20): Article[] {
  const q = `%${query}%`;
  return await queryAll(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND (a.title LIKE $1 OR a.summary LIKE $2 OR a.content LIKE $3)
    ORDER BY a.published_at DESC LIMIT $4
  `, [q, q, q, limit]) as Article[];
}
