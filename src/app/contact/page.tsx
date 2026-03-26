import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/types';

export const metadata: Metadata = {
  title: '联系我们',
  description: `联系 ${siteConfig.siteName} 与 Yayapay 官方渠道。`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="container-main py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">联系我们</h1>
      <p className="mt-4 text-sm text-gray-400">
        若您对 {siteConfig.siteName} 内容、合作或侵权投诉有任何疑问，欢迎通过以下方式联系 Yayapay 官方团队。
      </p>
      <ul className="mt-8 space-y-4 text-sm text-gray-300">
        <li>
          <span className="text-slate-500 block text-xs mb-1">官方网站</span>
          <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            {siteConfig.parentSite}
          </a>
        </li>
        <li>
          <span className="text-slate-500 block text-xs mb-1">交易与客服</span>
          <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            {siteConfig.tradingSite}
          </a>
          <p className="mt-1 text-xs text-slate-500">具体邮箱、在线客服以 Yayapay 官网公示为准。</p>
        </li>
        <li>
          <span className="text-slate-500 block text-xs mb-1">本站地址</span>
          <span className="text-gray-300">{siteConfig.siteUrl}</span>
        </li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/about" className="text-primary-400 hover:underline">
          关于我们
        </Link>
        <Link href="/privacy" className="text-primary-400 hover:underline">
          隐私政策
        </Link>
      </div>
    </div>
  );
}
