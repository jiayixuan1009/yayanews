import MallardDuck from '@/components/MallardDuck';

type Zone = 'hero' | 'banner' | 'topic' | 'guidance';

type Props = {
  zone: Zone;
  className?: string;
};

/**
 * 品牌鸭仅出现在指定槽位：hero/banner/topic/guidance。
 * 小尺寸、低对比，避免与头条标题竞争（locked rules）。
 */
export default function DuckAccent({ zone, className = '' }: Props) {
  const opacity = zone === 'hero' ? 'opacity-[0.35]' : 'opacity-30';
  return (
    <div
      className={`pointer-events-none select-none ${opacity} ${className}`}
      aria-hidden
      title=""
    >
      {/* 符号化小 IP：欧洲漫编辑气质由 MallardDuck SVG 承担；此处仅控制尺度与位置 */}
      <MallardDuck size="sm" className="text-emerald-700/80" />
    </div>
  );
}
