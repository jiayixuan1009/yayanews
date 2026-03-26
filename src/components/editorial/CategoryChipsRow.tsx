import Link from 'next/link';

export type ChipItem = { name: string; href: string; slug: string };

type Props = {
  items: ChipItem[];
  className?: string;
};

export default function CategoryChipsRow({ items, className = '' }: Props) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {items.map(item => (
        <Link
          key={item.slug}
          href={item.href}
          className="shrink-0 rounded-full border border-[#ddd5ca] bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-[#bfb4a5] hover:text-[#143d33]"
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}
