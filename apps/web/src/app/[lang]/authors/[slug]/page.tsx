import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleCard from '@/components/ArticleCard';
import { getAuthorBySlug, getPublishedArticlesByAuthorSlug } from '@/lib/queries';
import { getDictionary } from '@/lib/dictionaries';
import { buildAuthorUrl, createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const author = await getAuthorBySlug(slug);
  if (!author) return {};
  const isEditorial = slug === 'yayanews-editorial';
  return createMetadata({
    title: locale === 'en'
      ? `${author.name} - Author Profile | YayaNews`
      : `${author.name} - 作者主页 | 鸭鸭财经新闻`,
    description: locale === 'en'
      ? `${author.name}'s latest financial news, market analysis and editorial coverage on YayaNews.`
      : `${author.name} 在鸭鸭财经新闻发布的财经资讯、市场分析与编辑报道。`,
    url: `/${locale}/authors/${slug}`,
    lang: locale,
    type: 'website',
    noIndex: !isEditorial && author.article_count < 3,
  });
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const [dict, author] = await Promise.all([
    getDictionary(locale),
    getAuthorBySlug(slug),
  ]);
  if (!author) notFound();

  const articles = await getPublishedArticlesByAuthorSlug(slug, locale, 24);
  const isEditorial = slug === 'yayanews-editorial';
  const authorDescription = locale === 'en'
    ? isEditorial
      ? 'YayaNews Editorial Desk curates real-time financial news, market context and data-informed analysis across US stocks, Hong Kong markets, crypto assets, derivatives and global macro.'
      : `${author.name} publishes market coverage and financial news analysis for YayaNews.`
    : isEditorial
      ? 'YayaNews 编辑部持续整理全球财经快讯、市场脉络与数据驱动分析，覆盖美股、港股、加密资产、衍生品与全球宏观。'
      : `${author.name} 在 YayaNews 发布市场资讯与财经分析。`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: buildAuthorUrl(author.name, locale),
    inLanguage: locale === 'en' ? 'en' : 'zh-CN',
    mainEntity: {
      '@type': 'Person',
      name: author.name,
      url: buildAuthorUrl(author.name, locale),
      description: authorDescription,
      worksFor: {
        '@type': 'NewsMediaOrganization',
        name: siteConfig.siteName,
        url: siteConfig.siteUrl,
      },
      sameAs: isEditorial ? Object.values(siteConfig.socialLinks) : undefined,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-8 sm:py-10">
        <header className="border-b border-[#ddd5ca] pb-6">
          <p className="yn-meta text-[#1d5c4f]">{locale === 'en' ? 'Author' : '作者'}</p>
          <h1 className="yn-page-title mt-3">{author.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#667067]">{authorDescription}</p>
          <dl className="mt-5 flex flex-wrap gap-4 text-xs uppercase tracking-[0.14em] text-[#68746c]">
            <div>
              <dt className="inline">{locale === 'en' ? 'Published' : '已发布'}</dt>
              <dd className="ml-2 inline font-semibold text-[#14261f]">{author.article_count}</dd>
            </div>
            <div>
              <dt className="inline">{locale === 'en' ? 'Coverage' : '覆盖领域'}</dt>
              <dd className="ml-2 inline font-semibold text-[#14261f]">
                {locale === 'en' ? 'Markets, macro, crypto, derivatives' : '市场、宏观、加密、衍生品'}
              </dd>
            </div>
          </dl>
        </header>

        <section className="mt-7">
          <h2 className="yn-heading">{locale === 'en' ? 'Latest Articles' : '最新文章'}</h2>
          {articles.length > 0 ? (
            <div className="mt-4">
              {articles.map(article => (
                <ArticleCard key={article.id} article={article} dict={dict} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-slate-500">{dict.common.noData}</p>
          )}
        </section>
      </div>
    </>
  );
}
