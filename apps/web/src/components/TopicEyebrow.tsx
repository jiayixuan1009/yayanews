import LocalizedLink from './LocalizedLink';

interface TopicEyebrowProps {
  topic: { slug: string; name_zh?: string; name_en?: string; title?: string } | null;
  lang: string;
}

/**
 * 文章页顶部专题标签（Eyebrow）
 * PRD 第 5.1 节：绑定 topic_id 时渲染，否则完全不渲染任何 DOM。
 */
export default function TopicEyebrow({ topic, lang }: TopicEyebrowProps) {
  if (!topic) return null;

  const isZh = lang !== 'en';
  const name = isZh
    ? (topic.name_zh || topic.title || '')
    : (topic.name_en || topic.title || '');

  const label = isZh ? `专题：${name}` : `Topic: ${name}`;

  return (
    <LocalizedLink
      href={`/topics/${topic.slug}`}
      className="
        mb-3 inline-flex items-center gap-1.5 rounded-full
        border border-emerald-200 bg-emerald-50
        px-3 py-1 text-[12px] font-medium
        text-[#1d5c4f] transition-colors
        hover:border-emerald-300 hover:bg-emerald-100
        focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
      "
      data-topic-slug={topic.slug}
      onClick={undefined}
    >
      <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3H5a2 2 0 00-2 2v2M7 3a2 2 0 012 2v0M17 3h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2M21 17v2a2 2 0 01-2 2h-2M3 7v10M21 7v10" />
      </svg>
      <span>{label}</span>
      <span className="text-[#1d5c4f] opacity-60">→</span>
    </LocalizedLink>
  );
}
