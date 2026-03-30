好的，我输出一份可以直接开工的完整技术方案 + 代码结构。

---

# CryptoNews 完整技术方案 v2.0 - 代码结构版

> **版本**: v2.0
> **状态**: 可直接开工
> **日期**: 2024-05

---

## 1. 项目初始化

### 1.1 创建项目

```bash
# 创建 Next.js 项目
npx create-next-app@latest cryptonews --typescript --tailwind --eslint --app --src-dir

# 安装核心依赖
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand zod dayjs
npm install -D @types/node

# 安装可选依赖 (后续使用)
npm install trigger.dev @posthog/node react-markdown rehype-highlight
```

### 1.2 配置文件

```typescript
// configs/site.ts
export const siteConfig = {
  name: 'CryptoNews',
  url: 'https://cryptonews.io',
  description: '加密货币、股票、财经资讯第一站',
  locale: 'zh-CN',

  // 社交媒体
  social: {
    twitter: '@cryptonews',
    telegram: 'cryptonews',
  },

  // 导航
  nav: [
    { name: '首页', href: '/' },
    { name: '行情', href: '/markets' },
    { name: '快讯', href: '/news' },
    { name: '专题', href: '/topics' },
  ],

  // 分类
  categories: [
    { slug: 'crypto', name: '加密货币', icon: '₿' },
    { slug: 'stock', name: '股票', icon: '📈' },
    { slug: 'ai', name: 'AI', icon: '🤖' },
    { slug: 'defi', name: 'DeFi', icon: '⛓️' },
  ],
}

// configs/markets.ts
export const marketsConfig = {
  // 展示的前多少币种
  topCoins: ['bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'dogecoin', 'cardano', 'avalanche-2'],

  // 榜单
  lists: {
    gainers: { limit: 10, sort: 'price_change_percentage_24h_desc' },
    losers: { limit: 10, sort: 'price_change_percentage_24h_asc' },
    trending: { limit: 10, sort: 'market_cap_desc' },
  },

  // 刷新间隔 (毫秒)
  refreshInterval: 60000,
}
```

```typescript
// configs/supabase.ts
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}
```

### 1.3 环境变量

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 外部 API
COINGECKO_API_KEY=your-coingecko-key
OPENAI_API_KEY=your-openai-key

