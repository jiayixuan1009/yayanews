'use client';

import Link, { LinkProps } from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { AnchorHTMLAttributes, forwardRef } from 'react';

type LocalizedLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

function localeFromPath(pathname: string | null): 'zh' | 'en' | undefined {
  if (!pathname) return undefined;
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  if (pathname === '/zh' || pathname.startsWith('/zh/')) return 'zh';
  return undefined;
}

const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  ({ href, ...rest }, ref) => {
    const params = useParams();
    const pathname = usePathname();
    const paramLang = params?.lang as string | undefined;
    const pathLang = localeFromPath(pathname);
    // 水合瞬间 useParams 偶发为空时，用 pathname 兜底，避免 /en 下链接变成 /zh 触发水合不一致
    const currentLang = paramLang || pathLang || 'zh';
    
    // If href is a string and starts with /, prepend the lang
    let localizedHref = href;
    if (typeof href === 'string') {
      if (href.startsWith('/')) {
        localizedHref = `/${currentLang}${href}`;
      }
    } else if (href && typeof href === 'object') {
      const hrefObj = href as any;
      if (hrefObj.pathname?.startsWith('/')) {
        localizedHref = { ...hrefObj, pathname: `/${currentLang}${hrefObj.pathname}` };
      }
    }

    return <Link href={localizedHref} ref={ref} {...rest} />;
  }
);

LocalizedLink.displayName = 'LocalizedLink';

export default LocalizedLink;
