'use client';

import Link, { LinkProps } from 'next/link';
import { useParams } from 'next/navigation';
import { AnchorHTMLAttributes, forwardRef } from 'react';

type LocalizedLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  ({ href, ...rest }, ref) => {
    const params = useParams();
    const lang = params?.lang as string;

    // Default to 'zh' if no lang is found in url
    const currentLang = lang || 'zh';
    
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