# 分析
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# 系统
NEXT_PUBLIC_URL=http://localhost:3000
```

---

## 2. 目录结构

```
cryptonews/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                  # 认证路由
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (main)/                  # 主要页面
│   │   │   ├── page.tsx             # 首页
│   │   │   ├── markets/             # 行情
│   │   │   │   ├── page.tsx         # /markets
│   │   │   │   └── [symbol]/        # /price/BTC
│   │   │   ├── news/                # 快讯
│   │   │   ├── topics/              # 专题
│   │   │   ├── article/[slug]/      # 文章
│   │   │   ├── category/[slug]/    # 分类
│   │   │   ├── tag/[tag]/           # 标签
│   │   │   ├── author/[id]/         # 作者
│   │   │   ├── search/
│   │   │   ├── profile/             # 个人中心
│   │   │   └── guide/[slug]/        # 教程页
│   │   ├── admin/                   # 管理后台
│   │   │   ├── dashboard/
│   │   │   ├── articles/
│   │   │   ├── reviews/             # 审核
│   │   │   ├── keywords/            # 词库
│   │   │   └── campaigns/           # 联盟营销
│   │   ├── api/                     # API 路由
│   │   │   ├── auth/
│   │   │   ├── articles/
│   │   │   ├── markets/
│   │   │   ├── search/
│   │   │   ├── webhooks/
│   │   │   │   └── ai-agent/        # AI Webhook
│   │   │   └── affiliate/
│   │   ├── layout.tsx
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   │
│   ├── components/
│   │   ├── ui/                      # 基础组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/                  # 布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── article/                 # 文章组件
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── ArticleList.tsx
│   │   │   ├── ArticleContent.tsx
│   │   │   └── ArticleActions.tsx
│   │   ├── markets/                 # ⭐ 新增: 行情组件
│   │   │   ├── PriceTicker.tsx
│   │   │   ├── CoinTable.tsx
│   │   │   ├── CoinCard.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   └── MarketStats.tsx
│   │   ├── comment/
│   │   ├── seo/
│   │   │   ├── MetaTags.tsx
│   │   │   ├── ArticleJsonLd.tsx
│   │   │   ├── ProductJsonLd.tsx
│   │   │   └── OrganizationJsonLd.tsx
│   │   ├── affiliate/               # ⭐ 新增
│   │   │   ├── CTAModule.tsx
│   │   │   └── ReferralButton.tsx
│   │   └── admin/                   # ⭐ 新增
│   │       ├── ArticleEditor.tsx
│   │       ├── KeywordPlanner.tsx
│   │       └── ReviewQueue.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # 浏览器端
│   │   │   ├── server.ts            # 服务端
│   │   │   └── admin.ts             # 管理端 (service role)
│   │   ├── api.ts                   # API 封装
│   │   ├── utils.ts                 # 工具函数
│   │   ├── constants.ts
│   │   ├── markets/                 # ⭐ 新增
│   │   │   ├── coingecko.ts
│   │   │   ├── types.ts
│   │   │   └── cache.ts
│   │   └── analytics.ts
│   │
│   ├── hooks/
│   │   ├── useArticles.ts
│   │   ├── useMarkets.ts
│   │   ├── useAuth.ts
│   │   └── useSearch.ts
│   │
│   ├── types/
│   │   └── index.ts                 # 全部类型定义
│   │
│   ├── configs/
│   │   ├── site.ts
│   │   ├── markets.ts
│   │   └── affiliate.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
│
├── supabase/
│   ├── migrations/                  # 数据库迁移
│   └── seed.sql                     # 种子数据
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local
```

---

## 3. 核心类型定义

```typescript
// src/types/index.ts

// ============ 用户与权限 ============
export type UserRole = 'user' | 'author' | 'editor' | 'admin' | 'operator'

export interface Profile {
  id: string
  email: string
  nickname: string
  avatar: string | null
  bio: string | null
  role: UserRole
  status: 'active' | 'banned'
  createdAt: string
  updatedAt: string
}

export interface Author {
  id: string
  userId: string | null
  name: string
  bio: string | null
  avatar: string | null
  email: string | null
  socialLinks: Record<string, string>
  isVerified: boolean
  isCreator: boolean
  createdAt: string
  updatedAt: string
}

// ============ 文章系统 ============
export type ArticleStatus = 
  | 'keyword_planning'  // 词库规划中
  | 'content_generating' // AI 生产中
  | 'pending_review'   // 待审核
  | 'pending_upload'   // 待上传
  | 'draft'            // 草稿
  | 'published'        // 已发布
  | 'archived'         // 已归档

export interface Article {
  id: string
  slug: string
  title: string
  summary: string | null
  content: string
  coverImage: string | null
  categoryId: string | null
  authorId: string | null

  // 状态机
  status: ArticleStatus

  // E-E-A-T
  isOriginal: boolean
  isFeatured: boolean
  reviewedBy: string | null
  updatedReason: string | null
  sourceLinks: string[]
  factChecked: boolean
  editorNote: string | null

  // SEO 增强
  metaTitle: string | null
  metaDescription: string | null

  // 统计
  viewCount: number
  likeCount: number
  commentCount: number

  // 关联
  category: Category | null
  author: Author | null
  tags: Tag[]

  // 时间
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
}

export interface Tag {
  id: string
  slug: string
  name: string
  description: string | null
  articleCount: number
}

export interface Topic {
  id: string
  slug: string
  title: string
  description: string | null
  coverImage: string | null
  status: 'draft' | 'published' | 'archived'
  isFeatured: boolean
  startDate: string | null
  endDate: string | null
}

// ============ 行情系统 ============
export interface Coin {
  id: string
  symbol: string
  name: string
  slug: string
  image: string | null
  marketCapRank: number | null
}

