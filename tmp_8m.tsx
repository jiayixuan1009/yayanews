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

const ARTICLE_STEPS = [
  { key: 'collect', label: '閫夐閲囬泦', sub: 'Agent 1 路 RSS + LLM' },
  { key: 'generate', label: '鍐呭鐢熸垚', sub: 'Agent 2' },
  { key: 'review', label: '璐ㄩ噺瀹℃牳', sub: 'Agent 3' },
  { key: 'seo', label: 'SEO 浼樺寲', sub: 'Agent 4' },
  { key: 'publish', label: '鍏ュ簱鍙戝竷', sub: 'Agent 5 + Ping' },
];

const FLASH_STEPS = [
  { key: 'c1', label: '澶氶€氶亾閲囬泦', sub: 'Finnhub / Marketaux / 鈥? },
  { key: 'c2', label: '缈昏瘧 & 鍘婚噸', sub: 'LLM 鎵归噺' },
  { key: 'c3', label: '鍏ュ簱', sub: 'flash_news' },
];

function inferArticleStep(log: string): number {
  if (!log) return -1;
  if (/Agent 5|鍙戝竷瀹屾垚|publish/i.test(log) && !/Pipeline 瀹屾垚/.test(log.slice(-800))) return 4;
  if (/Agent 4|SEO/i.test(log)) return 3;
  if (/Agent 3|瀹℃牳/i.test(log)) return 2;
  if (/Agent 2|鍐呭鐢熸垚|Generating/i.test(log)) return 1;
  if (/Agent 1|閫夐閲囬泦|閲囬泦瀹屾垚/i.test(log)) return 0;
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
    if (!confirm('纭畾瑕佷腑鏂?Pipeline锛?)) return;
    setLoading(true);
    try {
      await adminFetch('/api/admin/pipeline?action=stop', { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    } finally {
      setLoading(false);
    }
  }

  const articleStep = status.running && (mode === 'all' || mode === 'articles') ? inferArticleStep(status.log) : -1;
  const flashRunning = status.running && (mode === 'all' || mode === 'flash') && /蹇|flash|Flash/i.test(status.log);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">鍐呭鐢熶骇 Pipeline</h2>

      {/* 鈥斺€?娴佺▼鍙鍖?鈥斺€?*/}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-6">
        <h3 className="text-sm font-semibold text-white">鏂囩珷鐢熶骇绾匡紙椤哄簭鎵ц锛?/h3>
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
                  {active && <div className="mt-1 text-[10px] text-primary-400 animate-pulse">杩涜涓€?/div>}
                  {done && !active && <div className="mt-1 text-[10px] text-emerald-600">鉁?/div>}
                </div>
                {i < ARTICLE_STEPS.length - 1 && (
                  <div className="hidden md:block w-2 shrink-0 text-slate-600 text-center">鈫?/div>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="text-sm font-semibold text-white pt-2 border-t border-slate-800">蹇鐢熶骇绾匡紙閫氶亾骞跺彂 鈫?缈昏瘧锛?/h3>
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
          鏂囩珷闃舵鏍规嵁褰撳墠鏃ュ織鍏抽敭瀛楅珮浜紱鏈繍琛屾椂鍏ㄩ儴鏄剧ず涓哄緟鏈恒€傚緟澶勭悊闃熷垪涓哄簱鍐?<code className="text-slate-400">draft/review</code> 鐘舵€併€?        </p>
      </div>

      {/* 鈥斺€?鍙岄槦鍒?鈥斺€?*/}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-900/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-200">寰呭鐞嗭紙鑽夌 / 寰呭锛?/h3>
            <span className="text-xs text-slate-500">{queues.pending.length} 鏉?/span>
          </div>
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
            {queues.pending.length === 0 ? (
              <li className="text-slate-500 text-xs py-4 text-center">鏆傛棤 鈥?Pipeline 閫氬父鐩存帴鍙?published</li>
            ) : (
              queues.pending.map(a => (
                <li key={a.id} className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-slate-300 line-clamp-2 flex-1">{a.title}</span>
                  <span className="shrink-0 text-[10px] uppercase text-slate-500">{a.status}</span>
                </li>
              ))
            )}
          </ul>
          <Link href="/admin/articles" className="mt-3 inline-block text-xs text-primary-400 hover:text-primary-300">
            鏂囩珷绠＄悊 鈫?          </Link>
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-emerald-300">宸插彂甯冿紙鏈€杩戯級</h3>
            <span className="text-xs text-slate-500">{queues.published.length} 鏉?/span>
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

      {/* Status */}
      <div className="flex items-center gap-4">
        <span className={`h-3 w-3 rounded-full ${status.running ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-sm text-slate-300">
          {status.running ? `杩愯涓?(PID: ${status.pid})` : '宸插仠姝?}
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">鍚姩鍙傛暟</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">鐢熶骇妯″紡</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as typeof mode)}
              disabled={status.running}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
            >
              <option value="all">鏂囩珷 + 蹇</option>
              <option value="articles">浠呮枃绔?/option>
              <option value="flash">浠呭揩璁?/option>
            </select>
          </div>
          {mode !== 'flash' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">鏂囩珷鏁伴噺</label>
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
              <label className="block text-xs text-slate-400 mb-1.5">蹇鏁伴噺</label>
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
              鍚姩 Pipeline
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              涓柇 Pipeline
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
            鍒锋柊
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">杩愯鏃ュ織</h3>
          {status.running && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              瀹炴椂鏇存柊涓?            </span>
          )}
        </div>
        <pre
          ref={logRef}
          className="h-80 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800 p-4 text-xs text-slate-400 font-mono whitespace-pre-wrap"
        >
          {status.log || '鏆傛棤鏃ュ織杈撳嚭銆傜偣鍑汇€屽惎鍔?Pipeline銆嶅紑濮嬪唴瀹圭敓浜с€?}
        </pre>
      </div>
    </div>
  );
}
