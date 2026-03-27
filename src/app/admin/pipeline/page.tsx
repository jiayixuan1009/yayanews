'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
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

interface SourceActivity {
  source: string;
  last_seen: string;
  count_24h: number;
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
  const [queues, setQueues] = useState<{ pending: QueueItem[]; published: QueueItem[]; sources: SourceActivity[] }>({
    pending: [],
    published: [],
    sources: [],
  });
  const [loading, setLoading] = useState(false);
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
      .then((data: { pending?: QueueItem[]; published?: QueueItem[]; sources?: SourceActivity[] }) => {
        setQueues({
          pending: data.pending || [],
          published: data.published || [],
          sources: data.sources || [],
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
      const res = await adminFetch(`/api/admin/pipeline?action=start`, { method: 'POST' });
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

  const articleStep = status.running ? inferArticleStep(status.log) : -1;
  const flashRunning = status.running && /快讯|flash|Flash|Dispatching \d+ flash/i.test(status.log);
  const isPaused = !status.running && status.log?.includes('[已暂停]');
  const isOffline = !status.running && status.log?.includes('警告: 离线超过');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">内容生产 Pipeline</h2>
        
        {/* -- First Principles: Definitive Control Switch -- */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg">
          <span className="text-xs font-medium text-slate-400">总开关状态</span>
          <button
            onClick={status.running ? handleStop : handleStart}
            disabled={loading || isOffline}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              status.running ? 'bg-primary-500' : 'bg-slate-600'
            } ${loading || isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status.running ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-bold ${status.running ? 'text-primary-400 animate-pulse' : isOffline ? 'text-red-500' : 'text-amber-500'}`}>
            {status.running ? '生产中' : isOffline ? '离线异常' : '已中断'}
          </span>
        </div>
      </div>

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

        <h3 className="text-sm font-semibold text-white pt-2 border-t border-slate-800 mt-6">数据源实时监控 (Active Channels)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {queues.sources.length === 0 ? (
            <div className="col-span-full py-2 text-xs text-slate-500 text-center">暂无数据源活动记录</div>
          ) : (
            queues.sources.map(s => {
              const secondsAgo = (Date.now() - new Date(s.last_seen).getTime()) / 1000;
              const isBlinking = secondsAgo < 15; // Pulse if updated within the last 15 seconds!
              return (
                <div
                  key={s.source}
                  className={`relative overflow-hidden rounded-lg border px-3 py-2 transition-all ${
                    isBlinking
                      ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'border-slate-700 bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold tracking-wide uppercase ${isBlinking ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {s.source}
                    </span>
                    {isBlinking && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">24H: <span className="text-slate-400">{s.count_24h}</span></span>
                    <span className={isBlinking ? 'text-emerald-500/80' : 'text-slate-600'}>
                      {isBlinking ? 'Acquiring...' : `${Math.floor(secondsAgo / 60)}m ago`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-emerald-300">已发布（最近）</h3>
            <span className="text-xs text-slate-500">{queues.published.length} 条</span>
          </div>
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
            {queues.published.map(a => (
              <li key={a.id} className="border-b border-slate-800/80 pb-2">
                <Link
                  href={`/article/${a.slug}`}
                  target="_blank"
                  className="text-slate-300 hover:text-primary-400 line-clamp-2"
                >
                  {a.title}
                </Link>
                <div className="text-[10px] text-slate-600 mt-0.5">{a.published_at?.slice(0, 16)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">守护进程实时心跳 (Daemon Heartbeat)</h3>
          {status.running && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              后台指令正常侦听中
            </span>
          )}
        </div>
        <pre
          ref={logRef}
          className={`h-24 overflow-y-auto rounded-lg bg-slate-950 border p-4 text-sm font-mono whitespace-pre-wrap ${
            isPaused ? 'border-amber-500/50 text-amber-200' : isOffline ? 'border-red-500/50 text-red-400' : 'border-emerald-500/50 text-emerald-300'
          }`}
        >
          {status.log || '正在连接守护进程...'}
        </pre>
      </div>
    </div>
  );
}
