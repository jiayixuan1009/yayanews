import type { Article } from '@yayanews/types';
import Image from 'next/image';
import LocalizedLink from '@/components/LocalizedLink';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

type Props = {
  lang: string;
  dict: any;
  title: string;
  description: string;
  label?: string;
  quote?: string;
  featured?: Article | null;
};

export default function ChannelHeader({
  lang,
  dict,
  title,
  description,
  label = 'SECTION',
  quote,
  featured,
}: Props) {
  const coverSrc = featured ? getArticleCoverSrc(featured.cover_image, undefined, featured.source) : null;
  const coverOpt = coverSrc ? isRemoteImageOptimizable(coverSrc) : false;

  return (
    <header className="mb-10 grid gap-0 xl:grid-cols-[150px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[#d6cec2] bg-[#efebe4] xl:flex xl:flex-col xl:justify-between">
        <div className="space-y-6 p-5">
          <div className="border border-[#d6cec2] bg-white p-3">
            <p className="yn-meta text-[#1d5c4f]">{lang === 'zh' ? '动态档案' : 'The Living Archive'}</p>
            <p className="mt-2 text-xs yn-body text-[#667067]">
              {lang === 'zh' ? '为追踪结构性变化读者提供的每日精选情报。' : 'Curated daily intelligence for readers tracking structural shifts.'}
            </p>
          </div>
          <nav className="space-y-2 yn-action text-[#667067]">
            <LocalizedLink href="/" className="block border-l-2 border-[#1d5c4f] pl-3 text-[#14261f]">{dict?.nav?.home || 'Home'}</LocalizedLink>
            <LocalizedLink href="/flash" className="block pl-3">{dict?.nav?.flash || 'Breaking'}</LocalizedLink>
            <LocalizedLink href="/news" className="block pl-3">{dict?.home?.newsOverview || 'Trending'}</LocalizedLink>
          </nav>
        </div>
        <div className="space-y-4 p-5">
          <button className="w-full border border-[#7ae88a] bg-[#9cff8f] px-3 py-2 yn-action text-[#0e2a1f]">
            {lang === 'zh' ? '订阅简报' : 'Newsletter signup'}
          </button>
        </div>
      </aside>

      <div className="border border-[#d6cec2] bg-[#004c39] text-white">
        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-stretch lg:gap-10 lg:p-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-4 border-b border-white/15 pb-4">
              <span className="border border-[#7fe193] bg-[#d5ff8d]/90 px-2 py-1 yn-action text-[#0e2a1f]">
                {label} • {title}
              </span>
              {quote && <p className="hidden font-display text-base tracking-tight text-white/75 md:block">“{quote}”</p>}
            </div>
            <h1 className="yn-display mt-5 max-w-[8ch] text-white">
              {title}
            </h1>
            <p className="mt-5 max-w-[36ch] font-body text-[1rem] leading-8 text-white/78 md:text-[1.05rem]">{description}</p>
          </div>

          <div className="relative min-h-[340px] overflow-hidden border border-white/10 bg-[#08241d] shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
            {coverSrc ? (
              <Image
                src={coverSrc}
                alt={featured?.title ?? title}
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
                priority
                unoptimized={!coverOpt}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(82,203,177,0.45),_transparent_35%),linear-gradient(180deg,_#092e25,_#021d16)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.28))]" />

            {featured ? (
              <div className="absolute bottom-5 left-5 max-w-[320px] rotate-[-2deg] border border-[#d6cec2] bg-[#f8f4ee] p-4 text-[#14261f] shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                <p className="yn-meta text-[#1d5c4f]">{dict?.home?.editorsPicks || "Editor's pick"}</p>
                <p className="yn-card-title mt-2 line-clamp-3">{featured.title}</p>
                <LocalizedLink href={`/article/${featured.slug}`} className="mt-3 inline-block yn-action text-[#1d5c4f] hover:text-[#143d33]">
                  {lang === 'zh' ? '展开档案 →' : 'Open dossier →'}
                </LocalizedLink>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
