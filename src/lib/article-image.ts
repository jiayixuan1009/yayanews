/**
 * 文章封面展示策略（与入库脚本配合）：
 * - 有 `cover_image` 时展示真实配图；
 * - 无图时展示站内占位图，保证列表/首卡布局一致。
 * - 批量补 URL：`npm run covers:assign`（scripts/assign-article-covers.mjs，读 .env 图库 Key）。
 */
export const ARTICLE_COVER_PLACEHOLDER = '/images/article-placeholder.svg';

export function getArticleCoverSrc(coverImage: string | null | undefined): string {
  const t = coverImage?.trim();
  if (t) return t;
  return ARTICLE_COVER_PLACEHOLDER;
}

export function articleHasRealCover(coverImage: string | null | undefined): boolean {
  return Boolean(coverImage?.trim());
}
