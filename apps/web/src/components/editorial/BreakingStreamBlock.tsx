'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FlashNews } from '@yayanews/types';
import LocalizedLink from '@/components/LocalizedLink';
import { encodeFlashSlug } from '@/lib/ui-utils';

// ─── Category filter config ────────────────────────────────────────────────
// Mapped from category_name in DB — covers the main groups users care about
function getFilterTags(lang: string): { label: string; match: (name: string) => boolean }[] {
  if (lang === 'en') {
    return [
      { label: 'US Stocks',   match: n => n.includes('美股') },
      { label: 'HK & APAC',   match: n => n.includes('港股') || n.includes('亚太') },
      { label: 'Crypto', match: n => n.includes('加密') || n.toLowerCase().includes('crypto') || n.includes('比特') },
      { label: 'Derivatives', match: n => n.includes('衍生') || n.includes('期货') || n.includes('期权') || n.includes('宏观') },
    ];
  }
  return [
    { label: '美股',   match: n => n.includes('美股') },
    { label: '港股',   match: n => n.includes('港股') || n.includes('亚太') },
    { label: '加密货币', match: n => n.includes('加密') || n.toLowerCase().includes('crypto') || n.includes('比特') },
    { label: '衍生品', match: n => n.includes('衍生') || n.includes('期货') || n.includes('期权') || n.includes('宏观') },
  ];
}

type Props = {
  items?: FlashNews[];
  title?: string;
  emptyText?: string;
  actionLabel?: string;
  lang?: string;
  className?: string;
};

