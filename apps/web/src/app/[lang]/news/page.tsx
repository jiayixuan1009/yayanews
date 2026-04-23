import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import { createMetadata } from '@yayanews/seo';
import LocalizedLink from '@/components/LocalizedLink';
import {
  getPublishedArticles,
  getCategoriesOrdered,
  getArticleCountByType,
  getPopularTags,
  getFlashNews,
} from '@/lib/queries';
import { encodeFlashSlug } from '@/lib/ui-utils';
import ArticleCard from '@/components/ArticleCard';
import DepthTabs from '@/components/DepthTabs';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';

export function generateMetadata({ params, searchParams }: { params: { lang: string }; searchParams: { page?: string } }): Metadata {
  const isZh = params.lang !== 'en';
  const page = parseInt(searchParams.page || '1', 10);
  return createMetadata({
    title: isZh ? '金融新闻深度分析 | 美股·港股·加密货币·衍生品' : 'Financial News & In-Depth Analysis | US Stocks, Crypto, HK Markets',
    description: isZh
      ? '浏览鸭鸭财经全站深度分析与实时资讯，覆盖美股指数、港股蓝筹、比特币行情、黄金原油等核心资产。专业量化与AI驱动编辑团队，为投资者提供精准市场解读。'
      : 'Browse YayaNews in-depth financial analysis and breaking news across US equities, HK stocks, Bitcoin, crypto, gold and oil. Expert-curated and AI-powered market coverage for professional investors.',
    url: '/news',
    lang: params.lang as 'zh' | 'en',
    noIndex: page > 1, // P2 SEO: pagination pages excluded from index to prevent duplicate content
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function NewsPage({ 
  searchParams, 
  params 
}: { 
  searchParams: { page?: string; type?: string };
  params: { lang: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const depthFilter = searchParams.type || '';
  const articleType = depthFilter === 'deep' ? 'deep' : depthFilter === 'standard' ? 'standard' : undefined;

  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const locale = params.lang === 'en' ? 'en' : 'zh';
  const dict = await getDictionary(locale);
  const articles = await getPublishedArticles(locale, pageSize, offset, undefined, undefined, articleType);
  const total = await getArticleCountByType(undefined, articleType, locale);
  const totalPages = Math.ceil(total / pageSize);
  const categories = await getCategoriesOrdered();

  const countAll = await getArticleCountByType(undefined, undefined, locale);
  const countStandard = await getArticleCountByType(undefined, 'standard', locale);
  const countDeep = await getArticleCountByType(undefined, 'deep', locale);

  const popularTags = await getPopularTags(12);
  const flashMini = await getFlashNews(locale, 6);

  const featured = articles[0];
  const subFeatured = articles.slice(1, 3);
  const feed = articles.slice(3);

  return (
    <div className="container-main py-6 sm:py-8">
      <ChannelHeader
        lang={locale}
        dict={dict}
        title={locale === 'zh' ? '最新资讯' : 'Latest News'}
        description={locale === 'zh' ? '全站稿件总览；按深度与栏目筛选，与单频道页共用同一套编辑组件语言。' : 'All articles overview; filter by depth and category.'}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <LocalizedLink
          href="/news"
          className="badge border border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
        >
          {dict.common.all}
        </LocalizedLink>
        {categories.map(c => (
          <LocalizedLink
            key={c.slug}
            href={`/news/${c.slug}`}
            className="badge border border-transparent bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {locale === 'en' ? (c.name_en || c.name) : c.name}
          </LocalizedLink>
        ))}
      </div>

      <DepthTabs
        baseUrl="/news"
        current={depthFilter}
        counts={{ all: countAll, standard: countStandard, deep: countDeep }}
        lang={locale}
      />

      {articles.length === 0 ? (
        <p className="py-16 text-center text-slate-500">{dict.common.noData}</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            {page === 1 && !articleType ? (
              <section className="mb-8 space-y-4">
                <SectionHeader title={dict.news.todayFocus} emphasis="strong" />
                {featured ? <ArticleCard article={featured} featured priority /> : null}
                {subFeatured.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {subFeatured.map(a => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {page === 1 && !articleType && feed.length > 0 ? (
              <>
                <SectionHeader title={dict.home.moreList} emphasis="default" />
                <div className="space-y-3">
                  {feed.map(a => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </>
            ) : null}

            {(page > 1 || articleType) && articles.length > 0 ? (
              <>
                <SectionHeader title={dict.news.newsList} emphasis="default" />
                <div className="space-y-3">
                  {articles.map(a => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </>
            ) : null}

            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {page > 1 && (
                  <LocalizedLink
                    href={`/news?page=${page - 1}${depthFilter ? `&type=${depthFilter}` : ''}`}
                    className="btn-primary text-sm"
                  >
                    {dict.common.prevPage}
                  </LocalizedLink>
                )}
                <span className="yn-meta px-2">
                  {dict.common.pageIndicator.replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}
                </span>
                {page < totalPages && (
                  <LocalizedLink
                    href={`/news?page=${page + 1}${depthFilter ? `&type=${depthFilter}` : ''}`}
                    className="btn-primary text-sm"
                  >
                    {dict.common.nextPage}
                  </LocalizedLink>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-5 lg:col-span-4">
            <RightRailPanel title={dict.news.flashSnippets} actionHref="/flash" actionLabel="7×24">
              {flashMini.length === 0 ? (
                <p className="yn-meta text-slate-500">{dict.news.noFlash}</p>
              ) : (
                <ul className="space-y-2.5">
                  {flashMini.map(f => (
                    <li key={f.id} className="border-b border-slate-800/80 pb-2.5 last:border-0 last:pb-0">
                      <LocalizedLink href={`/flash/${encodeFlashSlug(f)}`} className="group block">
                        <span className="yn-meta tabular-nums group-hover:text-primary-400/70">{f.published_at?.slice(5, 16) ?? '—'}</span>
                        <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-200 group-hover:text-primary-400 transition-colors">{f.title}</p>
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              )}
            </RightRailPanel>

            <RightRailPanel title={dict.news.popularTags} accent>
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map(tag => (
                  <LocalizedLink
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="rounded-full border border-slate-700/90 bg-slate-900/40 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    #{locale === 'en' ? (tag.name_en || tag.name) : tag.name}
                  </LocalizedLink>
                ))}
              </div>
            </RightRailPanel>
          </aside>
        </div>
      )}
    </div>
  );
}
