import type { Article } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

type Props = {
  title: string;
  description: string;
  label?: string;
  quote?: string;
  featured?: Article | null;
};

export default function ChannelHeader({
  title,
  description,
  label = 'SECTION',
  quote = 'An edited briefing from the living archive.',
  featured,
}: Props) {
  const coverSrc = featured ? getArticleCoverSrc(featured.cover_image) : null;
  const coverOpt = coverSrc ? isRemoteImageOptimizable(coverSrc) : false;

  return (
    <header className="mb-10 grid gap-0 xl:grid-cols-[96px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[#d6cec2] bg-[#efebe4] xl:flex xl:flex-col xl:justify-between">
        <div className="space-y-6 p-5">
          <div className="border border-[#d6cec2] bg-white p-3">
            <p className="yn-meta text-[#1d5c4f]">The Living Archive</p>
            <p className="mt-2 text-[11px] leading-5 text-[#667067]">Curated daily intelligence for readers tracking structural shifts.</p>
          </div>
          <nav className="space-y-2 text-[11px] uppercase tracking-[0.18em] text-[#667067]">
            <div className="border-l-2 border-[#1d5c4f] pl-3 text-[#14261f]">Home</div>
            <div className="pl-3">Breaking</div>
            <div className="pl-3">Trending</div>
            <div className="pl-3">Saved</div>
            <div className="pl-3">Mascot Corner</div>
          </nav>
        </div>
        <div className="space-y-4 p-5">
          <button className="w-full border border-[#7ae88a] bg-[#9cff8f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0e2a1f]">
            Newsletter signup
          </button>
          <div className="space-y-2 text-[10px] uppercase tracking-[0.18em] text-[#667067]">
            <div>Settings</div>
            <div>Help</div>
          </div>
        </div>
      </aside>

      <div className="border border-[#d6cec2] bg-[#004c39] text-white">
        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-stretch lg:gap-10 lg:p-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-4 border-b border-white/15 pb-4">
              <span className="border border-[#7fe193] bg-[#d5ff8d]/90 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0e2a1f]">
                {label}: {title}
              </span>
              <p className="hidden font-display text-base italic tracking-tight text-white/75 md:block">“{quote}”</p>
            </div>
            <h1 className="mt-5 max-w-[8ch] font-display text-[3.5rem] font-semibold leading-[0.9] tracking-[-0.07em] text-white sm:text-[4.5rem] lg:text-[5.6rem]">
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
              <div className="absolute bottom-5 left-5 max-w-[260px] rotate-[-2deg] border border-[#d6cec2] bg-[#f8f4ee] p-4 text-[#14261f] shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                <p className="yn-meta text-[#1d5c4f]">Editor&apos;s pick</p>
                <p className="mt-2 font-display text-lg leading-tight">{featured.title}</p>
                <Link href={`/article/${featured.slug}`} className="mt-3 inline-block text-[11px] uppercase tracking-[0.16em] text-[#1d5c4f] hover:text-[#143d33]">
                  Open dossier →
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
