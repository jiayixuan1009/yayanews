import LocalizedLink from '@/components/LocalizedLink';
import Image from 'next/image';
import type { Article } from '@yayanews/types';
import { getArticleCoverSrc, articleHasRealCover } from '@/lib/article-image';
import { isRemoteImageOptimizable } from '@/lib/remote-image';

function getCategoryBadgeClass(slug?: string): string {
  switch (slug) {
    case 'us-stock': return 'yn-tag bg-blue-50 text-blue-700 hover:bg-blue-100';
    case 'hk-stock': return 'yn-tag bg-rose-50 text-rose-700 hover:bg-rose-100';
    case 'crypto': return 'yn-tag bg-[#f5efe6] text-[#b08735] hover:bg-[#ebdcc0]';
    case 'derivatives': return 'yn-tag bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    case 'ai': return 'yn-tag bg-violet-50 text-violet-700 hover:bg-violet-100';
    default: return 'yn-tag';
  }
}

function getReadTime(type: string, dict: Record<string, any>): string {
  switch (type) {
    case 'deep': return `8 ${dict.common?.minute || 'min'}`;
    default: return `3 ${dict.common?.minute || 'min'}`;
  }
}

function DepthBadge({ type, dict }: { type: string, dict: Record<string, any> }) {
  if (type !== 'deep') return null;
  return <span className="yn-tag ml-1.5 bg-violet-50 text-violet-700">{dict.article?.deepDive || '深度研报'}</span>;
}

export default function ArticleCard({ article, featured = false, priority = false, dict = {} }: { article: Article; featured?: boolean; priority?: boolean; dict?: any }) {
  const coverSrc = getArticleCoverSrc(article.cover_image, article.lang, article.source);
  const coverOpt = isRemoteImageOptimizable(coverSrc);
  const hasRealCover = articleHasRealCover(article.cover_image, article.source);

  if (featured) {
    return (
      <LocalizedLink href={`/article/${article.slug}`} className="group block overflow-hidden border border-[#d9d2c8] bg-[#fbf9f5] transition-colors hover:border-[#b7ab99]">
        <div className="grid gap-0 lg:grid-cols-[1.08fr,0.92fr]">
          <div className="relative aspect-[16/9] lg:aspect-auto bg-[#ebe3d6] lg:order-2 lg:min-h-[540px]">
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
              <span className="yn-action text-white/80">Lead report</span>
            </div>
          </div>
          <div className="flex flex-col justify-between p-4 sm:p-6 lg:p-10">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {article.category_name && <span className={getCategoryBadgeClass(article.category_slug)}>{dict.nav?.[article.category_slug || ''] || article.category_name}</span>}
                <DepthBadge type={article.article_type} dict={dict} />
                {!hasRealCover && <span className="yn-tag bg-amber-50 text-amber-700">{dict.article?.noImage || '待配图'}</span>}
              </div>
              <p className="mt-5 yn-action text-[#667067]">Lead report</p>
              <h2 className="yn-title-xl mt-3 max-w-[20ch] sm:max-w-[10ch] text-[#101713] group-hover:text-[#1d5c4f] line-clamp-3 overflow-hidden">
                {article.title}
              </h2>
              {article.summary && <p className="mt-4 max-w-[33ch] yn-body sm:text-[1rem] sm:leading-8 line-clamp-4">{article.summary}</p>}
            </div>
            <div className="mt-5 sm:mt-7 border-t border-[#e3dbcf] pt-4 sm:pt-5 yn-meta">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-[#14261f]">{article.author}</span>
                <span>{article.published_at?.slice(0, 16)}</span>
                <span>{getReadTime(article.article_type, dict)}</span>
              </div>
              {article.source && article.source !== 'YayaNews' ? <div className="mt-2">{dict.common?.source || '来源'}: {article.source}</div> : null}
            </div>
          </div>
        </div>
      </LocalizedLink>
    );
  }

  return (
    <LocalizedLink href={`/article/${article.slug}`} className="group grid gap-3 sm:gap-5 border-t border-[#ddd5ca] py-4 sm:py-6 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_196px] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {article.category_name && <span className={getCategoryBadgeClass(article.category_slug)}>{dict.nav?.[article.category_slug || ''] || article.category_name}</span>}
          <DepthBadge type={article.article_type} dict={dict} />
          {!hasRealCover && <span className="yn-tag bg-amber-50 text-amber-700">{dict.article?.noImage || '待配图'}</span>}
        </div>
        <h3 className="yn-card-title-lg mt-3 max-w-[28ch] text-[#13211b] group-hover:text-[#1d5c4f] line-clamp-3">
          {article.title}
        </h3>
        {article.summary && <p className="mt-3 max-w-[56ch] yn-body text-slate-600 line-clamp-3">{article.summary}</p>}
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#ece4d8] pt-3 yn-meta">
          <span className="font-semibold text-[#14261f]">{article.author}</span>
          <span>{article.published_at?.slice(0, 16)}</span>
          <span>{getReadTime(article.article_type, dict)}</span>
          {article.source && article.source !== 'YayaNews' && <span>{dict.common?.source || '来源'}: {article.source}</span>}
        </div>
      </div>
      <div className="relative order-first aspect-[16/9] overflow-hidden border border-[#d8d1c5] bg-[#ece6dc] sm:order-last sm:h-[138px] sm:w-[196px] sm:aspect-auto">
        <Image
          src={coverSrc}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 100vw, 196px"
          className="object-cover transition duration-700 group-hover:scale-[1.02]"
          unoptimized={!coverOpt}
        />
      </div>
    </LocalizedLink>
  );
}
