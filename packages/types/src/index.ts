export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  /** 封面图 URL；入库前可由 pipeline/cover_image.py 从信源 og:image 或图库/文生图解析 */
  cover_image: string | null;
  category_id: number | null;
  author: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  article_type: 'short' | 'standard' | 'deep';
  sentiment?: string;
  tickers?: string;
  key_points?: string;
  source?: string;
  source_url?: string;
  subcategory?: string;
  collected_at?: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
  tags?: Tag[];
  processing_seconds?: number | null;
  lang?: string;
}

export interface SubCategory {
  slug: string;
  name: string;
}

export const DERIVATIVES_SUBCATEGORIES: SubCategory[] = [
  { slug: 'commodity', name: '大宗商品' },
  { slug: 'futures', name: '期货' },  // DB 中 subcategory slug，保留
  { slug: 'options', name: '期权' },
  { slug: 'forex', name: '外汇' },
  { slug: 'bonds', name: '债券' },
];

export interface FlashNews {
  id: number;
  title: string;
  content: string;
  source: string | null;
  source_url: string | null;
  category_id: number | null;
  importance: 'low' | 'normal' | 'high' | 'urgent';
  subcategory?: string;
  collected_at?: string | null;
  published_at: string;
  created_at?: string;
  category_name?: string;
  processing_seconds?: number | null;
  lang?: string;
}

export interface Topic {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  /** 专题头图 URL，建议与文章封面同源策略（图库/自上传） */
  cover_image: string | null;
  status: 'active' | 'archived';
  sort_order: number;
  article_count?: number;
}

export interface Guide {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  /** 指南封面 URL，建议配图 */
  cover_image: string | null;
  sort_order: number;
  published_at: string | null;
}

export interface SiteConfig {
  siteName: string;
  siteUrl: string;
  description: string;
  language: string;
  parentSite: string;
  tradingSite: string;
}

export const SITE_NAME_ZH = '鸭鸭财经新闻';
export const SITE_NAME_EN = 'Yaya Financial News';
export const SITE_SLOGAN_ZH = '快人一步 · 投资者信赖的财经资讯平台';
export const SITE_SLOGAN_EN = 'The Fastest Financial News — Trusted by Investors';

export const siteConfig: SiteConfig = {
  siteName: 'Yaya Financial News',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://yayanews.cryptooptiontool.com',
  description: '鸭鸭财经新闻，比市场快一步。7×24小时实时追踪全球财经脉动，为专业投资者呈现美股、港股、加密资产与宏观经济权威资讯。',
  language: 'zh-CN',
  parentSite: process.env.NEXT_PUBLIC_PARENT_SITE || 'https://www.biyapay.com',
  tradingSite: process.env.NEXT_PUBLIC_TRADING_SITE || 'https://invest.biyapay.com',
};
