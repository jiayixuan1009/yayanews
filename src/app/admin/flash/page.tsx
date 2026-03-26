'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FlashNews } from '@/lib/types';
import { DERIVATIVES_SUBCATEGORIES } from '@/lib/types';
import { adminFetch } from '@/lib/admin-fetch';

const CATEGORIES = [
  { slug: '', label: '全部分类' },
  { slug: 'us-stock', label: '美股' },
  { slug: 'crypto', label: '加密货币' },
  { slug: 'derivatives', label: '衍生品' },
  { slug: 'hk-stock', label: '港股' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500',
  crypto: 'bg-amber-500',
  derivatives: 'bg-emerald-500',
  'hk-stock': 'bg-rose-500',
};

const IMPORTANCE_STYLES: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-500/5',
  high: 'border-l-amber-500 bg-amber-500/5',
  normal: 'border-l-slate-700',
  low: 'border-l-slate-800',
};

interface ListResult {
  items: FlashNews[];
  total: number;
  page: number;
  pageSize: number;
}

export default function FlashPage() {
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (search) params.set('search', search);

    adminFetch(`/api/admin/flash?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, category, subcategory, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleDelete(id: number) {
    if (!confirm(`确定删除快讯 #${id}？`)) return;
    await adminFetch(`/api/admin/flash/${id}`, { method: 'DELETE' });
    if (expanded === id) setExpanded(null);
    fetchList();
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">快讯管理</h2>
        {data && <span className="text-sm text-slate-500">共 {data.total} 条</span>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setSubcategory(''); setPage(1); }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
        >
          {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>

        {category === 'derivatives' && (
          <select
            value={subcategory}
            onChange={e => { setSubcategory(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">全部子分类</option>
            {DERIVATIVES_SUBCATEGORIES.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        )}

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="搜索快讯..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors">
            搜索
          </button>
        </form>

        {search && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="text-xs text-slate-500 hover:text-white"
          >
            清除搜索
          </button>
        )}
      </div>

      {/* Flash list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-500">
            暂无数据
          </div>
        ) : (
          data?.items.map(item => {
            const isExpanded = expanded === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border border-slate-800 bg-slate-900/60 border-l-4 transition-colors ${IMPORTANCE_STYLES[item.importance] || IMPORTANCE_STYLES.normal}`}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">#{item.id}</span>
                      <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[getCategorySlug(item.category_name)] || 'bg-slate-500'}`} />
                      <span className="text-xs text-slate-500">{item.category_name || '-'}</span>
                      {item.importance !== 'normal' && (
                        <span className={`text-[10px] uppercase font-medium ${
                          item.importance === 'urgent' ? 'text-red-400' : item.importance === 'high' ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {item.importance}
                        </span>
                      )}
                      {item.processing_seconds != null && (
                        <ProcessingTimeBadge seconds={item.processing_seconds} />
                      )}
                      <span className="ml-auto text-xs text-slate-500">{item.published_at?.slice(0, 16)}</span>
                    </div>
                    <p className={`text-sm text-slate-200 ${isExpanded ? '' : 'truncate'}`}>{item.title}</p>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 px-4 py-3 space-y-3">
                    <p className="text-sm text-slate-300 leading-relaxed">{item.content}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex gap-4">
                        {item.source && <span>来源: {item.source}</span>}
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                            原文链接
                          </a>
                        )}
                        {item.collected_at && <span>采集: {item.collected_at}</span>}
                        {item.processing_seconds != null && (
                          <span className="text-primary-400">耗时: {formatDuration(item.processing_seconds)}</span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                        className="text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

function getCategorySlug(name?: string | null): string {
  if (!name) return '';
  const map: Record<string, string> = { '美股': 'us-stock', '加密货币': 'crypto', '衍生品': 'derivatives', '港股': 'hk-stock' };
  return map[name] || '';
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '-';
  if (seconds < 60) return `${seconds}秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return sec > 0 ? `${min}分${sec}秒` : `${min}分`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}时${remainMin}分`;
}

function ProcessingTimeBadge({ seconds }: { seconds: number }) {
  const color = seconds < 60 ? 'text-green-400 bg-green-500/10' : seconds < 180 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${color}`}>
      {formatDuration(seconds)}
    </span>
  );
}
