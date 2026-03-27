'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface BenchmarkRecord {
  id: number;
  article_id: number;
  article_title: string;
  our_published_at: string;
  competitor_title: string | null;
  competitor_source: string | null;
  competitor_url: string | null;
  competitor_published_at: string | null;
  diff_seconds: number | null;
  status: string;
  result_count: number;
  created_at: string;
}

interface BenchmarkData {
  total: number;
  done: number;
  faster: number;
  slower: number;
  noResult: number;
  avgDiffSeconds: number | null;
  medianDiffSeconds: number | null;
  records: BenchmarkRecord[];
}

function formatDiff(seconds: number | null): { text: string; color: string; icon: string } {
  if (seconds === null) return { text: '—', color: 'text-gray-500', icon: '' };
  const abs = Math.abs(seconds);
  let unit: string;
  let value: number;
  if (abs < 60) { value = abs; unit = '秒'; }
  else if (abs < 3600) { value = Math.round(abs / 60); unit = '分钟'; }
  else { value = Math.round(abs / 3600 * 10) / 10; unit = '小时'; }

  if (seconds < 0) {
    return { text: `快 ${value}${unit}`, color: 'text-emerald-400', icon: '🏆' };
  }
  if (seconds === 0) {
    return { text: '同时', color: 'text-yellow-400', icon: '⚡' };
  }
  return { text: `慢 ${value}${unit}`, color: 'text-red-400', icon: '🐢' };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    done: { bg: 'bg-emerald-600/20', text: 'text-emerald-400', label: '完成' },
    pending: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: '待检测' },
    failed: { bg: 'bg-red-600/20', text: 'text-red-400', label: '失败' },
    no_result: { bg: 'bg-slate-700', text: 'text-gray-400', label: '无结果' },
  };
  const s = map[status] || map.pending;
  return <span className={`${s.bg} ${s.text} text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>{s.label}</span>;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-600">{sub}</p>}
    </div>
  );
}

export default function BenchmarkView() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await adminFetch('/api/admin/benchmarks?limit=100');
      const body = await res.json();
      if (res.ok) {
        setData(body as BenchmarkData);
      } else {
        setData(null);
        setLoadError(typeof body?.error === 'string' ? body.error : `请求失败（HTTP ${res.status}）`);
      }
    } catch {
      setData(null);
      setLoadError('网络异常，请稍后重试');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRunBenchmark = async () => {
    setRunning(true);
    setMessage('正在检测最近 24 小时的文章...');
    try {
      const res = await adminFetch('/api/admin/benchmarks', { method: 'POST' });
      const result = await res.json();
      if (result.ok) {
        setMessage('检测完成！正在刷新数据...');
        await fetchData();
        setMessage('');
      } else {
        setMessage(`检测失败: ${result.error || '未知错误'}`);
      }
    } catch (e) {
      setMessage(`请求失败: ${e}`);
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-red-400">加载失败</p>
        {loadError && <p className="text-sm text-slate-500 font-mono break-all">{loadError}</p>}
        <p className="text-xs text-slate-600">
          若提示缺少数据表，请在服务器执行：<code className="text-primary-400">node scripts/init-db.mjs</code>
        </p>
      </div>
    );
  }

  const fasterPct = data.done > 0 ? Math.round((data.faster / data.done) * 100) : 0;
  const avgFmt = formatDiff(data.avgDiffSeconds);
  const medianFmt = formatDiff(data.medianDiffSeconds);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">时效对比</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            检测本站文章与 Google News 上同一新闻最早来源的发布时间差
          </p>
        </div>
        <button
          onClick={handleRunBenchmark}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? '检测中...' : '立即检测'}
        </button>
      </div>

      {message && (
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-gray-300">
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="总检测数" value={data.total} sub={`${data.done} 个有结果`} />
        <StatCard
          label="领先比例"
          value={`${fasterPct}%`}
          sub={`${data.faster} 篇比竞品快`}
          color={fasterPct >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatCard label="落后篇数" value={data.slower} color="text-red-400" />
        <StatCard label="无竞品" value={data.noResult} sub="Google News 未收录" />
        <StatCard
          label="平均时间差"
          value={avgFmt.text}
          color={avgFmt.color}
        />
        <StatCard
          label="中位数时间差"
          value={medianFmt.text}
          color={medianFmt.color}
        />
      </div>

      {/* Bar visualization */}
      {data.done > 0 && (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
          <p className="text-xs text-gray-500 mb-3">领先 vs 落后分布</p>
          <div className="flex h-6 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500/60 transition-all"
              style={{ width: `${fasterPct}%` }}
              title={`${data.faster} 篇领先`}
            />
            <div
              className="bg-red-500/40 transition-all"
              style={{ width: `${100 - fasterPct}%` }}
              title={`${data.slower} 篇落后`}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-gray-600">
            <span>领先 {data.faster} 篇</span>
            <span>落后 {data.slower} 篇</span>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-medium text-white">检测记录</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-slate-700/30">
                <th className="text-left px-4 py-2.5 font-medium">本站文章</th>
                <th className="text-left px-4 py-2.5 font-medium">我方发布</th>
                <th className="text-left px-4 py-2.5 font-medium">最早竞品</th>
                <th className="text-left px-4 py-2.5 font-medium">竞品发布</th>
                <th className="text-center px-4 py-2.5 font-medium">时间差</th>
                <th className="text-center px-4 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map(r => {
                const diff = formatDiff(r.diff_seconds);
                return (
                  <tr key={r.id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="max-w-[250px]">
                        <p className="text-white text-xs font-medium truncate" title={r.article_title}>
                          {r.article_title}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {r.our_published_at?.slice(5, 16)}
                    </td>
                    <td className="px-4 py-3">
                      {r.competitor_source ? (
                        <div className="max-w-[220px]">
                          <p className="text-xs text-gray-300 truncate">{r.competitor_source}</p>
                          {r.competitor_url && (
                            <a
                              href={r.competitor_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary-500 hover:text-primary-400"
                            >
                              查看原文 →
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {r.competitor_published_at?.slice(5, 16) || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${diff.color}`}>
                        {diff.icon} {diff.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
              {data.records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-600">
                    暂无检测记录，点击右上角「立即检测」开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