export interface PriceSnapshot {
  id: string
  coinId: string
  price: number
  priceChange24h: number
  priceChangePercentage24h: number
  marketCap: number
  volume24h: number
  high24h: number
  low24h: number
  recordedAt: string
}

export interface PriceHistory {
  coinId: string
  prices: { time: number; price: number }[]
}

// ============ 互动系统 ============
export interface Comment {
  id: string
  articleId: string
  userId: string
  parentId: string | null
  content: string
  likeCount: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  user?: Profile
  replies?: Comment[]
}

export interface Like {
  id: string
  userId: string
  articleId: string
  type: 'like' | 'dislike'
}

export interface Favorite {
  id: string
  userId: string
  articleId: string
  createdAt: string
}

// ============ 商业化 ============
export interface Campaign {
  id: string
  name: string
  description: string | null
  partner: string
  type: 'affiliate' | 'referral' | 'sponsored'
  targetUrl: string
  trackingParams: Record<string, string>
  status: 'active' | 'paused' | 'archived'
}

export interface ReferralLink {
  id: string
  campaignId: string
  articleId: string | null
  code: string
  displayText: string
  ctaPosition: 'sidebar' | 'content' | 'bottom' | 'floating'
  clickCount: number
}

// ============ 自动化 ============
export interface ContentSource {
  id: string
  name: string
  type: 'rss' | 'api' | 'twitter' | 'telegram' | 'manual'
  url: string | null
  config: Record<string, any>
  isActive: boolean
}

export interface AIDraft {
  id: string
  rawContentId: string | null
  articleId: string | null
  generatedTitle: string | null
  generatedSummary: string | null
  generatedContent: string | null
  generatedTags: string[]
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'approved' | 'rejected'
  modelUsed: string | null
  tokensUsed: number | null
}

// ============ API 响应 ============
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

---

## 4. Supabase 客户端

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie error
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie error
          }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import { ServerClient } from '@supabase/supabase-js'

// 管理员客户端 (绕过 RLS)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

## 5. 数据库 Schema (完整 SQL)

