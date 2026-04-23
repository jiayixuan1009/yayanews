import { getDictionary } from '@/lib/dictionaries';
import LocalizedLink from '@/components/LocalizedLink';
import type { Metadata } from 'next';
import { createMetadata, buildOrganizationJsonLd, buildWebSiteJsonLd } from '@yayanews/seo';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
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
const SiteLiveSubscriber = dynamic(() => import('@/components/SiteLiveSubscriber'), { ssr: false });
import CtaBanner from '@/components/CtaBanner';
import HomeHeroEditorial from '@/components/editorial/HomeHeroEditorial';
import BreakingStreamBlock from '@/components/editorial/BreakingStreamBlock';
import { stripHtml } from '@/lib/ui-utils';
import CategoryChipsRow from '@/components/editorial/CategoryChipsRow';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';
import { siteConfig } from '@yayanews/types';

export function generateMetadata({ params: { lang } }: { params: { lang: string } }): Metadata {
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en'
      ? 'Live Financial News – US Stocks, Crypto & HK Markets'
      : '鸭鸭财经新闻 今日财经资讯 · 美股、港股、加密货币实时新闻',
    description: locale === 'en'
      ? 'Get today\'s live financial news on US stocks, Hong Kong markets, crypto and derivatives. YayaNews delivers 24/7 AI-powered market intelligence and breaking analysis for investors.'
      : '今日实时财经快讯与深度分析，覆盖美股、港股、加密货币、衍生品市场。7×24小时AI驱动资讯引擎，为投资者快一步提供市场信号与权威解读。',
    url: locale === 'en' ? '/en' : '/zh',
    lang: locale,
    type: 'website',
  });
}

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

// ISR: revalidate every 60s. Real-time freshness is delivered via SSE
// (SiteLiveSubscriber / BreakingStreamBlock), so caching SSR is safe.
export const revalidate = 60;

