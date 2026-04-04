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

export const revalidate = 0;

export default async function TopicsPage() {
  const topics = await getTopics(50);
  
  return (
    <div className="container-main py-6 sm:py-8">
      <header className="mb-8 border-b border-[#ddd5ca] pb-6">
        <h1 className="text-2xl font-black tracking-tight text-black md:text-3xl">热门专题</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#667067]">持续追踪市场重大事件，沉淀深度知识图谱。</p>
      </header>

      {topics.length > 0 ? (
        <>
          <SectionHeader title="全部专题" emphasis="strong" className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, idx) => (
              <LocalizedLink
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="card group flex flex-col rounded-yn-md p-5 border border-[#eae4dc] bg-white transition-colors hover:border-[#bfb4a5] shadow-sm"
              >
                {topic.cover_image ? (
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-[4px] border border-[#f2ede9] bg-[#f8f5f0]">
                    <Image
                      src={topic.cover_image}
                      alt={topic.name_zh || topic.title || topic.slug}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-opacity duration-200 group-hover:opacity-95"
                      priority={idx < 3}
                      unoptimized={!isRemoteImageOptimizable(topic.cover_image)}
                    />
                  </div>
                ) : null}
                <h2 className="text-lg font-bold tracking-tight text-[#101713] group-hover:text-[#1d5c4f]">
                  {topic.name_zh || topic.title || topic.slug}
                </h2>
                {(topic.description_zh || topic.description) ? (
                  <p className="mt-2 text-sm text-[#4a5250] line-clamp-2">{topic.description_zh || topic.description}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between border-t border-[#f2ede9] pt-3 text-xs font-semibold text-[#8a948e]">
                  <span>{topic.article_count || 0} 篇报道</span>
                  <span className="text-[#1d5c4f] opacity-80 group-hover:opacity-100">阅读专题 →</span>
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
