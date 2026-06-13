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
import ArticleViewBeacon from '@/components/ArticleViewBeacon';
import { siteConfig, type Article } from '@yayanews/types';
import { sanitizeHtml } from '@/lib/sanitize';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import { articleHasRealCover, getArticleCoverSrc } from '@/lib/article-image';

import { buildAuthorSlug, createMetadata, buildNewsArticleJsonLd, buildBreadcrumbJsonLd } from '@yayanews/seo';

function truncateMetadataTitle(title: string, lang: string): string {
  const maxLength = lang === 'en' ? 95 : 60;
  const chars = Array.from(title);
  if (chars.length <= maxLength) return title;

  const sliced = chars.slice(0, maxLength - 1).join('');
  const trimmed = lang === 'en'
    ? sliced.replace(/\s+\S*$/, '').trim()
    : sliced.trim();
  return `${trimmed || sliced.trim()}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lang: string }> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const article = await getArticleBySlug(slug) as (Article & { sibling_slug?: string }) | undefined;
  if (!article || (article.lang && article.lang !== lang)) return {};
  const descFallback = article.summary
    ? article.summary.slice(0, 155)
    : article.content
      ? article.content.replace(/<[^>]+>/g, '').slice(0, 152) + '...'
      : article.title;

  const sibling = (article as { sibling_slug?: string }).sibling_slug;

  // 仅当库里有 sibling 时成对输出 zh/en hreflang，避免捏造 `-en` 等 404
  let alternatesLanguages: Record<string, string>;
  if (lang === 'zh' && sibling) {
    alternatesLanguages = {
      zh: `/zh/article/${slug}`,
      en: `/en/article/${sibling}`,
    };
  } else if (lang === 'en' && sibling) {
    alternatesLanguages = {
      zh: `/zh/article/${sibling}`,
      en: `/en/article/${slug}`,
    };
  } else if (lang === 'zh') {
    const p = `/zh/article/${slug}`;
    alternatesLanguages = { zh: p, 'x-default': p };
  } else {
    const p = `/en/article/${slug}`;
    alternatesLanguages = { en: p, 'x-default': p };
  }

  return createMetadata({
    title: truncateMetadataTitle(article.title, lang),
    description: descFallback,
    url: `/article/${slug}`,
    type: 'article',
    authors: [article.author],
    image: article.cover_image || undefined,
    publishedTime: article.published_at || undefined,
    modifiedTime: article.updated_at || undefined,
    section: article.category_name || undefined,
    lang: lang as 'zh' | 'en',
    alternatesLanguages,
    // short articles are thin content (< ~300 words) — exclude from index pool
    noIndex: article.article_type === 'short',
  });
}

export const revalidate = 300;

function formatDate(value?: string | null) {
  return value?.slice(0, 16) ?? '';
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang } = await params;
  const dict = await getDictionary(lang);

  function getSentimentLabel(sentiment?: string) {
    if (sentiment === 'bullish') return { label: dict.article.bullish, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    if (sentiment === 'bearish') return { label: dict.article.bearish, cls: 'border-rose-200 bg-rose-50 text-rose-700' };
    if (sentiment) return { label: dict.article.neutral, cls: 'border-slate-200 bg-slate-100 text-slate-600' };
    return null;
  }

  const article = await getArticleBySlug(slug);
  if (!article || (article.lang && article.lang !== lang)) notFound();

  const related = await getRelatedArticles(article.id, article.category_id, 5);
  const { prev, next } = await getAdjacentArticles(article.id);
  const articleUrl = `${siteConfig.siteUrl}/${lang}/article/${article.slug}`;
  const hasCover = articleHasRealCover(article.cover_image, article.source);
  const coverSrc = getArticleCoverSrc(article.cover_image, lang, article.source);
  const coverOpt = hasCover ? isRemoteImageOptimizable(coverSrc) : false;
  const sameCategory =
    article.category_slug != null
      ? (await getPublishedArticles(lang, 8, 0, article.category_slug)).filter((a: Article) => a.id !== article.id)
      : [];
  const moreRead = sameCategory.slice(0, 4);
  // 从文章自己的 topic_id 获取所属专题（含同专题最新3篇文章）
  const topicId = article.topic_id as number | null | undefined;
  const articleTopic = await getArticleTopic(article.id, topicId);
  const sentiment = getSentimentLabel(article.sentiment);
  const tickers = article.tickers
    ? article.tickers
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];
  const authorName = article.author_profile?.display_name || article.author || 'YayaNews';
  const authorSlug = article.author_profile?.slug || buildAuthorSlug(authorName);
  const sourceUrl = article.original_url || article.source_url;
  const sourceName = article.source || article.author_profile?.display_name || '';
  const sourceType = article.source_type || 'original';
  const sourceTypeLabel: Record<string, string> = lang === 'en'
    ? {
        original: 'Original',
        syndicated: 'Syndicated',
        translated: 'Translated',
        ai_assisted: 'AI-Assisted',
        sponsored: 'Sponsored',
        partner: 'Partner',
      }
    : {
        original: '原创',
        syndicated: '合作来源',
        translated: '编译',
        ai_assisted: 'AI 辅助',
        sponsored: '赞助',
        partner: '合作',
      };

  return (
    <div className="container-main py-6 sm:py-8 lg:py-10 xl:py-12">
      <ReadingProgress />
      <ArticleViewBeacon articleId={article.id} />
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

              <TopicEyebrow topic={articleTopic} lang={lang} />
              <h1 className="yn-display mt-4 text-balance">{article.title}</h1>

              {article.summary ? (
                <p className="mt-4 max-w-measure font-body text-[17px] leading-8 text-slate-700">{article.summary}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#ddd5ca] pt-4 text-sm text-slate-600">
                <LocalizedLink href={`/authors/${authorSlug}`} rel="author" className="font-medium text-slate-800 hover:text-[#1d5c4f]">
                  {authorName}
                </LocalizedLink>
                {sourceType !== 'original' ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span className="rounded-full border border-[#d9d2c8] bg-white px-2 py-0.5 text-xs font-semibold text-[#1d5c4f]" data-source-type={sourceType}>
                      {sourceTypeLabel[sourceType] || sourceType}
                    </span>
                  </>
                ) : null}
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
                {sourceName && sourceName !== 'YayaNews' ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span>
                      {dict.common.source}{' '}
                      {sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="yn-link"
                        >
                          {sourceName}
                        </a>
                      ) : (
                        <span className="text-slate-800">{sourceName}</span>
                      )}
                    </span>
                  </>
                ) : null}
                {article.reviewed_at ? (
                  <>
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span>
                      {lang === 'en' ? 'Reviewed' : '已审核'}: <time dateTime={article.reviewed_at}>{formatDate(article.reviewed_at)}</time>
                    </span>
                  </>
                ) : null}
              </div>
            </header>

            {article.key_points && article.key_points.trim() ? (
              <section className="yn-panel mt-6 p-5 sm:p-6">
                <div className="yn-section-rule mb-4 flex items-center justify-between">
                  <h2 className="yn-heading-sm">{dict.article.keyTakeaways}</h2>
                  <span className="yn-meta">{lang === 'en' ? 'Key takeaways' : '核心提炼'}</span>
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
              {/* Risk disclosure — required for deep-dive analysis articles */}
              {article.article_type === 'deep' && (
                <aside className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                    {lang === 'en' ? 'Risk Disclosure' : '风险提示'}
                  </p>
                  <p className="text-sm leading-6 text-amber-800">
                    {lang === 'en'
                      ? 'This analysis reflects the author\'s views at time of publication and does not constitute investment advice. Financial markets involve significant risk; past performance is not indicative of future results. Always conduct your own research before making investment decisions.'
                      : '本文为作者发布时的个人观点，不构成任何投资建议。金融市场存在重大风险，历史表现不代表未来结果。在做出任何投资决策前，请务必进行独立研究与评估。'}
                  </p>
                </aside>
              )}
              <div className="yn-panel-soft p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="yn-meta mb-2">{dict.article.disclaimerTitle}</p>
                    {sourceName === 'YayaNews' || !sourceName ? (
                      <p className="yn-body">{dict.article.disclaimerSelf}</p>
                    ) : (
                      <p className="yn-body">
                        {dict.article.disclaimerOther}
                        {sourceUrl ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="yn-link"
                          >
                            {sourceName}
                          </a>
                        ) : (
                          <span className="text-slate-800">{sourceName}</span>
                        )}
                        {dict.article.disclaimerSuffix}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ShareButtons title={article.title} url={articleUrl} lang={lang} />
                  </div>
                </div>
              </div>

              {articleTopic ? <TopicBridge topicTitle={lang === 'en' ? (articleTopic.name_en || articleTopic.title || '') : (articleTopic.name_zh || articleTopic.title || '')} href={`/topics/${articleTopic.slug}`} lang={lang} /> : null}

              <TopicMoreArticles topic={articleTopic} currentArticleId={article.id} lang={lang} dict={dict} />

              {article.tags && article.tags.length > 0 ? (
                <section>
                  <div className="yn-section-rule mb-3 flex items-center justify-between">
                    <h2 className="yn-heading-sm">{dict.article.tagsTitle}</h2>
                    <span className="yn-meta">{lang === 'en' ? 'Topics & symbols' : '标签与标的'}</span>
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
                    <span className="yn-meta">{lang === 'en' ? 'Previous & next' : '前篇后篇'}</span>
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
                {sourceType !== 'original' ? (
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5ddd2] pb-3">
                    <dt className="yn-meta !text-[10px]">{lang === 'en' ? 'Source Type' : '来源类型'}</dt>
                    <dd className="text-right text-slate-700">{sourceTypeLabel[sourceType] || sourceType}</dd>
                  </div>
                ) : null}
                {sourceName ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="yn-meta !text-[10px]">{dict.article.infoSource}</dt>
                    <dd className="text-right text-slate-700">
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="yn-link">
                          {sourceName}
                        </a>
                      ) : (
                        sourceName
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
          __html: JSON.stringify(buildNewsArticleJsonLd(article, articleTopic, lang)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd([
            { name: dict.nav.home, url: `/${lang}` },
            { name: dict.nav.newsSection, url: `/${lang}/news` },
            ...(article.category_name && article.category_slug
              ? [{ name: article.category_name, url: `/${lang}/news/${article.category_slug}` }]
              : []),
            { name: article.title, url: `/${lang}/article/${article.slug}` },
          ])),
        }}
      />
    </div>
  );
}
