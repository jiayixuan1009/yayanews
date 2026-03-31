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
import ArticleCard from '@/components/ArticleCard';
import DerivativesSubTabs from '@/components/DerivativesSubTabs';
import DepthTabs from '@/components/DepthTabs';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

const categoryMeta: Record<string, { title: string; desc: string; label: string; quote: string }> = {
  'us-stock': { title: 'US Equities & Wall Street', desc: '追踪美股三大指数、资金流动与各大机构财报的实时异动分析。', label: 'Desk', quote: 'Price action is just the surface.' },
  'hk-stock': { title: 'Hong Kong & Asian Equities', desc: '洞悉港股大盘、南向资金流向及亚太核心资产的宏观交易逻辑。', label: 'Desk', quote: 'Capital leaves fingerprints.' },
  crypto: { title: 'Cryptocurrency Markets', desc: '从比特币宏观周期、以太坊生态到链上异常资金流动的底层技术档案。', label: 'Desk', quote: 'Narratives move faster than protocols.' },
  derivatives: { title: 'Derivatives & Macro Risks', desc: '深度覆盖期权异动、大宗商品及外汇市场的宏观对冲与博弈信号。', label: 'Desk', quote: 'Volatility is a language of its own.' },
  ai: { title: 'Artificial Intelligence & Tech', desc: '持续追踪大模型演进、算力资本开支与应用层的真实商业落地。', label: 'Desk', quote: 'Automation always arrives in layers.' },
  other: { title: 'The Open Brief', desc: '跨市场、跨主题的补充档案与综合编辑整理。', label: 'Desk', quote: 'What matters rarely fits one beat.' },
};

