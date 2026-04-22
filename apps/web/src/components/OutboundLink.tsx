'use client';
import { trackOutbound } from '@/lib/analytics';

interface OutboundLinkProps {
  href: string;
  label: 'mainsite_cta' | 'trading_cta' | 'source_link' | 'social_link';
  source?: string;
  className?: string;
  children: React.ReactNode;
}

/** Thin client wrapper for outbound links that need GA4 tracking */
export default function OutboundLink({ href, label, source = 'footer', className, children }: OutboundLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackOutbound(label, href, source)}
    >
      {children}
    </a>
  );
}
