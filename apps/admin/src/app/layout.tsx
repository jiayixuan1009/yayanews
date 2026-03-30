import type { Metadata } from 'next';
import './globals.css';
import AdminAuthGate from './components/AdminAuthGate';

export const metadata: Metadata = {
  title: 'YayaNews Admin',
  description: 'YayaNews Administration Panel',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <AdminAuthGate>
          {children}
        </AdminAuthGate>
      </body>
    </html>
  );
}
