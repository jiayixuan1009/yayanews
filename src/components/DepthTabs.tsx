import Link from 'next/link';

interface DepthTabsProps {
  baseUrl: string;
  current: string;
  counts: { all: number; standard: number; deep: number };
}

const tabs = [
  { key: '', label: 'Chronological' },
  { key: 'standard', label: 'Briefings' },
  { key: 'deep', label: 'Deep Dive' },
] as const;

export default function DepthTabs({ baseUrl, current, counts }: DepthTabsProps) {
  const countMap: Record<string, number> = {
    '': counts.all,
    standard: counts.standard,
    deep: counts.deep,
  };

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd5ca] pb-3">
      <p className="yn-meta">Archive view</p>
      <div className="flex flex-wrap items-center gap-4">
        {tabs.map(tab => {
          const active = current === tab.key;
          const href = tab.key ? `${baseUrl}?type=${tab.key}` : baseUrl;
          const count = countMap[tab.key] ?? 0;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`border-b pb-1 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                active
                  ? 'border-[#14261f] text-[#14261f]'
                  : 'border-transparent text-[#667067] hover:text-[#14261f]'
              }`}
            >
              {tab.label}
              {count > 0 ? <span className="ml-1.5 text-[#8a938b]">{count}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