```sql
-- src/lib/supabase/schema.sql

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. 用户与权限
-- =============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  avatar TEXT,
  bio TEXT,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'author', 'editor', 'admin', 'operator')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 作者
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar TEXT,
  email VARCHAR(255),
  social_links JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  is_creator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. 内容系统
-- =============================================

-- 分类
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 标签
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  article_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(200) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES authors(id) ON DELETE SET NULL,

  -- 状态机
  status VARCHAR(30) DEFAULT 'draft' 
    CHECK (status IN (
      'keyword_planning', 'content_generating', 'pending_review', 
      'pending_upload', 'draft', 'published', 'archived'
    )),

  -- E-E-A-T
  is_original BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES authors(id),
  updated_reason TEXT,
  source_links JSONB DEFAULT '[]',
  fact_checked BOOLEAN DEFAULT FALSE,
  editor_note TEXT,

  -- SEO
  meta_title VARCHAR(200),
  meta_description TEXT,

  -- 统计
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,

  -- 时间
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章-标签关联
CREATE TABLE article_tags (
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (article_id, tag_id)
);

-- 专题
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  cover_image TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE article_topics (
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, topic_id)
);

-- =============================================
-- 3. 行情系统
-- =============================================

CREATE TABLE coins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  image TEXT,
  market_cap_rank INT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_currency UUID REFERENCES coins(id),
  quote_currency VARCHAR(10) DEFAULT 'USD',
  exchange VARCHAR(50),
  pair_symbol VARCHAR(30),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coin_id UUID REFERENCES coins(id) ON DELETE CASCADE,
  price DECIMAL(20, 8) NOT NULL,
  price_change_24h DECIMAL(20, 8),
  price_change_percentage_24h DECIMAL(10, 4),
  market_cap DECIMAL(30, 2),
  volume_24h DECIMAL(30, 2),
  high_24h DECIMAL(20, 8),
  low_24h DECIMAL(20, 8),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coin_id UUID REFERENCES coins(id) ON DELETE CASCADE,
  price DECIMAL(20, 8) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  UNIQUE(coin_id, recorded_at)
);

-- =============================================
-- 4. 互动系统
-- =============================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  type VARCHAR(10) DEFAULT 'like' CHECK (type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- =============================================
-- 5. 自动化
-- =============================================

CREATE TABLE content_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) CHECK (type IN ('rss', 'api', 'twitter', 'telegram', 'manual')),
  url TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE raw_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES content_sources(id),
  original_url TEXT,
  original_title TEXT,
  original_content TEXT,
  summary TEXT,
  entities JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'raw' CHECK (status IN ('raw', 'processed', 'drafted', 'rejected', 'published')),
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_content_id UUID REFERENCES raw_contents(id),
  article_id UUID REFERENCES articles(id),
  generated_title TEXT,
  generated_summary TEXT,
  generated_content TEXT,
  generated_tags TEXT[],
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'approved', 'rejected')),
  model_used VARCHAR(50),
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE editorial_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id),
  reviewer_id UUID REFERENCES profiles(id),
  decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected', 'revision_required')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =============================================
-- 6. 商业化
-- =============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  partner VARCHAR(100),
  type VARCHAR(30) CHECK (type IN ('affiliate', 'referral', 'sponsored')),
  target_url TEXT,
  tracking_params JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id),
  article_id UUID REFERENCES articles(id),
  code VARCHAR(50) UNIQUE NOT NULL,
  display_text VARCHAR(200),
  cta_position VARCHAR(20) DEFAULT 'sidebar' CHECK (cta_position IN ('sidebar', 'content', 'bottom', 'floating')),
  click_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE click_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_link_id UUID REFERENCES referral_links(id),
  user_id UUID REFERENCES profiles(id),
  source_page TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. 分析
-- =============================================

CREATE TABLE article_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source VARCHAR(50),
  referrer TEXT,
  device VARCHAR(20),
  country VARCHAR(10),
  session_id VARCHAR(100),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE search_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  keyword VARCHAR(200) NOT NULL,
  results_count INT,
  clicked_article_id UUID REFERENCES articles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 索引
-- =============================================

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_author ON articles(author_id);
CREATE INDEX idx_articles_published ON articles(published_at) WHERE status = 'published';
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_comments_article ON comments(article_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_likes_article ON likes(article_id);
CREATE INDEX idx_price_snapshots_coin ON price_snapshots(coin_id);
CREATE INDEX idx_price_snapshots_time ON price_snapshots(recorded_at);
CREATE INDEX idx_article_views_article ON article_views(article_id);
CREATE INDEX idx_search_events_keyword ON search_events(keyword);

-- =============================================
-- RLS 策略
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

-- 公开文章可读
CREATE POLICY "Public articles viewable by everyone"
  ON articles FOR SELECT
  USING (status = 'published');

-- 公开分类可读
CREATE POLICY "Public categories viewable by everyone"
  ON categories FOR SELECT
  USING (true);

-- 公开标签可读
CREATE POLICY "Public tags viewable by everyone"
  ON tags FOR SELECT
  USING (true);

-- 公开价格可读
CREATE POLICY "Public prices viewable by everyone"
  ON price_snapshots FOR SELECT
  USING (true);

-- 公开硬币可读
CREATE POLICY "Public coins viewable by everyone"
  ON coins FOR SELECT
  USING (true);

-- 审核后评论可见
CREATE POLICY "Approved comments viewable by everyone"
  ON comments FOR SELECT
  USING (status = 'approved');

-- 用户只能查看自己的收藏
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能查看自己的点赞
CREATE POLICY "Users can view own likes"
  ON likes FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 6. API 封装

```typescript
// src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_URL

