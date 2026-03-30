import { getDictionary } from '@/lib/dictionaries';
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
      <span className="flex-shrink-0 font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f]">Live Ticker</span>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className="h-4 w-28 flex-shrink-0 animate-pulse rounded bg-[#e5ddd2]" />
      ))}
    </div>
  ),
});

export const revalidate = 15;

export default async function HomePage({ params: { lang } }: { params: { lang: string } }) {
  const dict = await getDictionary(lang as any);
  const articles = await getPublishedArticles(lang, 22);
  const flashStream = await getFlashNews(lang, 12);
  const topics = await getTopics(6);
  const categories = await getCategoriesOrdered();
  const popularTags = await getPopularTags(14);
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
    ? [ { name: dict.nav.flash || '快讯', slug: 'flash', href: '/flash' }, ...restEntries]
    : [ { name: dict.nav.flash || '快讯', slug: 'flash', href: '/flash' }, ...restEntries.slice(0, pos), { name: dict.nav.ai || 'AI资讯', slug: 'ai', href: '/news/ai' }, ...restEntries.slice(pos)];

  const chipItems = categoryEntries.map(e => ({
    name: (dict.nav as any)[e.slug] || e.name,
    slug: e.slug,
    href: e.href,
  }));

  const totalArticles = await getArticleCount();
  const lead = articles[0];
  const secondaries = articles.slice(1, 5);
  const listArticles = articles.slice(5, 13);
  const watchArticles = articles.slice(13, 19);
  const spotlightArticles = articles.slice(8, 12);
  const moreArticles = articles.slice(19);
  const flashMaxId = await getFlashMaxId(lang);
  const articleMaxId = await getPublishedArticleMaxId(lang);
  const leadTopic = topics[0];

  return (
    <>
      <SiteLiveSubscriber />

      <HomeHeroEditorial lead={lead} secondaries={secondaries} dict={dict} />

      <section className="border-b border-[#ddd5ca] bg-white/90">
        <div className="container-main py-2 text-sm">
          <LiveTicker title={dict.home.liveTicker} />
        </div>
      </section>

      <section className="border-b border-[#ddd5ca] bg-[#fbf8f4]">
        <div className="container-main py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="yn-meta">{dict.home.channelNav}</span>
            <LocalizedLink href="/news" className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f] hover:text-[#143d33]">
              {dict.home.newsOverview || '资讯总览'}
            </LocalizedLink>
          </div>
          <CategoryChipsRow items={chipItems} />
        </div>
      </section>

      <div className="container-main py-5 md:py-8 lg:py-10">
        <div className="grid gap-5 md:gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="space-y-5 md:space-y-8 lg:col-span-8 lg:space-y-10">
            <BreakingStreamBlock items={flashStream} title={dict.home.flashTitle} emptyText={dict.news.noFlash || '暂无快讯'} actionLabel={dict.common.all || '全部'} />

            {leadTopic ? (
              <TopicBanner
                title={leadTopic.title}
                description={leadTopic.description}
                href={`/topics/${leadTopic.slug}`}
              />
            ) : null}

            {spotlightArticles.length > 0 ? (
              <section className="border border-[#ddd5ca] bg-white px-4 py-5 md:px-5 md:py-6 sm:px-7">
                <SectionHeader title={dict.home.spotlightTitle || "The Political Compass"} emphasis="strong" />
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
                title={dict.home.newestTitle}
                emphasis="strong"
                actionHref="/news"
                actionLabel={`${dict.common.all} · ${totalArticles}`}
              />
              {listArticles.length > 0 ? (
                <div className="space-y-3">
                  {listArticles.map(a => (
                    <ArticleCard key={a.id} article={a} dict={dict} />
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-slate-500">{dict.common.noData}</p>
              )}
            </section>

            {moreArticles.length > 0 ? (
              <section>
                <SectionHeader title={dict.home.editorsPicks} emphasis="default" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {moreArticles.map(a => (
                    <ArticleCard key={a.id} article={a} dict={dict} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="text-center">
              <LocalizedLink href="/news" className="btn-primary text-sm">
                {dict.home.moreArticlesBtn || '查看更多资讯'}
              </LocalizedLink>
            </div>
          </div>

          <aside className="space-y-4 md:space-y-5 lg:col-span-4 lg:space-y-6">
            {watchArticles.length > 0 ? (
              <RightRailPanel title={dict.home.marketWatch} accent actionHref="/news" actionLabel={dict.common.readMore}>
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

            <RightRailPanel title={dict.home.popularTags} accent actionHref="/search" actionLabel={dict.common.search}>
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
                <p className="text-sm text-slate-500">{dict.home.noTags}</p>
              )}
            </RightRailPanel>

            {topics.length > 1 ? (
              <RightRailPanel title={dict.home.moreTopics} actionHref="/topics" actionLabel={dict.common.all}>
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

            <CtaBanner dict={dict} />

            <RightRailPanel title={dict.home.guideTitle} accent>
              <p className="font-body leading-7 text-slate-600">
                {dict.home.guideDesc}
              </p>
              <LocalizedLink href="/guide" className="mt-4 inline-block font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f] hover:text-[#143d33]">
                {dict.home.enterGuide}
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
