/**
 * 栏目展示顺序：快讯、美股、港股、衍生品、加密货币、AI资讯、其他。
 * 用于首页卡片、Tab、Header 下拉、Footer 链接等。
 */
export const CATEGORY_DISPLAY_ORDER: string[] = [
  'us-stock',   // 美股
  'hk-stock',   // 港股
  'derivatives',// 衍生品
  'crypto',     // 加密货币
  'ai',         // AI资讯
  'other',      // 其他
];

/** 快讯为独立页 /flash，在栏目中排第一位，不入 DB categories */
export const FLASH_ENTRY = {
  name: '快讯',
  slug: 'flash',
  href: '/flash',
  description: '7×24 小时快讯',
} as const;

/** AI资讯板块，链接到 /news/ai（DB 可有 ai 分类） */
export const AI_ENTRY = {
  name: 'AI资讯',
  slug: 'ai',
  href: '/news/ai',
  description: 'AI 与智能金融',
} as const;

export const ORDERED_NAV_CATEGORIES = [
  { label: '快讯', href: '/flash' },
  { label: '美股', href: '/news/us-stock' },
  { label: '港股', href: '/news/hk-stock' },
  { label: '衍生品', href: '/news/derivatives' },
  { label: '加密货币', href: '/news/crypto' },
  { label: 'AI资讯', href: '/news/ai' },
  { label: '其他', href: '/news/other' },
];
