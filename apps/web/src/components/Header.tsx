'use client';

import LocalizedLink from '@/components/LocalizedLink';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { siteConfig } from '@yayanews/types';
import LangSwitcher from '@/components/LangSwitcher';
import { ORDERED_NAV_CATEGORIES } from '@/lib/constants';

const primaryNav = [
  { label: '首页', href: '/' },
  { label: '快讯', href: '/flash' },
  ...ORDERED_NAV_CATEGORIES.filter(item => item.href !== '/flash').slice(0, 5),
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
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(now);
  }, []);

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#ddd5ca] bg-[#f8f5f0]/96 shadow-[0_2px_12px_rgba(20,38,31,0.04)] backdrop-blur-md">
      <div className="border-b border-[#e7dfd2] bg-[#f3eee6]">
        <div className="container-main flex min-h-[38px] items-center justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-[#667067]">
          <div className="hidden md:block">{dateline}</div>
          <div className="mx-auto text-center md:mx-0">Daily Financial Dispatch</div>
          <div className="hidden items-center gap-4 md:flex">
            {utilityNavKeys.map(item => (
              <LocalizedLink key={item.href} href={item.href} className={isActive(item.href) ? 'text-[#101713]' : 'text-[#5d635f] hover:text-[#101713]'}>
                {dict[item.key] || item.key}
              </LocalizedLink>
            ))}
            <LangSwitcher lang={lang} />
          </div>
        </div>
      </div>

      <div className="container-main grid min-h-[88px] grid-cols-[auto,1fr,auto] items-center gap-3 py-3 sm:min-h-[96px] sm:gap-4 sm:py-4">
        <div className="hidden lg:block">
          <LocalizedLink href="/search" aria-label="搜索" className="inline-flex h-10 w-10 items-center justify-center border border-[#d8d1c5] text-[#101713] hover:border-[#bfb4a5] hover:text-[#1d5c4f]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </LocalizedLink>
        </div>

        <div className="min-w-0 text-center">
          <LocalizedLink href="/" className="inline-flex flex-col items-center">
            <span className="font-display text-[2.1rem] font-semibold leading-none tracking-[-0.06em] text-[#0d3b30] sm:text-[2.7rem] lg:text-[3rem]">yayanews</span>
            <span className="mt-1 max-w-[24ch] font-label text-[10px] uppercase tracking-[0.22em] text-[#667067]">{dict.marketIntelligence || 'Market intelligence edition'}</span>
          </LocalizedLink>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LangSwitcher lang={lang} />
          <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f5551] hover:text-[#101713]">
            {dict.signIn || 'Sign In'}
          </a>
          <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-[#0d3b30] bg-[#0d3b30] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#072d24]">
            {dict.subscribe || 'Subscribe'}
          </a>
        </div>

        <button className="justify-self-end rounded p-2 text-[#4f5551] md:hidden" onClick={() => setMobileOpen(v => !v)} aria-label="菜单">
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
        <nav className="container-main flex min-h-[54px] items-center justify-center gap-7">
          <LocalizedLink href="/" className={`border-b pb-1 text-[15px] ${isActive('/') ? 'border-[#14261f] font-medium text-[#101713]' : 'border-transparent text-[#5d635f] hover:text-[#101713]'}`}>{dict.home}</LocalizedLink>
          <LocalizedLink href="/flash" className={`border-b pb-1 text-[15px] ${isActive('/flash') ? 'border-[#14261f] font-medium text-[#101713]' : 'border-transparent text-[#5d635f] hover:text-[#101713]'}`}>{dict.flash || '快讯'}</LocalizedLink>
          {ORDERED_NAV_CATEGORIES.filter(item => item.href !== '/flash').slice(0, 5).map(item => {
            const slug = item.href.replace('/news/', '');
            return (
              <LocalizedLink
                key={item.href}
                href={item.href}
                className={`border-b pb-1 text-[15px] ${isActive(item.href) ? 'border-[#14261f] font-medium text-[#101713]' : 'border-transparent text-[#5d635f] hover:text-[#101713]'}`}
              >
                {dict[slug] || item.label}
              </LocalizedLink>
            );
          })}
        </nav>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#ddd5ca] bg-[#f8f5f0] md:hidden">
          <nav className="container-main flex flex-col gap-1 py-4">
            <LocalizedLink href="/search" onClick={() => setMobileOpen(false)} className="mb-2 border border-[#d8d1c5] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#14261f]">
              {dict.searchArchive || 'Search archive'}
            </LocalizedLink>
            <LocalizedLink href="/" onClick={() => setMobileOpen(false)} className={`border-b border-[#e8e0d5] px-1 py-2.5 text-sm ${isActive('/') ? 'text-[#101713]' : 'text-[#5d635f] hover:text-[#101713]'}`}>{dict.home}</LocalizedLink>
            <LocalizedLink href="/flash" onClick={() => setMobileOpen(false)} className={`border-b border-[#e8e0d5] px-1 py-2.5 text-sm ${isActive('/flash') ? 'text-[#101713]' : 'text-[#5d635f] hover:text-[#101713]'}`}>{dict.flash || '快讯'}</LocalizedLink>
            {ORDERED_NAV_CATEGORIES.filter(item => item.href !== '/flash').slice(0, 5).map(item => {
              const slug = item.href.replace('/news/', '');
              return (
                <LocalizedLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`border-b border-[#e8e0d5] px-1 py-2.5 text-sm ${isActive(item.href) ? 'text-[#101713]' : 'text-[#5d635f] hover:text-[#101713]'}`}
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
                className={`border-b border-[#e8e0d5] px-1 py-2.5 text-sm ${isActive(item.href) ? 'text-[#101713]' : 'text-[#5d635f] hover:text-[#101713]'}`}
              >
                {dict[item.key] || item.key}
              </LocalizedLink>
            ))}
            <div className="mt-3 flex items-center gap-3">
              <LangSwitcher lang={lang} />
              <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-[#0d3b30] bg-[#0d3b30] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                {dict.subscribe || 'Subscribe'}
              </a>
              <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-[#cfc7ba] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#101713]">
                {dict.signIn || 'Sign In'}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
