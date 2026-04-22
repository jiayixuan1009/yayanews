import * as db from '@yayanews/database';

/**
 * 物理删除过期的新闻文章记录
 * @param days 保留天数，删除 older than this many days 的记录
 * @returns 删除的文章条数
 */
export async function deleteExpiredArticles(days: number): Promise<number> {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('清理阈值必须为正整数');
  }

  // 先获取要删除的 article_id 列表
  // PostgreSQL 物理外键约束如果是 CASCADE，直接删除 articles 就会同步删除 tags
  // 如果不是 CASCADE，我们需要手动删除 article_tags 中挂载的记录
  const candidates = await db.queryAll<{ id: number }>(
    `SELECT id FROM articles WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [days]
  );

  if (candidates.length === 0) return 0;

  const ids = candidates.map(c => c.id);

  // 手动安全清除依赖 (article_tags)
  await db.queryRun(
    `DELETE FROM article_tags WHERE article_id = ANY($1::int[])`,
    [ids]
  );

  // 物理删除文章本体
  const changes = await db.queryRun(
    `DELETE FROM articles WHERE id = ANY($1::int[])`,
    [ids]
  );
  return changes;
}

/**
 * 物理删除过期的快讯记录
 * @param days 保留天数，删除 older than this many days 的记录
 * @returns 删除的快讯条数
 */
export async function deleteExpiredFlash(days: number): Promise<number> {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('清理阈值必须为正整数');
  }

  const changes = await db.queryRun(
    `DELETE FROM flash_news WHERE published_at < NOW() - ($1::int * INTERVAL '1 day') OR created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [days]
  );
  
  return changes;
}
