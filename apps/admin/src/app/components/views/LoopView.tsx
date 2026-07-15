'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface LoopSummaryItem {
  opportunity_type: string;
  status: string;
  count: number;
  max_priority: number | null;
  last_seen_at: string | null;
}

interface LoopOpportunityItem {
  id: number;
  opportunity_type: string;
  status: string;
  priority: number;
  score: number;
  entity_kind: string;
  entity_value: string;
  lang: string | null;
  title: string;
  reason: string;
  metrics: Record<string, unknown>;
  recommended_action: string;
  url: string | null;
  updated_at: string;
  last_seen_at: string;
}

interface LoopActionItem {
  id: number;
  action_type: string;
  status: string;
  risk_level: string;
  target_kind: string;
  target_id: number | null;
  target_value: string | null;
  target_url: string | null;
  result: Record<string, unknown>;
  updated_at: string;
  opportunity_type: string | null;
  priority: number | null;
}

interface LoopRunItem {
  id: number;
  run_type: string;
  mode: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
  notes: string;
}

interface LoopDashboard {
  summaries: LoopSummaryItem[];
  opportunities: LoopOpportunityItem[];
  actions: LoopActionItem[];
  runs: LoopRunItem[];
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
}

function fmtMetric(value: unknown) {
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === 'string') return value;
  return '-';
}

