import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  getPublishedArticles,
  getCategoriesOrdered,
  getArticleCountByType,
  getPopularTags,
  getFlashNews,
} from '@/lib/queries';
import { encodeFlashSlug, stripHtml } from '@/lib/ui-utils';
import ArticleCard from '@/components/ArticleCard';
import DerivativesSubTabs from '@/components/DerivativesSubTabs';
import DepthTabs from '@/components/DepthTabs';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';


import { createMetadata } from '@yayanews/seo';

export async function generateMetadata({ params }: { params: { category: string; lang: string } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang as any);
  const meta = (dict as any).categoryMeta?.[params.category];
  if (!meta) return {};
  return createMetadata({
    title: meta.title,
    description: meta.desc,
    url: `/${params.lang}/news/${params.category}`,
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { category: string; lang: string };
  searchParams: { type?: string };
}) {
  const dict = await getDictionary(params.lang as any);
  const meta = (dict as any).categoryMeta?.[params.category];
  if (!meta) notFound();

  const depthFilter = searchParams.type || '';
  const articleType = depthFilter === 'deep' ? 'deep' : depthFilter === 'standard' ? 'standard' : undefined;

  const articles = await getPublishedArticles(params.lang, 36, 0, params.category, undefined, articleType);
  const categories = await getCategoriesOrdered();
  const isDerivatives = params.category === 'derivatives';

  const countAll = await getArticleCountByType(params.category);
  const countStandard = await getArticleCountByType(params.category, 'standard');
  const countDeep = await getArticleCountByType(params.category, 'deep');

  const featured = articles[0];
  const secondary = articles.slice(1, 3);
  const tertiary = articles.slice(3, 6);
  const feed = articles.slice(6);

  const popularTags = await getPopularTags(10);
  const flashMini = await getFlashNews(params.lang, 6);

  const lead = featured ?? null;
  const featureCover = lead ? getArticleCoverSrc(lead.cover_image, undefined, lead.source) : null;
  const featureCoverOpt = featureCover ? isRemoteImageOptimizable(featureCover) : false;

  return (
    <div className="container-main py-6 sm:py-8 lg:py-10">
      <ChannelHeader
        lang={params.lang}
        dict={dict}
        title={meta.title}
        description={meta.desc}
        label={meta.label}
        quote={meta.quote}
        featured={lead}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#ddd5ca] pb-4 lg:mb-8">
        <LocalizedLink href="/news" className="border border-[#ddd5ca] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#667067] hover:text-[#14261f]">
          {params.lang === 'zh' ? '全部分类' : 'All desks'}
        </LocalizedLink>
        {categories.map(c => (
          <LocalizedLink
            key={c.slug}
            href={`/news/${c.slug}`}
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
              c.slug === params.category
                ? 'border-[#14261f] bg-white text-[#14261f]'
                : 'border-[#ddd5ca] bg-[#f7f4ee] text-[#667067] hover:text-[#14261f]'
            }`}
          >
            {c.name}
          </LocalizedLink>
        ))}
      </div>

      <DepthTabs
        baseUrl={`/news/${params.category}`}
        current={depthFilter}
        counts={{ all: countAll, standard: countStandard, deep: countDeep }}
        lang={params.lang}
      />

      {isDerivatives && !articleType ? (
        <DerivativesSubTabs initialArticles={articles} lang={params.lang} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-12 xl:gap-12">
          {/* Main Content Area */}
          <div className="min-w-0 lg:col-span-8 xl:col-span-9">
            {articles.length === 0 ? (
              <p className="py-16 text-center text-[#667067]">{dict.news.noCategoryNews}</p>
            ) : (
              <>
                {/* Top Section: Hero (2/3) + Secondary (1/3) */}
                <section className="grid gap-6 border-b border-[#ddd5ca] pb-8 md:grid-cols-3">
                  {/* Hero */}
                  <div className="md:col-span-2 md:border-r border-[#ddd5ca] md:pr-6">
                    {featureCover && lead ? (
                      <LocalizedLink href={`/article/${lead.slug}`} className="group block">
                        <div className="relative aspect-[16/9] overflow-hidden border border-[#d9d2c8] bg-[#ece6dc]">
                          <Image
                            src={featureCover}
                            alt={lead.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 60vw"
                            className="object-cover transition duration-500 group-hover:scale-[1.02]"
                            priority
                            unoptimized={!featureCoverOpt}
                          />
                        </div>
                      </LocalizedLink>
                    ) : null}
                    {lead && (
                      <div className="pt-4">
                        <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
                          <span className="text-[#1d5c4f] font-semibold">{dict.news.featuredReport}</span>
                          <span>•</span>
                          <span>{lead.published_at?.slice(0, 10)}</span>
                          <span>•</span>
                          <span>{lead.article_type === 'deep' ? dict.news.deepDive : dict.news.briefing}</span>
                        </div>
                        <LocalizedLink href={`/article/${lead.slug}`} className="group block">
                          <h2 className="yn-title-xl mt-2 text-[#111713] group-hover:text-[#1d5c4f]">
                            {lead.title}
                          </h2>
                          {lead.summary && (
                            <p className="mt-3 max-w-[65ch] font-body text-[1.05rem] leading-relaxed text-slate-700">{stripHtml(lead.summary)}</p>
                          )}
                        </LocalizedLink>
                      </div>
                    )}
                  </div>

                  {/* Secondary (2 items stacked) */}
                  <div className="md:col-span-1 flex flex-col gap-6">
                    {secondary.map(item => {
                      const cover = getArticleCoverSrc(item.cover_image, undefined, item.source);
                      const opt = isRemoteImageOptimizable(cover);
                      return (
                        <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group flex flex-col gap-3">
                          <div className="relative aspect-[16/9] overflow-hidden border border-[#d9d2c8] bg-[#ece6dc]">
                            <Image src={cover} alt={item.title} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={!opt} />
                          </div>
                          <div>
                            <p className="yn-meta text-[#1d5c4f]">{item.category_name}</p>
                            <h3 className="yn-card-title mt-1 text-[#14261f] group-hover:text-[#1d5c4f]">
                              {item.title}
                            </h3>
                          </div>
                        </LocalizedLink>
                      );
                    })}
                  </div>
                </section>

                {/* Tertiary Section: 3 items in a row */}
                {tertiary.length > 0 && (
                  <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-b border-[#ddd5ca] pb-8">
                    {tertiary.map(item => {
                      const cover = getArticleCoverSrc(item.cover_image, undefined, item.source);
                      const opt = isRemoteImageOptimizable(cover);
                      return (
                        <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group flex flex-col gap-3 relative sm:border-r border-[#ece4d9] sm:pr-6 last:border-r-0 last:pr-0">
                          <div className="min-w-0">
                            <h3 className="yn-card-title mt-1 text-[#14261f] group-hover:text-[#1d5c4f] line-clamp-4">
                              {item.title}
                            </h3>
                            <p className="yn-meta text-[#667067] mt-2">{item.published_at?.slice(5, 16)}</p>
                          </div>
                        </LocalizedLink>
                      );
                    })}
                  </section>
                )}

                {/* Feed Section: Standard 2-col masonry or list */}
                <section className="pt-8">
                  <SectionHeader title={dict.home.newestTitle} emphasis="default" className="mb-6" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    {feed.map(a => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                  {feed.length > 0 && (
                    <div className="mt-8 border-t border-[#ddd5ca] pt-6 text-center">
                      <span className="inline-block border border-[#14261f] px-6 py-2 text-[11px] uppercase tracking-[0.18em] text-[#14261f] hover:bg-[#14261f] hover:text-[#f6f3ee] transition-colors cursor-pointer">
                        {dict.news.loadMore}
                      </span>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Rigid Right Rail */}
          <aside className="lg:col-span-4 xl:col-span-3 lg:border-l border-[#ddd5ca] lg:pl-8 space-y-8">
            <RightRailPanel title={dict.news.flashSnippets} actionHref="/flash" actionLabel={dict.news.live} accent className="bg-white">
              {flashMini.length === 0 ? (
                <p className="yn-meta text-[#667067]">{dict.news.noFlash}</p>
              ) : (
                <ul className="space-y-4">
                  {flashMini.slice(0, 5).map(f => (
                    <li key={f.id} className="border-b border-dashed border-[#ece4d9] pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#cc3333] shrink-0"></span>
                        <span className="yn-meta tabular-nums text-[#cc3333]">{f.published_at?.slice(11, 16) ?? '—'}</span>
                      </div>
                      <LocalizedLink href={`/flash/${encodeFlashSlug(f as any)}`} className="group block">
                        <p className="text-[0.95rem] leading-relaxed text-[#14261f] group-hover:text-[#1d5c4f] transition-colors">{f.title}</p>
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              )}
            </RightRailPanel>

            <RightRailPanel title={dict.news.popularTags}>
              <div className="flex flex-wrap gap-2">
                {popularTags.map(tag => (
                  <LocalizedLink
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="border border-[#ddd5ca] bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#667067] hover:border-[#14261f] hover:text-[#14261f] transition-colors"
                  >
                    #{tag.name}
                  </LocalizedLink>
                ))}
              </div>
            </RightRailPanel>
            
            <div className="sticky top-24 pt-6 border-t border-[#ddd5ca]">
              <p className="yn-meta mb-4 font-semibold text-[#14261f]">{dict.news.channelIndex}</p>
              <div className="space-y-3 flex flex-col">
                {categories.map((c) => (
                  <LocalizedLink key={c.slug} href={`/news/${c.slug}`} className="text-sm text-slate-600 hover:text-[#14261f] hover:underline underline-offset-4 decoration-[#ddd5ca]">
                    {c.name}
                  </LocalizedLink>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
