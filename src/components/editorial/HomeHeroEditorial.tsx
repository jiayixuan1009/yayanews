import Link from 'next/link';
import Image from 'next/image';
import MallardDuck from '@/components/MallardDuck';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import { siteConfig, type Article } from '@/lib/types';

type Props = {
  lead: Article | undefined;
  secondaries: Article[];
};

function HeroMeta({ article }: { article: Article }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
      <span className="font-semibold text-[#14261f]">{article.author}</span>
      <span>{article.article_type === 'deep' ? '14 min read' : '6 min read'}</span>
      <span>{article.view_count}</span>
    </div>
  );
}

function SecondaryFeature({ article }: { article: Article }) {
  const cover = getArticleCoverSrc(article.cover_image);
  const optimizable = isRemoteImageOptimizable(cover);
  return (
    <Link href={`/article/${article.slug}`} className="group grid gap-4 border-t border-[#ddd5ca] pt-4 sm:grid-cols-[1.1fr,1fr] sm:items-start">
      <div className="relative aspect-[16/10] overflow-hidden border border-[#d8d1c5] bg-[#e9e3d8]">
        <Image src={cover} alt={article.title} fill sizes="(max-width: 768px) 100vw, 26vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={!optimizable} />
      </div>
      <div>
        {article.category_name ? <span className="yn-meta text-[#1d5c4f]">{article.category_name}</span> : null}
        <h3 className="mt-2 font-display text-[1.65rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#101a15] group-hover:text-[#1d5c4f] sm:text-[1.9rem]">
          {article.title}
        </h3>
        {article.summary ? <p className="mt-3 max-w-[32ch] font-body text-[15px] leading-7 text-slate-600 line-clamp-3">{article.summary}</p> : null}
      </div>
    </Link>
  );
}

export default function HomeHeroEditorial({ lead, secondaries }: Props) {
  const leadCover = lead ? getArticleCoverSrc(lead.cover_image) : null;
  const leadCoverOptimizable = leadCover ? isRemoteImageOptimizable(leadCover) : false;
  const hotItems = secondaries.slice(0, 4);
  const lowerFeatures = secondaries.slice(0, 2);

  return (
    <section className="border-b border-[#ddd5ca] bg-[#f7f4ee]">
      <div className="container-main py-6 sm:py-8 lg:py-10">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#ddd5ca] pb-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8fcb79] bg-[#91f78e]/50">
              <MallardDuck size="sm" />
            </span>
            <div>
              <p className="yn-meta text-[#1d5c4f]">The Living Archive</p>
              <p className="text-xs text-slate-500">Curated Intelligence</p>
            </div>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">{siteConfig.siteName}</span>
        </div>

        {lead ? (
          <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)_280px] xl:items-start">
              <div>
                <div className="mb-3 inline-flex rounded-[2px] bg-[#91f78e]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d5c4f]">
                  {lead.article_type === 'deep' ? 'Investigative feature' : 'Featured report'}
                </div>
                <Link href={`/article/${lead.slug}`} className="group block">
                  <h1 className="max-w-[9ch] font-display text-[2.9rem] font-semibold leading-[0.93] tracking-[-0.055em] text-[#111713] group-hover:text-[#1d5c4f] sm:text-[4rem] lg:text-[4.7rem] xl:text-[5.2rem]">
                    {lead.title}
                  </h1>
                  {lead.summary ? <p className="mt-5 max-w-[34ch] font-body text-[1rem] leading-8 text-slate-700 sm:text-[1.08rem] sm:leading-9">{lead.summary}</p> : null}
                  <HeroMeta article={lead} />
                </Link>
              </div>

              <Link href={`/article/${lead.slug}`} className="group block xl:pt-3">
                <div className="relative mx-auto aspect-[4/5] max-w-[420px] overflow-hidden border border-[#1b241f] bg-[#0d1411] shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
                  {leadCover ? <Image src={leadCover} alt={lead.title} fill priority sizes="(max-width: 1280px) 70vw, 30vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={!leadCoverOptimizable} /> : null}
                  <div className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-[2px] border border-[#c6d2ca] bg-[#f6f3ee]/90 shadow-sm">
                    <MallardDuck size="sm" />
                  </div>
                </div>
              </Link>

              <div className="space-y-4 xl:pt-2">
                <div className="border border-[#ddd5ca] bg-[#f1eeea] px-4 py-5 sm:px-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-display text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-[#1a1c1c] sm:text-[2rem]">Hot Stream</h2>
                    <span className="text-[#1d5c4f]">⚡</span>
                  </div>
                  <ol className="space-y-4">
                    {hotItems.map((item, idx) => (
                      <li key={item.id} className="grid grid-cols-[1.8rem,1fr] gap-3 border-t border-[#dfd8ce] pt-4 first:border-t-0 first:pt-0">
                        <span className="font-display text-[1.8rem] italic leading-none text-[#d2ccc2] sm:text-[2rem]">{String(idx + 1).padStart(2, '0')}</span>
                        <Link href={`/article/${item.slug}`} className="group block">
                          <h3 className="font-display text-[1.08rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#1b201d] group-hover:text-[#1d5c4f] sm:text-[1.2rem]">
                            {item.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-x-2 text-[11px] uppercase tracking-[0.16em] text-[#7b807b]">
                            <span>{item.category_name || 'YayaNews'}</span>
                            <span>{item.published_at?.slice(0, 10)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="overflow-hidden border border-[#0e4739] bg-[#034433] text-white shadow-[0_16px_40px_rgba(3,68,51,0.18)]">
                  <div className="flex items-start justify-between gap-4 p-5 pb-3">
                    <div>
                      <h3 className="font-display text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[1.9rem]">Mascot Corner:</h3>
                      <p className="font-display text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[1.9rem]">Daily Curations</p>
                    </div>
                    <MallardDuck size="md" />
                  </div>
                  <div className="px-5 pb-5">
                    <p className="max-w-[28ch] text-sm leading-7 text-emerald-50/85">
                      我们把高频市场噪声整理成更适合阅读的判断顺序：先脉络，再证据，最后是动作信号。
                    </p>
                    <Link href="/guide" className="mt-5 inline-flex items-center justify-center rounded-[2px] bg-[#91f78e] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0d3f30] hover:bg-[#7be978]">
                      Read digest
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {lowerFeatures.length > 0 ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
                {lowerFeatures.map(item => <SecondaryFeature key={item.id} article={item} />)}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[2px] border border-[#ddd5ca] bg-white p-8 text-center text-sm text-slate-500">头条稿件准备中</div>
        )}
      </div>
    </section>
  );
}
