'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import LocalizedLink from '@/components/LocalizedLink';
import { adminFetch } from '@/lib/admin-fetch';

interface PipelineStatus {
  running: boolean;
  pid: number | null;
  log: string;
}

interface QueueItem {
  id: number;
  title: string;
  status?: string;
  slug?: string;
  updated_at?: string;
  published_at?: string | null;
}

const ARTICLE_STEPS = [
  { key: 'collect', label: '选题采集', sub: 'Agent 1 · RSS + LLM' },
  { key: 'generate', label: '内容生成', sub: 'Agent 2' },
  { key: 'review', label: '质量审核', sub: 'Agent 3' },
  { key: 'seo', label: 'SEO 优化', sub: 'Agent 4' },
  { key: 'publish', label: '入库发布', sub: 'Agent 5 + Ping' },
];

const FLASH_STEPS = [
  { key: 'c1', label: '多通道采集', sub: 'Finnhub / Marketaux / …' },
  { key: 'c2', label: '翻译 & 去重', sub: 'LLM 批量' },
  { key: 'c3', label: '入库', sub: 'flash_news' },
];

function inferArticleStep(log: string): number {
  if (!log) return -1;
  if (/Agent 5|发布完成|publish/i.test(log) && !/Pipeline 完成/.test(log.slice(-800))) return 4;
  if (/Agent 4|SEO/i.test(log)) return 3;
  if (/Agent 3|审核/i.test(log)) return 2;
  if (/Agent 2|内容生成|Generating/i.test(log)) return 1;
  if (/Agent 1|选题采集|采集完成/i.test(log)) return 0;
  return -1;
}

