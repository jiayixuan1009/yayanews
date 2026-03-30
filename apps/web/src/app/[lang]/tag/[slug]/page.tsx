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
import ArticleCard from '@/components/ArticleCard';
import ChannelHeader from '@/components/editorial/ChannelHeader';
import RightRailPanel from '@/components/editorial/RightRailPanel';
import SectionHeader from '@/components/editorial/SectionHeader';

import { createMetadata } from '@yayanews/seo';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tag = await getTagBySlug(params.slug);
  if (!tag) return {};
  return createMetadata({
    title: `标签：${tag.name}`,
    description: `浏览与「${tag.name}」相关的 YayaNews 资讯稿件`,
    url: `/tag/${params.slug}`,
  });
}

export const revalidate = 120;

export default async function TagPage({ params }: { params: { slug: string; lang: string } }) {
  const tag = await getTagBySlug(params.slug);
  if (!tag) notFound();

  const dict = await getDictionary(params.lang as any);
  const articles = await getPublishedArticlesByTagSlug(params.slug, 48, 0);
  const total = await getArticleCountByTagSlug(params.slug);
  const popularTags = await getPopularTags(12);
  const flashMini = await getFlashNews(params.lang, 6);
  const featured = articles[0];
  const subFeatured = articles.slice(1, 3);
  const feed = articles.slice(3);

  return (
    <div className="container-main py-6 sm:py-8">
      <ChannelHeader
        title={`#${tag.name}`}
        description={dict.tag.totalCount.replace("{count}", total.toString())}
      />

      <p className="yn-meta mb-6 text-slate-500">
        <LocalizedLink href="/news" className="text-slate-400 hover:text-slate-200">
          资讯首页
        </LocalizedLink>
        <span className="mx-2">/</span>
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
                    <span className="yn-meta tabular-nums">{f.published_at?.slice(5, 16) ?? '—'}</span>
                    <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-200">{f.title}</p>
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
                  #{t.name}
                </LocalizedLink>
              ))}
            </div>
          </RightRailPanel>
        </aside>
      </div>
    </div>
  );
}
