import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  getArticleBySlug,
  getRelatedArticles,
  getAdjacentArticles,
  getPublishedArticles,
  getArticleTopic,
} from '@/lib/queries';
import CtaBanner from '@/components/CtaBanner';
import ReadingProgress from '@/components/ReadingProgress';
import ShareButtons from '@/components/ShareButtons';
import ArticleCard from '@/components/ArticleCard';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import TopicBridge from '@/components/editorial/TopicBridge';
import SectionHeader from '@/components/editorial/SectionHeader';
import TopicEyebrow from '@/components/TopicEyebrow';
import TopicMoreArticles from '@/components/TopicMoreArticles';
import { siteConfig, type Article } from '@yayanews/types';
import { sanitizeHtml } from '@/lib/sanitize';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import { articleHasRealCover, getArticleCoverSrc } from '@/lib/article-image';

import { createMetadata, buildNewsArticleJsonLd, buildBreadcrumbJsonLd } from '@yayanews/seo';

export async function generateMetadata({ params }: { params: { slug: string; lang: string } }): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug) as (Article & { sibling_slug?: string }) | undefined;
  if (!article || (article.lang && article.lang !== params.lang)) return {};
  const descFallback = article.summary
    ? article.summary.slice(0, 155)
    : article.content
      ? article.content.replace(/<[^>]+>/g, '').slice(0, 152) + '...'
      : article.title;

  const isEnDoc = params.lang === 'en';
  
  // Natively pull the related slugs based on DB linkage, fallback to current slug if orphaned
  const zhSlug = isEnDoc ? (article.sibling_slug || params.slug) : params.slug;
  const enSlug = isEnDoc ? params.slug : (article.sibling_slug || `${params.slug}-en`);

  return createMetadata({
    title: article.title,
    description: descFallback,
    url: `/article/${params.slug}`,
    type: 'article',
    authors: [article.author],
    image: article.cover_image || undefined,
    publishedTime: article.published_at || undefined,
    modifiedTime: article.updated_at || undefined,
    section: article.category_name || undefined,
    lang: params.lang as 'zh' | 'en',
    alternatesLanguages: {
      'zh': `/zh/article/${zhSlug}`,
      'en': `/en/article/${enSlug}`,
    },
  });
}

export const revalidate = 300;

function formatDate(value?: string | null) {
  return value?.slice(0, 16) ?? '';
}

