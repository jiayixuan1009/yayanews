'use client';

const navItems = [
  { label: '内容生产', id: 'pipeline', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { label: '数据概览', id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { label: 'GA 流量', id: 'analytics', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
  { label: '速度监控', id: 'speed', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: '时效对比', id: 'benchmark', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: '文章管理', id: 'articles', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: '快讯管理', id: 'flash', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

export default function AdminSidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (id: string) => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-5">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-xs font-bold text-white">Y</div>
        <span className="font-semibold text-white tracking-wide">YayaNews</span>
        <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-primary-600/20 text-primary-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-500">
          <p>YayaNews Pipeline</p>
          <p className="text-slate-600 mt-0.5">v1.0 &middot; PostgreSQL</p>
        </div>
      </div>
    </aside>
  );
}
