'use client';

/**
 * 绿头鸭卡通形象：用于 KV、Banner、Logo、模块边框等。
 * 配色：绿头、白颈环、褐身。
 */
export default function MallardDuck({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  /** 额外 class，如 text-green-600 */
  className?: string;
}) {
  const sizeMap = { sm: 32, md: 48, lg: 80 };
  const w = sizeMap[size];
  const h = Math.round(w * 0.9);

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 64 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* 身体 褐/灰 */}
      <ellipse cx="34" cy="38" rx="20" ry="14" fill="#8B7355" />
      <path
        d="M14 38 Q20 42 28 40 Q36 38 44 40 Q52 42 54 38 L52 44 Q40 50 32 48 Q24 46 16 44 Z"
        fill="#6B5344"
      />
      {/* 翅膀 */}
      <ellipse cx="28" cy="34" rx="10" ry="6" fill="#7D6B52" transform="rotate(-15 28 34)" />
      {/* 颈 + 白环 */}
      <path
        d="M48 22 Q52 28 50 36 L48 32 Q46 26 48 22 Z"
        fill="#C4A574"
      />
      <path
        d="M48 24 Q50 28 49 32 Q48 30 48 26 Q48 24 48 24 Z"
        fill="#F5F0E6"
        stroke="#B8956A"
        strokeWidth="0.8"
        fillOpacity="0.95"
      />
      {/* 绿头 */}
      <ellipse cx="52" cy="18" rx="12" ry="11" fill="#2D5A27" />
      <ellipse cx="54" cy="16" rx="4" ry="3" fill="#1a3518" opacity="0.6" />
      {/* 嘴 */}
      <path
        d="M60 16 L64 18 L60 20 Z"
        fill="#E8A84A"
        stroke="#C4892E"
        strokeWidth="0.5"
      />
      {/* 眼 */}
      <circle cx="56" cy="16" r="2.5" fill="#1a1a1a" />
      <circle cx="56.5" cy="15" r="0.6" fill="white" />
      {/* 尾羽 */}
      <path
        d="M16 32 Q12 36 14 42 Q18 38 20 34 Z"
        fill="#5C4A3A"
      />
    </svg>
  );
}
