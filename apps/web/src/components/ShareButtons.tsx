'use client';

import { useState, useCallback } from 'react';

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[#d2c9bc] bg-white px-4 py-2 text-sm text-slate-700 shadow-yn-soft">
      {message}
    </div>
  );
}

const i18n = {
  zh: { share: '分享', copyLink: '复制链接', copied: '链接已复制', copiedWechat: '链接已复制，可粘贴到微信分享' },
  en: { share: 'Share', copyLink: 'Copy link', copied: 'Link copied', copiedWechat: 'Link copied — paste to share on WeChat' },
};

export default function ShareButtons({ title, url, lang = 'zh' }: { title: string; url: string; lang?: string }) {
  const t = lang === 'en' ? i18n.en : i18n.zh;
  const [toast, setToast] = useState('');
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  const copyAndToast = useCallback(
    (msg: string) => {
      navigator.clipboard?.writeText(url).then(() => showToast(msg));
    },
    [url, showToast]
  );

  const links = [
    {
      name: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      name: 'WeChat',
      href: '#',
      onClick: () => copyAndToast(t.copiedWechat),
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.18 2.96c.533 0 .966.44.966.982a.975.975 0 0 1-.966.981.975.975 0 0 1-.966-.981c0-.542.433-.982.966-.982zm4.329 0c.533 0 .966.44.966.982a.975.975 0 0 1-.966.981.975.975 0 0 1-.966-.981c0-.542.433-.982.966-.982z" />
        </svg>
      ),
    },
    {
      name: t.copyLink,
      href: '#',
      onClick: () => copyAndToast(t.copied),
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="yn-meta mr-1">{t.share}</span>
        {links.map(l => (
          <a
            key={l.name}
            href={l.href}
            target={l.href !== '#' ? '_blank' : undefined}
            rel={l.href !== '#' ? 'noopener noreferrer' : undefined}
            onClick={l.onClick ? e => {
              e.preventDefault();
              l.onClick();
            } : undefined}
            title={l.name}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9d2c8] bg-white text-slate-500 transition-colors hover:border-[#bfb4a5] hover:text-[#143d33]"
          >
            {l.icon}
          </a>
        ))}
      </div>
      {toast ? <Toast message={toast} /> : null}
    </>
  );
}
