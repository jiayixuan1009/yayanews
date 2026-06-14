import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getFlashNewsById } from '@/lib/queries';
import { decodeFlashSlug, encodeFlashSlug, getImportanceDot } from '@/lib/ui-utils';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';
import LocalizedLink from '@/components/LocalizedLink';

/** High-importance and urgent flash items are substantive breaking news — index them */
function isIndexable(importance: string | undefined): boolean {
  return importance === 'high' || importance === 'urgent';
}

function flashLocale(value?: string | null): 'zh' | 'en' {
  return value === 'en' ? 'en' : 'zh';
}

function normalizeRouteSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeRouteSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lang: string }> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const flashId = decodeFlashSlug(slug);
  if (!flashId) return {};
  const flash = await getFlashNewsById(flashId);
  const locale = flashLocale(lang);
  if (!flash || flashLocale(flash.lang) !== locale) return {};
  const canonicalSlug = encodeFlashSlug(flash);
  const canonicalPath = `/${locale}/flash/${canonicalSlug}`;

  return createMetadata({
    title: flash.title, // brand suffix auto-appended by title template
    description: (flash.content || flash.title).slice(0, 155),
    url: `/flash/${canonicalSlug}`,
    type: 'article',
    publishedTime: flash.published_at || undefined,
    modifiedTime: flash.published_at || undefined,
    section: flash.category_name || undefined,
    lang: locale,
    alternatesLanguages: {
      [locale]: canonicalPath,
      'x-default': canonicalPath,
    },
    // high/urgent = substantive breaking news worth indexing; low/normal = thin, keep noindex
    noIndex: !isIndexable(flash.importance),
  });
}

export const revalidate = 60;

export default async function FlashDetailPage({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang } = await params;
  const flashId = decodeFlashSlug(slug);
  if (!flashId) notFound();

  const flash = await getFlashNewsById(flashId);
  if (!flash) notFound();

  const flashLang = flashLocale(flash.lang);
  const canonicalSlug = encodeFlashSlug(flash);
  if (flashLang !== lang || canonicalSlug !== normalizeRouteSlug(slug)) {
    permanentRedirect(`/${flashLang}/flash/${encodeRouteSegment(canonicalSlug)}`);
  }

  const dict = await getDictionary(lang);
  const loc = lang === 'en' ? '/en' : '/zh';
  const flashJsonLd = isIndexable(flash.importance) ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: flash.title,
    description: (flash.content || flash.title).slice(0, 200),
    datePublished: new Date(flash.published_at).toISOString(),
    dateModified: new Date(flash.published_at).toISOString(),
    inLanguage: lang === 'en' ? 'en' : 'zh-CN',
    isAccessibleForFree: true,
    ...(flash.source_url ? { citation: { '@type': 'CreativeWork', url: flash.source_url, ...(flash.source ? { name: flash.source } : {}) } } : {}),
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteConfig.siteUrl}/brand/logo-square.png`, width: 512, height: 512 },
      sameAs: Object.values(siteConfig.socialLinks),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteConfig.siteUrl}${loc}/flash/${canonicalSlug}` },
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
