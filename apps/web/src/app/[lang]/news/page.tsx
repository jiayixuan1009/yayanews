import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import {
  getPublishedArticles,
  getCategoriesOrdered,
  getArticleCountByType,
  getPopularTags,
  getFlashNews,
} from '@/lib/queries';
import ArticleCard from '@/components/ArticleCard';
import DepthTabs from '@/components/DepthTabs';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';

export const metadata: Metadata = {
  title: '最新资讯',
  description: '最新金融资讯，覆盖美股、港股、加密货币、衍生品与大宗商品市场动态',
  alternates: { canonical: '/news' },
  openGraph: { title: '最新资讯 | YayaNews', description: '全球金融市场最新动态与深度分析' },
};

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
  const dict = await getDictionary(params.lang as any);
  const articles = await getPublishedArticles(params.lang, pageSize, offset, undefined, undefined, articleType);
  const total = await getArticleCountByType(undefined, articleType);
  const totalPages = Math.ceil(total / pageSize);
  const categories = await getCategoriesOrdered();

  const countAll = await getArticleCountByType();
  const countStandard = await getArticleCountByType(undefined, 'standard');
  const countDeep = await getArticleCountByType(undefined, 'deep');

  const popularTags = await getPopularTags(12);
  const flashMini = await getFlashNews(params.lang, 6);

  const featured = articles[0];
  const subFeatured = articles.slice(1, 3);
  const feed = articles.slice(3);

  return (
    <div className="container-main py-6 sm:py-8">
      <ChannelHeader
        title="最新资讯"
        description="全站稿件总览；按深度与栏目筛选，与单频道页共用同一套编辑组件语言。"
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <LocalizedLink
          href="/news"
          className="badge border border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
        >
          全部
        </LocalizedLink>
        {categories.map(c => (
          <LocalizedLink
            key={c.slug}
            href={`/news/${c.slug}`}
            className="badge border border-transparent bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {c.name}
          </LocalizedLink>
        ))}
      </div>

      <DepthTabs
        baseUrl="/news"
        current={depthFilter}
        counts={{ all: countAll, standard: countStandard, deep: countDeep }}
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
                    ← 上一页
                  </LocalizedLink>
                )}
                <span className="yn-meta px-2">
                  第 {page} / {totalPages} 页
                </span>
                {page < totalPages && (
                  <LocalizedLink
                    href={`/news?page=${page + 1}${depthFilter ? `&type=${depthFilter}` : ''}`}
                    className="btn-primary text-sm"
                  >
                    下一页 →
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
                      <span className="yn-meta tabular-nums">{f.published_at?.slice(5, 16) ?? '—'}</span>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-200">{f.title}</p>
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
                    #{tag.name}
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
