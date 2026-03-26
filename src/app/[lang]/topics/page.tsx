import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { getTopics } from '@/lib/queries';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import SectionHeader from '@/components/editorial/SectionHeader';

export const metadata: Metadata = {
  title: '热门专题',
  description: '金融市场热门专题聚合，深度追踪美股、港股、加密货币、衍生品市场重大事件',
  alternates: { canonical: '/topics' },
  openGraph: { title: '热门专题 | YayaNews', description: '深度追踪市场重大事件，聚合相关报道' },
};

export const revalidate = 300;

export default function TopicsPage() {
  const topics = getTopics(50);

  return (
    <div className="container-main py-6 sm:py-8">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">热门专题</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">编辑战役聚合；卡片内不放鸭，视觉与首页 TopicBanner 槽位区分。</p>
      </header>

      {topics.length > 0 ? (
        <>
          <SectionHeader title="全部专题" emphasis="strong" className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, idx) => (
              <LocalizedLink
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="card group flex flex-col rounded-yn-md p-5 transition-colors hover:border-slate-600/90"
              >
                {topic.cover_image ? (
                  <div className="relative mb-3 aspect-video overflow-hidden rounded-yn-md border border-slate-800/80 bg-slate-900">
                    <Image
                      src={topic.cover_image}
                      alt={topic.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-opacity duration-200 group-hover:opacity-95"
                      priority={idx < 3}
                      unoptimized={!isRemoteImageOptimizable(topic.cover_image)}
                    />
                  </div>
                ) : null}
                <h2 className="text-lg font-semibold tracking-tight text-white group-hover:text-emerald-400/95">
                  {topic.title}
                </h2>
                {topic.description ? (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2">{topic.description}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-500">
                  <span>{topic.article_count || 0} 篇</span>
                  <span className="text-emerald-600/90 group-hover:text-emerald-500">进入 →</span>
                </div>
              </LocalizedLink>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 py-16">暂无专题</p>
      )}
    </div>
  );
}
