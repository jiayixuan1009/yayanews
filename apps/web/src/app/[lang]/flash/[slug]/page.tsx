import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFlashNewsById } from '@/lib/queries';
import { decodeFlashSlug, getImportanceDot } from '@/lib/ui-utils';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';
import LocalizedLink from '@/components/LocalizedLink';

/** High-importance and urgent flash items are substantive breaking news — index them */
function isIndexable(importance: string | undefined): boolean {
  return importance === 'high' || importance === 'urgent';
}

export async function generateMetadata({ params }: { params: { slug: string; lang: string } }): Promise<Metadata> {
  const flashId = decodeFlashSlug(params.slug);
  if (!flashId) return {};
  const flash = await getFlashNewsById(flashId);
  if (!flash || (flash.lang && flash.lang !== params.lang)) return {};
  return createMetadata({
    title: flash.title, // brand suffix auto-appended by title template
    description: (flash.content || flash.title).slice(0, 155),
    url: `/flash/${params.slug}`,
    type: 'article',
    publishedTime: flash.published_at || undefined,
    modifiedTime: flash.published_at || undefined,
    section: flash.category_name || undefined,
    lang: params.lang as 'zh' | 'en',
    // high/urgent = substantive breaking news worth indexing; low/normal = thin, keep noindex
    noIndex: !isIndexable(flash.importance),
  });
}

export const revalidate = 60;

export default async function FlashDetailPage({ params }: { params: { slug: string; lang: string } }) {
  const dict = await getDictionary(params.lang as any);
  const flashId = decodeFlashSlug(params.slug);
  if (!flashId) notFound();

  const flash = await getFlashNewsById(flashId);
  if (!flash || (flash.lang && flash.lang !== params.lang)) notFound();

  const loc = params.lang === 'en' ? '/en' : '/zh';
  const flashJsonLd = isIndexable(flash.importance) ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: flash.title,
    description: (flash.content || flash.title).slice(0, 200),
    datePublished: new Date(flash.published_at).toISOString(),
    dateModified: new Date(flash.published_at).toISOString(),
    inLanguage: params.lang === 'en' ? 'en' : 'zh-CN',
    isAccessibleForFree: true,
    ...(flash.source_url ? { citation: { '@type': 'CreativeWork', url: flash.source_url, ...(flash.source ? { name: flash.source } : {}) } } : {}),
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteConfig.siteUrl}/brand/logo-square.png`, width: 512, height: 512 },
      sameAs: Object.values(siteConfig.socialLinks),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteConfig.siteUrl}${loc}/flash/${params.slug}` },
  } : null;

  return (
    <>
      {flashJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(flashJsonLd) }}
        />
      )}
    <div className="container-main py-8 sm:py-12 lg:py-16 min-h-[70vh]">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <LocalizedLink href="/" className="hover:text-primary-400 transition-colors">
            {dict.nav.home || '首页'}
          </LocalizedLink>
          <span>/</span>
          <LocalizedLink href="/flash" className="hover:text-primary-400 transition-colors">
            {dict.nav.flash || '7x24快讯'}
          </LocalizedLink>
        </nav>

        <article className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-800/80">
             <div className={`w-full h-full opacity-80 ${getImportanceDot(flash.importance)}`} />
          </div>
          
          <header className="mb-6">
            <div className="flex items-center gap-3 mb-4 text-sm font-mono text-gray-400">
              <time dateTime={flash.published_at}>{flash.published_at?.replace('T', ' ')}</time>
              {flash.category_name && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800/50 text-gray-300 font-sans text-xs">
                  {flash.category_name}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 leading-tight">
              {flash.title}
            </h1>
          </header>

          {flash.content && (
            <div className="prose prose-invert prose-slate max-w-none text-gray-300 leading-relaxed text-base sm:text-lg">
              {flash.content.split('\n').map((paragraph: string, i: number) => (
                paragraph.trim() ? <p key={i}>{paragraph}</p> : null
              ))}
            </div>
          )}
          
          {flash.source_url && (
            <div className="mt-10 pt-6 border-t border-slate-800/60">
              <a 
                href={flash.source_url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                {dict.flash?.viewSource || 'View original source'} &rarr;
              </a>
            </div>
          )}
        </article>
      </div>
    </div>
    </>
  );
}