export default function PipelinePage() {
  const [status, setStatus] = useState<PipelineStatus>({ running: false, pid: null, log: '' });
  const [queues, setQueues] = useState<{ pending: QueueItem[]; published: QueueItem[] }>({
    pending: [],
    published: [],
  });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'all' | 'articles' | 'flash'>('all');
  const [articles, setArticles] = useState('10');
  const [flash, setFlash] = useState('15');
  const logRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(() => {
    adminFetch('/api/admin/pipeline')
      .then(r => r.json())
      .then((data: PipelineStatus) => {
        setStatus(data);
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      })
      .catch(() => {});
  }, []);

  const fetchQueues = useCallback(() => {
    adminFetch('/api/admin/pipeline-queues')
      .then(r => r.json())
      .then((data: { pending?: QueueItem[]; published?: QueueItem[] }) => {
        setQueues({
          pending: data.pending || [],
          published: data.published || [],
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchQueues();
  }, [fetchStatus, fetchQueues]);

  useEffect(() => {
    const q = setInterval(fetchQueues, 10000);
    return () => clearInterval(q);
  }, [fetchQueues]);

  useEffect(() => {
    if (status.running) {
      pollRef.current = setInterval(fetchStatus, 3000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status.running, fetchStatus]);

  async function handleStart() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'start', mode, articles, flash });
      const res = await adminFetch(`/api/admin/pipeline?${params}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) alert(data.error);
      else setTimeout(fetchStatus, 1000);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!confirm('确定要中断 Pipeline？')) return;
    setLoading(true);
    try {
      await adminFetch('/api/admin/pipeline?action=stop', { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    } finally {
      setLoading(false);
    }
  }

  const articleStep = status.running && (mode === 'all' || mode === 'articles') ? inferArticleStep(status.log) : -1;
  const flashRunning = status.running && (mode === 'all' || mode === 'flash') && /快讯|flash|Flash/i.test(status.log);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">内容生产 Pipeline</h2>

      {/* —— 流程可视化 —— */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-6">
        <h3 className="text-sm font-semibold text-white">文章生产线（顺序执行）</h3>
        <div className="flex flex-wrap items-stretch gap-2 md:gap-0 md:justify-between">
          {ARTICLE_STEPS.map((s, i) => {
            const active = articleStep === i;
            const done = articleStep > i;
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-[100px] max-w-full md:max-w-[20%]">
                <div
                  className={`flex-1 rounded-lg border px-3 py-3 text-center transition-colors ${
                    active
                      ? 'border-primary-500 bg-primary-500/15 ring-1 ring-primary-500/40'
                      : done
                        ? 'border-emerald-800/60 bg-emerald-950/20'
                        : 'border-slate-700 bg-slate-800/40'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{s.label}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500 leading-tight">{s.sub}</div>
                  {active && <div className="mt-1 text-[10px] text-primary-400 animate-pulse">进行中…</div>}
                  {done && !active && <div className="mt-1 text-[10px] text-emerald-600">✓</div>}
                </div>
                {i < ARTICLE_STEPS.length - 1 && (
                  <div className="hidden md:block w-2 shrink-0 text-slate-600 text-center">→</div>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="text-sm font-semibold text-white pt-2 border-t border-slate-800">快讯生产线（通道并发 → 翻译）</h3>
        <div className="flex flex-wrap gap-3">
          {FLASH_STEPS.map((s, i) => {
            const active = flashRunning && i === 1;
            const hot = flashRunning && i === 0;
            return (
              <div
                key={s.key}
                className={`rounded-lg border px-4 py-2.5 flex-1 min-w-[140px] ${
                  hot || active ? 'border-amber-600/50 bg-amber-950/20' : 'border-slate-700 bg-slate-800/30'
                }`}
              >
                <div className="text-xs font-medium text-white">{s.label}</div>
                <div className="text-[10px] text-slate-500">{s.sub}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          文章阶段根据当前日志关键字高亮；未运行时全部显示为待机。待处理队列为库内 <code className="text-slate-400">draft/review</code> 状态。
        </p>
      </div>

      {/* —— 双队列 —— */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-900/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-200">待处理（草稿 / 待审）</h3>
            <span className="text-xs text-slate-500">{queues.pending.length} 条</span>
          </div>
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
            {queues.pending.length === 0 ? (
              <li className="text-slate-500 text-xs py-4 text-center">暂无 — Pipeline 通常直接发 published</li>
            ) : (
              queues.pending.map(a => (
                <li key={a.id} className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-slate-300 line-clamp-2 flex-1">{a.title}</span>
                  <span className="shrink-0 text-[10px] uppercase text-slate-500">{a.status}</span>
                </li>
              ))
            )}
          </ul>
          <LocalizedLink href="/admin/articles" className="mt-3 inline-block text-xs text-primary-400 hover:text-primary-300">
            文章管理 →
          </LocalizedLink>
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-emerald-300">已发布（最近）</h3>
            <span className="text-xs text-slate-500">{queues.published.length} 条</span>
          </div>
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
            {queues.published.map(a => (
              <li key={a.id} className="border-b border-slate-800/80 pb-2">
                <LocalizedLink
                  href={`/article/${a.slug}`}
                  target="_blank"
                  className="text-slate-300 hover:text-primary-400 line-clamp-2"
                >
                  {a.title}
                </LocalizedLink>
                <div className="text-[10px] text-slate-600 mt-0.5">{a.published_at?.slice(0, 16)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4">
        <span className={`h-3 w-3 rounded-full ${status.running ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-sm text-slate-300">
          {status.running ? `运行中 (PID: ${status.pid})` : '已停止'}
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">启动参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">生产模式</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as typeof mode)}
              disabled={status.running}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
            >
              <option value="all">文章 + 快讯</option>
              <option value="articles">仅文章</option>
              <option value="flash">仅快讯</option>
            </select>
          </div>
          {mode !== 'flash' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">文章数量</label>
              <input
                type="number"
                min={1}
                max={50}
                value={articles}
                onChange={e => setArticles(e.target.value)}
                disabled={status.running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
          )}
          {mode !== 'articles' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">快讯数量</label>
              <input
                type="number"
                min={1}
                max={100}
                value={flash}
                onChange={e => setFlash(e.target.value)}
                disabled={status.running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          {!status.running ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              启动 Pipeline
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              中断 Pipeline
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              fetchStatus();
              fetchQueues();
            }}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">运行日志</h3>
          {status.running && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              实时更新中
            </span>
          )}
        </div>
        <pre
          ref={logRef}
          className="h-80 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800 p-4 text-xs text-slate-400 font-mono whitespace-pre-wrap"
        >
          {status.log || '暂无日志输出。点击「启动 Pipeline」开始内容生产。'}
        </pre>
      </div>
    </div>
  );
}
