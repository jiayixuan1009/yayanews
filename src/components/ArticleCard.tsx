import Link from 'next/link';
import Image from 'next/image';
import type { Article } from '@/lib/types';
import { getArticleCoverSrc, articleHasRealCover } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

function getCategoryBadgeClass(slug?: string): string {
  switch (slug) {
    case 'us-stock': return 'badge border-blue-200 bg-blue-50 text-blue-700';
    case 'hk-stock': return 'badge border-rose-200 bg-rose-50 text-rose-700';
    case 'crypto': return 'badge-crypto';
    case 'derivatives': return 'badge border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'ai': return 'badge border-violet-200 bg-violet-50 text-violet-700';
    default: return 'badge border-[#d8d1c5] bg-[#f3efe8] text-[#5b635f]';
  }
}

function getReadTime(type: string): string {
  switch (type) {
    case 'deep': return '8分钟';
    default: return '3分钟';
  }
}

function DepthBadge({ type }: { type: string }) {
  if (type !== 'deep') return null;
  return <span className="badge ml-1.5 border-violet-200 bg-violet-50 text-violet-700">深度研报</span>;
}

export default function ArticleCard({ article, featured = false, priority = false }: { article: Article; featured?: boolean; priority?: boolean }) {
  const coverSrc = getArticleCoverSrc(article.cover_image);
  const coverOpt = isRemoteImageOptimizable(coverSrc);
  const hasRealCover = articleHasRealCover(article.cover_image);

  if (featured) {
    return (
      <Link href={`/article/${article.slug}`} className="group block overflow-hidden border border-[#d9d2c8] bg-[#fbf9f5] transition-colors hover:border-[#b7ab99]">
        <div className="grid gap-0 lg:grid-cols-[1.08fr,0.92fr]">
          <div className="relative min-h-[300px] bg-[#ebe3d6] lg:order-2 lg:min-h-[540px]">
            <Image
              src={coverSrc}
              alt={article.title}
              fill
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover transition duration-700 group-hover:scale-[1.02]"
              priority={priority}
              unoptimized={!coverOpt}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1714]/75 via-[#0f1714]/20 to-transparent px-5 pb-5 pt-16 lg:hidden">
              <span className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Lead report</span>
            </div>
          </div>
          <div className="flex flex-col justify-between p-5 sm:p-8 lg:p-10">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {article.category_name && <span className={getCategoryBadgeClass(article.category_slug)}>{article.category_name}</span>}
                <DepthBadge type={article.article_type} />
                {!hasRealCover && <span className="badge border-amber-200 bg-amber-50 text-amber-700">待配图</span>}
              </div>
              <p className="mt-5 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-[#667067]">Lead report</p>
              <h2 className="mt-3 max-w-[10ch] font-display text-[2.4rem] font-semibold leading-[0.94] tracking-[-0.055em] text-[#101713] group-hover:text-[#1d5c4f] sm:text-[3rem] lg:text-[4.15rem]">
                {article.title}
              </h2>
              {article.summary && <p className="mt-5 max-w-[33ch] font-body text-[1rem] leading-8 text-slate-700 line-clamp-4">{article.summary}</p>}
            </div>
            <div className="mt-7 border-t border-[#e3dbcf] pt-5 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-[#14261f]">{article.author}</span>
                <span>{article.published_at?.slice(0, 16)}</span>
                <span>{getReadTime(article.article_type)}</span>
              </div>
              {article.source && article.source !== 'YayaNews' ? <div className="mt-2">来源: {article.source}</div> : null}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/article/${article.slug}`} className="group grid gap-4 border-t border-[#ddd5ca] py-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_196px] sm:items-start sm:gap-5 sm:py-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {article.category_name && <span className={getCategoryBadgeClass(article.category_slug)}>{article.category_name}</span>}
          <DepthBadge type={article.article_type} />
          {!hasRealCover && <span className="badge border-amber-200 bg-amber-50 text-amber-700">待配图</span>}
        </div>
        <h3 className="mt-3 max-w-[28ch] font-display text-[1.6rem] font-semibold leading-[1.02] tracking-[-0.045em] text-[#13211b] group-hover:text-[#1d5c4f] line-clamp-3 sm:text-[1.82rem]">
          {article.title}
        </h3>
        {article.summary && <p className="mt-3 max-w-[56ch] font-body text-[15px] leading-7 text-slate-600 line-clamp-3">{article.summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#ece4d8] pt-3 text-[11px] uppercase tracking-[0.16em] text-[#667067]">
          <span className="font-semibold text-[#14261f]">{article.author}</span>
          <span>{article.published_at?.slice(0, 16)}</span>
          <span>{getReadTime(article.article_type)}</span>
          {article.source && article.source !== 'YayaNews' && <span>来源: {article.source}</span>}
        </div>
      </div>
      <div className="relative order-first aspect-[4/3] overflow-hidden border border-[#d8d1c5] bg-[#ece6dc] sm:order-last sm:h-[138px] sm:w-[196px] sm:aspect-auto">
        <Image
          src={coverSrc}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 100vw, 196px"
          className="object-cover transition duration-700 group-hover:scale-[1.02]"
          unoptimized={!coverOpt}
        />
      </div>
    </Link>
  );
}
