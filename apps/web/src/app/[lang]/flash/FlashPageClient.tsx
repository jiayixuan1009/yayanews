'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import type { FlashNews, Category } from '@yayanews/types';
import CtaBanner from '@/components/CtaBanner';
import { getImportanceDot, encodeFlashSlug } from '@/lib/ui-utils';

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

interface FlashDict {
  pageTitle: string;
  pageSubtitle: string;
  sseLive: string;
  countdownSuffix: string;
  lastUpdate: string;
  allCategories: string;
  noFlash: string;
}

function CountdownButton({
  onRefresh,
  intervalSec,
  sseLive,
  dict,
}: {
  onRefresh: () => void;
  intervalSec: number;
  sseLive: boolean;
  dict: FlashDict;
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
      className="group flex items-center gap-2 rounded-yn-md border border-slate-200 bg-white py-1.5 pl-3 pr-2.5 text-xs transition-colors hover:border-slate-300 shadow-sm"
    >
      <div className="relative h-5 w-5">
        <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-100" />
          <circle
            cx="18" cy="18" r="15" fill="none" strokeWidth="2.5"
            className="text-primary-500 transition-all duration-1000 ease-linear"
            strokeDasharray="94.25"
            strokeDashoffset={94.25 - (pct / 100) * 94.25}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-500">
          {cd}
        </span>
      </div>
      <span className="text-slate-500 group-hover:text-slate-700">
        {sseLive ? dict.sseLive : ''}
        {cd}{dict.countdownSuffix}
      </span>
    </button>
  );
}

export default function FlashPageClient({ initialCat, lang = 'zh', flashDict }: { initialCat: string, lang?: string, flashDict: FlashDict }) {
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
      if (lang) params.set('lang', lang);
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
      const locale = lang === 'en' ? 'en-US' : 'zh-CN';
      setLastUpdate(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      /* keep stale data */
    } finally {
      setLoading(false);
    }
  }, [activeCat, lang]);

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
      if (lang) qs.set('lang', lang);
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
  }, [activeCat, esSince, fetchData, lang]);

  const grouped = groupByDate(items);

  return (
    <div className="container-main py-6 sm:py-8">
      {/* 快讯页：流内无鸭；时间轴 + 细边框卡片 */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">{flashDict.pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{flashDict.pageSubtitle}</p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <CountdownButton
            onRefresh={fetchData}
            intervalSec={sseLive ? REFRESH_INTERVAL_SSE : REFRESH_INTERVAL_POLL}
            sseLive={sseLive}
            dict={flashDict}
          />
          {lastUpdate && (
            <span className="yn-meta text-slate-600">
              {flashDict.lastUpdate}{lastUpdate}
            </span>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveCat('')}
          className={`yn-tag cursor-pointer border px-3 py-1 text-sm transition-colors ${
            !activeCat ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {flashDict.allCategories}
        </button>
        {categories.map(c => (
          <button
            type="button"
            key={c.slug}
            onClick={() => setActiveCat(c.slug)}
            className={`yn-tag cursor-pointer border px-3 py-1 text-sm transition-colors ${
              activeCat === c.slug
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {lang === 'en' ? ((c as any).name_en || c.name) : c.name}
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
                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                    <div className="mt-1 h-12 w-px bg-slate-200" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([date, dateItems]) => (
              <div key={date} className="mb-6">
                <div className="sticky top-[72px] sm:top-[108px] z-10 mb-2 bg-white/90 backdrop-blur-sm py-2">
                  <span className="yn-tag bg-slate-100 text-slate-700 border border-slate-200">{date}</span>
                </div>
                <div className="card rounded-yn-md border border-slate-200 p-4 bg-white shadow-sm">
                  <div className="space-y-0">
                    {dateItems.map(item => {
                      const isNew = newIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`group flex gap-3 border-b border-slate-100 py-3 last:border-0 transition-colors duration-700 ${
                            isNew ? 'bg-primary-50 -mx-2 px-2 rounded-lg' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`h-2 w-2 rounded-full ${isNew ? 'animate-pulse bg-primary-500' : getImportanceDot(item.importance)}`} />
                            <div className="mt-1 h-full w-px bg-slate-200" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 yn-meta text-slate-500">
                              <time className="yn-tabular-nums">{item.published_at.slice(11, 16)}</time>
                              {item.category_name && <span className="text-slate-600 font-medium">{item.category_name}</span>}
                              {isNew && <span className="yn-tag bg-primary-100 px-1 py-0.5 text-primary-700 text-[10px]">NEW</span>}
                            </div>
                            <LocalizedLink href={`/flash/${encodeFlashSlug(item)}`} className="block mt-1">
                              <p className="text-[1.05rem] font-medium leading-relaxed text-slate-900 group-hover:text-primary-700 transition-colors">{item.title}</p>
                              {item.content && (
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 line-clamp-3">{item.content}</p>
                              )}
                            </LocalizedLink>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-500 py-16">{flashDict.noFlash}</p>
          )}
        </div>

        <aside className="space-y-6">
          <CtaBanner />
        </aside>
      </div>
    </div>
  );
}
