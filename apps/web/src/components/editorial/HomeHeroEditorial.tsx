import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import MallardDuck from '@/components/MallardDuck';
import { getArticleCoverSrc } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';
import { siteConfig, type Article } from '@yayanews/types';

type Props = {
  lead: Article | undefined;
  secondaries: Article[];
  dict?: any;
};

function HeroMeta({ article, dict }: { article: Article; dict?: any }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
      <span className="font-semibold text-[#14261f]">{article.author}</span>
      <span>{article.article_type === 'deep' ? `14 ${dict?.common?.minute || 'min read'}` : `6 ${dict?.common?.minute || 'min read'}`}</span>
      <span>{article.view_count}</span>
    </div>
  );
}

function SecondaryFeature({ article, dict }: { article: Article; dict?: any }) {
  const cover = getArticleCoverSrc(article.cover_image);
  const optimizable = isRemoteImageOptimizable(cover);
  return (
    <LocalizedLink href={`/article/${article.slug}`} className="group grid gap-4 border-t border-[#ddd5ca] pt-4 sm:grid-cols-[1.1fr,1fr] sm:items-start">
      <div className="relative aspect-[16/10] overflow-hidden border border-[#d8d1c5] bg-[#e9e3d8]">
        <Image src={cover} alt={article.title} fill sizes="(max-width: 768px) 100vw, 26vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={cover.endsWith('.svg') || !optimizable} />
      </div>
      <div>
        {article.category_name ? <span className="yn-meta text-[#1d5c4f]">{dict?.nav?.[article.category_slug || ''] || article.category_name}</span> : null}
        <h3 className="mt-2 font-display text-[1.65rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#101a15] group-hover:text-[#1d5c4f] sm:text-[1.9rem]">
          {article.title}
        </h3>
        {article.summary ? <p className="mt-3 max-w-[32ch] font-body text-[15px] leading-7 text-slate-600 line-clamp-3">{article.summary}</p> : null}
      </div>
    </LocalizedLink>
  );
}

