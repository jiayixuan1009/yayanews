import { siteConfig } from '@/lib/types';
import MallardDuck from '@/components/MallardDuck';

export default function CtaBanner({ dict = {} }: { dict?: any }) {
  const cta = dict.cta || {};
  return (
    <div className="yn-panel relative overflow-hidden border-[#cdd9d3] bg-[#eef6f3] p-5 sm:p-6">
      <div className="absolute -right-1 -top-1 opacity-[0.12] grayscale sm:opacity-20" aria-hidden>
        <MallardDuck size="sm" />
      </div>
      <div className="relative">
        <p className="mb-1 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d5c4f]">{cta.tag || '交易入口'}</p>
        <h3 className="font-display text-xl font-semibold tracking-tight text-[#14261f]">{cta.title || 'BiyaPay 全球资产'}</h3>
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
