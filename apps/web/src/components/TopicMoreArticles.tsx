import LocalizedLink from './LocalizedLink';
import type { Topic } from '@yayanews/types';

interface TopicMoreArticlesProps {
  topic: (Topic & { recent_articles?: { id: number; slug: string; title: string; published_at: string | null }[] }) | null;
  currentArticleId: number;
  lang: string;
  totalCount?: number;
  dict: any;
}

/**
 * 文章页底部"本专题更多报道"模块
 * PRD 第 5.2 节：
 * - recent_articles 为空时完全隐藏
 * - 最多显示 3 篇（排除当前文章）
 * - 底部"查看全部"链接指向专题页
 */
export default function TopicMoreArticles({ topic, currentArticleId, lang, totalCount, dict }: TopicMoreArticlesProps) {
  if (!topic) return null;

  const recent = (topic.recent_articles || []).filter(a => a.id !== currentArticleId).slice(0, 3);
  if (recent.length === 0) return null;

  const isZh = lang !== 'en';
  const name = isZh ? (topic.name_zh || topic.title || '') : (topic.name_en || topic.title || '');
  const moduleTitle = dict.topics.moreArticles;
  const viewAllLabel = totalCount 
    ? dict.topics.viewAllCount.replace('{count}', totalCount.toString())
    : dict.topics.viewAll;

  return (
    <section
      className="mt-10 border-t border-[#ddd5ca] pt-8"
      aria-label={dict.topics.moreArticles}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#667067]">
            {dict.topics.relatedTopic}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-[#101713]">
            📂 {name} · {moduleTitle}
          </h2>
        </div>
      </div>

      <ul className="divide-y divide-[#eae4dc]">
        {recent.map((a) => (
          <li key={a.id} className="py-3">
            <LocalizedLink
              href={`/article/${a.slug}`}
              className="group flex items-start justify-between gap-3"
            >
              <span className="flex-1 text-[15px] font-medium leading-snug text-[#14261f] group-hover:text-[#1d5c4f]">
                {a.title}
              </span>
              {a.published_at && (
                <time
                  dateTime={a.published_at}
                  className="shrink-0 text-[12px] text-[#667067]"
                >
                  {a.published_at.slice(0, 10)}
                </time>
              )}
            </LocalizedLink>
          </li>
        ))}
      </ul>

      <LocalizedLink
        href={`/topics/${topic.slug}`}
        className="
          mt-5 inline-flex items-center gap-1.5
          border border-[#d8d1c5] px-4 py-2
          text-[13px] font-medium text-[#14261f]
          transition-colors hover:border-[#bfb4a5] hover:text-[#1d5c4f]
        "
      >
        {viewAllLabel}
      </LocalizedLink>
    </section>
  );
}
