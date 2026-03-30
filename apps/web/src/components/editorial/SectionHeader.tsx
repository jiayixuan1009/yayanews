import LocalizedLink from '@/components/LocalizedLink';

type Props = {
  title: string;
  emphasis?: 'default' | 'strong';
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

export default function SectionHeader({
  title,
  emphasis = 'default',
  actionHref,
  actionLabel = '→',
  className = '',
}: Props) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-3 yn-section-rule ${className}`}>
      <h2
        className={
          emphasis === 'strong'
            ? 'yn-heading flex items-center gap-2'
            : 'yn-heading-sm'
        }
      >
        {emphasis === 'strong' && (
          <span className="inline-block h-4 w-0.5 shrink-0 rounded-sm bg-[#1d5c4f]" aria-hidden />
        )}
        {title}
      </h2>
      {actionHref ? (
        <LocalizedLink
          href={actionHref}
          className="shrink-0 font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#1d5c4f] hover:text-[#143d33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d5c4f]"
        >
          {actionLabel}
        </LocalizedLink>
      ) : null}
    </div>
  );
}
