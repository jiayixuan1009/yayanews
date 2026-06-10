'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface PipelineStatus {
  running: boolean;
  pid: number | null;
  state?: 'running' | 'paused' | 'offline';
  log: string;
  metrics?: {
    queued: number;
    started: number;
    failed: number;
    failedTotal?: number;
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
  age_seconds?: number | null;
}

interface PendingSummary {
  total: number;
  draft: number;
  review: number;
  stale: number;
  staleHours: number;
  oldest_updated_at: string | null;
}

interface SourceActivity {
  source: string;
  last_seen: string;
  count_24h: number;
}

interface PipelineQueues {
  pending: QueueItem[];
  pendingSummary: PendingSummary;
  published: QueueItem[];
  sources: SourceActivity[];
  pendingFlashCount: number;
}

const EMPTY_PENDING_SUMMARY: PendingSummary = {
  total: 0,
  draft: 0,
  review: 0,
  stale: 0,
  staleHours: 2,
  oldest_updated_at: null,
};

const EMPTY_QUEUES: PipelineQueues = {
  pending: [],
  pendingSummary: EMPTY_PENDING_SUMMARY,
  published: [],
  sources: [],
  pendingFlashCount: 0,
};

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

const PIPELINE_STEPS = ['采集', '生成', '审核', '发布'];

