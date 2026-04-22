import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { notFound } from 'next/navigation';
import {
  getTagBySlug,
  getPublishedArticlesByTagSlug,
  getArticleCountByTagSlug,
  getPopularTags,
  getFlashNews,
} from '@/lib/queries';
import { encodeFlashSlug } from '@/lib/ui-utils';
import ArticleCard from '@/components/ArticleCard';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';

import { createMetadata, buildBreadcrumbJsonLd } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export async function generateMetadata({ params, searchParams }: { params: { slug: string; lang: string }; searchParams: any }): Promise<Metadata> {
  const decodedSlug = decodeURIComponent(params.slug);
  const tag = await getTagBySlug(decodedSlug);
  if (!tag) return {};
  const isZh = params.lang !== 'en';
  const articleCount = await getArticleCountByTagSlug(decodedSlug, params.lang);
  return createMetadata({
    title: isZh ? `标签：${tag.name}` : `Tag: ${tag.name}`,
    description: isZh ? `浏览与「${tag.name}」相关的 YayaNews 资讯稿件` : `Browse YayaNews articles related to #${tag.name}`,
    url: `/tag/${decodedSlug}`,
    lang: params.lang as 'zh' | 'en',
    noIndex: articleCount < 3, // P1 SEO: thin tag pages (< 3 articles) excluded from index pool
  });
}

export const revalidate = 120;

export default async function TagPage({ params }: { params: { slug: string; lang: string } }) {
  const decodedSlug = decodeURIComponent(params.slug);
  const tag = await getTagBySlug(decodedSlug);
  if (!tag) notFound();

  const dict = await getDictionary(params.lang as any);
  const articles = await getPublishedArticlesByTagSlug(decodedSlug, 48, 0, params.lang);
  const total = await getArticleCountByTagSlug(decodedSlug, params.lang);
  const popularTags = await getPopularTags(12);
  const flashMini = await getFlashNews(params.lang, 6);
  const isEn = params.lang === 'en';
  const tagName = isEn ? (tag.name_en || tag.name) : tag.name;
  const featured = articles[0];
  const subFeatured = articles.slice(1, 3);
  const feed = articles.slice(3);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isEn ? `Tag: ${tagName}` : `标签：${tagName}`,
    description: isEn
      ? `Browse YayaNews articles related to #${tagName}`
      : `浏览与「${tagName}」相关的 YayaNews 资讯稿件`,
    url: `${siteConfig.siteUrl}/${params.lang}/tag/${decodedSlug}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title,
        url: `${siteConfig.siteUrl}/${params.lang}/article/${a.slug}`,
      })),
    },
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: dict.nav.home, url: `/${params.lang}` },
    { name: dict.nav.newsSection || dict.nav.news, url: `/${params.lang}/news` },
    { name: `#${tagName}`, url: `/${params.lang}/tag/${decodedSlug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="container-main py-6 sm:py-8">
      <ChannelHeader
        lang={params.lang}
        dict={dict}
        title={`#${tag.name}`}
        description={dict.tag.totalCount.replace("{count}", total.toString())}
      />

      <p className="yn-meta mb-6 text-slate-500">
        <LocalizedLink href="/news" className="text-slate-400 hover:text-slate-200">
          {dict.nav.newsSection}
        </LocalizedLink>
        <span className="mx-2" aria-hidden>/</span>
        <span>{dict.tag.tagTitle}</span>
      </p>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          {articles.length === 0 ? (
            <p className="py-16 text-center text-slate-500">{dict.tag.noArticles}</p>
          ) : (
            <>
              <section className="mb-8 space-y-4">
                <SectionHeader title={dict.tag.featured} emphasis="strong" />
                {featured ? <ArticleCard article={featured} featured priority /> : null}
                {subFeatured.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {subFeatured.map(a => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                ) : null}
              </section>

              <SectionHeader title={dict.tag.moreRelated} emphasis="default" />
              <div className="space-y-3">
                {feed.map(a => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </>
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
                    <LocalizedLink href={`/flash/${encodeFlashSlug(f as any)}`} className="group block">
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
              {popularTags.map(t => (
                <LocalizedLink
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    t.slug === tag.slug
                      ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-700/90 bg-slate-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{isEn ? (t.name_en || t.name) : t.name}
                </LocalizedLink>
              ))}
            </div>
          </RightRailPanel>
        </aside>
      </div>
    </div>
    </>
  );
}
