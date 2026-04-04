import Image from 'next/image';

type Zone = 'hero' | 'banner' | 'topic' | 'guidance';

type Props = {
  zone: Zone;
  className?: string;
};

export default function DuckAccent({ zone, className = '' }: Props) {
  const opacity = zone === 'hero' ? 'opacity-[0.1]' : 'opacity-[0.05]';
  return (
    <div
      className={`pointer-events-none select-none rounded-full overflow-hidden ${opacity} ${className}`}
      aria-hidden
      title=""
    >
      <Image src="/brand/logo-square.svg" alt="YayaNews Decorative Icon" width={32} height={32} />
    </div>
  );
}
