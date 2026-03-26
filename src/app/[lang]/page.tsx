import LocalizedLink from '@/components/LocalizedLink';
import dynamic from 'next/dynamic';
import {
  getPublishedArticles,
  getFlashNews,
  getTopics,
  getCategoriesOrdered,
  getPopularTags,
  getArticleCount,
  getFlashMaxId,
  getPublishedArticleMaxId,
} from '@/lib/queries';
import { FLASH_ENTRY, AI_ENTRY } from '@/lib/constants';
import ArticleCard from '@/components/ArticleCard';
import SiteLiveSubscriber from '@/components/SiteLiveSubscriber';
import CtaBanner from '@/components/CtaBanner';
import HomeHeroEditorial from '@/components/editorial/HomeHeroEditorial';
import BreakingStreamBlock from '@/components/editorial/BreakingStreamBlock';
import CategoryChipsRow from '@/components/editorial/CategoryChipsRow';
import TopicBanner from '@/components/editorial/TopicBanner';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';
import { siteConfig } from '@/lib/types';

const LiveTicker = dynamic(() => import('@/components/LiveTicker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-6 py-3">
      <span className="flex-shrink-0 font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f]">实时行情</span>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className="h-4 w-28 flex-shrink-0 animate-pulse rounded bg-[#e5ddd2]" />
      ))}
    </div>
  ),
});

export const revalidate = 15;

