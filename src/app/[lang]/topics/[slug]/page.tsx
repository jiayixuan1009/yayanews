import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { notFound } from 'next/navigation';
import { getTopicBySlug, getTopics } from '@/lib/queries';
import { siteConfig } from '@/lib/types';
import ArticleCard from '@/components/ArticleCard';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = getTopicBySlug(params.slug);
  if (!topic) return { title: '专题未找到' };
  return {
    title: topic.title,
    description: topic.description || `${topic.title} - ${siteConfig.siteName}专题聚合`,
    alternates: { canonical: `/topics/${params.slug}` },
    openGraph: { title: `${topic.title} | YayaNews`, description: topic.description || topic.title },
  };
}

export async function generateStaticParams() {
  const topics = getTopics(100);
  return topics.map(t => ({ slug: t.slug }));
}

export const revalidate = 300;

export default function TopicDetailPage({ params }: Props) {
  const topic = getTopicBySlug(params.slug);
  if (!topic) notFound();

  return (
    <div className="container-main py-8">
      <nav className="mb-6 text-sm text-gray-500">
        <LocalizedLink href="/" className="hover:text-primary-400">首页</LocalizedLink>
        <span className="mx-2">/</span>
        <LocalizedLink href="/topics" className="hover:text-primary-400">专题</LocalizedLink>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{topic.title}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{topic.title}</h1>
        {topic.description && (
          <p className="mt-2 text-gray-400">{topic.description}</p>
        )}
        <p className="mt-2 text-sm text-gray-500">{topic.articles.length} 篇相关文章</p>
      </div>

      {topic.articles.length > 0 ? (
        <div className="space-y-3">
          {topic.articles.map(a => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-16">该专题暂无文章</p>
      )}
    </div>
  );
}
