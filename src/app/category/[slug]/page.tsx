import { permanentRedirect } from 'next/navigation';

/**
 * PRD 公共路由 /category/[slug] 与现有 /news/[category] 对齐：永久重定向，利于外链与 SEO 统一。
 */
export default function CategoryAliasPage({ params }: { params: { slug: string } }) {
  permanentRedirect(`/news/${params.slug}`);
}