export default function PipelineView() {
  const [status, setStatus] = useState<PipelineStatus>({ running: false, pid: null, log: '' });
  const [queues, setQueues] = useState<PipelineQueues>(EMPTY_QUEUES);
  const [loading, setLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
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
        if (logRef.current) logRef.current.scrollTop = 0;
      })
      .catch(() => {});
  }, []);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/pipeline-queues');
      const data = await res.json();
      if (data?.error) return;
      setQueues({
        pending: data.pending || [],
        pendingSummary: data.pendingSummary || EMPTY_PENDING_SUMMARY,
        published: data.published || [],
        sources: data.sources || [],
        pendingFlashCount: data.pendingFlashCount ?? 0,
      });
    } catch {
      // Keep the last known values on transient admin API failures.
    }
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
    if (!confirm('确定暂停 Pipeline？')) return;
    setLoading(true);
    try {
      await adminFetch('/api/admin/pipeline?action=stop', { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchiveStaleDrafts() {
    const hours = queues.pendingSummary.staleHours || 2;
    if (!confirm(`确认归档 ${queues.pendingSummary.stale} 篇超过 ${hours} 小时的 draft/review 文章？`)) return;
    setMaintenanceLoading(true);
    try {
      const res = await adminFetch(`/api/admin/pipeline-queues?action=archive-stale&hours=${hours}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert(`已归档 ${data.archived || 0} 篇`);
      await fetchQueues();
    } finally {
      setMaintenanceLoading(false);
    }
  }

  const rqQueued = status.metrics?.queued || 0;
  const rqStarted = status.metrics?.started || 0;
  const rqFailed = status.metrics?.failed || 0;
  const rqFailedTotal = status.metrics?.failedTotal || 0;
  const rqFinished = status.metrics?.finished || 0;
  const pendingSummary = queues.pendingSummary;
  const isPaused = status.state === 'paused';
  const isOffline = status.state === 'offline' || (!status.running && !isPaused);
  const apiSources = KNOWN_SOURCES.filter(s => s.type.includes('API'));
  const rssSources = KNOWN_SOURCES.filter(s => s.type.includes('RSS'));

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-100px)] lg:max-h-[calc(100vh-60px)]">
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-lg shrink-0">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          内容生产 Pipeline
          <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-normal">Daemon</span>
        </h2>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">总开关</span>
          <button
            onClick={status.running ? handleStop : handleStart}
            disabled={loading}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              status.running ? 'bg-primary-500' : 'bg-slate-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={status.running ? '暂停 Pipeline' : '启动 Pipeline'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                status.running ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs font-bold min-w-[64px] ${status.running ? 'text-primary-400 animate-pulse' : isOffline ? 'text-red-500' : 'text-amber-500'}`}>
            {status.running ? '运行中' : isOffline ? '离线异常' : '已暂停'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
        <MetricCard label="处理中 RQ" value={rqStarted} tone="primary" active={rqStarted > 0} />
        <MetricCard label="待执行 RQ" value={rqQueued} tone="slate" active={rqQueued > 0} />
        <MetricCard label="遗留草稿" value={pendingSummary.total} tone="amber" active={pendingSummary.total > 0} sub={`draft ${pendingSummary.draft} / review ${pendingSummary.review}`} />
        <MetricCard label="近10分快讯" value={queues.pendingFlashCount} tone="cyan" active={queues.pendingFlashCount > 0} />
        <MetricCard label="24h失败" value={rqFailed} tone="red" active={rqFailed > 0} sub={`历史 ${rqFailedTotal}`} />
        <MetricCard label="已完成 RQ" value={rqFinished} tone="emerald" active={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0 lg:overflow-hidden">
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 lg:overflow-y-auto pr-1">
          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 shrink-0">
            <h3 className="text-sm font-semibold text-white mb-2 pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>API 通道活跃度</span>
              <span className="text-xs text-cyan-500 font-normal">24h</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {apiSources.map(s => <SourceCard key={s.id} source={s} activity={queues.sources} rss={false} />)}
            </div>

            <h3 className="text-sm font-semibold text-white mt-3 mb-2 pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>RSS 通道活跃度</span>
              <span className="text-xs text-amber-500 font-normal">24h</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {rssSources.map(s => <SourceCard key={s.id} source={s} activity={queues.sources} rss />)}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 shrink-0">
            <h3 className="text-sm font-semibold text-white mb-2">文章流水线</h3>
            <div className="grid grid-cols-4 gap-2">
              {PIPELINE_STEPS.map((step, index) => {
                const active = rqStarted > 0 && index === Math.min(PIPELINE_STEPS.length - 1, Math.floor(Date.now() / 3000) % PIPELINE_STEPS.length);
                return (
                  <div key={step} className={`rounded border p-1.5 text-center text-xs font-medium ${active ? 'border-primary-500/50 bg-primary-950/30 text-primary-300' : 'border-slate-800 bg-slate-800/20 text-slate-400'}`}>
                    {step}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
            <section className="rounded-lg border border-amber-900/30 bg-slate-900/50 p-3 flex flex-col min-h-[190px]">
              <div className="flex items-start justify-between gap-3 mb-2 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-amber-300">遗留草稿 / Review</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    超时 {pendingSummary.stale} 篇，最早 {formatShortTime(pendingSummary.oldest_updated_at)}
                  </p>
                </div>
                <button
                  onClick={handleArchiveStaleDrafts}
                  disabled={maintenanceLoading || pendingSummary.stale === 0}
                  className="shrink-0 rounded border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  归档超时
                </button>
              </div>

              <ul className="overflow-y-auto space-y-1.5 pr-1 flex-1">
                {queues.pending.length === 0 ? (
                  <li className="text-slate-600 text-xs py-2 text-center">暂无 draft/review</li>
                ) : (
                  queues.pending.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-2 border-b border-slate-800/50 pb-1.5">
                      <span className="text-sm text-slate-300 line-clamp-1 flex-1" title={a.title}>{a.title}</span>
                      <span className="shrink-0 text-xs text-slate-500 font-mono">{formatAge(a.age_seconds)}</span>
                      <StatusPill status={a.status || ''} />
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-lg border border-emerald-900/30 bg-slate-900/50 p-3 flex flex-col min-h-[190px]">
              <div className="flex justify-between mb-2 shrink-0">
                <h3 className="text-sm font-semibold text-emerald-300">最近发布</h3>
                <span className="text-xs text-slate-500 bg-slate-800 px-1.5 rounded">{queues.published.length}</span>
              </div>
              <ul className="overflow-y-auto space-y-1.5 pr-1 flex-1">
                {queues.published.length === 0 ? (
                  <li className="text-slate-600 text-xs py-2 text-center">暂无发布记录</li>
                ) : (
                  queues.published.map(a => (
                    <li key={a.id} className="border-b border-slate-800/50 pb-1.5 flex justify-between gap-1 items-center">
                      <a href={`/article/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-300 hover:text-primary-400 line-clamp-1 flex-1" title={a.title}>
                        {a.title}
                      </a>
                      <div className="text-xs text-slate-600 shrink-0">{formatShortTime(a.published_at)}</div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-[300px]">
          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 shrink-0">
            <h3 className="text-sm font-semibold text-slate-300 mb-1.5">运行参数</h3>
            <div className="flex gap-2">
              <select
                value={mode}
                onChange={e => setMode(e.target.value as 'all' | 'articles' | 'flash')}
                disabled={status.running}
                className="flex-1 rounded text-xs bg-slate-800 border-slate-700 p-1 text-slate-300 outline-none focus:border-primary-500 h-[24px]"
              >
                <option value="all">文章 + 快讯</option>
                <option value="articles">仅文章</option>
                <option value="flash">仅快讯</option>
              </select>
              {mode !== 'flash' && (
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={articles}
                  onChange={e => setArticles(e.target.value)}
                  disabled={status.running}
                  title="文章批量"
                  className="w-[60px] rounded text-xs bg-slate-800 border-slate-700 p-1 text-center text-slate-300 h-[24px]"
                />
              )}
              {mode !== 'articles' && (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={flash}
                  onChange={e => setFlash(e.target.value)}
                  disabled={status.running}
                  title="快讯批量"
                  className="w-[60px] rounded text-xs bg-slate-800 border-slate-700 p-1 text-center text-slate-300 h-[24px]"
                />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-0 flex flex-col flex-1 overflow-hidden">
            <div className="p-2 border-b border-slate-800/50 bg-slate-950/30 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-semibold text-slate-300">守护进程日志</h3>
              {status.running && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="运行中" />}
            </div>
            <pre
              ref={logRef}
              className={`flex-1 overflow-y-auto p-2 text-xs font-mono leading-tight whitespace-pre-wrap bg-[#0c1017] ${
                isPaused ? 'text-amber-300/80' : isOffline ? 'text-red-400' : 'text-emerald-400/80'
              }`}
            >
              {status.log ? status.log.split('\n').reverse().join('\n') : '正在连接守护进程...'}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone, active, sub }: { label: string; value: number; tone: 'primary' | 'slate' | 'amber' | 'cyan' | 'red' | 'emerald'; active: boolean; sub?: string }) {
  const colors: Record<typeof tone, string> = {
    primary: 'border-primary-500/30 bg-primary-950/10 text-primary-400',
    slate: 'border-slate-700/50 bg-slate-800/30 text-slate-300',
    amber: 'border-amber-900/30 bg-amber-950/10 text-amber-300',
    cyan: 'border-cyan-900/30 bg-cyan-950/10 text-cyan-300',
    red: 'border-red-900/30 bg-red-950/10 text-red-400',
    emerald: 'border-emerald-900/30 bg-emerald-950/10 text-emerald-400',
  };
  const dot = active ? 'bg-current animate-pulse' : 'bg-slate-600';

  return (
    <div className={`rounded-lg border p-2.5 flex flex-col justify-center min-h-[72px] ${colors[tone]}`}>
      <div className="text-xs font-medium flex items-center gap-1.5 mb-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="text-xl font-bold font-mono leading-none">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-500 leading-none">{sub}</div>}
    </div>
  );
}

function SourceCard({ source, activity, rss }: { source: { id: string; type: string }; activity: SourceActivity[]; rss: boolean }) {
  const dbRecord = activity.find(s => s.source.toLowerCase() === source.id.toLowerCase());
  const secondsAgo = dbRecord ? (Date.now() - new Date(dbRecord.last_seen).getTime()) / 1000 : Infinity;
  const blinking = secondsAgo < 30;
  const online = secondsAgo < 7200;
  const palette = rss
    ? {
      borderBlink: 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
      borderOnline: 'border-amber-900/50',
      bgBlink: 'bg-amber-950/40',
      textBlink: 'text-amber-400',
      dot: 'bg-amber-400',
      timeBlink: 'text-amber-500',
    }
    : {
      borderBlink: 'border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
      borderOnline: 'border-cyan-900/50',
      bgBlink: 'bg-cyan-950/40',
      textBlink: 'text-cyan-400',
      dot: 'bg-cyan-400',
      timeBlink: 'text-cyan-500',
    };
  const border = blinking ? palette.borderBlink : online ? palette.borderOnline : 'border-slate-800 opacity-60';
  const bg = blinking ? palette.bgBlink : online ? 'bg-slate-800/40' : 'bg-slate-900/40';
  const text = blinking ? palette.textBlink : online ? 'text-slate-300' : 'text-slate-500';

  return (
    <div className={`relative rounded-md border p-2 transition-all duration-300 ${border} ${bg}`}>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-bold tracking-wide ${text}`}>{source.id}</span>
        {blinking && <span className={`h-1.5 w-1.5 rounded-full ${palette.dot} animate-pulse`} />}
      </div>
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-slate-500">24H: <span className="text-slate-400">{dbRecord?.count_24h || 0}</span></span>
        <span className={blinking ? `${palette.timeBlink} font-bold` : online ? 'text-slate-400' : 'text-slate-600'}>
          {blinking ? 'Fetch...' : dbRecord ? formatAge(secondsAgo) : 'Idle'}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: 'bg-slate-700/50 text-slate-400', label: 'draft' },
    review: { cls: 'bg-amber-500/20 text-amber-400', label: 'review' },
    published: { cls: 'bg-green-500/20 text-green-400', label: 'published' },
    archived: { cls: 'bg-slate-700/50 text-slate-500', label: 'archived' },
  };
  const item = map[status] || { cls: 'bg-slate-700/50 text-slate-400', label: status || '-' };
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase font-medium ${item.cls}`}>{item.label}</span>;
}

function formatAge(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '-';
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatShortTime(value: string | null | undefined): string {
  if (!value) return '-';
  return value.length >= 16 ? value.slice(5, 16) : value;
}
