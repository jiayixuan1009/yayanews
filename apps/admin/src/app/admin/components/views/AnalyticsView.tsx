'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { adminFetch } from '@/lib/admin-fetch';

type SeriesPoint = {
  dateRaw: string;
  date: string;
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
};

type GaTrafficResponse =
  | {
      configured: false;
      message: string;
    }
  | {
      configured: true;
      days: number;
      series: SeriesPoint[];
      totals: { sessions: number; activeUsers: number; screenPageViews: number };
    }
  | {
      configured: true;
      error: string;
      hint?: string;
    };

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsView() {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [data, setData] = useState<GaTrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/admin/ga-traffic?days=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j as GaTrafficResponse);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chartData = useMemo(() => {
    if (!data || !data.configured || !('series' in data)) return [];
    return data.series;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-400">无法加载流量数据。</p>;
  }

  if (!data.configured) {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-xl font-bold text-white">Google Analytics 流量</h2>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200 mb-2">尚未完成 GA4 接口配置</p>
          <p className="text-slate-300 whitespace-pre-wrap">{data.message}</p>
        </div>
        <ol className="list-decimal list-inside text-sm text-slate-400 space-y-2">
          <li>在 Google Cloud 创建服务账号并下载 JSON 密钥，启用「Google Analytics Data API」。</li>
          <li>在 GA4「管理 → 媒体资源访问管理」把服务账号邮箱加为「查看者」。</li>
          <li>
            在服务器 <code className="text-primary-400">.env</code> 中设置{' '}
            <code className="text-primary-400">GA4_PROPERTY_ID</code>（数字资源 ID）与凭据（推荐{' '}
            <code className="text-primary-400">GA4_CREDENTIALS_BASE64</code>）。
          </li>
          <li>重启 <code className="text-primary-400">yayanews-web</code>（PM2）后刷新本页。</li>
        </ol>
      </div>
    );
  }

  if ('error' in data && data.error) {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-xl font-bold text-white">Google Analytics 流量</h2>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100/90">
          <p className="font-medium text-red-200 mb-2">GA Data API 报错</p>
          <p className="font-mono text-xs break-all">{data.error}</p>
          {data.hint && <p className="mt-3 text-slate-300">{data.hint}</p>}
        </div>
      </div>
    );
  }

  if (!('series' in data)) {
    return <p className="text-red-400">流量数据格式异常。</p>;
  }

  const totals = data.totals;
  const days = data.days;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Google Analytics 流量</h2>
          <p className="text-sm text-slate-500 mt-1">数据来源：GA4 Data API（近 {days} 日，按天）</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRange(d)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                range === d ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="会话数（周期合计）" value={totals.sessions.toLocaleString()} />
        <Card
          label="活跃用户（按日相加）"
          value={totals.activeUsers.toLocaleString()}
          sub="不等于周期内唯一用户"
        />
        <Card label="网页浏览（周期合计）" value={totals.screenPageViews.toLocaleString()} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">趋势（会话 / 活跃用户 / 浏览）</h3>
        <div className="h-[320px] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="sessions" name="会话" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="activeUsers"
                name="活跃用户"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="screenPageViews"
                name="网页浏览"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">每日会话（柱状）</h3>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="sessions" name="会话" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {chartData.length === 0 && (
        <p className="text-sm text-slate-500">所选时间范围内暂无数据（新属性或未产生流量时常见）。</p>
      )}
    </div>
  );
}