export default function HomeHeroEditorial({ lead, secondaries, dict = {} }: Props) {
  const leadCover = lead ? getArticleCoverSrc(lead.cover_image) : null;
  const leadCoverOptimizable = leadCover ? isRemoteImageOptimizable(leadCover) : false;
  const hotItems = secondaries.slice(0, 4);
  const lowerFeatures = secondaries.slice(0, 2);

  return (
    <section className="border-b border-[#ddd5ca] bg-[#f7f4ee]">
      <div className="container-main py-4 md:py-6 lg:py-8">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#ddd5ca] pb-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8fcb79] bg-[#91f78e]/50">
              <MallardDuck size="sm" />
            </span>
            <div>
              <p className="yn-meta text-[#1d5c4f]">{dict.home?.livingArchive || 'The Living Archive'}</p>
              <p className="text-xs text-slate-500">{dict.home?.curatedIntel || 'Curated Intelligence'}</p>
            </div>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">{siteConfig.siteName}</span>
        </div>

        {lead ? (
          <>
            <div className="grid gap-6 md:gap-8 lg:gap-10 xl:grid-cols-[1fr_300px] xl:items-start">
              
              {/* WSJ / Bloomberg Style Main Feature Column */}
              <div className="flex flex-col gap-4 md:gap-5">
                
                {/* Full-width Title Block */}
                <div className="pt-2">
                  <div className="mb-3 inline-flex rounded-[2px] bg-[#91f78e]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d5c4f]">
                    {lead.article_type === 'deep' ? (dict.home?.investigativeFeature || 'Investigative feature') : (dict.home?.featuredReport || 'Featured report')}
                  </div>
                  <LocalizedLink href={`/article/${lead.slug}`} className="group block mb-2">
                    <h1 className="font-display text-[2.2rem] md:text-[2.8rem] lg:text-[3.4rem] font-bold leading-[1.05] tracking-[-0.03em] text-[#111713] group-hover:text-[#1d5c4f]">
                      {lead.title}
                    </h1>
                  </LocalizedLink>
                </div>

                {/* Sub-grid for Image and Summary */}
                <div className="grid gap-4 sm:gap-6 md:grid-cols-[1.5fr_1fr] md:items-start border-t border-[#dfd8ce] pt-4 md:pt-5">
                  <LocalizedLink href={`/article/${lead.slug}`} className="group block">
                    <div className="relative aspect-[3/2] overflow-hidden border border-[#1b241f] bg-[#0d1411] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                      {leadCover ? <Image src={leadCover} alt={lead.title} fill priority sizes="(max-width: 1280px) 70vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" unoptimized={leadCover.endsWith('.svg') || !leadCoverOptimizable} /> : null}
                      <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#c6d2ca] bg-[#f6f3ee]/90 shadow-sm">
                        <MallardDuck size="sm" />
                      </div>
                    </div>
                  </LocalizedLink>

                  <LocalizedLink href={`/article/${lead.slug}`} className="group block flex-1">
                    {lead.summary ? (
                      <p className="font-body text-[1.1rem] leading-relaxed text-[#3a443e] sm:text-[1.15rem]">
                        {lead.summary}
                      </p>
                    ) : null}
                    <div className="mt-4 pt-4 border-t border-[#dfd8ce] border-dashed">
                      <HeroMeta article={lead} dict={dict} />
                    </div>
                  </LocalizedLink>
                </div>

              </div>

              {/* Right Rail: Hot Stream & Mascot */}
              <div className="space-y-6">
                <div className="border border-[#ddd5ca] bg-[#f1eeea] px-4 py-5 sm:px-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-display text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-[#1a1c1c] sm:text-[2rem]">{dict.home?.hotStream || 'Hot Stream'}</h2>
                    <span className="text-[#1d5c4f]">⚡</span>
                  </div>
                  <ol className="space-y-4">
                    {hotItems.map((item, idx) => (
                      <li key={item.id} className="grid grid-cols-[1.8rem,1fr] gap-3 border-t border-[#dfd8ce] pt-4 first:border-t-0 first:pt-0">
                        <span className="font-display text-[1.8rem] italic leading-none text-[#d2ccc2] sm:text-[2rem]">{String(idx + 1).padStart(2, '0')}</span>
                        <LocalizedLink href={`/article/${item.slug}`} className="group block">
                          <h3 className="font-display text-[1.08rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#1b201d] group-hover:text-[#1d5c4f] sm:text-[1.2rem]">
                            {item.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-x-2 text-[11px] uppercase tracking-[0.16em] text-[#7b807b]">
                            <span>{dict.nav?.[item.category_slug || ''] || item.category_name || 'YayaNews'}</span>
                            <span>{item.published_at?.slice(0, 10)}</span>
                          </div>
                        </LocalizedLink>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="overflow-hidden border border-[#0e4739] bg-[#034433] text-white shadow-[0_16px_40px_rgba(3,68,51,0.18)]">
                  <div className="flex items-start justify-between gap-4 p-5 pb-3">
                    <div>
                      <h3 className="font-display text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[1.9rem]">{dict.home?.mascotCorner || 'Mascot Corner:'}</h3>
                      <p className="font-display text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[1.9rem]">{dict.home?.dailyCurations || 'Daily Curations'}</p>
                    </div>
                    <MallardDuck size="md" />
                  </div>
                  <div className="px-5 pb-5">
                    <p className="max-w-[28ch] text-sm leading-7 text-emerald-50/85">
                      {dict.home?.mascotDesc || 'Curating high-frequency market noise into a readable order of judgment: context, evidence, and finally action signals.'}
                    </p>
                    <LocalizedLink href="/guide" className="mt-5 inline-flex items-center justify-center rounded-[2px] bg-[#91f78e] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0d3f30] hover:bg-[#7be978]">
                      {dict.home?.readDigest || 'Read digest'}
                    </LocalizedLink>
                  </div>
                </div>
              </div>
            </div>

            {lowerFeatures.length > 0 ? (
              <div className="mt-5 md:mt-8 grid gap-4 md:gap-6 lg:grid-cols-2 lg:gap-8">
                {lowerFeatures.map(item => <SecondaryFeature key={item.id} article={item} dict={dict} />)}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[2px] border border-[#ddd5ca] bg-white p-8 text-center text-sm text-slate-500">{dict.home?.noLead || 'Headline article in preparation'}</div>
        )}
      </div>
    </section>
  );
}