function getCategoryBadgeLight(name?: string) {
  if (!name) return 'bg-[#f4ebe1] text-[#7c837d] border-[#ece4d8]';
  if (name.includes('美股')) return 'bg-blue-50 text-blue-600 border-blue-200';
  if (name.includes('加密') || name.includes('比特币') || name.toLowerCase().includes('crypto')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (name.includes('港股') || name.includes('亚太')) return 'bg-rose-50 text-rose-600 border-rose-200';
  if (name.includes('衍生') || name.includes('宏观')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-[#f4ebe1] text-[#7c837d] border-[#ece4d8]';
}

function translateCategoryName(name: string, lang: string) {
  if (lang !== 'en' || !name) return name;
  if (name.includes('美股')) return 'US Stocks';
  if (name.includes('港股') || name.includes('亚太')) return 'HK & APAC';
  if (name.includes('加密') || name.toLowerCase().includes('crypto')) return 'Crypto';
  if (name.includes('衍生') || name.includes('期货') || name.includes('宏观')) return 'Derivatives';
  if (name.includes('综合') || name.includes('其他')) return 'General';
  return name;
}

export default function BreakingStreamBlock({
  items: initialItems = [],
  title = '7×24 快讯',
  emptyText = '暂无快讯',
  actionLabel = '全部快讯',
  lang = 'zh',
  className = '',
}: Props) {
  const [allItems, setAllItems] = useState<FlashNews[]>(initialItems);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(60);
  // Track IDs of freshly-added items so we can animate them sliding in
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());
  const newItemTimerRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── Fetch fresh data from same API as FlashPage ──────────────────────────
  const fetchFresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ lang, limit: '60' });
      const res = await fetch(`/api/flash?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming: FlashNews[] = data.items ?? [];
      if (incoming.length > 0) setAllItems(incoming);
    } catch { /* keep stale */ }
  }, [lang]);

  // Fetch on mount and every 30s
  useEffect(() => {
    fetchFresh();
    const timer = setInterval(fetchFresh, 30_000);
    return () => clearInterval(timer);
  }, [fetchFresh]);

  // Visual countdown timer (60s loop)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => prev <= 1 ? 60 : prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── WebSocket live push ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ws: WebSocket;
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/`);
      ws.onerror = () => { /* silently ignore */ };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel && data.channel === `flash:new:${lang}`) {
            const newFlash = data.payload as FlashNews;
            if (!newFlash?.id) return;
            setAllItems(prev => {
              if (prev.find(p => p.id === newFlash.id)) return prev;
              return [newFlash, ...prev].slice(0, 60);
            });
            // Mark as new for animation, then clear after 700ms
            setNewItemIds(prev => new Set(prev).add(newFlash.id));
            const timer = setTimeout(() => {
              setNewItemIds(prev => { const n = new Set(prev); n.delete(newFlash.id); return n; });
            }, 700);
            newItemTimerRef.current.set(newFlash.id, timer);
          }
        } catch { /**/ }
      };
      ws.onclose = () => { if (!cancelled) setTimeout(connect, 3000); };
    };
    connect();
    return () => {
      cancelled = true;
      ws?.close();
      // Clean up any pending animation timers
      newItemTimerRef.current.forEach(t => clearTimeout(t));
    };
  }, [lang]);

  // ── Multi-select category filtering ──────────────────────────────────────
  const filterTags = getFilterTags(lang);
  const toggleTag = (label: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleItems = selectedTags.size === 0
    ? allItems
    : allItems.filter(item => {
        const name = item.category_name ?? '';
        return Array.from(selectedTags).some(tag => {
          const tagDef = filterTags.find(t => t.label === tag);
          return tagDef ? tagDef.match(name) : false;
        });
      });

  return (
    <section className={`yn-panel flex flex-col p-4 sm:p-5 ${className}`}>

      {/* ── 头部：标题 + 倒计时 同行 ──────────────────────────── */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#ece4d8] pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-0.5 shrink-0 rounded-sm bg-[#1d5c4f]" aria-hidden />
          <h2 className="yn-heading leading-none">{title}</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[#89908a]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {countdown}s
          </div>
        </div>
      </div>

      {/* ── 标签栏：5个同行，不换行，横向滚动 ──────────────────── */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {/* 全部按钮 */}
        <button
          type="button"
          onClick={() => setSelectedTags(new Set())}
          className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-semibold transition-all ${
            selectedTags.size === 0
              ? 'border-[#0d3b30] bg-[#0d3b30] text-white shadow-sm'
              : 'border-[#ddd5ca] bg-white text-[#667067] hover:border-[#0d3b30]/40 hover:text-[#0d3b30]'
          }`}
        >
          {lang === 'en' ? 'All' : '全部'}
        </button>
        {filterTags.map(tag => {
          const active = selectedTags.has(tag.label);
          return (
            <button
              key={tag.label}
              type="button"
              onClick={() => toggleTag(tag.label)}
              className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-all ${
                active
                  ? 'border-[#0d3b30] bg-[#0d3b30] text-white shadow-sm font-semibold'
                  : 'border-[#ddd5ca] bg-white text-[#667067] hover:border-[#0d3b30]/40 hover:text-[#0d3b30] font-medium'
              }`}
            >
              {active && <span className="text-[9px]">✓</span>}
              {tag.label}
            </button>
          );
        })}
      </div>

      {/* ── 列表：新条目滑入动画 ──────────────────────────────── */}
      {visibleItems.length === 0 ? (
        <p className="py-6 flex-1 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar -mr-1 sm:-mr-2">
          <ul className="divide-y divide-[#ece4d8]">
            {visibleItems.slice(0, 20).map(item => {
              if (!item?.id) return null;
              const isNew = newItemIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className={`py-2.5 first:pt-0 transition-all duration-500 ${
                    isNew ? 'animate-flash-slide-in' : ''
                  }`}
                >
                  <LocalizedLink
                    href={`/flash/${encodeFlashSlug(item as any)}`}
                    className="group block rounded-lg -mx-2 px-2 py-1 hover:bg-[#f8f3ea] transition-colors cursor-pointer"
                  >
                    {/* Row 1: 时间 + 类别 */}
                    <div className="flex items-center gap-2 mb-1">
                      <time className="font-label text-[11px] uppercase tracking-[0.12em] text-[#89908a] leading-none tabular-nums">
                        {item.published_at?.slice(11, 16) ?? '—'}
                      </time>
                      {item.category_name && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none ${getCategoryBadgeLight(item.category_name)}`}>
                          {translateCategoryName(item.category_name, lang)}
                        </span>
                      )}
                    </div>
                    {/* Row 2: 标题 */}
                    <p className="font-body text-sm font-medium leading-[1.5] text-slate-800 line-clamp-2 group-hover:text-[#1d5c4f] transition-colors">
                      {item.title}
                    </p>
                  </LocalizedLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
