import type { Metadata } from 'next';
import Link from 'next/link';
import { getGuides } from '@/lib/queries';

export const metadata: Metadata = {
  title: '新手指南',
  description: '金融投资新手入门指南，涵盖美股港股开户、加密货币交易、衍生品入门等实用教程',
  alternates: { canonical: '/guide' },
  openGraph: { title: '新手指南 | YayaNews', description: '从零开始学习金融投资基础知识' },
};

export const revalidate = 600;

export default function GuidesPage() {
  const guides = getGuides(50);

  return (
    <div className="container-main py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">新手指南</h1>
        <p className="mt-1 text-sm text-gray-400">从零开始，系统学习金融投资基础知识</p>
      </div>

      {guides.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide, idx) => (
            <Link
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
                阅读指南 &rarr;
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-16">指南正在编写中，敬请期待</p>
      )}
    </div>
  );
}