export default async function HomePage({ params: { lang } }: { params: { lang: string } }) {
  const locale = lang === 'en' ? 'en' : 'zh';
  const dict = await getDictionary(locale);

  // ── Parallelize all independent DB queries (P0: eliminates serial TTFB) ──
  const [articles, flashStream, topics, categories, popularTags, totalArticles, flashMaxId, articleMaxId] =
    await Promise.all([
      getPublishedArticles(locale, 26),
      getFlashNews(locale, 12),
      getTopics(6),
      getCategoriesOrdered(),
      getPopularTags(14),
      getArticleCount(locale),
      getFlashMaxId(locale),
      getPublishedArticleMaxId(locale),
    ]);

  const hasAi = categories.some(c => c.slug === 'ai');
  const insertAiAt = categories.findIndex(c => c.slug === 'other');
  const pos = insertAiAt === -1 ? categories.length : insertAiAt;
  const isEn = locale === 'en';
  const restEntries = categories.map(c => ({
    name: isEn ? (c.name_en || c.name) : c.name,
    slug: c.slug,
    href: `/news/${c.slug}` as const,
    description: c.description ?? '',
  }));
  const categoryEntries = hasAi
    ? [ { name: dict.nav.flash || '快讯', slug: 'flash', href: '/flash' }, ...restEntries]
    : [ { name: dict.nav.flash || '快讯', slug: 'flash', href: '/flash' }, ...restEntries.slice(0, pos), { name: dict.nav.ai || 'AI资讯', slug: 'ai', href: '/news/ai' }, ...restEntries.slice(pos)];

  const chipItems = categoryEntries.map(e => ({
    name: (dict.nav as Record<string, string>)[e.slug] || e.name,
    slug: e.slug,
    href: e.href,
  }));

  const lead = articles[0];
  const secondaries = articles.slice(1, 5);
  const listArticles = articles.slice(5, 13);
  const spotlightArticles = articles.slice(13, 16);
  const watchArticles = articles.slice(16, 22);
  const moreArticles = articles.slice(22, 26);
  const leadTopic = topics[0];

  return (
    <>
      <SiteLiveSubscriber />

      <section className="border-b border-[#ddd5ca] bg-white/90">
        <div className="container-main py-2 text-sm">
          <LiveTicker title={dict.home.liveTicker} tickerUs={(dict.home as Record<string, string>).tickerUs} tickerApac={(dict.home as Record<string, string>).tickerApac} tickerCrypto={(dict.home as Record<string, string>).tickerCrypto} />
        </div>
      </section>
      <HomeHeroEditorial
        lead={lead}
        secondaries={secondaries}
        dict={dict}
        rightRail={
            <BreakingStreamBlock
              items={flashStream}
              title={dict.home.flashTitle}
              emptyText={dict.news.noFlash}
              actionLabel={dict.common.all || '全部'}
              lang={locale}
              className="flex-none h-[400px] sm:h-[600px] xl:h-[1050px] w-full overflow-hidden"
            />
        }
      />      <div className="container-main py-5 md:py-8 lg:py-10">
        <div className="grid gap-5 md:gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="space-y-5 md:space-y-8 lg:col-span-8 lg:space-y-10">
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

            {spotlightArticles.length > 0 ? (
              <section className="border border-[#ddd5ca] bg-white px-4 py-5 md:px-5 md:py-6 sm:px-7">
                <SectionHeader title={dict.home.spotlightTitle || "The Political Compass"} emphasis="strong" />
                <div className="mt-5 grid gap-6 md:grid-cols-3">
                  {spotlightArticles.slice(0, 3).map(item => (
                    <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group block border-t border-[#e9e2d6] pt-4 md:border-t-0 md:pt-0 min-w-0">
                      <h3 className="yn-card-title-lg group-hover:text-[#1d5c4f] line-clamp-3 overflow-hidden">
                        {item.title}
                      </h3>
                      {item.summary ? <p className="mt-3 text-sm leading-7 text-slate-600 line-clamp-4">{stripHtml(item.summary)}</p> : null}
                      <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#7c837d]">
                        <span className="inline-flex h-3.5 w-3.5 rounded-full bg-[#c8d0c7]" />
                        <span>{item.author}</span>
                      </div>
                    </LocalizedLink>
                  ))}
                </div>
              </section>
            ) : null}

            {moreArticles.length > 0 ? (
              <section>
                <SectionHeader title={dict.home.editorsPicks} emphasis="default" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {moreArticles.map(item => (
                    <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group flex flex-col gap-3 min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#1d5c4f] font-semibold">
                        {item.category_name ? ((dict.nav as Record<string, string>)?.[item.category_slug || ''] || item.category_name) : 'Yaya Financial News'}
                      </div>
                      <div className="relative aspect-[16/10] overflow-hidden bg-[#e9e3d8]">
                        <Image 
                          src={getArticleCoverSrc(item.cover_image, undefined, item.source)} 
                          alt={item.title} 
                          fill 
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.05]" 
                          unoptimized={getArticleCoverSrc(item.cover_image, undefined, item.source).endsWith('.svg') || !isRemoteImageOptimizable(getArticleCoverSrc(item.cover_image, undefined, item.source))}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="yn-card-title group-hover:text-[#1d5c4f] line-clamp-3 overflow-hidden">
                          {item.title}
                        </h3>
                        {item.summary ? (
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">{stripHtml(item.summary)}</p>
                        ) : null}
                      </div>
                      <div className="mt-auto flex items-center gap-2 text-[11px] uppercase text-[#667067] tracking-[0.12em]">
                         <span>{item.author}</span>
                         <span className="inline-block w-1 h-1 rounded-full bg-[#c8d0c7]" />
                         <span>{item.published_at?.slice(0, 10)}</span>
                      </div>
                    </LocalizedLink>
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
            <div className="border border-[#ddd5ca] bg-[#f1eeea] px-4 py-5 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="yn-heading">{dict.home?.hotStream || 'Hot Stream'}</h2>
                <span className="text-[#1d5c4f]">⚡</span>
              </div>
              <ol className="space-y-4">
                {secondaries.slice(0, 4).map((item, idx) => (
                  <li key={item.id} className="grid grid-cols-[1.8rem,1fr] gap-3 border-t border-[#dfd8ce] pt-4 first:border-t-0 first:pt-0">
                    <span className="font-display text-[1.6rem] font-bold leading-none text-[#a09890] tabular-nums sm:text-[1.8rem]">{String(idx + 1).padStart(2, '0')}</span>
                    <LocalizedLink href={`/article/${item.slug}`} className="group block min-w-0">
                      <h3 className="yn-card-title text-[#1b201d] group-hover:text-[#1d5c4f] line-clamp-3 overflow-hidden">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-x-2 text-[11px] uppercase tracking-[0.16em] text-[#555a55]">
                        <span>{(dict.nav as Record<string, string>)?.[item.category_slug || ''] || item.category_name || 'Yaya Financial News'}</span>
                        <span>{item.published_at?.slice(0, 10)}</span>
                      </div>
                    </LocalizedLink>
                  </li>
                ))}
              </ol>
            </div>

            <div className="overflow-hidden border border-[#0e4739] bg-[#034433] text-white shadow-[0_16px_40px_rgba(3,68,51,0.18)]">
              <div className="flex items-start justify-between gap-4 p-5 pb-3">
                <div>
                  <h3 className="yn-heading">{dict.home?.mascotCorner || 'Mascot Corner:'}</h3>
                  <p className="yn-heading">{dict.home?.dailyCurations || 'Daily Curations'}</p>
                </div>
                <div className="flex-shrink-0 rounded-full border-2 border-[#8fcb79] bg-[#91f78e]/50 overflow-hidden w-12 h-12 flex items-center justify-center">
                  <Image src="/brand/logo-square.svg" alt="Yaya Financial News" width={48} height={48} className="object-cover" />
                </div>
              </div>
              <div className="px-5 pb-5">
                <p className="max-w-[28ch] text-sm leading-7 text-emerald-50/85">
                  {dict.home?.mascotDesc || 'Curating high-frequency market noise into a readable order of judgment: context, evidence, and finally action signals.'}
                </p>
                <LocalizedLink href="/guide" className="mt-5 inline-flex items-center justify-center rounded-[2px] bg-[#91f78e] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0d3f30] hover:bg-[#7be978]">
                  {dict.home?.readDigest || 'Read digest'}
                </LocalizedLink>
              </div>
            </div>

            {watchArticles.length > 0 ? (
              <RightRailPanel title={dict.home.marketWatch} accent actionHref="/news" actionLabel={dict.common.readMore}>
                <ul className="divide-y divide-[#ece4d8]">
                  {watchArticles.map(item => (
                    <li key={item.id} className="py-3 first:pt-0">
                      <LocalizedLink href={`/article/${item.slug}`} className="group block min-w-0">
                        {item.category_name ? (
                          <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-[#1d5c4f]">
                            {item.category_name}
                          </span>
                        ) : null}
                        <span className="yn-card-title line-clamp-3 group-hover:text-[#1d5c4f] overflow-hidden break-words block">
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
                      #{isEn ? (tag.name_en || tag.name) : tag.name}
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
                        <span className="yn-card-title line-clamp-2">{t.title}</span>
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd(locale)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd(locale)) }}
      />
    </>
  );
}
