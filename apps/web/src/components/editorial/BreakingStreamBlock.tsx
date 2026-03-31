'use client';

import { useEffect, useState } from 'react';
import type { FlashNews } from '@yayanews/types';
import SectionHeader from './SectionHeader';
import LocalizedLink from '@/components/LocalizedLink';
import { encodeFlashSlug } from '@/lib/ui-utils';

type Props = {
  items: FlashNews[];
  title?: string;
  emptyText?: string;
  actionLabel?: string;
};

function getCategoryBadgeLight(name?: string) {
  if (!name) return 'bg-[#f4ebe1] text-[#7c837d] border-[#ece4d8]';
  if (name.includes('美股')) return 'bg-blue-50 text-blue-600 border-blue-200';
  if (name.includes('加密') || name.includes('比特币') || name.toLowerCase().includes('crypto')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (name.includes('港股')) return 'bg-rose-50 text-rose-600 border-rose-200';
  if (name.includes('衍生品')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (name.includes('宏观')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-[#f4ebe1] text-[#7c837d] border-[#ece4d8]';
}

export default function BreakingStreamBlock({ items: initialItems, title = '快讯热流', emptyText = '暂无快讯', actionLabel = '全部' }: Props) {
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
            if (!newFlash || typeof newFlash !== 'object' || !newFlash.id) return;
            setItems(prev => {
              if (prev.find(p => p.id === newFlash.id || p.title === newFlash.title)) return prev;
              const newList = [newFlash, ...prev].slice(0, 15);
              return newList;
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

  return (
    <section className="yn-panel p-4 sm:p-5">
      <SectionHeader title={title} emphasis="strong" actionHref="/flash" actionLabel={actionLabel} />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-[#ece4d8]">
          {items.map(item => {
            if (!item || !item.id) return null;
            return (
              <li key={item.id} className="py-3 first:pt-0">
                <LocalizedLink href={`/flash/${encodeFlashSlug(item as any)}`} className="group grid grid-cols-[56px,1fr] gap-3 relative rounded-lg -mx-2 px-2 hover:bg-[#f8f3ea] transition-colors py-1 cursor-pointer">
                  <span className="font-label text-[11px] uppercase tracking-[0.16em] text-[#667067] pt-0.5">
                    {item.published_at?.slice(11, 16) ?? '—'}
                  </span>
                  <div className="min-w-0">
                    {item.category_name && (
                      <span className={`inline-block mb-1 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none ${getCategoryBadgeLight(item.category_name)}`}>
                        {item.category_name}
                      </span>
                    )}
                    <p className="font-body text-sm font-medium leading-6 text-slate-800 line-clamp-2 group-hover:text-[#1d5c4f] transition-colors">
                      {item.title}
                    </p>
                  </div>
                </LocalizedLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
