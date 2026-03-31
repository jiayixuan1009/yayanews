import { getDictionary } from '@/lib/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFlashNewsById } from '@/lib/queries';
import { decodeFlashSlug, getImportanceDot } from '@/lib/ui-utils';
import { createMetadata } from '@yayanews/seo';
import LocalizedLink from '@/components/LocalizedLink';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const flashId = decodeFlashSlug(params.slug);
  if (!flashId) return {};
  const flash = await getFlashNewsById(flashId);
  if (!flash) return {};
  return createMetadata({
    title: flash.title + ' - 7x24速递',
    description: flash.content || flash.title,
    url: `/flash/${params.slug}`,
    type: 'article',
    publishedTime: flash.published_at || undefined,
    modifiedTime: flash.published_at || undefined,
    section: flash.category_name || undefined,
  });
}

export const revalidate = 60;

export default async function FlashDetailPage({ params }: { params: { slug: string; lang: string } }) {
  const dict = await getDictionary(params.lang as any);
  const flashId = decodeFlashSlug(params.slug);
  if (!flashId) notFound();

  const flash = await getFlashNewsById(flashId);
  if (!flash) notFound();

  return (
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
                查看原文来源 &rarr;
              </a>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
