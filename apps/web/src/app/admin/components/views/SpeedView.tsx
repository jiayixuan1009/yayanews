'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { SpeedStats, PipelineRun } from '@/lib/admin-queries';

function fmt(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '-';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}m${sec}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

function fmtCN(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '-';
  const s = Math.round(seconds);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}分${sec}秒` : `${m}分钟`;
  const h = Math.floor(m / 60);
  return `${h}时${m % 60}分`;
}

function deltaIndicator(current: number | null, previous: number | null): JSX.Element | null {
  if (current == null || previous == null || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const improved = delta < 0;
  return (
    <span className={`text-[11px] font-medium ${improved ? 'text-green-400' : 'text-red-400'}`}>
      {improved ? '↓' : '↑'}{Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function MetricCard({ label, value, sub, delta, color = 'text-white' }: {
  label: string; value: string; sub?: string; delta?: JSX.Element | null; color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {delta}
      </div>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKeys, colors, height = 160 }: {
  /** 统计桶等结构化行；内部按 Record 读取数值列 */
  data: unknown[];
  labelKey: string;
  valueKeys: string[];
  colors: string[];
  height?: number;
}) {
  const rows = data as Record<string, unknown>[];
  const maxVal = Math.max(
    ...rows.flatMap((d: Record<string, unknown>) => valueKeys.map(k => Number(d[k]) || 0)),
    1
  );

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {rows.map((d: Record<string, unknown>, i: number) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          <div className="flex-1 w-full flex flex-col justify-end items-center gap-px">
            {valueKeys.map((k, ki) => {
              const v = (d[k] as number) || 0;
              const pct = (v / maxVal) * 100;
              return (
                <div
                  key={k}
                  className={`w-full max-w-[32px] rounded-t ${colors[ki]}`}
                  style={{ height: `${pct}%`, minHeight: v > 0 ? 3 : 0 }}
                  title={`${k}: ${v}`}
                />
              );
            })}
          </div>
          <span className="text-[9px] text-slate-600 truncate max-w-full">{String(d[labelKey])}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBar({ label, value, max, color, displayVal }: {
  label: string; value: number; max: number; color: string; displayVal: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-400 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute right-2 top-0 h-full flex items-center text-[10px] text-slate-300 font-medium">
          {displayVal}
        </span>
      </div>
    </div>
  );
}

function PercentileGauge({ label, p50, p95, fastest, slowest, avg }: {
  label: string; p50: number | null; p95: number | null;
  fastest: number | null; slowest: number | null; avg: number | null;
}) {
  const maxVal = slowest || 1;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h4 className="text-sm font-semibold text-white mb-4">{label}</h4>
      <div className="space-y-3">
        <HorizontalBar label="最快" value={fastest || 0} max={maxVal} color="bg-green-500" displayVal={fmt(fastest)} />
        <HorizontalBar label="P50 (中位)" value={p50 || 0} max={maxVal} color="bg-blue-500" displayVal={fmt(p50)} />
        <HorizontalBar label="平均" value={avg || 0} max={maxVal} color="bg-amber-500" displayVal={fmt(avg)} />
        <HorizontalBar label="P95" value={p95 || 0} max={maxVal} color="bg-orange-500" displayVal={fmt(p95)} />
        <HorizontalBar label="最慢" value={slowest || 0} max={maxVal} color="bg-red-500" displayVal={fmt(slowest)} />
      </div>
    </div>
  );
}

function parseStagePipeline(run: PipelineRun): { stage: string; seconds: number }[] {
  try {
    const obj = JSON.parse(run.stage_timings || '{}');
    return Object.entries(obj)
      .filter(([k]) => k !== 'total')
      .map(([k, v]) => ({ stage: k, seconds: v as number }));
  } catch {
    return [];
  }
}

function parseChannelTimings(run: PipelineRun): { channel: string; seconds: number }[] {
  try {
    const obj = JSON.parse(run.channel_timings || '{}');
    return Object.entries(obj).map(([k, v]) => ({ channel: k, seconds: v as number }));
  } catch {
    return [];
  }
}

const STAGE_COLORS: Record<string, string> = {
  collect: 'bg-blue-500', generate: 'bg-violet-500', review: 'bg-amber-500',
  seo: 'bg-emerald-500', publish: 'bg-rose-500', fetch: 'bg-cyan-500', translate: 'bg-pink-500',
};
const STAGE_LABELS: Record<string, string> = {
  collect: '采集', generate: '生成', review: '审核',
  seo: 'SEO', publish: '发布', fetch: '拉取', translate: '翻译',
};

export default function SpeedView() {
  const [stats, setStats] = useState<SpeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'runs'>('overview');

  useEffect(() => {
    adminFetch('/api/admin/speed-stats')
      .then(async (r) => {
        const data = await r.json();
        if (
          !r.ok ||
          !data ||
          typeof data !== 'object' ||
          !('overview' in data) ||
          !Array.isArray(data.distribution) ||
          !Array.isArray(data.trend) ||
          !Array.isArray(data.recentRuns) ||
          !data.articleProcessing ||
          !data.flashProcessing
        ) {
          setStats(null);
          return;
        }
        setStats(data as SpeedStats);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-red-400">Failed to load speed data.</p>;

  const { overview: o } = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">速度监控仪表盘</h2>
          <p className="text-sm text-slate-500 mt-1">可验证 · 可比较 · 可视化</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
          {(['overview', 'runs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'overview' ? '总览' : '运行记录'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          {/* ── 核心速度指标 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <MetricCard
              label="文章Pipeline平均"
              value={fmt(o.avgArticle)}
              sub={`今日: ${fmtCN(o.todayAvgArticle)}`}
              delta={deltaIndicator(o.todayAvgArticle, o.yesterdayAvgArticle)}
              color="text-blue-400"
            />
            <MetricCard
              label="快讯Pipeline平均"
              value={fmt(o.avgFlash)}
              sub={`今日: ${fmtCN(o.todayAvgFlash)}`}
              delta={deltaIndicator(o.todayAvgFlash, o.yesterdayAvgFlash)}
              color="text-amber-400"
            />
            <MetricCard label="文章P95" value={fmt(o.p95Article)} color="text-orange-400" />
            <MetricCard label="快讯P95" value={fmt(o.p95Flash)} color="text-orange-400" />
            <MetricCard label="单篇文章均耗" value={o.perItemArticle != null ? `${o.perItemArticle}s` : '-'} color="text-violet-400" />
            <MetricCard label="单条快讯均耗" value={o.perItemFlash != null ? `${o.perItemFlash}s` : '-'} color="text-violet-400" />
          </div>

          {/* ── 运行统计摘要 ── */}
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard label="总运行次数" value={String(o.totalRuns)} color="text-slate-300" />
            <MetricCard label="今日运行" value={String(o.todayRuns)} color="text-green-400" />
            <MetricCard label="最快文章Pipeline" value={fmt(o.fastestArticle)} color="text-green-400" />
            <MetricCard label="最快快讯Pipeline" value={fmt(o.fastestFlash)} color="text-green-400" />
          </div>

          {/* ── 百分位分析 (文章 vs 快讯 processing) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PercentileGauge
              label="文章处理耗时分布 (采集→发布)"
              {...stats.articleProcessing}
            />
            <PercentileGauge
              label="快讯处理耗时分布 (采集→发布)"
              {...stats.flashProcessing}
            />
          </div>

          {/* ── 处理时间分布直方图 ── */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">处理时间分布</h3>
            <BarChart
              data={stats.distribution}
              labelKey="range"
              valueKeys={['article_count', 'flash_count']}
              colors={['bg-blue-500/80', 'bg-amber-500/80']}
              height={160}
            />
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> 文章</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 快讯</span>
            </div>
          </div>

          {/* ── 14天趋势 ── */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">近14天平均处理耗时趋势</h3>
            {(() => {
              const maxSec = Math.max(
                ...stats.trend.map(d => Math.max(d.avg_article || 0, d.avg_flash || 0)),
                1
              );
              return (
                <div className="flex items-end gap-1" style={{ height: 180 }}>
                  {stats.trend.map(d => {
                    const artH = d.avg_article != null ? (d.avg_article / maxSec) * 100 : 0;
                    const flashH = d.avg_flash != null ? (d.avg_flash / maxSec) * 100 : 0;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
                        <div className="flex-1 w-full flex items-end justify-center gap-px">
                          <div
                            className="w-1/3 max-w-[14px] rounded-t bg-blue-500/80"
                            style={{ height: `${artH}%`, minHeight: artH > 0 ? 3 : 0 }}
                          />
                          <div
                            className="w-1/3 max-w-[14px] rounded-t bg-amber-500/80"
                            style={{ height: `${flashH}%`, minHeight: flashH > 0 ? 3 : 0 }}
                          />
                        </div>
                        <span className="text-[8px] text-slate-600">{d.date.slice(5)}</span>
                        <div className="hidden group-hover:block absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px] text-slate-300 whitespace-nowrap z-10 shadow-lg">
                          <p>文章: {fmt(d.avg_article)} ({d.count_article}篇)</p>
                          <p>快讯: {fmt(d.avg_flash)} ({d.count_flash}条)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> 文章平均</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 快讯平均</span>
            </div>
          </div>

          {/* ── 最近一次运行阶段分解 ── */}
          {stats.recentRuns.length > 0 && (() => {
            const lastArt = stats.recentRuns.find(r => r.run_type === 'article');
            const lastFlash = stats.recentRuns.find(r => r.run_type === 'flash');
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {lastArt && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <h4 className="text-sm font-semibold text-white mb-1">最近一次文章Pipeline阶段分解</h4>
                    <p className="text-[11px] text-slate-500 mb-4">{lastArt.started_at} · 总计 {fmt(lastArt.total_seconds)} · {lastArt.items_produced}/{lastArt.items_requested} 篇</p>
                    <div className="space-y-2">
                      {parseStagePipeline(lastArt).map(s => (
                        <HorizontalBar
                          key={s.stage}
                          label={STAGE_LABELS[s.stage] || s.stage}
                          value={s.seconds}
                          max={lastArt.total_seconds}
                          color={STAGE_COLORS[s.stage] || 'bg-slate-500'}
                          displayVal={fmt(s.seconds)}
                        />
                      ))}
                    </div>
                    {/* Waterfall visual */}
                    <div className="mt-4">
                      <p className="text-[10px] text-slate-500 mb-1">时间占比</p>
                      <div className="flex h-6 rounded-full overflow-hidden">
                        {parseStagePipeline(lastArt).map(s => {
                          const pct = lastArt.total_seconds > 0 ? (s.seconds / lastArt.total_seconds) * 100 : 0;
                          return (
                            <div
                              key={s.stage}
                              className={`${STAGE_COLORS[s.stage] || 'bg-slate-500'} relative group`}
                              style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }}
                              title={`${STAGE_LABELS[s.stage] || s.stage}: ${fmt(s.seconds)} (${pct.toFixed(1)}%)`}
                            >
                              {pct > 8 && (
                                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium">
                                  {STAGE_LABELS[s.stage] || s.stage}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {lastFlash && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <h4 className="text-sm font-semibold text-white mb-1">最近一次快讯Pipeline阶段分解</h4>
                    <p className="text-[11px] text-slate-500 mb-4">{lastFlash.started_at} · 总计 {fmt(lastFlash.total_seconds)} · {lastFlash.items_produced}/{lastFlash.items_requested} 条</p>
                    <div className="space-y-2">
                      {parseStagePipeline(lastFlash).map(s => (
                        <HorizontalBar
                          key={s.stage}
                          label={STAGE_LABELS[s.stage] || s.stage}
                          value={s.seconds}
                          max={lastFlash.total_seconds}
                          color={STAGE_COLORS[s.stage] || 'bg-slate-500'}
                          displayVal={fmt(s.seconds)}
                        />
                      ))}
                    </div>
                    {/* Channel timings */}
                    {parseChannelTimings(lastFlash).length > 0 && (
                      <>
                        <p className="text-[11px] text-slate-500 mt-4 mb-2">通道采集耗时</p>
                        <div className="space-y-2">
                          {parseChannelTimings(lastFlash).map(c => (
                            <HorizontalBar
                              key={c.channel}
                              label={c.channel}
                              value={c.seconds}
                              max={Math.max(...parseChannelTimings(lastFlash).map(x => x.seconds), 1)}
                              color="bg-cyan-500"
                              displayVal={`${c.seconds}s`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      ) : (
        /* ── 运行记录表 ── */
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Pipeline 运行记录 (最近50次)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-2 font-medium">ID</th>
                  <th className="text-left pb-2 font-medium">类型</th>
                  <th className="text-left pb-2 font-medium">开始时间</th>
                  <th className="text-right pb-2 font-medium">总耗时</th>
                  <th className="text-right pb-2 font-medium">请求</th>
                  <th className="text-right pb-2 font-medium">产出</th>
                  <th className="text-right pb-2 font-medium">成功率</th>
                  <th className="text-right pb-2 font-medium">单项均耗</th>
                  <th className="text-left pb-2 font-medium">阶段</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stats.recentRuns.map(run => {
                  const rate = run.items_requested > 0 ? (run.items_produced / run.items_requested * 100).toFixed(0) : '-';
                  const perItem = run.items_produced > 0 ? (run.total_seconds / run.items_produced).toFixed(1) : '-';
                  const stages = parseStagePipeline(run);
                  return (
                    <tr key={run.id} className="text-slate-300 hover:bg-slate-800/30">
                      <td className="py-2 text-slate-500">#{run.id}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          run.run_type === 'article' ? 'bg-blue-500/20 text-blue-400' :
                          run.run_type === 'flash' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>
                          {run.run_type === 'article' ? '文章' : run.run_type === 'flash' ? '快讯' : run.run_type}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-400">{run.started_at?.slice(0, 16)}</td>
                      <td className="py-2 text-right font-mono">{fmt(run.total_seconds)}</td>
                      <td className="py-2 text-right text-slate-500">{run.items_requested}</td>
                      <td className="py-2 text-right">{run.items_produced}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs ${
                          Number(rate) >= 80 ? 'text-green-400' :
                          Number(rate) >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-slate-400">{perItem}s</td>
                      <td className="py-2">
                        <div className="flex h-4 rounded-full overflow-hidden max-w-[200px]">
                          {stages.map(s => {
                            const pct = run.total_seconds > 0 ? (s.seconds / run.total_seconds) * 100 : 0;
                            return (
                              <div
                                key={s.stage}
                                className={`${STAGE_COLORS[s.stage] || 'bg-slate-500'}`}
                                style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }}
                                title={`${STAGE_LABELS[s.stage] || s.stage}: ${s.seconds}s`}
                              />
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {stats.recentRuns.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-600">暂无运行记录</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-slate-500">
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
               <span key={k} className="flex items-center gap-1">
                 <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[k]}`} />{v}
               </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