import { createMetadata } from '@yayanews/seo';

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const meta = categoryMeta[params.category];
  if (!meta) return {};
  return createMetadata({
    title: meta.title,
    description: meta.desc,
    url: `/news/${params.category}`,
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
  const meta = categoryMeta[params.category];
  if (!meta) notFound();

  const depthFilter = searchParams.type || '';
  const articleType = depthFilter === 'deep' ? 'deep' : depthFilter === 'standard' ? 'standard' : undefined;

  const dict = await getDictionary(params.lang as any);
  const articles = await getPublishedArticles(params.lang, 36, 0, params.category, undefined, articleType);
  const categories = await getCategoriesOrdered();
  const isDerivatives = params.category === 'derivatives';

  const countAll = await getArticleCountByType(params.category);
  const countStandard = await getArticleCountByType(params.category, 'standard');
  const countDeep = await getArticleCountByType(params.category, 'deep');

  const featured = articles[0];
  const secondary = articles.slice(1, 4);
  const feed = articles.slice(4);

  const popularTags = await getPopularTags(10);
  const flashMini = await getFlashNews(params.lang, 6);

  const lead = featured ?? null;
  const featureCover = lead ? getArticleCoverSrc(lead.cover_image) : null;
  const featureCoverOpt = featureCover ? isRemoteImageOptimizable(featureCover) : false;

  return (
    <div className="container-main py-6 sm:py-8 lg:py-10">
      <ChannelHeader
        title={meta.title}
        description={meta.desc}
        label={meta.label}
        quote={meta.quote}
        featured={lead}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#ddd5ca] pb-4 lg:mb-8">
        <LocalizedLink href="/news" className="border border-[#ddd5ca] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#667067] hover:text-[#14261f]">
          All desks
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
      />

      {isDerivatives && !articleType ? (
        <DerivativesSubTabs initialArticles={articles} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-12">
          <div className="min-w-0 space-y-10">
            {articles.length === 0 ? (
              <p className="py-16 text-center text-[#667067]">{dict.news.noCategoryNews}</p>
            ) : (
              <>
                <section className="grid gap-6 border-b border-[#ddd5ca] pb-10 lg:grid-cols-[minmax(0,1.25fr)_280px]">
                  <div className="min-w-0">
                    {featureCover ? (
                      <LocalizedLink href={`/article/${lead!.slug}`} className="group block">
                        <div className="relative aspect-[16/9] overflow-hidden border border-[#d9d2c8] bg-[#ece6dc]">
                          <Image
                            src={featureCover}
                            alt={lead!.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 60vw"
                            className="object-cover transition duration-500 group-hover:scale-[1.02]"
                            priority
                            unoptimized={!featureCoverOpt}
                          />
                        </div>
                      </LocalizedLink>
                    ) : null}
                    <div className="pt-4">
                      <p className="yn-meta text-[#1d5c4f]">Featured report</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
                        <span>By {lead!.author}</span>
                        <span>{lead!.published_at?.slice(0, 10)}</span>
                        <span>{lead!.article_type === 'deep' ? '12 min read' : '4 min read'}</span>
                      </div>
                      <LocalizedLink href={`/article/${lead!.slug}`} className="group block">
                        <h2 className="mt-3 max-w-[15ch] font-display text-[2.7rem] font-semibold leading-[0.96] tracking-[-0.05em] text-[#111713] group-hover:text-[#1d5c4f] sm:text-[3.4rem]">
                          {lead!.title}
                        </h2>
                        {lead!.summary ? (
                          <p className="mt-4 max-w-[58ch] font-body text-[1rem] leading-8 text-slate-700">{lead!.summary}</p>
                        ) : null}
                        <span className="mt-6 inline-block border-b border-[#14261f] pb-1 text-[11px] uppercase tracking-[0.18em] text-[#14261f]">Read full investigation →</span>
                      </LocalizedLink>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {secondary.map(item => {
                      const cover = getArticleCoverSrc(item.cover_image);
                      const opt = isRemoteImageOptimizable(cover);
                      return (
                        <LocalizedLink key={item.id} href={`/article/${item.slug}`} className="group grid gap-3 border-b border-[#ddd5ca] pb-4 last:border-b-0 last:pb-0" style={{ gridTemplateColumns: '98px minmax(0,1fr)' }}>
                          <div className="relative h-[98px] overflow-hidden border border-[#d9d2c8] bg-[#ece6dc]">
                            <Image src={cover} alt={item.title} fill sizes="98px" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={!opt} />
                          </div>
                          <div className="min-w-0">
                            <p className="yn-meta text-[#1d5c4f]">{item.article_type === 'deep' ? 'Deep dive' : item.category_name || 'Briefing'}</p>
                            <h3 className="mt-1 font-display text-[1.5rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#14261f] group-hover:text-[#1d5c4f] line-clamp-3">
                              {item.title}
                            </h3>
                            {item.summary ? <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-2">{item.summary}</p> : null}
                          </div>
                        </LocalizedLink>
                      );
                    })}
                  </div>
                </section>

                <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div>
                    <SectionHeader title={dict.home.newestTitle} emphasis="default" className="mb-5" />
                    <div className="space-y-4">
                      {feed.map(a => (
                        <ArticleCard key={a.id} article={a} />
                      ))}
                    </div>
                    {feed.length > 0 ? (
                      <div className="mt-8 border border-[#ddd5ca] bg-[#fbf8f4] px-5 py-3 text-center text-[11px] uppercase tracking-[0.18em] text-[#14261f]">
                        Load more archive entries
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-5">
                    <RightRailPanel title="The Mascot’s Brief" accent className="bg-white">
                      <p className="text-sm leading-7 text-slate-700">
                        今日这条栏目线更值得你看的，不一定是 headline，而是被忽略的底层变量。
                      </p>
                      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                        <li>• 为什么交易拥挤度比 headline 更重要</li>
                        <li>• 哪些二级信号正在提前反映风险偏好</li>
                        <li>• 应该先看谁在定价，而不是谁在发声</li>
                      </ul>
                    </RightRailPanel>

                    <RightRailPanel title="Pulse of the Planet" className="border-[#0f4a39] bg-[#0f4a39] text-white">
                      <p className="text-sm leading-7 text-white/80">A curated weekly newsletter on the shifts that matter.</p>
                      <div className="mt-4 space-y-2">
                        <input
                          type="email"
                          placeholder="Your editorial email..."
                          className="w-full border border-white/15 bg-[#0a372b] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
                        />
                        <button className="w-full border border-[#7ae88a] bg-[#9cff8f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0e2a1f]">
                          Enroll in the archive
                        </button>
                      </div>
                    </RightRailPanel>

                    <RightRailPanel title={dict.news.popularTags}>
                      <div className="flex flex-wrap gap-2">
                        {popularTags.map(tag => (
                          <LocalizedLink
                            key={tag.id}
                            href={`/tag/${tag.slug}`}
                            className="border border-[#ddd5ca] bg-[#f5f1ea] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#667067] hover:text-[#14261f]"
                          >
                            #{tag.name}
                          </LocalizedLink>
                        ))}
                      </div>
                    </RightRailPanel>

                    <RightRailPanel title={dict.news.flashSnippets} actionHref="/flash" actionLabel="7×24">
                      {flashMini.length === 0 ? (
                        <p className="yn-meta text-[#667067]">{dict.news.noFlash}</p>
                      ) : (
                        <ul className="space-y-3">
                          {flashMini.slice(0, 4).map(f => (
                            <li key={f.id} className="border-b border-[#ece4d9] pb-3 last:border-b-0 last:pb-0">
                              <span className="yn-meta tabular-nums">{f.published_at?.slice(5, 16) ?? '—'}</span>
                              <p className="mt-1 text-sm leading-6 text-slate-700">{f.title}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </RightRailPanel>
                  </div>
                </section>
              </>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border-l border-[#ddd5ca] pl-6">
              <p className="yn-meta mb-4">{dict.news.channelIndex}</p>
              <div className="space-y-3">
                {categories.map((c, idx) => (
                  <LocalizedLink
                    key={c.slug}
                    href={`/news/${c.slug}`}
                    className={`block border-b pb-2 text-sm uppercase tracking-[0.16em] ${c.slug === params.category ? 'text-[#14261f]' : 'text-[#667067] hover:text-[#14261f]'}`}
                  >
                    <span className="mr-2 text-[#8a938b]">{String(idx + 1).padStart(2, '0')}</span>
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