export default function HomePage({ params: { lang } }: { params: { lang: string } }) {
  const articles = getPublishedArticles(lang, 22);
  const flashStream = getFlashNews(lang, 12);
  const topics = getTopics(6);
  const categories = getCategoriesOrdered();
  const popularTags = getPopularTags(14);
  const hasAi = categories.some(c => c.slug === 'ai');
  const insertAiAt = categories.findIndex(c => c.slug === 'other');
  const pos = insertAiAt === -1 ? categories.length : insertAiAt;
  const restEntries = categories.map(c => ({
    name: c.name,
    slug: c.slug,
    href: `/news/${c.slug}` as const,
    description: c.description ?? '',
  }));
  const categoryEntries = hasAi
    ? [FLASH_ENTRY, ...restEntries]
    : [FLASH_ENTRY, ...restEntries.slice(0, pos), AI_ENTRY, ...restEntries.slice(pos)];

  const chipItems = categoryEntries.map(e => ({
    name: e.name,
    slug: e.slug,
    href: e.href,
  }));

  const totalArticles = getArticleCount();
  const lead = articles[0];
  const secondaries = articles.slice(1, 5);
  const listArticles = articles.slice(5, 13);
  const watchArticles = articles.slice(13, 19);
  const spotlightArticles = articles.slice(8, 12);
  const moreArticles = articles.slice(19);
  const flashMaxId = getFlashMaxId(lang);
  const articleMaxId = getPublishedArticleMaxId(lang);
  const leadTopic = topics[0];

  return (
    <>
      <SiteLiveSubscriber flashMaxId={flashMaxId} articleMaxId={articleMaxId} />

      <HomeHeroEditorial lead={lead} secondaries={secondaries} />

      <section className="border-b border-[#ddd5ca] bg-white/90">
        <div className="container-main py-2 text-sm">
          <LiveTicker />
        </div>
      </section>

      <section className="border-b border-[#ddd5ca] bg-[#fbf8f4]">
        <div className="container-main py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="yn-meta">频道导航</span>
            <LocalizedLink href="/news" className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f] hover:text-[#143d33]">
              资讯总览
            </LocalizedLink>
          </div>
          <CategoryChipsRow items={chipItems} />
        </div>
      </section>

      <div className="container-main py-8 sm:py-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="space-y-8 lg:col-span-8 lg:space-y-10">
            <BreakingStreamBlock items={flashStream} />

            {leadTopic ? (
              <TopicBanner
                title={leadTopic.title}
                description={leadTopic.description}
                href={`/topics/${leadTopic.slug}`}
              />
            ) : null}

            {spotlightArticles.length > 0 ? (
              <section className="border border-[#ddd5ca] bg-white px-5 py-6 sm:px-7">
                <SectionHeader title="The Political Compass" emphasis="strong" />
                <div className="mt-5 grid gap-6 md:grid-cols-3">
                  {spotlightArticles.slice(0, 3).map(item => (
                    <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group block border-t border-[#e9e2d6] pt-4 md:border-t-0 md:pt-0">
                      <h3 className="font-display text-[1.85rem] font-semibold leading-[1.03] tracking-[-0.04em] text-[#13211b] group-hover:text-[#1d5c4f]">
                        {item.title}
                      </h3>
                      {item.summary ? <p className="mt-3 text-sm leading-7 text-slate-600 line-clamp-4">{item.summary}</p> : null}
                      <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#7c837d]">
                        <span className="inline-flex h-3.5 w-3.5 rounded-full bg-[#c8d0c7]" />
                        <span>{item.author}</span>
                      </div>
                    </LocalizedLink>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <SectionHeader
                title="最新资讯"
                emphasis="strong"
                actionHref="/news"
                actionLabel={`全部 · ${totalArticles}`}
              />
              {listArticles.length > 0 ? (
                <div className="space-y-3">
                  {listArticles.map(a => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-slate-500">暂无更多列表稿件</p>
              )}
            </section>

            {moreArticles.length > 0 ? (
              <section>
                <SectionHeader title="编辑继续关注" emphasis="default" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {moreArticles.map(a => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="text-center">
              <LocalizedLink href="/news" className="btn-primary text-sm">
                查看更多资讯
              </LocalizedLink>
            </div>
          </div>

          <aside className="space-y-5 lg:col-span-4 lg:space-y-6">
            {watchArticles.length > 0 ? (
              <RightRailPanel title="市场观察" accent actionHref="/news" actionLabel="更多">
                <ul className="divide-y divide-[#ece4d8]">
                  {watchArticles.map(item => (
                    <li key={item.id} className="py-3 first:pt-0">
                      <LocalizedLink href={`/article/${item.slug}`} className="group block">
                        {item.category_name ? (
                          <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-[#1d5c4f]">
                            {item.category_name}
                          </span>
                        ) : null}
                        <span className="line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight text-[#14261f] group-hover:text-[#1d5c4f]">
                          {item.title}
                        </span>
                        <span className="mt-2 block text-xs text-slate-500">{item.published_at?.slice(0, 16)}</span>
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </RightRailPanel>
            ) : null}

            <RightRailPanel title="热门标签" accent actionHref="/search" actionLabel="搜索">
              {popularTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {popularTags.map(tag => (
                    <LocalizedLink
                      key={tag.id}
                      href={`/tag/${tag.slug}`}
                      className="rounded-full border border-[#ddd5ca] bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-[#bfb4a5] hover:text-[#143d33]"
                    >
                      #{tag.name}
                    </LocalizedLink>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">暂无标签数据</p>
              )}
            </RightRailPanel>

            {topics.length > 1 ? (
              <RightRailPanel title="更多专题" actionHref="/topics" actionLabel="全部">
                <ul className="divide-y divide-[#ece4d8]">
                  {topics.slice(1, 6).map(t => (
                    <li key={t.id}>
                      <LocalizedLink
                        href={`/topics/${t.slug}`}
                        className="flex items-center justify-between gap-2 py-3 text-slate-700 hover:text-[#1d5c4f]"
                      >
                        <span className="line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight">{t.title}</span>
                        {t.article_count !== undefined ? (
                          <span className="shrink-0 text-xs text-slate-500 tabular-nums">{t.article_count}</span>
                        ) : null}
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </RightRailPanel>
            ) : null}

            <CtaBanner />

            <RightRailPanel title="新手指南" accent>
              <p className="font-body leading-7 text-slate-600">
                从零了解美股、港股、加密货币与衍生品基础；编辑向结构，非营销落地页。
              </p>
              <LocalizedLink href="/guide" className="mt-4 inline-block font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f] hover:text-[#143d33]">
                进入指南 →
              </LocalizedLink>
            </RightRailPanel>
          </aside>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: siteConfig.siteName,
            url: siteConfig.siteUrl,
            description: siteConfig.description,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteConfig.siteUrl}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </>
  );
}
