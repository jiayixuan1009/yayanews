import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { searchArticles, getPopularTags } from '@/lib/queries';
import ArticleCard from '@/components/ArticleCard';
import SectionHeader from '@/components/editorial/SectionHeader';

export const metadata: Metadata = {
  title: '搜索',
  description: '搜索YayaNews金融新闻资讯，覆盖美股、港股、加密货币、衍生品市场',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
};

const HOT_SEARCHES = [
  '比特币', 'NVIDIA', '美联储', '黄金', '港股', '以太坊',
  '特斯拉', '降息', 'ETF', '原油',
];

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q?.trim() || '';
  const results = query ? searchArticles(query) : [];
  const popularTags = !query ? getPopularTags(20) : [];

  return (
    <div className="container-main py-6 sm:py-8">
      <header className="mb-6 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">搜索</h1>
        <p className="mt-2 text-sm text-slate-400">全文检索与标签发现；工具页不铺品牌插画。</p>
      </header>

      <form action="/search" method="GET" className="mb-8">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="输入关键词…"
              autoFocus
              className="w-full rounded-yn-md border border-slate-700/90 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-emerald-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-800/40"
            />
          </div>
          <button type="submit" className="btn-primary shrink-0 rounded-yn-md text-sm">
            搜索
          </button>
        </div>
      </form>

      {query ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">
              &ldquo;{query}&rdquo; 的搜索结果：{results.length} 篇
            </p>
            <LocalizedLink href="/search" className="text-xs text-slate-500 hover:text-slate-300">清除搜索</LocalizedLink>
          </div>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">未找到与 &ldquo;{query}&rdquo; 相关的文章</p>
              <p className="text-sm text-slate-600">试试其他关键词，或浏览热门搜索</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {HOT_SEARCHES.map(kw => (
                  <LocalizedLink
                    key={kw}
                    href={`/search?q=${encodeURIComponent(kw)}`}
                    className="badge bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white"
                  >
                    {kw}
                  </LocalizedLink>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeader title="热门搜索" emphasis="strong" />
            <div className="flex flex-wrap gap-2">
              {HOT_SEARCHES.map(kw => (
                <LocalizedLink
                  key={kw}
                  href={`/search?q=${encodeURIComponent(kw)}`}
                  className="rounded-full border border-slate-700/90 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white"
                >
                  {kw}
                </LocalizedLink>
              ))}
            </div>
          </section>

          {popularTags.length > 0 ? (
            <section>
              <SectionHeader title="数据库热门标签" emphasis="default" />
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map(tag => (
                  <LocalizedLink
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="rounded-full border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  >
                    #{tag.name}
                  </LocalizedLink>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
