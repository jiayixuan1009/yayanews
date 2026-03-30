'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function LangSwitcher({ lang }: { lang: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(target: string) {
    // Set cookie so middleware remembers the choice
    document.cookie = `NEXT_LOCALE=${target};path=/;max-age=${60 * 60 * 24 * 365}`;

    // Replace the current locale prefix in the path
    const segments = pathname.split('/');
    if (segments[1] === 'zh' || segments[1] === 'en') {
      segments[1] = target;
    }
    router.push(segments.join('/'));
  }

  const isZh = lang === 'zh';

  return (
    <button
      onClick={() => switchTo(isZh ? 'en' : 'zh')}
      className="inline-flex items-center gap-1 border border-[#d8d1c5] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4f5551] transition-colors hover:border-[#bfb4a5] hover:text-[#101713]"
      aria-label="Switch language"
    >
      <span className={isZh ? 'text-[#101713]' : 'text-[#9ca09d]'}>中文</span>
      <span className="text-[#ccc]">/</span>
      <span className={!isZh ? 'text-[#101713]' : 'text-[#9ca09d]'}>ENG</span>
    </button>
  );
}
