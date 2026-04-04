import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LocalizedLink from '@/components/LocalizedLink';
import ArticleCard from '@/components/ArticleCard';
import { getTopicBySlug, getTopics } from '@/lib/queries';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

interface Props {
  params: { slug: string; lang: string };
  searchParams: { page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = await getTopicBySlug(params.slug, 1, 20);
  if (!topic) return createMetadata({ title: '专题未找到' });

  const isZh = params.lang !== 'en';
  const name = isZh ? topic.name_zh : topic.name_en;
  const desc = isZh ? topic.description_zh : topic.description_en;
  const metaTitle = topic.meta_title || `${name} ${isZh ? '专题报道' : 'Topic Coverage'} | YayaNews`;
  const metaDesc = topic.meta_description || (desc || '').slice(0, isZh ? 120 : 160);

  return {
    title: metaTitle,
    description: metaDesc,
    // draft 状态前台 404，不会走到这里；archive 状态 noindex
    robots: topic.status === 'archive' ? 'noindex, follow' : 'index, follow',
    alternates: {
      canonical: `/${params.lang}/topics/${params.slug}`,
      languages: {
        'zh-CN': `/zh/topics/${params.slug}`,
        'en-US': `/en/topics/${params.slug}`,
        'x-default': `/zh/topics/${params.slug}`,
      },
    },
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: `${siteConfig.siteUrl}/${params.lang}/topics/${params.slug}`,
      type: 'website',
      images: topic.cover_image
        ? [{ url: topic.cover_image, width: 1200, height: 630 }]
        : [{ url: `${siteConfig.siteUrl}/brand/logo-square.svg`, width: 512, height: 512 }],
    },
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TopicDetailPage({ params, searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const pageSize = 20;

  const topic = await getTopicBySlug(params.slug, page, pageSize);

  // draft → 404；topic 不存在 → 404
  if (!topic || topic.status === 'draft') notFound();

  const isZh = params.lang !== 'en';
  const name = isZh ? (topic.name_zh || topic.title || '') : (topic.name_en || topic.title || '');
  const desc = isZh ? topic.description_zh : topic.description_en;
  const totalPages = Math.ceil((topic.total_count || 0) / pageSize);
  const featuredIds = new Set((topic.featured_articles || []).map(a => a.id));

  // Schema.org CollectionPage
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description: desc || '',
    url: `${siteConfig.siteUrl}/${params.lang}/topics/${params.slug}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (topic.articles || []).map((a, i) => ({
        '@type': 'ListItem',
        position: (page - 1) * pageSize + i + 1,
        name: a.title,
        url: `${siteConfig.siteUrl}/${params.lang}/article/${a.slug}`,
        datePublished: a.published_at || '',
      })),
    },
  };

  const faqItems = topic.faq_items && Array.isArray(topic.faq_items) ? topic.faq_items : [];
  let faqSchema = null;
  if (faqItems.length > 0) {
    faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: isZh ? item.q_zh : item.q_en,
        acceptedAnswer: {
          '@type': 'Answer',
          text: isZh ? item.a_zh : item.a_en,
        }
      }))
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="container-main py-6 sm:py-8 lg:py-10">
        {/* 归档状态横幅 */}
        {topic.status === 'archive' && (
          <div className="mb-6 flex items-center gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              {isZh
                ? '该专题已停止更新，以下内容为历史归档报道。'
                : 'This topic is archived and no longer updated. The content below is historical.'}
            </span>
          </div>
        )}

        {/* 面包屑导航 */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-[#667067]">
          <LocalizedLink href="/" className="hover:text-[#0d3b30]">
            {isZh ? '首页' : 'Home'}
          </LocalizedLink>
          <span>/</span>
          <LocalizedLink href="/topics" className="hover:text-[#0d3b30]">
            {isZh ? '专题' : 'Topics'}
          </LocalizedLink>
          <span>/</span>
          <span className="text-[#0d3b30]">{name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr,320px]">
          {/* 主栏 */}
          <main>
            <header className="mb-8 border-b border-[#ddd5ca] pb-8">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0d3b30] flex items-center gap-2">
                <span>{isZh ? '专题报道' : 'Topic Coverage'}</span>
                {topic.market && <span className="font-semibold">| {topic.market}</span>}
              </p>
              <h1 className="text-2xl font-black leading-tight tracking-tight text-black sm:text-3xl lg:text-4xl">
                {name}
              </h1>
              
              {/* Keywords and Tickers */}
              {(topic.keywords?.length || topic.related_tickers?.length) ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {topic.related_tickers?.map(t => (
                    <span key={t} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      ${t}
                    </span>
                  ))}
                  {topic.keywords?.slice(0, 5).map(k => (
                    <span key={k} className="rounded-full bg-[#f2ede9] px-2.5 py-0.5 text-xs font-medium text-[#4a5250]">
                      #{k}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Hero Summary */}
              {(topic.hero_summary_zh || topic.hero_summary_en) ? (
                <p className="mt-5 max-w-3xl text-[16px] font-medium leading-8 text-[#2c3631]">
                  {isZh ? (topic.hero_summary_zh || desc) : (topic.hero_summary_en || desc)}
                </p>
              ) : desc && (
                <p className="mt-5 max-w-3xl text-[16px] leading-8 text-[#4a5250]">
                  {desc}
                </p>
              )}
              <p className="mt-4 text-sm text-[#667067]">
                {isZh
                  ? `本专题共 ${topic.total_count || 0} 篇报道`
                  : `${topic.total_count || 0} articles in this topic`}
              </p>
            </header>

            {/* 精选文章区 */}
            {topic.featured_articles && topic.featured_articles.length > 0 && page === 1 && (
              <section className="mb-10" aria-label={isZh ? '精选文章' : 'Featured articles'}>
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1d5c4f]">
                    {isZh ? '编辑精选' : 'Editor\'s Picks'}
                  </h2>
                  <div className="h-px flex-1 bg-[#ddd5ca]" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {topic.featured_articles.map(a => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </section>
            )}

            {/* 全部文章列表 */}
            <section aria-label={isZh ? '全部文章' : 'All articles'}>
              {page === 1 && topic.featured_articles && topic.featured_articles.length > 0 && (
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667067]">
                    {isZh ? '全部报道' : 'All Coverage'}
                  </h2>
                  <div className="h-px flex-1 bg-[#ddd5ca]" />
                </div>
              )}

              {topic.articles && topic.articles.length > 0 ? (
                <div className="space-y-0 divide-y divide-[#eae4dc]">
                  {topic.articles
                    .filter(a => !featuredIds.has(a.id) || page > 1)
                    .map(a => (
                      <div key={a.id} className="py-5">
                        <LocalizedLink
                          href={`/article/${a.slug}`}
                          className="group flex items-start gap-4"
                        >
                          <div className="flex-1">
                            <h3 className="text-base font-semibold leading-snug text-[#101713] group-hover:text-[#1d5c4f]">
                              {a.title}
                            </h3>
                            {a.summary && (
                              <p className="mt-1.5 text-sm leading-6 text-[#4a5250] line-clamp-2">
                                {a.summary.slice(0, 80)}
                                {a.summary.length > 80 ? '…' : ''}
                              </p>
                            )}
                            <p className="mt-2 text-[12px] text-[#667067]">
                              {a.published_at?.slice(0, 10)}
                              {a.category_name ? ` · ${a.category_name}` : ''}
                            </p>
                          </div>
                        </LocalizedLink>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="py-16 text-center text-[#667067]">
                  {isZh ? '该专题暂无文章' : 'No articles in this topic yet'}
                </p>
              )}
            </section>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <nav
                className="mt-10 flex items-center justify-between border-t border-[#ddd5ca] pt-6"
                aria-label={isZh ? '分页' : 'Pagination'}
              >
                {page > 1 ? (
                  <LocalizedLink
                    href={page === 2 ? `/topics/${params.slug}` : `/topics/${params.slug}?page=${page - 1}`}
                    className="border border-[#d8d1c5] px-4 py-2 text-sm text-[#14261f] hover:border-[#bfb4a5]"
                  >
                    ← {isZh ? '上一页' : 'Previous'}
                  </LocalizedLink>
                ) : <span />}

                <span className="text-sm text-[#667067]">
                  {isZh ? `第 ${page} / ${totalPages} 页` : `Page ${page} of ${totalPages}`}
                </span>

                {page < totalPages ? (
                  <LocalizedLink
                    href={`/topics/${params.slug}?page=${page + 1}`}
                    className="border border-[#d8d1c5] px-4 py-2 text-sm text-[#14261f] hover:border-[#bfb4a5]"
                  >
                    {isZh ? '下一页' : 'Next'} →
                  </LocalizedLink>
                ) : <span />}
              </nav>
            )}
          </main>

          {/* 右侧边栏：相关专题与 FAQ */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div className="border border-[#ddd5ca] p-5">
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1d5c4f]">
                  {isZh ? '关于本专题' : 'About this topic'}
                </h2>
                <p className="text-sm leading-7 text-[#4a5250]">
                  {(desc || '').slice(0, 150)}{(desc || '').length > 150 ? '…' : ''}
                </p>
                {topic.seo_body_zh && isZh && (
                  <div className="mt-3 text-xs leading-6 text-[#667067] prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: topic.seo_body_zh }} />
                )}
                {topic.seo_body_en && !isZh && (
                  <div className="mt-3 text-xs leading-6 text-[#667067] prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: topic.seo_body_en }} />
                )}
                <div className="mt-4 border-t border-[#ddd5ca] pt-4 text-sm text-[#667067]">
                  <span className="block">
                    {isZh ? `共 ${topic.total_count || 0} 篇报道` : `${topic.total_count || 0} articles`}
                  </span>
                </div>
              </div>

              {faqItems.length > 0 && (
                <div className="border border-[#ddd5ca] p-5 bg-[#fcfaf8]">
                  <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1d5c4f]">
                    {isZh ? '常见问题 (FAQ)' : 'FAQ'}
                  </h2>
                  <div className="space-y-4">
                    {faqItems.map((item, idx) => (
                      <details key={idx} className="group">
                        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[#101713] list-none">
                          <span className="pr-2">{isZh ? item.q_zh : item.q_en}</span>
                          <span className="shrink-0 text-[#1d5c4f] group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-2 text-xs leading-6 text-[#4a5250]">
                          {isZh ? item.a_zh : item.a_en}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
