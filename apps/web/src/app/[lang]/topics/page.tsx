import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { getTopics } from '@/lib/queries';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import { createMetadata } from '@yayanews/seo';
import { getDictionary } from '@/lib/dictionaries';
import SectionHeader from '@/components/editorial/SectionHeader';

export function generateMetadata({ params: { lang } }: { params: { lang: 'zh' | 'en' } }): Metadata {
  const isZh = lang !== 'en';
  return createMetadata({
    title: isZh ? '热门专题 | 金融市场重大事件深度追踪' : 'Trending Topics | Deep Financial Market Event Tracking',
    description: isZh
      ? '金融市场热门专题聚合，深度追踪美股、港股、加密货币、衍生品市场重大事件'
      : 'Aggregated financial market trending topics. Deep tracking of major events in US stocks, HK stocks, crypto and derivatives markets.',
    url: '/topics',
    lang,
  });
}

// ISR: topic list changes slowly; 2min cache keeps TTFB low.
export const revalidate = 120;

export default async function TopicsPage({ params: { lang } }: { params: { lang: string } }) {
  const dict = await getDictionary(lang);
  const rawTopics = await getTopics(50);
  const topics = rawTopics.filter(t => (t.article_count || 0) > 0 && !(t.slug || '').toLowerCase().includes('sora'));
  const isZh = lang !== 'en';
  const t = dict.topics;

  return (
    <div className="container-main py-6 sm:py-8">
      <header className="mb-8 border-b border-[#ddd5ca] pb-6">
        <h1 className="yn-page-title">{t.pageTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#667067]">{t.pageDesc}</p>
      </header>

      {topics.length > 0 ? (
        <>
          <SectionHeader title={t.allTopics} emphasis="strong" className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, idx) => {
              const name = isZh
                ? (topic.name_zh || topic.title || topic.slug)
                : (topic.name_en || topic.title || topic.slug);
              const desc = isZh
                ? (topic.description_zh || topic.description)
                : (topic.description_en || topic.description);
              const coverImg = topic.cover_image || topic.latest_cover_image || null;
              return (
                <LocalizedLink
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="card group flex flex-col rounded-yn-md p-5 border border-[#eae4dc] bg-white transition-colors hover:border-[#bfb4a5] shadow-sm"
                >
                  {coverImg ? (
                    <div className="relative mb-4 aspect-video overflow-hidden rounded-[4px] border border-[#f2ede9] bg-[#f8f5f0]">
                      <Image
                        src={coverImg}
                        alt={name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-opacity duration-200 group-hover:opacity-95"
                        priority={idx < 3}
                        unoptimized={!isRemoteImageOptimizable(coverImg)}
                      />
                    </div>
                  ) : null}
                  <h2 className="yn-card-title group-hover:text-[#1d5c4f]">
                    {name}
                  </h2>
                  {desc ? (
                    <p className="mt-2 text-sm text-[#4a5250] line-clamp-2">{desc}</p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between border-t border-[#f2ede9] pt-3 text-xs font-semibold text-[#68746c]">
                    <span>{t.articleCount.replace('{count}', String(topic.article_count || 0))}</span>
                    <span className="text-[#1d5c4f] opacity-80 group-hover:opacity-100">{t.readTopic}</span>
                  </div>
                </LocalizedLink>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 py-16">{t.noTopics}</p>
      )}
    </div>
  );
}