function fmtPct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${(n * 100).toFixed(2)}%`;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    ctr_rewrite: 'CTR 改写',
    translate_en: '英文翻译',
    internal_link_boost: '内链增强',
    query_content_gap: '查询选题',
    meta_rewrite_draft: '标题草案',
    translate_en_priority: '翻译优先',
    internal_link_draft: '内链草案',
    topic_brief_draft: '选题草案',
    feedback_review_draft: '反馈复核',
    import_gsc_performance: '导入 GSC',
    score_opportunities: '机会打分',
    execute_actions: '执行动作',
  };
  return labels[type] || type;
}

function statusClass(status: string) {
  if (['completed', 'executed', 'queued', 'open'].includes(status)) return 'bg-emerald-500/15 text-emerald-300';
  if (['running', 'proposed'].includes(status)) return 'bg-cyan-500/15 text-cyan-300';
  if (['failed', 'dismissed'].includes(status)) return 'bg-red-500/15 text-red-300';
  return 'bg-slate-700 text-slate-300';
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function LoopView() {
  const [data, setData] = useState<LoopDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/loop?limit=40');
      const body = await res.json();
      if (!res.ok || body?.error) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setData(body as LoopDashboard);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleExecute() {
    setExecuting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/loop?action=execute&limit=20', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || body?.error) throw new Error(body?.error || `HTTP ${res.status}`);
      setMessage(`已处理 ${body.updatedActions || 0} 个低风险动作。`);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }

  async function handleMutation(action: string, id: number) {
    setExecuting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/loop?action=${encodeURIComponent(action)}&id=${id}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok || body?.error) throw new Error(body?.error || `HTTP ${res.status}`);
      setMessage(body?.message || '操作已完成。');
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    const summaries = data?.summaries || [];
    const open = summaries.filter((row) => row.status === 'open').reduce((sum, row) => sum + row.count, 0);
    const actions = data?.actions || [];
    const proposed = actions.filter((row) => row.status === 'proposed').length;
    const queuedTranslations = actions.filter((row) => row.action_type === 'translate_en_priority' && row.status === 'queued').length;
    const failedRuns = (data?.runs || []).filter((row) => row.status === 'failed').length;
    return { open, proposed, queuedTranslations, failedRuns };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white">Loop Engine</h2>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || '无法加载 Loop Engine 数据'}
        </div>
        <button onClick={fetchData} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Loop Engine</h2>
          <p className="mt-1 text-sm text-slate-500">GSC 反馈、内容机会、低风险动作和运行记录。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={executing || totals.proposed === 0}
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executing ? '执行中...' : '执行低风险动作'}
          </button>
          <button onClick={fetchData} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
            刷新
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="开放机会" value={totals.open} sub="content_opportunities" />
        <StatCard label="待执行动作" value={totals.proposed} sub="低风险 proposed" />
        <StatCard label="英文优先队列" value={totals.queuedTranslations} sub="Agent 6 可消费" />
        <StatCard label="失败 run" value={totals.failedRuns} sub="最近记录" />
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">机会摘要</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">类型</th>
                <th className="px-4 py-2">状态</th>
                <th className="px-4 py-2 text-right">数量</th>
                <th className="px-4 py-2 text-right">最高优先级</th>
                <th className="px-4 py-2">最近出现</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.summaries.length === 0 ? (
                <tr><td className="px-4 py-4 text-slate-500" colSpan={5}>暂无机会。先导入 GSC Performance 后运行打分。</td></tr>
              ) : data.summaries.map((row) => (
                <tr key={`${row.opportunity_type}-${row.status}`}>
                  <td className="px-4 py-2 text-slate-200">{typeLabel(row.opportunity_type)}</td>
                  <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span></td>
                  <td className="px-4 py-2 text-right text-slate-300">{row.count}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{row.max_priority ?? '-'}</td>
                  <td className="px-4 py-2 text-slate-500">{fmtDate(row.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Top 机会</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {data.opportunities.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">暂无开放机会。</div>
          ) : data.opportunities.map((row) => (
            <article key={row.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[80px_1fr_220px_96px]">
              <div>
                <p className="text-[11px] text-slate-500">优先级</p>
                <p className="text-2xl font-bold text-white">{row.priority}</p>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary-500/15 px-2 py-0.5 text-xs text-primary-300">{typeLabel(row.opportunity_type)}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{row.entity_kind}</span>
                  {row.lang && <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{row.lang}</span>}
                </div>
                <p className="mt-2 truncate text-sm font-medium text-white">{row.title}</p>
                <p className="mt-1 text-xs text-slate-400">{row.reason}</p>
                <p className="mt-1 text-xs text-slate-500">{row.recommended_action}</p>
                {row.url && <p className="mt-1 truncate text-[11px] text-slate-600">{row.url}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Metric label="展示" value={fmtMetric(row.metrics?.impressions)} />
                <Metric label="点击" value={fmtMetric(row.metrics?.clicks)} />
                <Metric label="CTR" value={fmtPct(row.metrics?.ctr)} />
                <Metric label="排名" value={fmtMetric(row.metrics?.position)} />
              </div>
              <div className="flex items-start justify-end">
                <button
                  onClick={() => handleMutation('dismiss-opportunity', row.id)}
                  disabled={executing}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-500/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  忽略
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">最近动作</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {data.actions.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-500">暂无动作。</div>
            ) : data.actions.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{typeLabel(row.action_type)}</p>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">{row.target_value || row.target_url || '-'}</p>
                <p className="mt-1 text-[11px] text-slate-600">{fmtDate(row.updated_at)}</p>
                <div className="mt-2 flex gap-2">
                  {row.status === 'proposed' && (
                    <button
                      onClick={() => handleMutation('dismiss-action', row.id)}
                      disabled={executing}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-500/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      忽略
                    </button>
                  )}
                  {row.status === 'dismissed' && (
                    <button
                      onClick={() => handleMutation('reopen-action', row.id)}
                      disabled={executing}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      重新打开
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">最近运行</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {data.runs.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-500">暂无运行记录。</div>
            ) : data.runs.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{typeLabel(row.run_type)}</p>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{row.mode} · {fmtDate(row.started_at)}</p>
                <p className="mt-1 truncate text-[11px] text-slate-600">{shortStats(row.stats)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-2">
      <p className="text-[10px] text-slate-600">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function shortStats(stats: Record<string, unknown>) {
  return Object.entries(stats || {})
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 5)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}
