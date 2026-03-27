import type { Metadata } from 'next';
import AdminSidebar from './components/AdminSidebar';
import AdminAuthGate from './components/AdminAuthGate';
import '../globals.css';

export const metadata: Metadata = {
  title: 'YayaNews Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="bg-slate-950 text-white">
        <div id="admin-root-shield">
          <AdminAuthGate>
            <div className="admin-shell fixed inset-0 z-[100] flex bg-slate-950 text-gray-100">
              <AdminSidebar />
              <div className="flex-1 flex flex-col min-h-screen ml-64">
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6">
                  <h1 className="text-sm font-medium text-slate-400">YayaNews 管理后台</h1>
                  <a href="/" className="text-xs text-slate-500 hover:text-slate-300" target="_blank" rel="noopener noreferrer">
                    查看前台 &rarr;
                  </a>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                  {children}
                </main>
              </div>
            </div>
          </AdminAuthGate>
        </div>
      </body>
    </html>
  );
}
