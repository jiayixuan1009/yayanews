import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YayaNews Admin',
  description: 'YayaNews Administration Panel',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