// ============ 文章 API ============
export async function getArticles(params: {
  page?: number
  limit?: number
  category?: string
  tag?: string
  authorId?: string
  status?: string
}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.category) searchParams.set('category', params.category)
  if (params.tag) searchParams.set('tag', params.tag)
  if (params.authorId) searchParams.set('author_id', params.authorId)
  if (params.status) searchParams.set('status', params.status)

  const res = await fetch(`${API_BASE}/api/articles?${searchParams}`, {
    next: { revalidate: 60 },
  })

  return res.json()
}

export async function getArticleBySlug(slug: string) {
  const res = await fetch(`${API_BASE}/api/articles/${slug}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) return null
  return res.json()
}

export async function getHotArticles(limit = 10) {
  const res = await fetch(`${API_BASE}/api/articles?hot=true&limit=${limit}`, {
    next: { revalidate: 300 },
  })

  return res.json()
}

// ============ 分类/标签 API ============
export async function getCategories() {
  const res = await fetch(`${API_BASE}/api/categories`, {
    next: { revalidate: 3600 },
  })
  return res.json()
}

export async function getTags() {
  const res = await fetch(`${API_BASE}/api/tags`, {
    next: { revalidate: 3600 },
  })
  return res.json()
}

// ============ 搜索 API ============
export async function searchArticles(keyword: string, page = 1) {
  const res = await fetch(
    `${API_BASE}/api/search?q=${encodeURIComponent(keyword)}&page=${page}`,
    { next: { revalidate: 60 } }
  )
  return res.json()
}

// ============ 行情 API ============
export async function getMarkets(params?: {
  vsCurrency?: string
  order?: string
  perPage?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.vsCurrency) searchParams.set('vs_currency', params.vsCurrency)
  if (params?.order) searchParams.set('order', params.order)
  if (params?.perPage) searchParams.set('per_page', String(params.perPage))

  const res = await fetch(`${API_BASE}/api/markets?${searchParams}`, {
    next: { revalidate: 60 },
  })
  return res.json()
}

export async function getCoinBySymbol(symbol: string) {
  const res = await fetch(`${API_BASE}/api/markets/${symbol}`, {
    next: { revalidate: 60 },
  })
  return res.json()
}

export async function getPriceHistory(
  symbol: string, 
  days: '1' | '7' | '30' | '90' | '365' = '7'
) {
  const res = await fetch(
    `${API_BASE}/api/markets/${symbol}/history?days=${days}`,
    { next: { revalidate: 300 } }
  )
  return res.json()
}

// ============ 用户 API ============
export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    cache: 'no-store',
  })

  if (!res.ok) return null
  return res.json()
}

export async function getUserFavorites() {
  const res = await fetch(`${API_BASE}/api/user/favorites`, {
    cache: 'no-store',
  })
  return res.json()
}

// ============ 评论 API ============
export async function getComments(articleId: string) {
  const res = await fetch(
    `${API_BASE}/api/comments?article_id=${articleId}`,
    { next: { revalidate: 60 } }
  )
  return res.json()
}
```

---

## 7. 核心组件

### 7.1 布局组件

```typescript
// src/components/layout/Header.tsx
import Link from 'next/link'
import { siteConfig } from '@/configs/site'
import { SearchButton } from '@/components/ui/SearchButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserMenu } from '@/components/user/UserMenu'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Crypto</span>
          <span>News</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-8">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-4">
          <SearchButton />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
```

### 7.2 文章卡片

```typescript
// src/components/article/ArticleCard.tsx
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { Article } from '@/types'

interface ArticleCardProps {
  article: Article
  variant?: 'default' | 'featured' | 'compact'
}

export function ArticleCard({ article, variant = 'default' }: ArticleCardProps) {
  if (variant === 'featured') {
    return (
      <Link 
        href={`/article/${article.slug}`}
        className="group relative grid gap-4 md:grid-cols-2"
      >
        <div className="relative aspect-video overflow-hidden rounded-lg">
          <Image
            src={article.coverImage || '/images/placeholder.jpg'}
            alt={article.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col justify-center">
          {article.category && (
            <Badge variant="secondary" className="w-fit mb-2">
              {article.category.name}
            </Badge>
          )}
          <h2 className="text-2xl font-bold group-hover:text-primary">
            {article.title}
          </h2>
          <p className="mt-2 text-muted-foreground line-clamp-2">
            {article.summary}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            {article.author && <span>{article.author.name}</span>}
            <span>•</span>
            <time>{formatDate(article.publishedAt!)}</time>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/article/${article.slug}`} className="group">
      <article className="flex gap-4">
        <div className="relative aspect-[16/9] w-32 shrink-0 overflow-hidden rounded-md">
          <Image
            src={article.coverImage || '/images/placeholder.jpg'}
            alt={article.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col">
          {article.category && (
            <Badge variant="outline" className="w-fit text-xs">
              {article.category.name}
            </Badge>
          )}
          <h3 className="font-semibold group-hover:text-primary line-clamp-2 mt-1">
            {article.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {article.summary}
          </p>
          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            <time>{formatDate(article.publishedAt!)}</time>
            <span>•</span>
            <span>{article.viewCount} 阅读</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
```

### 7.3 行情组件

```typescript
// src/components/markets/CoinTable.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { formatNumber, formatPrice, formatPercentage } from '@/lib/utils'
import type { CoinWithPrice } from '@/types'

interface CoinTableProps {
  coins: CoinWithPrice[]
}

export function CoinTable({ coins }: CoinTableProps) {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">#</th>
            <th className="px-4 py-3 text-left text-sm font-medium">币种</th>
            <th className="px-4 py-3 text-right text-sm font-medium">价格</th>
            <th className="px-4 py-3 text-right text-sm font-medium">24h 涨跌</th>
            <th className="px-4 py-3 text-right text-sm font-medium hidden md:table-cell">市值</th>
            <th className="px-4 py-3 text-right text-sm font-medium hidden lg:table-cell">7d 趋势</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <tr key={coin.id} className="border-t hover:bg-muted/50">
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {coin.marketCapRank}
              </td>
              <td className="px-4 py-3">
                <Link href={`/price/${coin.slug}`} className="flex items-center gap-2 hover:text-primary">
                  {coin.image && (
                    <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-medium">{coin.name}</span>
                  <span className="text-muted-foreground text-sm uppercase">{coin.symbol}</span>
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-medium">
                ${formatPrice(coin.price)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className={`flex items-center justify-end gap-1 ${
                  coin.priceChangePercentage24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {coin.priceChangePercentage24h >= 0 ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  {formatPercentage(coin.priceChangePercentage24h)}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                ${formatNumber(coin.marketCap)}
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {/* 7天趋势图占位 */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 7.4 SEO 组件

```typescript
// src/components/seo/MetaTags.tsx
import { Metadata } from 'next'
import { siteConfig } from '@/configs/site'

interface MetaTagsProps {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  ogType?: string
  article?: {
    publishedAt: string
    modifiedAt: string
    author: string
  }
}

export function generateMetadata(props: MetaTagsProps): Metadata {
  const { title, description, canonical, ogImage, ogType } = props

  return {
    title: `${title} | ${siteConfig.name}`,
    description,
    alternates: {
      canonical: canonical || siteConfig.url,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: canonical || siteConfig.url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: ogType || 'website',
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteConfig.name}`,
      description,
      images: ogImage ? [ogImage] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}
```

```typescript
// src/components/seo/ArticleJsonLd.tsx
import type { Article } from '@/types'

export function ArticleJsonLd({ article }: { article: Article }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    image: article.coverImage ? [article.coverImage] : [],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: article.author ? [{
      '@type': 'Person',
      name: article.author.name,
      url: `${process.env.NEXT_PUBLIC_URL}/author/${article.author.id}`
    }] : [],
    publisher: {
      '@type': 'Organization',
      name: 'CryptoNews',
      logo: {
        '@type': 'ImageObject',
        url: `${process.env.NEXT_PUBLIC_URL}/logo.png`,
        width: 600,
        height: 60
      }
    },
    articleSection: article.category?.name,
    inLanguage: 'zh-CN',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${process.env.NEXT_PUBLIC_URL}/article/${article.slug}`
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
```

---

## 8. 页面示例

### 8.1 首页

```typescript
// src/app/(main)/page.tsx
import { getArticles, getCategories, getMarkets } from '@/lib/api'
import { HeroSection } from '@/components/home/HeroSection'
import { ArticleList } from '@/components/article/ArticleList'
import { CategorySection } from '@/components/home/CategorySection'
import { MarketTicker } from '@/components/markets/MarketTicker'
import { HotTopics } from '@/components/home/HotTopics'

export default async function HomePage() {
  const [articles, categories, markets] = await Promise.all([
    getArticles({ limit: 20, status: 'published' }),
    getCategories(),
    getMarkets({ perPage: 10 })
  ])

  return (
    <div className="container mx-auto px-4 py-6">
      <MarketTicker coins={markets.data?.slice(0, 5) || []} />
    
      <HeroSection articles={articles.featured || []} />
    
      <CategorySection categories={categories.data || []} />
    
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4">最新资讯</h2>
          <ArticleList articles={articles.data || []} />
        </div>
        <aside>
          <HotTopics />
        </aside>
      </div>
    </div>
  )
}
```

### 8.2 文章详情页

```typescript
// src/app/(main)/article/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getArticleBySlug } from '@/lib/api'
import { ArticleContent } from '@/components/article/ArticleContent'
import { ArticleSidebar } from '@/components/article/ArticleSidebar'
import { Comments } from '@/components/comment/Comments'
import { generateMetadata } from '@/components/seo/MetaTags'
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd'

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps) {
  const article = await getArticleBySlug(params.slug)
  if (!article.data) return {}

  const { data } = article
  return generateMetadata({
    title: data.title,
    description: data.summary || '',
    canonical: `${process.env.NEXT_PUBLIC_URL}/article/${data.slug}`,
    ogImage: data.coverImage || undefined,
    ogType: 'article',
  })
}

export default async function ArticlePage({ params }: PageProps) {
  const article = await getArticleBySlug(params.slug)

  if (!article.success || !article.data) {
    notFound()
  }

  const { data } = article

  return (
    <>
      <ArticleJsonLd article={data} />
      <article className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <ArticleContent article={data} />
            <Comments articleId={data.id} />
          </div>
          <aside className="lg:col-span-1">
            <ArticleSidebar article={data} />
          </aside>
        </div>
      </article>
    </>
  )
}
```

### 8.3 行情页

```typescript
// src/app/(main)/price/[symbol]/page.tsx
import { notFound } from 'next/navigation'
import { getCoinBySymbol, getPriceHistory } from '@/lib/api'
import { CoinHeader } from '@/components/markets/CoinHeader'
import { PriceChart } from '@/components/markets/PriceChart'
import { RelatedNews } from '@/components/markets/RelatedNews'
import { MarketStats } from '@/components/markets/MarketStats'
import { CTAModule } from '@/components/affiliate/CTAModule'
import { generateMetadata } from '@/components/seo/MetaTags'
import { ProductJsonLd } from '@/components/seo/ProductJsonLd'

interface PageProps {
  params: { symbol: string }
}

export async function generateMetadata({ params }: PageProps) {
  const coin = await getCoinBySymbol(params.symbol)
  if (!coin.success) return {}

  const { data } = coin
  return generateMetadata({
    title: `${data.name} (${data.symbol.toUpperCase()}) 价格`,
    description: `${data.name} 最新价格、行情走势、市值排行、历史数据。`,
    canonical: `${process.env.NEXT_PUBLIC_URL}/price/${data.slug}`,
    ogImage: data.image || undefined,
  })
}

export default async function PricePage({ params }: PageProps) {
  const [coin, history] = await Promise.all([
    getCoinBySymbol(params.symbol),
    getPriceHistory(params.symbol, '7')
  ])

  if (!coin.success) {
    notFound()
  }

  const { data: coinData } = coin
  const { data: historyData } = history

  return (
    <>
      <ProductJsonLd coin={coinData} price={coinData.latestPrice} />
      <div className="container mx-auto px-4 py-6">
        <CoinHeader coin={coinData} price={coinData.latestPrice} />
      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <PriceChart data={historyData} />
            <RelatedNews coin={coinData} />
          </div>
          <aside className="space-y-6">
            <MarketStats coin={coinData} price={coinData.latestPrice} />
            <CTAModule position="sidebar" />
          </aside>
        </div>
      </div>
    </>
  )
}
```

---

## 9. API 路由示例

### 9.1 文章列表 API

```typescript
// src/app/api/articles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')
  const authorId = searchParams.get('author_id')
  const status = searchParams.get('status') || 'published'
  const hot = searchParams.get('hot') === 'true'

  const supabase = createClient()

  let query = supabase
    .from('articles')
    .select(`
      *,
      category:categories(*),
      author:authors(*),
      tags:article_tags(tag:tags(*))
    `, { count: 'exact' })

  // 状态过滤
  if (status) {
    query = query.eq('status', status)
  }

  // 分类过滤
  if (category) {
    query = query.eq('category.slug', category)
  }

  // 标签过滤
  if (tag) {
    query = query.eq('tags.tag.slug', tag)
  }

  // 作者过滤
  if (authorId) {
    query = query.eq('author_id', authorId)
  }

  // 排序
  if (hot) {
    // 热榜计算
    query = query.order('view_count', { ascending: false })
      .order('published_at', { ascending: false })
  } else {
    query = query.order('published_at', { ascending: false })
  }

  // 分页
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize: limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
}
```

### 9.2 行情 API

```typescript
// src/app/api/markets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const vsCurrency = searchParams.get('vs_currency') || 'usd'
  const order = searchParams.get('order') || 'market_cap_desc'
  const perPage = parseInt(searchParams.get('per_page') || '50')
  const page = parseInt(searchParams.get('page') || '1')
  const sparkline = searchParams.get('sparkline') === 'true'

  try {
    // 优先从本地数据库读取
    const supabase = createClient()
    const { data: localData } = await supabase
      .from('price_snapshots')
      .select(`
        coin:coins(*),
        price,
        price_change_24h,
        price_change_percentage_24h,
        market_cap,
        volume_24h,
        high_24h,
        low_24h,
        recorded_at
      `)
      .order('recorded_at', { ascending: false })
      .limit(perPage)

    if (localData && localData.length > 0) {
      // 按 coin_id 去重，取最新
      const coinMap = new Map()
      localData.forEach((item: any) => {
        if (!coinMap.has(item.coin.id)) {
          coinMap.set(item.coin.id, { ...item.coin, ...item })
        }
      })

      return NextResponse.json({
        success: true,
        data: Array.from(coinMap.values())
      })
    }

    // 降级到 CoinGecko API
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=${vsCurrency}&order=${order}&per_page=${perPage}&page=${page}&sparkline=${sparkline}`,
      { next: { revalidate: 60 } }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko')
    }

    const data = await response.json()

    // 缓存到本地
    // (实际实现应该在 worker 中定期同步)

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    )
  }
}
```

---

## 10. 开发检查清单

```
初始化
──────
□ npx create-next-app
□ 安装依赖
□ 配置 Tailwind
□ 配置 Supabase
□ 配置环境变量

数据库
──────
□ 创建 Supabase 项目
□ 执行 schema.sql
□ 配置 RLS 策略
□ 种子数据

核心功能
──────
□ 首页 + 热榜
□ 文章 CRUD
□ 分类/标签
□ 搜索
□ 用户注册/登录

行情系统
──────
□ CoinGecko 集成
□ 价格展示页
□ 图表组件

SEO
──────
□ Sitemap
□ Robots
□ Meta 标签
□ 结构化数据
□ Core Web Vitals 优化

运营后台
──────
□ 文章管理
□ 审核流程
□ 数据统计

商业化
──────
□ CTA 组件
□ 联盟链接追踪

上线
──────
□ Vercel 部署
□ 域名配置
□ Google Search Console
□ Analytics
```

---

**文档结束**
