import type { FlashNews } from '@/lib/types';
import SectionHeader from './SectionHeader';

type Props = {
  items: FlashNews[];
  title?: string;
  emptyText?: string;
  actionLabel?: string;
};

export default function BreakingStreamBlock({ items, title = '快讯热流', emptyText = '暂无快讯', actionLabel = '全部' }: Props) {
  return (
    <section className="yn-panel p-4 sm:p-5">
      <SectionHeader title={title} emphasis="strong" actionHref="/flash" actionLabel={actionLabel} />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-[#ece4d8]">
          {items.map(item => (
            <li key={item.id} className="grid grid-cols-[56px,1fr] gap-3 py-3 first:pt-0">
              <span className="font-label text-[11px] uppercase tracking-[0.16em] text-[#667067]">
                {item.published_at?.slice(11, 16) ?? '—'}
              </span>
              <p className="min-w-0 font-body text-sm font-medium leading-6 text-slate-800 line-clamp-2">
                {item.title}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