export default async function ArticlePage({ params }: { params: { slug: string; lang: string } }) {
  const dict = await getDictionary(params.lang as any);

  function getSentimentLabel(sentiment?: string) {
    if (sentiment === 'bullish') return { label: dict.article.bullish, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    if (sentiment === 'bearish') return { label: dict.article.bearish, cls: 'border-rose-200 bg-rose-50 text-rose-700' };
    if (sentiment) return { label: dict.article.neutral, cls: 'border-slate-200 bg-slate-100 text-slate-600' };
    return null;
  }

  const article = await getArticleBySlug(params.slug);
  if (!article || (article.lang && article.lang !== params.lang)) notFound();

  const related = await getRelatedArticles(article.id, article.category_id, 5);
  const { prev, next } = await getAdjacentArticles(article.id);
  const articleUrl = `${siteConfig.siteUrl}/article/${article.slug}`;
  const hasCover = articleHasRealCover(article.cover_image, article.source);
  const coverSrc = getArticleCoverSrc(article.cover_image, params.lang, article.source);
  const coverOpt = hasCover ? isRemoteImageOptimizable(coverSrc) : false;
  const sameCategory =
    article.category_slug != null
      ? (await getPublishedArticles(params.lang, 8, 0, article.category_slug)).filter((a: Article) => a.id !== article.id)
      : [];
  const moreRead = sameCategory.slice(0, 4);
  // 从文章自己的 topic_id 获取所属专题（含同专题最新3篇文章）
  const topicId = (article as any).topic_id as number | null | undefined;
  const articleTopic = await getArticleTopic(article.id, topicId);
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
                {dict.nav.home}
              </LocalizedLink>
              <span aria-hidden>/</span>
              <LocalizedLink href="/news" className="yn-link">
                {dict.nav.newsSection}
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
                  <span className="badge border-violet-200 bg-violet-50 text-violet-700">{dict.article.deepDive}</span>
                ) : null}
                {sentiment ? <span className={`badge ${sentiment.cls}`}>{sentiment.label}</span> : null}
                {tickers.length > 0 ? (
                  <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                    {tickers.slice(0, 3).map(t => `$${t}`).join(' ')}
                  </span>
                ) : null}
              </div>

              <TopicEyebrow topic={articleTopic} lang={params.lang} />
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
                {article.updated_at && article.updated_at !== article.published_at ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span className="text-slate-500">
                      {dict.article.updatedAt || '更新'}: <time dateTime={article.updated_at}>{formatDate(article.updated_at)}</time>
                    </span>
                  </>
                ) : null}
                <span className="text-slate-400" aria-hidden>
                  ·
                </span>
                <span>{article.view_count} {dict.article.views}</span>
                {article.source && article.source !== 'YayaNews' ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span>
                      {dict.common.source}{' '}
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
                  <h2 className="yn-heading-sm">{dict.article.keyTakeaways}</h2>
                  <span className="yn-meta">{params.lang === 'en' ? 'Key takeaways' : '核心提炼'}</span>
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

            {hasCover ? (
              <figure className="mt-6 overflow-hidden rounded-yn-md border border-[#ddd5ca] bg-white">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={coverSrc}
                    alt={article.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 48rem"
                    className="object-cover"
                    priority
                    unoptimized={!coverOpt}
                  />
                </div>
                <figcaption className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {article.source && article.source !== 'YayaNews' ? `${dict.article.imageSource} ${article.source}` : dict.article.imageDisclaimer}
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
                    <p className="yn-meta mb-2">{dict.article.disclaimerTitle}</p>
                    {article.source === 'YayaNews' || !article.source ? (
                      <p className="yn-body">{dict.article.disclaimerSelf}</p>
                    ) : (
                      <p className="yn-body">
                        {dict.article.disclaimerOther}
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
                        {dict.article.disclaimerSuffix}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ShareButtons title={article.title} url={articleUrl} lang={params.lang} />
                  </div>
                </div>
              </div>

              {articleTopic ? <TopicBridge topicTitle={params.lang === 'en' ? (articleTopic.name_en || articleTopic.title || '') : (articleTopic.name_zh || articleTopic.title || '')} href={`/topics/${articleTopic.slug}`} lang={params.lang} /> : null}

              <TopicMoreArticles topic={articleTopic} currentArticleId={article.id} lang={params.lang} />

              {article.tags && article.tags.length > 0 ? (
                <section>
                  <div className="yn-section-rule mb-3 flex items-center justify-between">
                    <h2 className="yn-heading-sm">{dict.article.tagsTitle}</h2>
                    <span className="yn-meta">{params.lang === 'en' ? 'Topics & symbols' : '标签与标的'}</span>
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
                    <h2 className="yn-heading-sm">{dict.article.continueReading}</h2>
                    <span className="yn-meta">{params.lang === 'en' ? 'Previous & next' : '前篇后篇'}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {prev ? (
                      <LocalizedLink href={`/article/${prev.slug}`} className="yn-panel group p-4 hover:border-[#bfb4a5]">
                        <span className="yn-meta mb-2 block">{dict.article.prev}</span>
                        <span className="block text-sm font-semibold leading-6 text-slate-800 group-hover:text-[#1d5c4f] line-clamp-2">
                          {prev.title}
                        </span>
                      </LocalizedLink>
                    ) : (
                      <div />
                    )}
                    {next ? (
                      <LocalizedLink href={`/article/${next.slug}`} className="yn-panel group p-4 hover:border-[#bfb4a5] sm:text-right">
                        <span className="yn-meta mb-2 block">{dict.article.next}</span>
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
                  <SectionHeader title={dict.article.relatedReading} emphasis="strong" actionHref={`/news/${article.category_slug}`} actionLabel={dict.article.enterChannel} />
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
            <RightRailPanel title={dict.article.articleInfo} accent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                  <dt className="yn-meta !text-[10px]">{dict.article.publishedAt}</dt>
                  <dd className="text-right text-slate-700">{formatDate(article.published_at)}</dd>
                </div>
                {article.category_name ? (
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                    <dt className="yn-meta !text-[10px]">{dict.article.channel}</dt>
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
                  <dt className="yn-meta !text-[10px]">{dict.article.viewCount}</dt>
                  <dd className="text-slate-700">{article.view_count}</dd>
                </div>
                {tickers.length > 0 ? (
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                    <dt className="yn-meta !text-[10px]">{dict.article.relatedTickers}</dt>
                    <dd className="text-right text-slate-700">{tickers.map(t => `$${t}`).join(' ')}</dd>
                  </div>
                ) : null}
                {article.source ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="yn-meta !text-[10px]">{dict.article.infoSource}</dt>
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
              <RightRailPanel title={dict.article.relatedRecommendations} accent>
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
          __html: JSON.stringify(buildNewsArticleJsonLd(article, articleTopic)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd([
            { name: dict.nav.home, url: `/${params.lang}` },
            { name: dict.nav.newsSection, url: `/${params.lang}/news` },
            ...(article.category_name && article.category_slug
              ? [{ name: article.category_name, url: `/${params.lang}/news/${article.category_slug}` }]
              : []),
            { name: article.title, url: `/${params.lang}/article/${article.slug}` },
          ])),
        }}
      />
    </div>
  );
}
