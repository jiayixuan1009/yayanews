import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@yayanews/types';

export const metadata: Metadata = {
  title: '联系我们',
  description: `联系 ${siteConfig.siteName} 与 Yayapay 官方渠道。`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage({ params }: { params: { lang: string } }) {
  const isZh = params.lang !== 'en';

  return (
    <div className="container-main py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">
        {isZh ? '联系我们' : 'Contact Us'}
      </h1>
      <p className="mt-4 text-sm text-gray-400">
        {isZh
          ? `若您对 ${siteConfig.siteName} 内容、合作或侵权投诉有任何疑问，欢迎通过以下方式联系官方团队。`
          : `For any questions about ${siteConfig.siteName} content, partnerships, or DMCA takedowns, please reach out via the channels below.`}
      </p>

      {/* ── 社交媒体联系方式 ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* Telegram */}
        <a
          href={siteConfig.socialLinks.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border border-[#2d6d5c]/40 bg-[#0d2b24] p-5 transition-all hover:border-[#91f78e]/60 hover:bg-[#0d3b30]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          </div>
          <div>
            <p className="text-xs text-gray-500">Telegram</p>
            <p className="text-sm font-medium text-emerald-100 group-hover:text-white">@CryptoMan1024</p>
          </div>
        </a>

        {/* Twitter / X */}
        <a
          href={siteConfig.socialLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border border-[#2d6d5c]/40 bg-[#0d2b24] p-5 transition-all hover:border-[#91f78e]/60 hover:bg-[#0d3b30]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <div>
            <p className="text-xs text-gray-500">Twitter / X</p>
            <p className="text-sm font-medium text-emerald-100 group-hover:text-white">@0xReggieJ</p>
          </div>
        </a>
      </div>

      {/* ── 官方渠道 ── */}
      <ul className="mt-8 space-y-4 text-sm text-gray-300">
        <li>
          <span className="text-slate-500 block text-xs mb-1">{isZh ? '官方网站' : 'Official Website'}</span>
          <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            {siteConfig.parentSite}
          </a>
        </li>
        <li>
          <span className="text-slate-500 block text-xs mb-1">{isZh ? '交易与客服' : 'Trading & Support'}</span>
          <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            {siteConfig.tradingSite}
          </a>
          <p className="mt-1 text-xs text-slate-500">
            {isZh ? '具体邮箱、在线客服以 Yayapay 官网公示为准。' : 'For live chat and email support, please visit the official site.'}
          </p>
        </li>
        <li>
          <span className="text-slate-500 block text-xs mb-1">{isZh ? '本站地址' : 'Site URL'}</span>
          <span className="text-gray-300">{siteConfig.siteUrl}</span>
        </li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <LocalizedLink href="/about" className="text-primary-400 hover:underline">
          {isZh ? '关于我们' : 'About Us'}
        </LocalizedLink>
        <LocalizedLink href="/privacy" className="text-primary-400 hover:underline">
          {isZh ? '隐私政策' : 'Privacy Policy'}
        </LocalizedLink>
      </div>
    </div>
  );
}
