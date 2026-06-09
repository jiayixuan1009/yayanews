import { permanentRedirect } from 'next/navigation';

/**
 * PRD 公共路由 /category/[slug] 与现有 /news/[category] 对齐：永久重定向，利于外链与 SEO 统一。
 */
export default async function CategoryAliasPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/news/${slug}`);
}
