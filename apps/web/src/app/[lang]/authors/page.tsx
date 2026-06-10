import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { getAuthorsForIndex, getPublishedArticles } from '@/lib/queries';
import { buildAuthorUrl, createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en' ? 'Authors and Editorial Contributors' : '作者与编辑团队',
    description: locale === 'en'
      ? 'Meet the YayaNews editorial desk and market contributors behind our financial news, analysis and live market coverage.'
      : '了解 YayaNews 编辑团队与市场作者，查看财经资讯、市场分析与实时新闻报道的作者主页。',
    url: '/authors',
    type: 'website',
    lang: locale,
  });
}

function roleFor(author: { slug: string; name: string }, locale: 'zh' | 'en') {
  if (author.slug === 'yayanews-editorial') {
    return locale === 'en' ? 'Editorial Desk' : '编辑部';
  }
  return locale === 'en' ? 'Market Contributor' : '市场作者';
}

export default async function AuthorsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const [authors, latestArticles] = await Promise.all([
    getAuthorsForIndex(120),
    getPublishedArticles(locale, 6).catch(() => []),
  ]);

  const visibleAuthors = authors.filter(author => author.slug === 'yayanews-editorial' || author.article_count >= 1);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'en' ? 'YayaNews Authors' : 'YayaNews 作者',
    description: locale === 'en'
      ? 'Author directory for the YayaNews editorial desk and financial market contributors.'
      : 'YayaNews 编辑团队与财经市场作者目录。',
    url: `${siteConfig.siteUrl}/${locale}/authors`,
    inLanguage: locale === 'en' ? 'en' : 'zh-CN',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: visibleAuthors.length,
      itemListElement: visibleAuthors.map((author, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Person',
          name: author.name,
          url: buildAuthorUrl(author.name, locale),
          jobTitle: roleFor(author, locale),
          worksFor: {
            '@type': 'NewsMediaOrganization',
            name: siteConfig.siteName,
            url: siteConfig.siteUrl,
          },
        },
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-10 sm:py-12">
        <header className="border-b border-[#ddd5ca] pb-7">
          <p className="yn-meta text-[#1d5c4f]">{locale === 'en' ? 'Trust & bylines' : '信任与署名'}</p>
          <h1 className="yn-page-title mt-3">{locale === 'en' ? 'Authors and Editorial Contributors' : '作者与编辑团队'}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#667067]">
            {locale === 'en'
              ? 'Every byline links to a stable author profile, so readers and search engines can understand who produced the coverage and where to find related work.'
              : '每个署名都指向稳定的作者主页，便于读者和搜索引擎理解报道来源、作者职责与相关作品。'}
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleAuthors.map(author => (
            <LocalizedLink
              key={author.slug}
              href={`/authors/${author.slug}`}
              className="yn-panel group flex min-h-[170px] flex-col p-5 transition-colors hover:border-[#bfb4a5]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="yn-meta text-[#1d5c4f]">{roleFor(author, locale)}</p>
                  <h2 className="mt-2 text-xl font-semibold leading-7 text-[#14261f] group-hover:text-[#1d5c4f]">{author.name}</h2>
                </div>
                <span className="rounded-full border border-[#cfe1d9] bg-[#eef6f3] px-2.5 py-1 text-xs font-semibold text-[#1d5c4f]">
                  {author.article_count}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#667067]">
                {author.slug === 'yayanews-editorial'
                  ? locale === 'en'
                    ? 'Real-time financial news, market context and editorially reviewed analysis across major asset classes.'
                    : '覆盖主要资产类别的实时财经新闻、市场脉络与经编辑审核的分析内容。'
                  : locale === 'en'
                    ? 'Market coverage and financial news analysis published through the YayaNews editorial workflow.'
                    : '通过 YayaNews 编辑流程发布的市场资讯与财经分析。'}
              </p>
              <span className="mt-auto pt-4 text-sm font-semibold text-[#1d5c4f]">
                {locale === 'en' ? 'View profile' : '查看主页'}
              </span>
            </LocalizedLink>
          ))}
        </section>

        {latestArticles.length > 0 ? (
          <section className="mt-10 border-t border-[#ddd5ca] pt-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="yn-meta text-[#1d5c4f]">{locale === 'en' ? 'Recent work' : '近期作品'}</p>
                <h2 className="yn-heading mt-1">{locale === 'en' ? 'Latest Published Articles' : '最新发布文章'}</h2>
              </div>
              <LocalizedLink href="/news" className="yn-link text-sm font-semibold">
                {locale === 'en' ? 'All news' : '全部新闻'}
              </LocalizedLink>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {latestArticles.map(article => (
                <LocalizedLink key={article.id} href={`/article/${article.slug}`} className="yn-panel group p-4 hover:border-[#bfb4a5]">
                  <p className="yn-meta text-[#1d5c4f]">{article.author}</p>
                  <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-7 text-[#14261f] group-hover:text-[#1d5c4f]">{article.title}</h3>
                  {article.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667067]">{article.summary}</p> : null}
                </LocalizedLink>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
