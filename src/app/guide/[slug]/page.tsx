import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuideBySlug, getGuides } from '@/lib/queries';
import { siteConfig } from '@/lib/types';
import CtaBanner from '@/components/CtaBanner';
import { sanitizeHtml } from '@/lib/sanitize';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuideBySlug(params.slug);
  if (!guide) return { title: '指南未找到' };
  return {
    title: guide.title,
    description: guide.summary || `${guide.title} - ${siteConfig.siteName}新手指南`,
    alternates: { canonical: `/guide/${params.slug}` },
    openGraph: { title: `${guide.title} | YayaNews`, description: guide.summary || guide.title },
  };
}

export async function generateStaticParams() {
  const guides = getGuides(100);
  return guides.map(g => ({ slug: g.slug }));
}

export const revalidate = 600;

export default function GuideDetailPage({ params }: Props) {
  const guide = getGuideBySlug(params.slug);
  if (!guide) notFound();

  return (
    <div className="container-main py-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:text-primary-400">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/guide" className="hover:text-primary-400">新手指南</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{guide.title}</span>
      </nav>

      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white leading-tight">{guide.title}</h1>
        {guide.summary && (
          <p className="mt-3 text-lg text-gray-400">{guide.summary}</p>
        )}

        <div
          className="prose prose-invert prose-slate max-w-none mt-8"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(guide.content) }}
        />
      </article>

      <div className="mt-12">
        <CtaBanner />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: guide.title,
            description: guide.summary || guide.title,
            publisher: {
              '@type': 'Organization',
              name: siteConfig.siteName,
              url: siteConfig.siteUrl,
            },
          }),
        }}
      />
    </div>
  );
}
