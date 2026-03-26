import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '页面未找到',
  description: '您访问的页面不存在，请返回首页浏览更多内容',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container-main flex flex-col items-center justify-center py-24" role="main">
      <h1 className="text-6xl font-bold text-gray-600">404</h1>
      <p className="mt-4 text-lg text-gray-400">页面未找到</p>
      <p className="mt-2 text-sm text-gray-500">您访问的页面不存在或已被移除</p>
      <Link href="/" className="btn-primary mt-6">返回首页</Link>
    </div>
  );
}
