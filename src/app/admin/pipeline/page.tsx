'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';

interface PipelineStatus {
  running: boolean;
  pid: number | null;
  log: string;
  metrics?: {
    queued: number;
    started: number;
    failed: number;
    finished: number;
  };
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

const KNOWN_SOURCES = [
  { id: 'Finnhub', type: 'API' },
  { id: 'NewsAPI', type: 'API' },
  { id: 'Marketaux', type: 'API' },
  { id: 'Polygon', type: 'API' },
  { id: 'AlphaVantage', type: 'API' },
  { id: 'CoinGecko', type: 'API' },
  { id: 'CryptoCompare', type: 'API' },
  { id: 'CN_Sina', type: 'API/Spider' },
  { id: 'CN_RSS', type: 'RSS' },
  { id: 'RSS', type: 'RSS' },
];

// Removed brittle ARTICLE_STEPS and inferArticleStep.
// Architecture changed to granular one-by-one First Principles queues.

const FLASH_STEPS = [
  { key: 'c1', label: '多通道采集', sub: 'Finnhub / Marketaux / …' },
  { key: 'c2', label: '翻译 & 去重', sub: 'LLM 批量' },
  { key: 'c3', label: '入库', sub: 'flash_news' },
];

// inferArticleStep removed
export default function PipelinePage() {
  const [status, setStatus] = useState<PipelineStatus>({ running: false, pid: null, log: '' });
  const [queues, setQueues] = useState<{ pending: QueueItem[]; published: QueueItem[]; sources: SourceActivity[] }>({
    pending: [],
    published: [],
    sources: [],
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
        <h3 className="text-sm font-semibold text-white">生产工厂动态展板 (Factory Queue Board) — <span className="text-xs text-slate-400 font-normal border-l border-slate-600 pl-2 ml-1">第一性原理: 颗粒化绝对状态</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-primary-500/50 bg-primary-950/20 px-4 py-3 relative overflow-hidden">
            <div className="text-xs font-medium text-primary-200 mb-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${status.metrics?.started ? 'bg-primary-400 animate-pulse' : 'bg-slate-600'}`} />
              当前正在创作 (Worker)
            </div>
            <div className="text-3xl font-bold text-primary-400 font-mono">
              {status.metrics?.started || 0} <span className="text-sm text-primary-600/60 font-medium">篇</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              排队等待中 (Queued)
            </div>
            <div className="text-3xl font-bold text-slate-300 font-mono">
               {status.metrics?.queued || 0} <span className="text-sm text-slate-600 font-medium">篇</span>
            </div>
          </div>
          <div className="rounded-lg border border-red-900/40 bg-red-950/10 px-4 py-3">
            <div className="text-xs font-medium text-red-400/80 mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/50" />
              死信异常 (Failed)
            </div>
            <div className="text-3xl font-bold text-red-500/80 font-mono">
              {status.metrics?.failed || 0} <span className="text-sm text-red-900/50 font-medium">篇</span>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 px-4 py-3">
            <div className="text-xs font-medium text-emerald-500 mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              历史已投递 (Finished)
            </div>
            <div className="text-3xl font-bold text-emerald-400 font-mono">
               {status.metrics?.finished || 0} <span className="text-sm text-emerald-800/60 font-medium">次</span>
            </div>
          </div>
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

        <h3 className="text-sm font-semibold text-white pt-2 border-t border-slate-800 mt-6">数据源雷达矩阵 (Data Source Matrix)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {KNOWN_SOURCES.map(def => {
            const dbRecord = queues.sources?.find(s => s.source.toLowerCase() === def.id.toLowerCase());
            const secondsAgo = dbRecord ? (Date.now() - new Date(dbRecord.last_seen).getTime()) / 1000 : Infinity;
            
            // Highlight: Less than 30s ago -> highly active / pulsing!
            const isBlinking = secondsAgo < 30;
            // Online: Has fired within the last 2 hours.
            const isOnline = secondsAgo < 7200;

            return (
              <div
                key={def.id}
                className={`relative overflow-hidden rounded-lg border px-3 py-2 transition-all ${
                  isBlinking
                    ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105 z-10'
                    : isOnline
                    ? 'border-emerald-900/40 bg-slate-800/60'
                    : 'border-slate-800 bg-slate-900/40 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-bold tracking-wide uppercase ${isBlinking ? 'text-emerald-400' : isOnline ? 'text-slate-300' : 'text-slate-500'}`}>
                      {def.id}
                    </span>
                    <span className="text-[8px] text-slate-600 mt-0.5">{def.type}</span>
                  </div>
                  {isBlinking && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]" />}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">24H: <span className="text-slate-400 font-mono">{dbRecord?.count_24h || 0}</span></span>
                  <span className={isBlinking ? 'text-emerald-500/90 font-bold' : isOnline ? 'text-slate-400' : 'text-slate-600'}>
                    {isBlinking ? 'Fetching...' : dbRecord ? (secondsAgo < 60 ? '< 1 min' : `${Math.floor(secondsAgo / 60)}m ago`) : 'Idle'}
                  </span>
                </div>
              </div>
            );
          })}
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

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">运行时配置 (Runtime Config)</h3>
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
              <option value="articles">仅文章出稿</option>
              <option value="flash">仅快讯采集</option>
            </select>
          </div>
          {mode !== 'flash' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">文章单次投递量</label>
              <input
                type="number"
                min={1}
                max={50}
                value={articles}
                onChange={e => setArticles(e.target.value)}
                disabled={status.running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>
          )}
          {mode !== 'articles' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">快讯采集条数</label>
              <input
                type="number"
                min={1}
                max={100}
                value={flash}
                onChange={e => setFlash(e.target.value)}
                disabled={status.running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">注：上述配置会在下次点击【总开关】启动时，写入后台 PM2 守护进程生效。</p>
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
          className={`h-80 overflow-y-auto rounded-lg bg-slate-950 border p-4 text-xs font-mono whitespace-pre-wrap ${
            isPaused ? 'border-amber-500/50 text-amber-200' : isOffline ? 'border-red-500/50 text-red-400' : 'border-emerald-500/50 text-emerald-500'
          }`}
        >
          {status.log || '正在连接守护进程...'}
        </pre>
      </div>
    </div>
  );
}
