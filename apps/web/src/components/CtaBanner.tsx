'use client';
import { siteConfig } from '@yayanews/types';
import Image from 'next/image';
import { trackOutbound, trackConversion } from '@/lib/analytics';

export default function CtaBanner({ dict = {} }: { dict?: any }) {
  const cta = dict.cta || {};
  return (
    <div className="yn-panel relative overflow-hidden border-[#cdd9d3] bg-[#eef6f3] p-5 sm:p-6">
      <div className="absolute -right-2 -top-2 opacity-[0.05] grayscale sm:opacity-[0.08] rounded-full overflow-hidden" aria-hidden>
        <Image src="/brand/logo-square.svg" alt="YayaNews Logo Decorator" width={80} height={80} />
      </div>
      <div className="relative">
        <p className="mb-1 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d5c4f]">{cta.tag || 'Trading Portal'}</p>
        <h3 className="yn-heading-sm">{cta.title || 'BiyaPay Global Assets'}</h3>
        <p className="mt-2 font-body text-sm leading-7 text-slate-600">{cta.desc || 'Secure and convenient multi-market channels.'}</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-4 inline-block text-sm"
          onClick={() => {
            trackOutbound('trading_cta', siteConfig.tradingSite, 'cta_banner');
            trackConversion(siteConfig.tradingSite);
          }}
        >
          {cta.btn || 'Trade Now'}
        </a>
      </div>
    </div>
  );
}
