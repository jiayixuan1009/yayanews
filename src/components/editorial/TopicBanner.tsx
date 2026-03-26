import Link from 'next/link';
import DuckAccent from './DuckAccent';

type Props = {
  title: string;
  description?: string | null;
  href: string;
  kicker?: string;
};

/**
 * 专题 / 战役头：允许横幅级鸭（一侧），色块克制、无重渐变。
 */
export default function TopicBanner({ title, description, href, kicker = '专题' }: Props) {
  return (
    <div className="relative overflow-hidden rounded-yn-md border border-slate-700/90 bg-slate-900/70">
      <div className="absolute right-3 top-3 hidden sm:block">
        <DuckAccent zone="topic" />
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6 pr-16 sm:pr-20">
        <p className="yn-meta mb-1 font-medium uppercase tracking-wider text-emerald-500/80">{kicker}</p>
        <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          <Link href={href} className="hover:text-emerald-400/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            {title}
          </Link>
        </h3>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-400 line-clamp-2">{description}</p> : null}
        <Link
          href={href}
          className="mt-4 inline-flex text-sm font-medium text-emerald-500 hover:text-emerald-400"
        >
          进入专题 →
        </Link>
      </div>
    </div>
  );
}
