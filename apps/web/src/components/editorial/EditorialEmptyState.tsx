import LocalizedLink from '@/components/LocalizedLink';
import DuckAccent from './DuckAccent';

type Props = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
};

/**
 * 空状态：允许完整小鸭 + 文案（locked 主场景之一）。
 */
export default function EditorialEmptyState({ title, description, actionHref, actionLabel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-yn-md border border-dashed border-slate-700 bg-slate-900/30 px-6 py-14 text-center">
      <div className="mb-3 scale-125">
        <DuckAccent zone="guidance" className="opacity-50" />
      </div>
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {actionHref && actionLabel ? (
        <LocalizedLink href={actionHref} className="mt-5 text-sm font-medium text-emerald-500 hover:text-emerald-400">
          {actionLabel}
        </LocalizedLink>
      ) : null}
    </div>
  );
}
