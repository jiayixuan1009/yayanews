'use client';

import { useEffect, useState } from 'react';
import type { FlashNews } from '@yayanews/types';
import { getImportanceDot, encodeFlashSlug } from '@/lib/ui-utils';
import LocalizedLink from '@/components/LocalizedLink';

function getCategoryBadgeCls(name?: string) {
  if (!name) return 'bg-slate-800/50 text-gray-400 border-slate-700/50';
  if (name.includes('美股')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (name.includes('加密') || name.includes('比特币') || name.toLowerCase().includes('crypto')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (name.includes('港股')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (name.includes('衍生品')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (name.includes('宏观')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  return 'bg-slate-800/50 text-gray-400 border-slate-700/50';
}

export default function FlashList({ items: initialItems, compact = false, emptyText }: { items: FlashNews[]; compact?: boolean; emptyText?: string }) {
  const [items, setItems] = useState<FlashNews[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ws: WebSocket;
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/`);
      ws.onerror = () => { /* silently ignore — WS not available in all deploy envs */ };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel && data.channel.startsWith('flash:new')) {
            const newFlash = data.payload as FlashNews;
            setItems(prev => {
              if (prev.find(p => p.id === newFlash.id || p.title === newFlash.title)) return prev;
              return [newFlash, ...prev].slice(0, 50);
            });
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  if (items.length === 0) {
    return <p className="text-sm text-gray-500 py-4">{emptyText || 'No flash news'}</p>;
  }

  return (
    <div className="space-y-0">
      {items.map(item => (
        <LocalizedLink 
          href={`/flash/${encodeFlashSlug(item as any)}`} 
          key={item.id} 
          className="group flex gap-3 border-b border-slate-800/50 py-3 last:border-0 hover:bg-slate-800/30 transition-colors cursor-pointer rounded-lg px-2 -mx-2 mb-1"
        >
          <div className="flex flex-col items-center pt-1.5 min-w-[12px]">
            <div className={`h-2 w-2 rounded-full ${getImportanceDot(item.importance)} group-hover:scale-110 transition-transform`} />
            <div className="mt-1 h-full w-px bg-slate-800" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
              <time className="yn-tabular-nums">{item.published_at.slice(11, 16)}</time>
              {item.category_name && (
                <span className={`yn-tag ${getCategoryBadgeCls(item.category_name)}`}>
                  {item.category_name}
                </span>
              )}
            </div>
            <p className={`mt-0.5 text-sm font-medium text-gray-200 ${compact ? 'line-clamp-2' : ''}`}>
              {item.title}
            </p>
            {!compact && item.content && (
              <p className="mt-1 text-xs text-gray-400 line-clamp-3 group-hover:text-gray-300 transition-colors">{item.content}</p>
            )}
          </div>
        </LocalizedLink>
      ))}
    </div>
  );
}
