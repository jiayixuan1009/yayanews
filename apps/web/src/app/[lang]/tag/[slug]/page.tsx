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

function tagAlternates(slug: string, counts: { zh: number; en: number }, currentLang: 'zh' | 'en') {
  const languages: Record<string, string> = {};
  if (counts.zh >= 3) languages.zh = `/zh/tag/${slug}`;
  if (counts.en >= 3) languages.en = `/en/tag/${slug}`;

  if (Object.keys(languages).length === 0) {
    languages[currentLang] = `/${currentLang}/tag/${slug}`;
  }

  languages['x-default'] = languages.zh || languages.en || languages[currentLang];
  return languages;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lang: string }> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const tag = await getTagBySlug(decodedSlug);
  if (!tag) return {};
  const isZh = lang !== 'en';
  const locale = isZh ? 'zh' : 'en';
  const tagName = isZh ? tag.name : (tag.name_en || tag.name);
  const [zhArticleCount, enArticleCount] = await Promise.all([
    getArticleCountByTagSlug(decodedSlug, 'zh'),
    getArticleCountByTagSlug(decodedSlug, 'en'),
  ]);
  const articleCount = isZh ? zhArticleCount : enArticleCount;
  return createMetadata({
    title: isZh ? `标签：${tagName}` : `Tag: ${tagName}`,
    description: isZh
      ? `追踪「${tagName}」相关市场新闻、深度分析和实时资讯，覆盖美股、港股、加密货币、衍生品与宏观事件。`
      : `Track YayaNews market coverage related to #${tagName}, including news, analysis and live updates across stocks, crypto, derivatives and macro events.`,
    url: `/tag/${decodedSlug}`,
    lang: locale,
    alternatesLanguages: tagAlternates(decodedSlug, { zh: zhArticleCount, en: enArticleCount }, locale),
    noIndex: articleCount < 3, // P1 SEO: thin tag pages (< 3 articles) excluded from index pool
  });
}

export const revalidate = 120;

export default async function TagPage({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [tag, dict, articles, total, popularTags, flashMini] = await Promise.all([
    getTagBySlug(decodedSlug),
    getDictionary(lang),
    getPublishedArticlesByTagSlug(decodedSlug, 24, 0, lang),
    getArticleCountByTagSlug(decodedSlug, lang),
    getPopularTags(12).catch(() => []),
    getFlashNews(lang, 6).catch(() => []),
  ]);
  if (!tag) notFound();
  const isEn = lang === 'en';
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
    url: `${siteConfig.siteUrl}/${lang}/tag/${decodedSlug}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title,
        url: `${siteConfig.siteUrl}/${lang}/article/${a.slug}`,
      })),
    },
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: dict.nav.home, url: `/${lang}` },
    { name: dict.nav.newsSection || dict.nav.news, url: `/${lang}/news` },
    { name: `#${tagName}`, url: `/${lang}/tag/${decodedSlug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="container-main py-6 sm:py-8">
      <ChannelHeader
        lang={lang}
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
