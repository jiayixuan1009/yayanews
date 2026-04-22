import LocalizedLink from '@/components/LocalizedLink';

type Props = {
  topicTitle: string;
  href: string;
  lang?: string;
};

/**
 * 文后 / 列表底：专题桥，一条清晰横带，符号级品牌即可。
 */
export default function TopicBridge({ topicTitle, href, lang }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-yn-md border border-[#d9d2c8] bg-[#fbf8f4] px-4 py-3">
      <span className="yn-meta">{lang === 'en' ? 'Related Topic' : '同题专题'}</span>
      <LocalizedLink href={href} className="text-sm font-semibold text-[#1d5c4f] hover:text-[#143d33]">
        {topicTitle} →
      </LocalizedLink>
    </div>
  );
}

