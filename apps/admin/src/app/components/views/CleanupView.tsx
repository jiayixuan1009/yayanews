import { useState } from 'react';

export default function CleanupView() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const thresholds = [
    { label: '删 3 天以前', days: 3 },
    { label: '删 7 天以前', days: 7 },
    { label: '删 30 天以前', days: 30 }
  ];

  const handleCleanup = async (target: 'articles' | 'flash', days: number) => {
    const confirmText = target === 'articles' ? '深度文章' : '短线快讯';
    if (!confirm(`【严重警告】\n您正在执行物理删除操作！\n这将彻底清空该环境内 ${days} 天前的所有「${confirmText}」数据！\n此操作不可逆！确认执行？`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, days }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setResult({ message: data.message, type: 'success' });
      } else {
        setResult({ message: data.error || '清理失败', type: 'error' });
      }
    } catch (err: any) {
      setResult({ message: err.message || '网络异常', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <span>🗑️ 数据清理维护</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          为了减缓数据库膨胀速度，您可以在此主动执行过期数据物理粉碎。<br/>
          <strong>注意：物理删除即意味着从磁盘层面连根拔起，已删除的数据无法通过后台恢复。</strong>
        </p>
      </div>

      {result && (
        <div className={`p-4 rounded-md border ${result.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flash News Cleanup */}
        <div className="rounded-xl border border-rose-900/40 bg-slate-900 overflow-hidden shadow-sm relative">
          <div className="absolute top-0 right-0 bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-bl-md font-medium">高频</div>
          <div className="p-5 border-b border-rose-900/20 bg-slate-900/50">
            <h3 className="text-lg font-semibold text-rose-300">清理：短线快讯 (Flash News)</h3>
            <p className="text-sm text-slate-400 mt-1 h-10">
              快讯每日吞吐量巨大。建议仅保留最近 7 天或 3 天的数据，历史价值极低。
            </p>
          </div>
          <div className="p-5 bg-slate-900/20 space-y-4">
            <div className="flex flex-wrap gap-3">
              {thresholds.map((t) => (
                <button
                  key={`flash-${t.days}`}
                  disabled={loading}
                  onClick={() => handleCleanup('flash', t.days)}
                  className="flex-1 bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-700 text-slate-200 transition-colors py-2 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Articles Cleanup */}
        <div className="rounded-xl border border-indigo-900/40 bg-slate-900 overflow-hidden shadow-sm relative">
          <div className="absolute top-0 right-0 bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-bl-md font-medium">长尾</div>
          <div className="p-5 border-b border-indigo-900/20 bg-slate-900/50">
            <h3 className="text-lg font-semibold text-indigo-300">清理：深度文章 (Articles)</h3>
            <p className="text-sm text-slate-400 mt-1 h-10">
              文章具有长尾 SEO 价值，但由于是由并发 AI 日爆出产，超过一定时间依然会成为检索累赘。
            </p>
          </div>
          <div className="p-5 bg-slate-900/20 space-y-4">
            <div className="flex flex-wrap gap-3">
              {thresholds.map((t) => (
                <button
                  key={`articles-${t.days}`}
                  disabled={loading}
                  onClick={() => handleCleanup('articles', t.days)}
                  className="flex-1 bg-slate-800 hover:bg-indigo-900/60 border border-slate-700 hover:border-indigo-700 text-slate-200 transition-colors py-2 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          小贴士
        </h4>
        <p className="text-sm text-slate-400">
          执行物理删除后，您可以直接点击左侧边的 <span className="text-slate-300 mx-1">「仪表盘」</span> 进行刷新。那里的 <b>“系统储存大盘”</b> 会展现文章统计数字实时缩减效果。对用户侧的前端展示会自动剥离死链（前端依靠最新的有效数据重组瀑布流）。
        </p>
      </div>
    </div>
  );
}
