import type { Metadata } from 'next';
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
            {children}
          </AdminAuthGate>
        </div>
      </body>
    </html>
  );
}
