import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  getArticleBySlug,
  getRelatedArticles,
  getAdjacentArticles,
  getPublishedArticles,
  getTopics,
} from '@/lib/queries';
import CtaBanner from '@/components/CtaBanner';
import ReadingProgress from '@/components/ReadingProgress';
import ShareButtons from '@/components/ShareButtons';
import ArticleCard from '@/components/ArticleCard';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import TopicBridge from '@/components/editorial/TopicBridge';
import SectionHeader from '@/components/editorial/SectionHeader';
import { siteConfig } from '@/lib/types';
import { sanitizeHtml } from '@/lib/sanitize';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = getArticleBySlug(params.slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary || article.title,
    alternates: { canonical: `/article/${params.slug}` },
    openGraph: {
      title: article.title,
      description: article.summary || article.title,
      type: 'article',
      url: `/article/${params.slug}`,
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      authors: [article.author],
      images: article.cover_image ? [article.cover_image] : undefined,
      section: article.category_name || undefined,
    },
  };
}

export const revalidate = 300;

function formatDate(value?: string | null) {
  return value?.slice(0, 16) ?? '';
}

function getSentimentLabel(sentiment?: string) {
  if (sentiment === 'bullish') return { label: '偏多', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  if (sentiment === 'bearish') return { label: '偏空', cls: 'border-rose-200 bg-rose-50 text-rose-700' };
  if (sentiment) return { label: '中性', cls: 'border-slate-200 bg-slate-100 text-slate-600' };
  return null;
}

export default function ArticlePage({ params }: { params: { slug: string; lang: string } }) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  const related = getRelatedArticles(article.id, article.category_id, 5);
  const { prev, next } = getAdjacentArticles(article.id);
  const articleUrl = `${siteConfig.siteUrl}/article/${article.slug}`;
  const coverOpt = article.cover_image ? isRemoteImageOptimizable(article.cover_image) : false;
  const sameCategory =
    article.category_slug != null
      ? getPublishedArticles(params.lang, 8, 0, article.category_slug).filter(a => a.id !== article.id)
      : [];
  const moreRead = sameCategory.slice(0, 4);
  const bridgeTopic = getTopics(1)[0];
  const sentiment = getSentimentLabel(article.sentiment);
  const tickers = article.tickers
    ? article.tickers
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="container-main py-6 sm:py-8 lg:py-10 xl:py-12">
      <ReadingProgress />
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
        <article className="lg:col-span-8 xl:pr-2">
          <div className="mx-auto max-w-measure-wide">
            <nav className="yn-meta mb-5 flex flex-wrap gap-x-2 gap-y-1">
              <LocalizedLink href="/" className="yn-link">
                首页
              </LocalizedLink>
              <span aria-hidden>/</span>
              <LocalizedLink href="/news" className="yn-link">
                资讯
              </LocalizedLink>
              {article.category_name && article.category_slug ? (
                <>
                  <span aria-hidden>/</span>
                  <LocalizedLink href={`/news/${article.category_slug}`} className="yn-link">
                    {article.category_name}
                  </LocalizedLink>
                </>
              ) : null}
            </nav>

            <header className="yn-panel-soft px-5 py-5 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-center gap-2">
                {article.category_name ? (
                  <span className="badge border-[#cfe1d9] bg-[#eef6f3] text-[#1d5c4f]">{article.category_name}</span>
                ) : null}
                {article.article_type === 'deep' ? (
                  <span className="badge border-violet-200 bg-violet-50 text-violet-700">深度稿</span>
                ) : null}
                {sentiment ? <span className={`badge ${sentiment.cls}`}>{sentiment.label}</span> : null}
                {tickers.length > 0 ? (
                  <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                    {tickers.slice(0, 3).map(t => `$${t}`).join(' ')}
                  </span>
                ) : null}
              </div>

              <h1 className="yn-display mt-4 text-balance">{article.title}</h1>

              {article.summary ? (
                <p className="mt-4 max-w-measure font-body text-[17px] leading-8 text-slate-700">{article.summary}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#ddd5ca] pt-4 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{article.author}</span>
                <span className="text-slate-400" aria-hidden>
                  ·
                </span>
                <time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time>
                <span className="text-slate-400" aria-hidden>
                  ·
                </span>
                <span>{article.view_count} 阅读</span>
                {article.source && article.source !== 'YayaNews' ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span>
                      来源{' '}
                      {article.source_url ? (
                        <a
                          href={article.source_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="yn-link"
                        >
                          {article.source}
                        </a>
                      ) : (
                        <span className="text-slate-800">{article.source}</span>
                      )}
                    </span>
                  </>
                ) : null}
              </div>
            </header>

            {article.key_points && article.key_points.trim() ? (
              <section className="yn-panel mt-6 p-5 sm:p-6">
                <div className="yn-section-rule mb-4 flex items-center justify-between">
                  <h2 className="yn-heading-sm">核心要点</h2>
                  <span className="yn-meta">Key takeaways</span>
                </div>
                <ul className="space-y-3">
                  {article.key_points
                    .split('\n')
                    .map(p => p.trim())
                    .filter(Boolean)
                    .map((point, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d5c4f]" aria-hidden />
                        <span className="font-body text-[15px] leading-7 text-slate-700">{point}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            {article.cover_image ? (
              <figure className="mt-6 overflow-hidden rounded-yn-md border border-[#ddd5ca] bg-white">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={article.cover_image}
                    alt={article.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 48rem"
                    className="object-cover"
                    priority
                    unoptimized={!coverOpt}
                  />
                </div>
                <figcaption className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {article.source && article.source !== 'YayaNews' ? `图片来源：${article.source}` : '配图仅作信息辅助展示'}
                </figcaption>
              </figure>
            ) : null}

            <div
              className="prose-article mt-8"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
            />

            <div className="mt-10 space-y-8">
              <div className="yn-panel-soft p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="yn-meta mb-2">稿件说明</p>
                    {article.source === 'YayaNews' || !article.source ? (
                      <p className="yn-body">本文由 {siteConfig.siteName} 编辑整理发布，仅供信息参考，不构成投资建议。</p>
                    ) : (
                      <p className="yn-body">
                        本文转载或整理自{' '}
                        {article.source_url ? (
                          <a
                            href={article.source_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="yn-link"
                          >
                            {article.source}
                          </a>
                        ) : (
                          <span className="text-slate-800">{article.source}</span>
                        )}
                        ，仅供信息参考，不构成投资建议。
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ShareButtons title={article.title} url={articleUrl} />
                  </div>
                </div>
              </div>

              {bridgeTopic ? <TopicBridge topicTitle={bridgeTopic.title} href={`/topics/${bridgeTopic.slug}`} /> : null}

              {article.tags && article.tags.length > 0 ? (
                <section>
                  <div className="yn-section-rule mb-3 flex items-center justify-between">
                    <h2 className="yn-heading-sm">标签</h2>
                    <span className="yn-meta">Topics & symbols</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map(tag => (
                      <LocalizedLink
                        key={tag.id}
                        href={`/tag/${tag.slug}`}
                        className="rounded-full border border-[#d9d2c8] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#bfb4a5] hover:text-[#143d33]"
                      >
                        #{tag.name}
                      </LocalizedLink>
                    ))}
                  </div>
                </section>
              ) : null}

              {(prev || next) && (
                <section>
                  <div className="yn-section-rule mb-4 flex items-center justify-between">
                    <h2 className="yn-heading-sm">继续阅读</h2>
                    <span className="yn-meta">Previous & next</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {prev ? (
                      <LocalizedLink href={`/article/${prev.slug}`} className="yn-panel group p-4 hover:border-[#bfb4a5]">
                        <span className="yn-meta mb-2 block">上一篇</span>
                        <span className="block text-sm font-semibold leading-6 text-slate-800 group-hover:text-[#1d5c4f] line-clamp-2">
                          {prev.title}
                        </span>
                      </LocalizedLink>
                    ) : (
                      <div />
                    )}
                    {next ? (
                      <LocalizedLink href={`/article/${next.slug}`} className="yn-panel group p-4 hover:border-[#bfb4a5] sm:text-right">
                        <span className="yn-meta mb-2 block">下一篇</span>
                        <span className="block text-sm font-semibold leading-6 text-slate-800 group-hover:text-[#1d5c4f] line-clamp-2">
                          {next.title}
                        </span>
                      </LocalizedLink>
                    ) : (
                      <div />
                    )}
                  </div>
                </section>
              )}

              {moreRead.length > 0 ? (
                <section className="border-t border-[#ddd5ca] pt-8">
                  <SectionHeader title="同栏目延伸阅读" emphasis="strong" actionHref={`/news/${article.category_slug}`} actionLabel="进入频道" />
                  <div className="mt-4 space-y-3">
                    {moreRead.map(a => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </article>

        <aside className="space-y-5 lg:col-span-4 lg:pl-2">
          <div className="lg:sticky lg:top-24 space-y-5">
            <RightRailPanel title="文章信息" accent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                  <dt className="yn-meta !text-[10px]">发布时间</dt>
                  <dd className="text-right text-slate-700">{formatDate(article.published_at)}</dd>
                </div>
                {article.category_name ? (
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                    <dt className="yn-meta !text-[10px]">所属频道</dt>
                    <dd>
                      {article.category_slug ? (
                        <LocalizedLink href={`/news/${article.category_slug}`} className="yn-link text-right">
                          {article.category_name}
                        </LocalizedLink>
                      ) : (
                        <span className="text-slate-700">{article.category_name}</span>
                      )}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                  <dt className="yn-meta !text-[10px]">阅读量</dt>
                  <dd className="text-slate-700">{article.view_count}</dd>
                </div>
                {tickers.length > 0 ? (
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                    <dt className="yn-meta !text-[10px]">相关标的</dt>
                    <dd className="text-right text-slate-700">{tickers.map(t => `$${t}`).join(' ')}</dd>
                  </div>
                ) : null}
                {article.source ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="yn-meta !text-[10px]">信息来源</dt>
                    <dd className="text-right text-slate-700">
                      {article.source_url ? (
                        <a href={article.source_url} target="_blank" rel="noopener noreferrer nofollow" className="yn-link">
                          {article.source}
                        </a>
                      ) : (
                        article.source
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </RightRailPanel>

            <CtaBanner />

            {related.length > 0 ? (
              <RightRailPanel title="相关推荐" accent>
                <ul className="space-y-3">
                  {related.map(r => (
                    <li key={r.id} className="border-b border-[#e5ddd2] pb-3 last:border-b-0 last:pb-0">
                      <LocalizedLink href={`/article/${r.slug}`} className="group block">
                        {r.category_name ? <span className="yn-meta mb-1 block text-[#1d5c4f]">{r.category_name}</span> : null}
                        <span className="line-clamp-3 text-sm font-medium leading-6 text-slate-800 group-hover:text-[#1d5c4f]">
                          {r.title}
                        </span>
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </RightRailPanel>
            ) : null}
          </div>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            description: article.summary || article.title,
            image: article.cover_image || undefined,
            datePublished: article.published_at,
            dateModified: article.updated_at,
            author: { '@type': 'Person', name: article.author },
            publisher: {
              '@type': 'Organization',
              name: siteConfig.siteName,
              url: siteConfig.siteUrl,
            },
            mainEntityOfPage: `${siteConfig.siteUrl}/article/${article.slug}`,
          }),
        }}
      />
    </div>
  );
}
