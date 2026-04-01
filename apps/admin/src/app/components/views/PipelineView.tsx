'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

const FLASH_STEPS = [
  { key: 'c1', label: '多通道采集', sub: 'Finnhub / Marketaux...' },
  { key: 'c2', label: '翻译去重', sub: 'LLM 批量' },
  { key: 'c3', label: '快讯入库', sub: 'flash_news' },
];

export default function PipelineView() {
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
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight;
        }
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

  const apiSources = KNOWN_SOURCES.filter(s => s.type.includes('API'));
  const rssSources = KNOWN_SOURCES.filter(s => s.type.includes('RSS'));

  const renderSourceCard = (def: typeof KNOWN_SOURCES[0], isRss: boolean) => {
    const dbRecord = queues.sources?.find(s => s.source.toLowerCase() === def.id.toLowerCase());
    const secondsAgo = dbRecord ? (Date.now() - new Date(dbRecord.last_seen).getTime()) / 1000 : Infinity;
    const isBlinking = secondsAgo < 30;
    const isOnline = secondsAgo < 7200;

    const styles = isRss ? {
      borderBlink: 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)] z-10 scale-105',
      borderOnline: 'border-amber-900/50',
      borderIdle: 'border-slate-800 opacity-60',
      bgBlink: 'bg-amber-950/40',
      bgOnline: 'bg-slate-800/40',
      bgIdle: 'bg-slate-900/40',
      textBlink: 'text-amber-400',
      textOnline: 'text-slate-300',
      textIdle: 'text-slate-500',
      dot: 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,1)] animate-pulse',
      timeBlink: 'text-amber-500 font-bold',
      timeOnline: 'text-slate-400',
      timeIdle: 'text-slate-600'
    } : {
      borderBlink: 'border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)] z-10 scale-105',
      borderOnline: 'border-cyan-900/50',
      borderIdle: 'border-slate-800 opacity-60',
      bgBlink: 'bg-cyan-950/40',
      bgOnline: 'bg-slate-800/40',
      bgIdle: 'bg-slate-900/40',
      textBlink: 'text-cyan-400',
      textOnline: 'text-slate-300',
      textIdle: 'text-slate-500',
      dot: 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,1)] animate-pulse',
      timeBlink: 'text-cyan-500 font-bold',
      timeOnline: 'text-slate-400',
      timeIdle: 'text-slate-600'
    };

    const borderClass = isBlinking ? styles.borderBlink : isOnline ? styles.borderOnline : styles.borderIdle;
    const bgClass = isBlinking ? styles.bgBlink : isOnline ? styles.bgOnline : styles.bgIdle;
    const textTitleClass = isBlinking ? styles.textBlink : isOnline ? styles.textOnline : styles.textIdle;
    const timeClass = isBlinking ? styles.timeBlink : isOnline ? styles.timeOnline : styles.timeIdle;

    return (
      <div key={def.id} className={`relative rounded-md border p-2 transition-all duration-300 ${borderClass} ${bgClass}`}>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-xs font-bold tracking-wide ${textTitleClass}`}>{def.id}</span>
          {isBlinking && <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />}
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">24H: <span className="text-slate-400">{dbRecord?.count_24h || 0}</span></span>
          <span className={timeClass}>
            {isBlinking ? 'Fetch...' : dbRecord ? (secondsAgo < 60 ? '< 1m' : `${Math.floor(secondsAgo / 60)}m`) : 'Idle'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-100px)] lg:max-h-[calc(100vh-60px)]">
      {/* 1. Header & Switch */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-lg shrink-0">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          内容生产 Pipeline
          <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-normal">Daemon Mode</span>
        </h2>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">总开关状态</span>
          <button
            onClick={status.running ? handleStop : handleStart}
            disabled={loading || isOffline}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              status.running ? 'bg-primary-500' : 'bg-slate-600'
            } ${loading || isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                status.running ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs font-bold min-w-[48px] ${status.running ? 'text-primary-400 animate-pulse' : isOffline ? 'text-red-500' : 'text-amber-500'}`}>
            {status.running ? '生产中' : isOffline ? '离线异常' : '已中断'}
          </span>
        </div>
      </div>

      {/* 2. Top Factory Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="rounded-lg border border-primary-500/30 bg-primary-950/10 p-2.5 flex flex-col justify-center relative overflow-hidden">
          <div className="text-xs font-medium text-primary-300 flex items-center gap-1.5 mb-0.5">
            <span className={`h-1.5 w-1.5 rounded-full ${status.metrics?.started ? 'bg-primary-400 animate-pulse' : 'bg-slate-600'}`} />
            当前创作中 (Worker)
          </div>
          <div className="text-xl font-bold text-primary-400 font-mono leading-none">
            {status.metrics?.started || 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5 flex flex-col justify-center">
           <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-0.5">
             <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />排队等待中 (Queued)
           </div>
           <div className="text-xl font-bold text-slate-300 font-mono leading-none">{status.metrics?.queued || 0}</div>
        </div>
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 p-2.5 flex flex-col justify-center">
           <div className="text-xs font-medium text-red-400 flex items-center gap-1.5 mb-0.5">
             <span className="h-1.5 w-1.5 rounded-full bg-red-500/50" />死信异常 (Failed)
           </div>
           <div className="text-xl font-bold text-red-400 font-mono leading-none">{status.metrics?.failed || 0}</div>
        </div>
        <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-2.5 flex flex-col justify-center">
           <div className="text-xs font-medium text-emerald-500 flex items-center gap-1.5 mb-0.5">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />历史已投递 (Finished)
           </div>
           <div className="text-xl font-bold text-emerald-400 font-mono leading-none">{status.metrics?.finished || 0}</div>
        </div>
      </div>

      {/* 3. Main 3-Column Content - Fill Remaining Height */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0 lg:overflow-hidden">
         
         {/* Left 2 Cols: Sources & Flash & Dual Queues */}
         <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 lg:overflow-y-auto pr-1">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 shrink-0">
               <h3 className="text-sm font-semibold text-white mb-2 pb-1 border-b border-slate-800 flex items-center justify-between">
                 <span>API 通道雷达矩阵</span>
                 <span className="text-xs text-cyan-500 font-normal">Blue Matrix</span>
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 {apiSources.map(s => renderSourceCard(s, false))}
               </div>
               
               <h3 className="text-sm font-semibold text-white mt-3 mb-2 pb-1 border-b border-slate-800 flex items-center justify-between">
                 <span>RSS 通道雷达矩阵</span>
                 <span className="text-xs text-amber-500 font-normal">Amber Matrix</span>
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 {rssSources.map(s => renderSourceCard(s, true))}
               </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 shrink-0">
               <h3 className="text-sm font-semibold text-white mb-2">快讯流水线流程</h3>
               <div className="flex gap-2">
                 {FLASH_STEPS.map((s, i) => {
                    const active = flashRunning && i === 1;
                    const hot = flashRunning && i === 0;
                    return (
                      <div key={s.key} className={`rounded border p-1.5 flex-1 ${hot || active ? 'border-amber-600/40 bg-amber-950/20' : 'border-slate-800 bg-slate-800/20'}`}>
                        <div className="text-xs font-medium text-slate-300 text-center">{s.label}</div>
                      </div>
                    );
                 })}
               </div>
            </div>

            {/* Bottom: Dual Queues side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
              <div className="rounded-lg border border-amber-900/30 bg-slate-900/50 p-3 flex flex-col min-h-[150px]">
                <div className="flex justify-between mb-2 shrink-0">
                  <h3 className="text-sm font-semibold text-amber-300">待处理队列 (Draft/Review)</h3>
                  <span className="text-xs text-slate-500 bg-slate-800 px-1.5 rounded">{queues.pending.length}</span>
                </div>
                <ul className="overflow-y-auto space-y-1.5 pr-1 flex-1">
                  {queues.pending.length === 0 ? (
                    <li className="text-slate-600 text-xs py-2 text-center">暂无待审任务</li>
                  ) : (
                    queues.pending.map(a => (
                      <li key={a.id} className="flex justify-between gap-2 border-b border-slate-800/50 pb-1.5">
                        <span className="text-sm text-slate-300 line-clamp-1 flex-1" title={a.title}>{a.title}</span>
                        <span className="shrink-0 text-xs uppercase text-slate-500">{a.status}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-lg border border-emerald-900/30 bg-slate-900/50 p-3 flex flex-col min-h-[150px]">
                <div className="flex justify-between mb-2 shrink-0">
                  <h3 className="text-sm font-semibold text-emerald-300">历史已投递 (Finished)</h3>
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
                        <div className="text-xs text-slate-600 shrink-0">{a.published_at?.slice(11, 16)}</div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
         </div>

         {/* Column 3: Config & Heartbeat Log */}
         <div className="flex flex-col gap-3 min-h-[300px]">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 shrink-0">
              <h3 className="text-sm font-semibold text-slate-300 mb-1.5">运行时配置</h3>
              <div className="flex gap-2">
                 <div className="flex-1">
                   <select value={mode} onChange={e => setMode(e.target.value as any)} disabled={status.running} className="w-full rounded text-xs bg-slate-800 border-slate-700 p-1 text-slate-300 outline-none focus:border-primary-500 h-[24px]">
                     <option value="all">文章 + 快讯</option>
                     <option value="articles">仅文章出稿</option>
                     <option value="flash">仅快讯采集</option>
                   </select>
                 </div>
                 {mode !== 'flash' && <div className="w-[60px]"><input type="number" min={1} max={50} value={articles} onChange={e => setArticles(e.target.value)} disabled={status.running} title="文章并发" className="w-full rounded text-xs bg-slate-800 border-slate-700 p-1 text-center text-slate-300 h-[24px]" /></div>}
                 {mode !== 'articles' && <div className="w-[60px]"><input type="number" min={1} max={100} value={flash} onChange={e => setFlash(e.target.value)} disabled={status.running} title="快讯并发" className="w-full rounded text-xs bg-slate-800 border-slate-700 p-1 text-center text-slate-300 h-[24px]" /></div>}
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-0 flex flex-col flex-1 overflow-hidden">
               <div className="p-2 border-b border-slate-800/50 bg-slate-950/30 flex justify-between items-center shrink-0">
                 <h3 className="text-sm font-semibold text-slate-300">守护进程实时控制台</h3>
                 {status.running && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="侦听中" />}
               </div>
               <pre
                 ref={logRef}
                 className={`flex-1 overflow-y-auto p-2 text-xs font-mono leading-tight whitespace-pre-wrap bg-[#0c1017] ${
                   isPaused ? 'text-amber-300/80' : isOffline ? 'text-red-400' : 'text-emerald-400/80'
                 }`}
               >
                 {status.log ? status.log.split('\n').reverse().join('\n') : '正在连接守护进程...'}
               </pre>
            </div>
         </div>
         
      </div>
    </div>
  );
}
