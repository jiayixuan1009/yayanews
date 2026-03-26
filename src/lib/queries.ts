import { getDb } from './db';
import type { Article, FlashNews, Category, Topic, Guide, Tag } from './types';
import { CATEGORY_DISPLAY_ORDER } from './constants';

export function getCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories ORDER BY sort_order').all() as Category[];
}

/** 按固定栏目顺序排序：快讯、美股、港股、衍生品、加密货币、其他（未在顺序中的排在最后） */
export function getCategoriesOrdered(): Category[] {
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

export function getPublishedArticles(limit = 20, offset = 0, categorySlug?: string, subcategory?: string, articleType?: string): Article[] {
  const db = getDb();
  let sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
  `;
  const params: unknown[] = [];

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

export function getArticleCountByType(categorySlug?: string, articleType?: string): number {
  const db = getDb();
  let sql = "SELECT COUNT(*) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published'";
  const params: unknown[] = [];
  if (categorySlug) { sql += ' AND c.slug = ?'; params.push(categorySlug); }
  if (articleType) { sql += ' AND a.article_type = ?'; params.push(articleType); }
  return (db.prepare(sql).get(...params) as { count: number }).count;
}

export function getArticleBySlug(slug: string): Article | undefined {
  const db = getDb();
  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = ? AND a.status = 'published'
  `).get(slug) as Article | undefined;

  if (article) {
    article.tags = getArticleTags(article.id);
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);
  }
  return article;
}

export function getArticleTags(articleId: number): Tag[] {
  return getDb().prepare(`
    SELECT t.* FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
  `).all(articleId) as Tag[];
}

export function getRelatedArticles(articleId: number, categoryId: number | null, limit = 5): Article[] {
  const db = getDb();
  if (categoryId) {
    return db.prepare(`
      SELECT a.*, c.name as category_name, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id != ? AND a.status = 'published' AND a.category_id = ?
      ORDER BY a.published_at DESC LIMIT ?
    `).all(articleId, categoryId, limit) as Article[];
  }
  return db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.id != ? AND a.status = 'published'
    ORDER BY a.published_at DESC LIMIT ?
  `).all(articleId, limit) as Article[];
}

export function getFlashMaxId(categorySlug?: string): number {
  const db = getDb();
  if (categorySlug) {
    const row = db
      .prepare(
        `SELECT MAX(f.id) as m FROM flash_news f
         JOIN categories c ON f.category_id = c.id WHERE c.slug = ?`
      )
      .get(categorySlug) as { m: number | null };
    return row.m ?? 0;
  }
  const row = db.prepare('SELECT MAX(id) as m FROM flash_news').get() as { m: number | null };
  return row.m ?? 0;
}

export function getPublishedArticleMaxId(): number {
  const row = getDb()
    .prepare(`SELECT MAX(id) as m FROM articles WHERE status = 'published'`)
    .get() as { m: number | null };
  return row.m ?? 0;
}

export function getFlashNews(limit = 50, categorySlug?: string): FlashNews[] {
  const db = getDb();
  if (categorySlug) {
    return db.prepare(`
      SELECT f.*, c.name as category_name
      FROM flash_news f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE c.slug = ?
      ORDER BY f.published_at DESC LIMIT ?
    `).all(categorySlug, limit) as FlashNews[];
  }
  return db.prepare(`
    SELECT f.*, c.name as category_name
    FROM flash_news f
    LEFT JOIN categories c ON f.category_id = c.id
    ORDER BY f.published_at DESC LIMIT ?
  `).all(limit) as FlashNews[];
}

export function getTopics(limit = 20): Topic[] {
  return getDb().prepare(`
    SELECT t.*, COUNT(ta.article_id) as article_count
    FROM topics t
    LEFT JOIN topic_articles ta ON t.id = ta.topic_id
    WHERE t.status = 'active'
    GROUP BY t.id
    ORDER BY t.sort_order, t.created_at DESC
    LIMIT ?
  `).all(limit) as Topic[];
}

export function getTopicBySlug(slug: string): (Topic & { articles: Article[] }) | undefined {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM topics WHERE slug = ? AND status = ?').get(slug, 'active') as Topic | undefined;
  if (!topic) return undefined;

  const articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN topic_articles ta ON a.id = ta.article_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE ta.topic_id = ? AND a.status = 'published'
    ORDER BY ta.sort_order, a.published_at DESC
  `).all(topic.id) as Article[];

  return { ...topic, articles };
}

export function getGuides(limit = 20): Guide[] {
  return getDb().prepare(
    'SELECT * FROM guides ORDER BY sort_order, created_at DESC LIMIT ?'
  ).all(limit) as Guide[];
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return getDb().prepare('SELECT * FROM guides WHERE slug = ?').get(slug) as Guide | undefined;
}

export function getArticleCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published'").get() as { count: number };
  return row.count;
}

export function getRecentArticlesForSitemap(): { slug: string; updated_at: string }[] {
  return getDb().prepare(`
    SELECT slug, updated_at FROM articles
    WHERE status = 'published' ORDER BY published_at DESC
  `).all() as { slug: string; updated_at: string }[];
}

export function getNewsArticlesLast48h(): Article[] {
  return getDb().prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND a.updated_at >= datetime('now', '+8 hours', '-48 hours')
    ORDER BY a.updated_at DESC
    LIMIT 1000
  `).all() as Article[];
}

export function getAdjacentArticles(articleId: number): { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null } {
  const db = getDb();
  const prev = db.prepare(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id < ?
    ORDER BY id DESC LIMIT 1
  `).get(articleId) as { slug: string; title: string } | undefined;
  const next = db.prepare(`
    SELECT slug, title FROM articles
    WHERE status = 'published' AND id > ?
    ORDER BY id ASC LIMIT 1
  `).get(articleId) as { slug: string; title: string } | undefined;
  return { prev: prev || null, next: next || null };
}

export function getPopularTags(limit = 15): Tag[] {
  return getDb().prepare(`
    SELECT t.*, COUNT(at.article_id) as usage_count
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT ?
  `).all(limit) as Tag[];
}

export function getTagBySlug(slug: string): Tag | undefined {
  return getDb().prepare('SELECT * FROM tags WHERE slug = ?').get(slug) as Tag | undefined;
}

export function getPublishedArticlesByTagSlug(tagSlug: string, limit = 48, offset = 0): Article[] {
  const articles = getDb()
    .prepare(
      `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE t.slug = ? AND a.status = 'published'
    ORDER BY a.published_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(tagSlug, limit, offset) as Article[];
  return articles.map(a => ({ ...a, tags: getArticleTags(a.id) }));
}

export function getArticleCountByTagSlug(tagSlug: string): number {
  const row = getDb()
    .prepare(
      `
    SELECT COUNT(*) as count FROM articles a
    JOIN article_tags at ON a.id = at.article_id
    JOIN tags t ON t.id = at.tag_id
    WHERE t.slug = ? AND a.status = 'published'
  `
    )
    .get(tagSlug) as { count: number };
  return row.count;
}

/** 有已发布稿件关联的标签，用于 sitemap */
export function getTagsForSitemap(): { slug: string; updated_at: string }[] {
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

export function searchArticles(query: string, limit = 20): Article[] {
  const q = `%${query}%`;
  return getDb().prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)
    ORDER BY a.published_at DESC LIMIT ?
  `).all(q, q, q, limit) as Article[];
}
