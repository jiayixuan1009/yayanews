'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Article } from '@/lib/types';
import { DERIVATIVES_SUBCATEGORIES } from '@/lib/types';
import { adminFetch } from '@/lib/admin-fetch';

const CATEGORIES = [
  { slug: '', label: '全部分类' },
  { slug: 'us-stock', label: '美股' },
  { slug: 'crypto', label: '加密货币' },
  { slug: 'derivatives', label: '衍生品' },
  { slug: 'hk-stock', label: '港股' },
];

const STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'review', label: '审核中' },
  { value: 'archived', label: '已归档' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500/20 text-blue-400',
  'crypto': 'bg-amber-500/20 text-amber-400',
  'derivatives': 'bg-emerald-500/20 text-emerald-400',
  'hk-stock': 'bg-rose-500/20 text-rose-400',
};

interface ListResult {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ArticlesView() {
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [lang, setLang] = useState<string>('all');
  const [selected, setSelected] = useState<Article | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (lang && lang !== 'all') params.set('lang', lang);

    adminFetch(`/api/admin/articles?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, category, subcategory, status, search, lang]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleDelete(id: number) {
    if (!confirm(`确定删除文章 #${id}？此操作不可恢复。`)) return;
    await adminFetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    fetchList();
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const r = await adminFetch(`/api/admin/articles/${id}`);
      const article = await r.json();
      setSelected(article);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">文章管理</h2>
        {data && <span className="text-sm text-slate-500">共 {data.total} 篇</span>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Language Toggle Buttons */}
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 mr-2">
          <button
            onClick={() => { setLang('all'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'all' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => { setLang('zh'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'zh' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => { setLang('en'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'en' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            English
          </button>
        </div>

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

        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="搜索标题..."
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

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-3 font-medium w-12">ID</th>
                  <th className="text-left px-4 py-3 font-medium w-16">语言</th>
                  <th className="text-left px-4 py-3 font-medium">标题</th>
                  <th className="text-left px-4 py-3 font-medium w-20">分类</th>
                  <th className="text-left px-4 py-3 font-medium w-16">情感</th>
                  <th className="text-left px-4 py-3 font-medium w-16">浏览</th>
                  <th className="text-left px-4 py-3 font-medium w-16">状态</th>
                  <th className="text-left px-4 py-3 font-medium w-20">耗时</th>
                  <th className="text-left px-4 py-3 font-medium w-36">时间</th>
                  <th className="text-left px-4 py-3 font-medium w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data && 'error' in data ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-red-500">
                      访问失败 - {(data as any).error}
                    </td>
                  </tr>
                ) : !data?.articles || data.articles.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-500">暂无数据</td></tr>
                ) : (
                  data.articles.map(a => (
                    <tr key={a.id} className="text-slate-300 hover:bg-slate-800/30 cursor-pointer" onClick={() => openDetail(a.id)}>
                      <td className="px-4 py-3 text-slate-500">#{a.id}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-bold text-slate-400">
                          {a.lang || 'zh'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md truncate font-medium">{a.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[a.category_slug || ''] || 'bg-slate-700 text-slate-400'}`}>
                          {a.category_name || '-'}
                        </span>
                        {a.subcategory && (
                          <span className="ml-1 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                            {DERIVATIVES_SUBCATEGORIES.find(s => s.slug === a.subcategory)?.name || a.subcategory}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><SentimentBadge value={a.sentiment} /></td>
                      <td className="px-4 py-3 text-slate-500">{a.view_count}</td>
                      <td className="px-4 py-3"><StatusBadge value={a.status} /></td>
                      <td className="px-4 py-3"><ProcessingTime seconds={a.processing_seconds} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{a.created_at?.slice(0, 16)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}

      {/* Detail modal */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={() => setSelected(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
              </div>
            ) : selected && (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 py-4">
                  <h3 className="text-lg font-bold text-white truncate pr-4">#{selected.id} {selected.title}</h3>
                  <button onClick={() => setSelected(null)} className="shrink-0 text-slate-500 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-slate-300 uppercase">
                      {selected.lang || 'zh'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-medium ${CATEGORY_COLORS[selected.category_slug || ''] || 'bg-slate-700 text-slate-400'}`}>
                      {selected.category_name}
                    </span>
                    <SentimentBadge value={selected.sentiment} />
                    <StatusBadge value={selected.status} />
                    {selected.tickers && selected.tickers.split(',').map(t => (
                      <span key={t} className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">{t.trim()}</span>
                    ))}
                  </div>

                  {selected.summary && (
                    <div className="rounded-lg bg-slate-800/50 p-4 text-sm text-slate-300 leading-relaxed">
                      {selected.summary}
                    </div>
                  )}

                  {selected.key_points && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">要点</h4>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {selected.key_points.split('\n').filter(Boolean).map((p, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary-500 shrink-0">-</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.tags && selected.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">标签</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.tags.map(t => (
                          <span key={t.id} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">#{t.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">正文内容</h4>
                    <div
                      className="prose prose-invert prose-sm max-w-none rounded-lg bg-slate-950 border border-slate-800 p-4 text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: selected.content }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-slate-500 border-t border-slate-800">
                    <span>Slug: {selected.slug}</span>
                    <span>浏览: {selected.view_count}</span>
                    {selected.collected_at && <span>采集: {selected.collected_at}</span>}
                    <span>创建: {selected.created_at}</span>
                    <span>发布: {selected.published_at || '-'}</span>
                    <span>更新: {selected.updated_at}</span>
                    <span>作者: {selected.author}</span>
                    {selected.processing_seconds != null && (
                      <span className="text-primary-400">处理耗时: {formatDuration(selected.processing_seconds)}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SentimentBadge({ value }: { value?: string }) {
  if (!value) return <span className="text-slate-600">-</span>;
  const map: Record<string, { cls: string; label: string }> = {
    bullish: { cls: 'bg-green-500/20 text-green-400', label: '看涨' },
    bearish: { cls: 'bg-red-500/20 text-red-400', label: '看跌' },
    neutral: { cls: 'bg-slate-700/50 text-slate-400', label: '中性' },
  };
  const m = map[value] || map.neutral;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    published: { cls: 'bg-green-500/20 text-green-400', label: '已发布' },
    draft: { cls: 'bg-slate-700/50 text-slate-400', label: '草稿' },
    review: { cls: 'bg-amber-500/20 text-amber-400', label: '审核中' },
    archived: { cls: 'bg-slate-700/50 text-slate-500', label: '已归档' },
  };
  const m = map[value] || { cls: 'bg-slate-700 text-slate-400', label: value };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
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

function ProcessingTime({ seconds }: { seconds?: number | null }) {
  if (seconds == null) return <span className="text-xs text-slate-600">-</span>;
  const color = seconds < 120 ? 'text-green-400' : seconds < 300 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-xs font-mono ${color}`}>{formatDuration(seconds)}</span>;
}
