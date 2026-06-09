import type { Metadata } from 'next';
import './globals.css';
import AdminAuthGate from './components/AdminAuthGate';
import { siteConfig } from '@yayanews/types';

function getMetadataBase(): URL {
  const raw = (siteConfig.siteUrl || '').trim() || 'https://yayanews.cryptooptiontool.com';
  try {
    return new URL(raw.replace(/\/+$/, ''));
  } catch {
    return new URL('https://yayanews.cryptooptiontool.com');
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
