'use client';

import LocalizedLink from '@/components/LocalizedLink';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { siteConfig } from '@yayanews/types';
import { ORDERED_NAV_CATEGORIES } from '@/lib/constants';
import BrandLogo from '@/components/BrandLogo';

const primaryNavBase = [
  { label: 'Home', labelZh: '首页', href: '/' },
  { label: 'Flash', labelZh: '快讯', href: '/flash' },
];

const utilityNavKeys = [
  { key: 'flash', href: '/flash' },
  { key: 'topics', href: '/topics' },
  { key: 'guide', href: '/guide' },
];

export default function Header({ lang = 'zh', dict }: { lang?: string, dict: Record<string, string> }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dateline = useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(now);
  }, [lang]);

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#ddd5ca] bg-[#f8f5f0]/96 shadow-[0_2px_12px_rgba(20,38,31,0.04)] backdrop-blur-md">


      <div className="container-main grid min-h-[64px] grid-cols-[auto,1fr,auto] items-center gap-3 py-2 sm:min-h-[96px] sm:gap-4 sm:py-4">
        <div className="hidden lg:flex items-center gap-3">
          <LocalizedLink href="/search" aria-label={lang === 'en' ? 'Search' : '搜索'} className="inline-flex h-10 w-10 items-center justify-center border border-[#d8d1c5] text-[#101713] hover:border-[#bfb4a5] hover:text-[#1d5c4f]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </LocalizedLink>
          <a
            href={lang === 'en' ? pathname.replace(/^\/en/, '/zh') : pathname.replace(/^\/zh/, '/en')}
            className="inline-flex h-10 px-3 items-center justify-center border border-[#d8d1c5] bg-white/50 yn-action hover:border-[#bfb4a5] hover:text-[#1d5c4f] transition-colors"
          >
            {lang === 'en' ? '中' : 'EN'}
          </a>
        </div>

        <div className="min-w-0 text-center">
          <div className="inline-flex flex-col items-center">
            <BrandLogo variant="header" lang={lang} />
            <span className="mt-1.5 yn-meta tracking-[0.22em] whitespace-nowrap hidden sm:block">{dict.marketIntelligence || 'Market intelligence edition'}</span>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {/* Subscription/registration buttons removed as requested */}
        </div>

        <button className="justify-self-end rounded p-2 text-[#4f5551] md:hidden" onClick={() => setMobileOpen(v => !v)} aria-label={lang === 'en' ? 'Menu' : '菜单'}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <div className="hidden border-t border-[#e7dfd2] lg:block">
        <div className="container-main flex min-h-[54px] items-center justify-between">
          <nav className="flex items-center justify-start gap-7 lg:gap-10">
            <LocalizedLink href="/" className={`yn-nav pb-1 border-b ${isActive('/') ? 'border-[#1d5c4f] text-[#1d5c4f]' : 'border-transparent'}`}>{dict.home}</LocalizedLink>
            <LocalizedLink href="/flash" className={`yn-nav pb-1 border-b ${isActive('/flash') ? 'border-[#1d5c4f] text-[#1d5c4f]' : 'border-transparent'}`}>{dict.flash || (lang === 'en' ? 'Flash' : '快讯')}</LocalizedLink>
            <LocalizedLink href="/markets" className={`yn-nav pb-1 border-b ${isActive('/markets') ? 'border-[#1d5c4f] text-[#1d5c4f]' : 'border-transparent'}`}>{dict.markets || (lang === 'en' ? 'Markets' : '行情')}</LocalizedLink>
            {ORDERED_NAV_CATEGORIES.filter(item => item.href !== '/flash' && item.href !== '/markets').slice(0, 5).map(item => {
              const slug = item.href.replace(/^\/(?:news\/)?/, '');
              return (
                <LocalizedLink
                  key={item.href}
                  href={item.href}
                  className={`yn-nav pb-1 border-b ${isActive(item.href) ? 'border-[#1d5c4f] text-[#1d5c4f]' : 'border-transparent'}`}
                >
                  {dict[slug] || item.label}
                </LocalizedLink>
              );
            })}

          </nav>
          <div className="flex items-center gap-6">
            <a href="/admin" className="flex items-center gap-1.5 yn-nav pb-1 border-b border-transparent" title={lang === 'en' ? 'Admin' : '管理后台'}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {dict.admin || (lang === 'en' ? 'Admin' : '后台')}
            </a>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#ddd5ca] bg-[#f8f5f0] md:hidden">
          <nav className="container-main flex flex-col gap-1 py-4">
            <LocalizedLink href="/search" onClick={() => setMobileOpen(false)} className="mb-2 border border-[#d8d1c5] px-3 py-2 yn-action text-[#14261f]">
              {dict.searchArchive || 'Search archive'}
            </LocalizedLink>
            <LocalizedLink href="/" onClick={() => setMobileOpen(false)} className={`yn-nav block border-b border-[#e8e0d5] px-1 py-2.5 ${isActive('/') ? 'text-[#1d5c4f]' : ''}`}>{dict.home}</LocalizedLink>
            <LocalizedLink href="/flash" onClick={() => setMobileOpen(false)} className={`yn-nav block border-b border-[#e8e0d5] px-1 py-2.5 ${isActive('/flash') ? 'text-[#1d5c4f]' : ''}`}>{dict.flash || (lang === 'en' ? 'Flash' : '快讯')}</LocalizedLink>
            <LocalizedLink href="/markets" onClick={() => setMobileOpen(false)} className={`yn-nav block border-b border-[#e8e0d5] px-1 py-2.5 ${isActive('/markets') ? 'text-[#1d5c4f]' : ''}`}>{dict.markets || (lang === 'en' ? 'Markets' : '行情')}</LocalizedLink>
            {ORDERED_NAV_CATEGORIES.filter(item => item.href !== '/flash' && item.href !== '/markets').slice(0, 6).map(item => {
              const slug = item.href.replace(/^\/(?:news\/)?/, '');
              return (
                <LocalizedLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`yn-nav block border-b border-[#e8e0d5] px-1 py-2.5 ${isActive(item.href) ? 'text-[#1d5c4f]' : ''}`}
                >
                  {dict[slug] || item.label}
                </LocalizedLink>
              );
            })}
            {utilityNavKeys.map(item => (
              <LocalizedLink
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`yn-nav block border-b border-[#e8e0d5] px-1 py-2.5 ${isActive(item.href) ? 'text-[#1d5c4f]' : ''}`}
              >
                {dict[item.key] || item.key}
              </LocalizedLink>
            ))}
            <div className="mt-3 flex items-center gap-3">
              <a
                href={lang === 'en' ? pathname.replace(/^\/en/, '/zh') : pathname.replace(/^\/zh/, '/en')}
                className="inline-flex items-center justify-center border border-[#d8d1c5] px-4 py-2 yn-action text-[#101713]"
              >
                {lang === 'en' ? '中文' : 'English'}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
