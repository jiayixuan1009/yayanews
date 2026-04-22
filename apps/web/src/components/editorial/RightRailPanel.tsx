import type { ReactNode } from 'react';
import SectionHeader from './SectionHeader';

type Props = {
  title: string;
  accent?: boolean;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
};

export default function RightRailPanel({
  title,
  accent = false,
  actionHref,
  actionLabel,
  children,
  className = '',
}: Props) {
  return (
    <div className={`yn-panel ${accent ? 'bg-[#fbf8f4]' : 'bg-white'} p-4 ${className}`}>
      <SectionHeader
        title={title}
        emphasis={accent ? 'strong' : 'default'}
        actionHref={actionHref}
        actionLabel={actionLabel}
        className="mb-3"
      />
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
