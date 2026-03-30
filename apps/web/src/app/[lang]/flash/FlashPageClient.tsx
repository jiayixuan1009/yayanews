'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import type { FlashNews, Category } from '@yayanews/types';
import CtaBanner from '@/components/CtaBanner';
import { getImportanceDot } from '@/lib/ui-utils';

/** 秒；SSE 推送时作为兜底轮询间隔 */
const REFRESH_INTERVAL_SSE = 45;
const REFRESH_INTERVAL_POLL = 15;

function groupByDate(items: FlashNews[]): Record<string, FlashNews[]> {
  return items.reduce<Record<string, FlashNews[]>>((acc, item) => {
    const date = item.published_at.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}

function CountdownButton({
  onRefresh,
  intervalSec,
  sseLive,
}: {
  onRefresh: () => void;
  intervalSec: number;
  sseLive: boolean;
}) {
  const [cd, setCd] = useState(intervalSec);
  const cdRef = useRef(intervalSec);

  useEffect(() => {
    cdRef.current = intervalSec;
    setCd(intervalSec);
  }, [intervalSec]);

  useEffect(() => {
    const timer = setInterval(() => {
      cdRef.current -= 1;
      if (cdRef.current <= 0) {
        onRefresh();
        cdRef.current = intervalSec;
      }
      setCd(cdRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [onRefresh, intervalSec]);

  const pct = ((intervalSec - cd) / intervalSec) * 100;

  return (
    <button
      onClick={() => { onRefresh(); cdRef.current = intervalSec; setCd(intervalSec); }}
      className="group flex items-center gap-2 rounded-yn-md border border-slate-700/90 bg-slate-900/60 py-1.5 pl-3 pr-2.5 text-xs transition-colors hover:border-slate-600"
    >
      <div className="relative h-5 w-5">
        <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-800" />
          <circle
            cx="18" cy="18" r="15" fill="none" strokeWidth="2.5"
            className="text-primary-500 transition-all duration-1000 ease-linear"
            strokeDasharray="94.25"
            strokeDashoffset={94.25 - (pct / 100) * 94.25}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-300">
          {cd}
        </span>
      </div>
      <span className="text-slate-400 group-hover:text-slate-200">
        {sseLive ? '实时推送已连接 · ' : ''}
        {cd}s 后兜底刷新
      </span>
    </button>
  );
}

export default function FlashPageClient({ initialCat }: { initialCat: string }) {
  const [items, setItems] = useState<FlashNews[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState(initialCat);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevIdsRef = useRef<Set<number>>(new Set());
  const [sseLive, setSseLive] = useState(false);
  const [esSince, setEsSince] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCat) params.set('cat', activeCat);
      const res = await fetch(`/api/flash?${params}`);
      const data = await res.json();

      const incoming: FlashNews[] = data.items || [];
      if (typeof data.maxId === 'number') setEsSince(data.maxId);
      const incomingIds = new Set(incoming.map((i: FlashNews) => i.id));

      if (prevIdsRef.current.size > 0) {
        const fresh = new Set<number>();
        incomingIds.forEach(id => {
          if (!prevIdsRef.current.has(id)) fresh.add(id);
        });
        if (fresh.size > 0) {
          setNewIds(fresh);
          setTimeout(() => setNewIds(new Set()), 3000);
        }
      }
      prevIdsRef.current = incomingIds;

      setItems(incoming);
      setCategories(data.categories || []);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      /* keep stale data */
    } finally {
      setLoading(false);
    }
  }, [activeCat]);

  useEffect(() => {
    setLoading(true);
    prevIdsRef.current = new Set();
    setSseLive(false);
    setEsSince(null);
    fetchData();
  }, [activeCat, fetchData]);

  useEffect(() => {
    if (esSince === null) return;
    let es: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const qs = new URLSearchParams({ since: String(esSince) });
      if (activeCat) qs.set('cat', activeCat);
      es = new EventSource(`/api/flash/events?${qs}`);
      es.onopen = () => setSseLive(true);
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data) as { type?: string };
          if (d.type === 'flash') fetchData();
        } catch {
          /* */
        }
      };
      es.onerror = () => {
        setSseLive(false);
        es?.close();
        if (!cancelled) setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [activeCat, esSince, fetchData]);

  const grouped = groupByDate(items);

  return (
    <div className="container-main py-6 sm:py-8">
      {/* 快讯页：流内无鸭；时间轴 + 细边框卡片 */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">7&times;24 快讯</h1>
          <p className="mt-2 text-sm text-slate-400">滚动热流优先于装饰；与首页 BreakingStreamBlock 同一信息层级逻辑。</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <CountdownButton
            onRefresh={fetchData}
            intervalSec={sseLive ? REFRESH_INTERVAL_SSE : REFRESH_INTERVAL_POLL}
            sseLive={sseLive}
          />
          {lastUpdate && (
            <span className="text-[11px] text-slate-600">
              上次更新: {lastUpdate}
            </span>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveCat('')}
          className={`badge cursor-pointer border ${
            !activeCat ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300' : 'border-transparent bg-slate-800 text-slate-400 hover:bg-slate-800/90 hover:text-white'
          }`}
        >
          全部
        </button>
        {categories.map(c => (
          <button
            type="button"
            key={c.slug}
            onClick={() => setActiveCat(c.slug)}
            className={`badge cursor-pointer border ${
              activeCat === c.slug
                ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300'
                : 'border-transparent bg-slate-800 text-slate-400 hover:bg-slate-800/90 hover:text-white'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="min-h-[500px] space-y-4 py-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="h-2 w-2 rounded-full bg-slate-700" />
                    <div className="mt-1 h-12 w-px bg-slate-800" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-700" />
                    <div className="h-4 w-3/4 rounded bg-slate-700" />
                    <div className="h-3 w-1/2 rounded bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([date, dateItems]) => (
              <div key={date} className="mb-6">
                <div className="sticky top-16 z-10 mb-2 bg-slate-950/90 backdrop-blur-sm py-2">
                  <span className="badge bg-slate-800 text-gray-300">{date}</span>
                </div>
                <div className="card rounded-yn-md p-4">
                  <div className="space-y-0">
                    {dateItems.map(item => {
                      const isNew = newIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`group flex gap-3 border-b border-slate-800/50 py-3 last:border-0 transition-colors duration-700 ${
                            isNew ? 'bg-primary-500/10 -mx-2 px-2 rounded-lg' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`h-2 w-2 rounded-full ${isNew ? 'animate-pulse bg-primary-400' : getImportanceDot(item.importance)}`} />
                            <div className="mt-1 h-full w-px bg-slate-800" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <time>{item.published_at.slice(11, 16)}</time>
                              {item.category_name && <span className="text-gray-600">{item.category_name}</span>}
                              {isNew && <span className="rounded bg-primary-500/20 px-1 py-0.5 text-[10px] text-primary-400 font-medium">NEW</span>}
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-gray-200">{item.title}</p>
                            {item.content && (
                              <p className="mt-1 text-xs text-gray-400 line-clamp-3">{item.content}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-16">暂无快讯</p>
          )}
        </div>

        <aside className="space-y-6">
          <CtaBanner />
        </aside>
      </div>
    </div>
  );
}
