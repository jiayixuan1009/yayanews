/**
 * 文章封面展示策略（与入库脚本配合）：
 * - 有 `cover_image` 时展示真实配图；
 * - 来源为 BWEnews / 方程式新闻 的文章，一律视为无图（走占位图）；
 * - 无图时展示站内占位图，保证列表/首卡布局一致。
 * - 批量补 URL：`npm run covers:assign`（scripts/assign-article-covers.mjs，读 .env 图库 Key）。
 */
export const ARTICLE_COVER_PLACEHOLDER = '/images/article-placeholder.svg';
export const ARTICLE_COVER_PLACEHOLDER_EN = '/images/article-placeholder-en.svg';

/** 检测来源是否为 BWEnews / 方程式新闻（其配图质量不达标，一律使用占位图） */
function isBWEnewsSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return s.includes('bwenews') || s.includes('方程式');
}

export function getArticleCoverSrc(
  coverImage: string | null | undefined,
  lang: string = 'zh',
  source?: string | null,
): string {
  // BWEnews 来源的文章一律视为无图
  if (isBWEnewsSource(source)) {
    return lang === 'en' ? ARTICLE_COVER_PLACEHOLDER_EN : ARTICLE_COVER_PLACEHOLDER;
  }
  const t = coverImage?.trim();
  if (t) return t;
  return lang === 'en' ? ARTICLE_COVER_PLACEHOLDER_EN : ARTICLE_COVER_PLACEHOLDER;
}

export function articleHasRealCover(
  coverImage: string | null | undefined,
  source?: string | null,
): boolean {
  if (isBWEnewsSource(source)) return false;
  return Boolean(coverImage?.trim());
}
