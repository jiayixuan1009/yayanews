import { siteConfig } from '@yayanews/types';
import Image from 'next/image';

export default function CtaBanner({ dict = {} }: { dict?: any }) {
  const cta = dict.cta || {};
  return (
    <div className="yn-panel relative overflow-hidden border-[#cdd9d3] bg-[#eef6f3] p-5 sm:p-6">
      <div className="absolute -right-2 -top-2 opacity-[0.05] grayscale sm:opacity-[0.08] rounded-full overflow-hidden" aria-hidden>
        <Image src="/brand/logo-square.svg" alt="YayaNews Logo Decorator" width={80} height={80} />
      </div>
      <div className="relative">
        <p className="mb-1 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d5c4f]">{cta.tag || '交易入口'}</p>
        <h3 className="yn-heading-sm">{cta.title || 'BiyaPay 全球资产'}</h3>
        <p className="mt-2 font-body text-sm leading-7 text-slate-600">{cta.desc || '安全便捷的多市场通道；与正文阅读区视觉分离。'}</p>
        <a
          href={siteConfig.tradingSite}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-4 inline-block text-sm"
        >
          {cta.btn || '前往交易'}
        </a>
      </div>
    </div>
  );
}
