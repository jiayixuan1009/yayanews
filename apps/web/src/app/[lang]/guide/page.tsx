import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { getGuides } from '@/lib/queries';
import { createMetadata } from '@yayanews/seo';

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const isZh = params.lang !== 'en';
  return createMetadata({
    title: isZh ? '新手指南 | 金融投资入门教程' : 'Beginner\'s Guide | Financial Investment Tutorials',
    description: isZh
      ? '金融投资新手入门指南，涵盖美股港股开户、加密货币交易、衍生品入门等实用教程，帮助投资者从零开始系统学习。'
      : 'Financial investment beginner guides covering US & HK stock accounts, crypto trading, derivatives basics, and practical tutorials for investors starting from scratch.',
    url: '/guide',
    lang: params.lang as 'zh' | 'en',
    type: 'website',
  });
}

export const revalidate = 600;

export default async function GuidesPage({ params }: { params: { lang: string } }) {
  const isZh = params.lang !== 'en';
  const guides = await getGuides(50);

  const headingText = isZh ? '新手指南' : "Beginner's Guide";
  const subText = isZh
    ? '从零开始，系统学习金融投资基础知识'
    : 'Learn financial investment basics from the ground up.';
  const readLabel = isZh ? '阅读指南 →' : 'Read guide →';
  const emptyText = isZh ? '指南正在编写中，敬请期待' : 'Guides are being prepared. Check back soon.';

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: headingText,
    description: subText,
    hasPart: guides.map((guide, idx) => ({
      '@type': 'Article',
      position: idx + 1,
      name: guide.title,
      description: guide.summary || guide.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <div className="container-main py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{headingText}</h1>
          <p className="mt-1 text-sm text-gray-400">{subText}</p>
        </div>

        {guides.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide, idx) => (
              <LocalizedLink
                key={guide.id}
                href={`/guide/${guide.slug}`}
                className="card group flex flex-col p-5 transition-colors hover:border-primary-500/50"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20 text-primary-400 font-bold">
                  {idx + 1}
                </div>
                <h2 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">
                  {guide.title}
                </h2>
                {guide.summary && (
                  <p className="mt-2 text-sm text-gray-400 line-clamp-3">{guide.summary}</p>
                )}
                <div className="mt-auto pt-3 text-xs text-primary-400 group-hover:translate-x-1 transition-transform">
                  {readLabel}
                </div>
              </LocalizedLink>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-16">{emptyText}</p>
        )}
      </div>
    </>
  );
}
