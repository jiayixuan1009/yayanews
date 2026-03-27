'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '@/lib/admin-queries';
import { adminFetch } from '@/lib/admin-fetch';

const CATEGORY_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500',
  'crypto': 'bg-amber-500',
  'derivatives': 'bg-emerald-500',
  'hk-stock': 'bg-rose-500',
};

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
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

function TimeStatCard({ label, seconds, todaySeconds, color }: { label: string; seconds: number | null; todaySeconds?: number | null; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-800/60 bg-slate-800/30 px-4 py-3">
      <span className={`h-3 w-3 rounded-full ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-white">{formatDuration(seconds)}</p>
        {todaySeconds != null && (
          <p className="text-[11px] text-slate-500">今日: {formatDuration(todaySeconds)}</p>
        )}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-800">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/stats?lang=${lang}`)
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [lang]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-red-400">Failed to load stats.</p>;
  if ('error' in stats) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-64 border border-red-900/50 bg-red-950/20 rounded-xl space-y-4">
        <p className="text-red-400 font-medium">访问被拒绝: {(stats as any).error}</p>
        <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors">
          返回前台 / 重新登录
        </button>
      </div>
    );
  }

  const maxCatArticles = Math.max(...stats.categoryStats.map(c => c.articles), 1);
  const maxTrend = Math.max(...stats.dailyTrend.map(d => d.articles + d.flash), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">数据概览</h2>
        
        {/* Language Toggle Buttons */}
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setLang('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'all' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setLang('zh')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'zh' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === 'en' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="文章总数" value={stats.totalArticles} sub={`今日 +${stats.todayArticles}`} color="bg-primary-500" />
        <StatCard label="快讯总数" value={stats.totalFlash} sub={`今日 +${stats.todayFlash}`} color="bg-amber-500" />
        <StatCard label="总浏览量" value={stats.totalViews.toLocaleString()} color="bg-emerald-500" />
        <StatCard label="分类数" value={stats.categoryStats.length} color="bg-violet-500" />
        <StatCard label="今日产量" value={stats.todayArticles + stats.todayFlash} sub="文章 + 快讯" color="bg-rose-500" />
      </div>

      {/* Processing time stats with link to speed dashboard */}
      {stats.processingStats && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">处理耗时统计</h3>
            <a
              href="/admin/speed"
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              查看详细速度监控 →
            </a>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <TimeStatCard
              label="文章平均耗时"
              seconds={stats.processingStats.avgArticleSeconds}
              todaySeconds={stats.processingStats.todayAvgArticleSeconds}
              color="bg-primary-500"
            />
            <TimeStatCard
              label="快讯平均耗时"
              seconds={stats.processingStats.avgFlashSeconds}
              todaySeconds={stats.processingStats.todayAvgFlashSeconds}
              color="bg-amber-500"
            />
            <TimeStatCard
              label="文章最大耗时"
              seconds={stats.processingStats.maxArticleSeconds}
              color="bg-rose-500"
            />
            <TimeStatCard
              label="快讯最大耗时"
              seconds={stats.processingStats.maxFlashSeconds}
              color="bg-orange-500"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">分类数据</h3>
          <div className="space-y-4">
            {stats.categoryStats.map(cat => (
              <div key={cat.slug}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[cat.slug] || 'bg-slate-500'}`} />
                    <span className="text-sm text-slate-300">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{cat.articles} 篇</span>
                    <span>{cat.flash} 快讯</span>
                  </div>
                </div>
                <MiniBar value={cat.articles} max={maxCatArticles} color={CATEGORY_COLORS[cat.slug] || 'bg-slate-500'} />
              </div>
            ))}
          </div>
        </div>

        {/* 7-day trend */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">近 7 天产量趋势</h3>
          <div className="flex items-end gap-2 h-40">
            {stats.dailyTrend.map(day => {
              const articleH = maxTrend > 0 ? (day.articles / maxTrend) * 100 : 0;
              const flashH = maxTrend > 0 ? (day.flash / maxTrend) * 100 : 0;
              const dateLabel = day.date.slice(5);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5">
                    <div className="w-full max-w-[28px] rounded-t bg-primary-500/80" style={{ height: `${articleH}%`, minHeight: day.articles > 0 ? 4 : 0 }} />
                    <div className="w-full max-w-[28px] rounded-t bg-amber-500/80" style={{ height: `${flashH}%`, minHeight: day.flash > 0 ? 4 : 0 }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{dateLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary-500" /> 文章</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 快讯</span>
          </div>
        </div>
      </div>

      {/* Recent articles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">最近文章</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left pb-2 font-medium">ID</th>
                <th className="text-left pb-2 font-medium">标题</th>
                <th className="text-left pb-2 font-medium">分类</th>
                <th className="text-left pb-2 font-medium">情感</th>
                <th className="text-left pb-2 font-medium">浏览</th>
                <th className="text-left pb-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {stats.recentArticles.map(a => (
                <tr key={a.id} className="text-slate-300 hover:bg-slate-800/30">
                  <td className="py-2 text-slate-500">#{a.id}</td>
                  <td className="py-2 max-w-xs truncate">
                    <span className="mr-2 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-bold text-slate-400">
                      {a.lang || 'zh'}
                    </span>
                    {a.title}
                  </td>
                  <td className="py-2">
                    <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${CATEGORY_COLORS[a.category_slug || ''] || 'bg-slate-500'}`} />
                    {a.category_name || '-'}
                  </td>
                  <td className="py-2">
                    <SentimentBadge value={a.sentiment} />
                  </td>
                  <td className="py-2 text-slate-500">{a.view_count}</td>
                  <td className="py-2 text-xs text-slate-500">{a.created_at?.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SentimentBadge({ value }: { value?: string }) {
  if (!value) return <span className="text-slate-600">-</span>;
  const colors: Record<string, string> = {
    bullish: 'bg-green-500/20 text-green-400',
    bearish: 'bg-red-500/20 text-red-400',
    neutral: 'bg-slate-700/50 text-slate-400',
  };
  const labels: Record<string, string> = { bullish: '看涨', bearish: '看跌', neutral: '中性' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[value] || colors.neutral}`}>
      {labels[value] || value}
    </span>
  );
}
