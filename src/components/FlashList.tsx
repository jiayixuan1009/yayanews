import type { FlashNews } from '@/lib/types';
import { getImportanceDot } from '@/lib/ui-utils';

export default function FlashList({ items, compact = false }: { items: FlashNews[]; compact?: boolean }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 py-4">暂无快讯</p>;
  }

  return (
    <div className="space-y-0">
      {items.map(item => (
        <div key={item.id} className="group flex gap-3 border-b border-slate-800/50 py-3 last:border-0">
          <div className="flex flex-col items-center pt-1.5">
            <div className={`h-2 w-2 rounded-full ${getImportanceDot(item.importance)}`} />
            <div className="mt-1 h-full w-px bg-slate-800" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <time>{item.published_at.slice(11, 16)}</time>
              {item.category_name && <span className="text-gray-600">{item.category_name}</span>}
            </div>
            <p className={`mt-0.5 text-sm font-medium text-gray-200 ${compact ? 'line-clamp-2' : ''}`}>
              {item.title}
            </p>
            {!compact && item.content && (
              <p className="mt-1 text-xs text-gray-400 line-clamp-3">{item.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
