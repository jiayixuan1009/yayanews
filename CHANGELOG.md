# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.3.0] - 2026-04-22

> Full SEO / GEO (AI Search Engine Optimization) sprint

### ✨ Added

**New files:**
- `apps/web/src/app/[lang]/editorial/page.tsx` — Editorial policy page (bilingual zh/en), with sections for content classification, source verification, editorial independence, corrections policy and investment disclaimer
- `apps/web/src/lib/analytics.ts` — GA4 event tracking utilities: `trackOutbound()`, `trackConversion()`, `trackPageSection()`
- `apps/web/src/components/OutboundLink.tsx` — Client component wrapping outbound links with GA4 click tracking
- `scripts/sql/seed-core-topics-seo.sql` — Idempotent seed script for 5 priority topic `seo_body` entries

**Schema.org JSON-LD coverage expanded:**
- `apps/web/src/app/[lang]/page.tsx` — `WebSite` + `Organization` structured data on homepage
- `apps/web/src/app/[lang]/about/page.tsx` — `Organization` JSON-LD
- `apps/web/src/app/[lang]/guide/page.tsx` — `CollectionPage` JSON-LD + bilingual `generateMetadata`
- `apps/web/src/app/[lang]/news/[category]/page.tsx` — `CollectionPage` + `ItemList` + `BreadcrumbList`
- `apps/web/src/app/[lang]/tag/[slug]/page.tsx` — `CollectionPage` + `ItemList` + `BreadcrumbList`
- `apps/web/src/app/[lang]/topics/[slug]/page.tsx` — `FAQPage` + `CollectionPage` + `BreadcrumbList`
- `apps/web/src/app/[lang]/flash/[slug]/page.tsx` — Conditional `NewsArticle` JSON-LD for `high`/`urgent` importance

**AI search engine (GEO) optimizations:**
- `apps/web/src/app/robots.ts` — Whitelisted 9 AI crawlers: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `anthropic-ai`, `ClaudeBot`, `GoogleOther`, `Googlebot-News`, `YouBot`

**New topic records in production DB:**
- `hk-stock-sectors` — 港股热点板块 (category: hk-stock, priority: 86, full bilingual seo_body + faq_items)
- `crypto-regulation` — 加密货币监管 (category: crypto, priority: 88, full bilingual seo_body)

### 🔧 Changed

**packages/seo/src/json-ld.ts:**
- Enhanced `buildNewsArticleJsonLd()`: added `speakable`, `inLanguage`, `wordCount` (estimated), `citation`, `keywords`, author typed as `Person`
- Added `buildWebSiteJsonLd(locale)` — root-domain `WebSite` with `SearchAction` potentialAction
- Added `buildOrganizationJsonLd(locale)` — `NewsMediaOrganization` with `sameAs` wired to `siteConfig.socialLinks`

**packages/types/src/index.ts:**
- Added `socialLinks: { twitter: string; telegram: string }` to `SiteConfig` interface
- Populated with real values (`x.com/0xReggieJ`, `t.me/CryptoMan1024`)
- `FlashNews.importance` typed as `'low' | 'normal' | 'high' | 'urgent'`

**apps/web/src/app/[lang]/topics/[slug]/page.tsx:**
- `seo_body_zh/en` now rendered in **main content flow** (page 1 only) — fixes mobile Googlebot invisibility
- Also retained in right sidebar (`hidden lg:block`)

**apps/web/src/app/[lang]/article/[slug]/page.tsx:**
- `noIndex: article.article_type === 'short'` — prevents thin-content indexing
- Risk warning `<aside>` block rendered for `article_type === 'deep'` articles

**apps/web/src/app/[lang]/flash/[slug]/page.tsx:**
- `noIndex` for `low`/`normal` importance flashes; only `high`/`urgent` are indexed

**apps/web/src/app/[lang]/tag/[slug]/page.tsx:**
- `noIndex: articleCount < 3` — prevents empty tag pages from being crawled

**apps/web/src/app/sitemap.ts:**
- `/editorial` added (priority 0.5, monthly)
- `short` articles filtered out
- `deep` articles boosted to priority 0.75

**apps/web/src/lib/queries.ts:**
- `getRecentArticlesForSitemap()` now returns `article_type` field

**apps/web/src/components/Footer.tsx:**
- Social links sourced from `siteConfig.socialLinks` (no more hardcoded strings)
- External links wrapped in `OutboundLink` for GA4 tracking

**apps/web/src/app/[lang]/contact/page.tsx:**
- Social links sourced from `siteConfig.socialLinks`

**apps/web/src/components/CtaBanner.tsx:**
- `onClick` fires `trackOutbound('trading_cta', ...)` + `trackConversion(url)` via `@/lib/analytics`

**infra/deploy/ENV.production.example:**
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` uncommented with real property ID
- Monitoring section expanded with inline comments for GSC, Bing UET, Clarity

**Production database:**
- `seo_body_zh` / `seo_body_en` columns confirmed present (idempotent ALTER)
- Updated `seo_body` for existing topics: `earnings` (财报), `btc` (比特币), `fed` (美联储)
- Inserted `hk-stock-sectors` and `crypto-regulation` as new topic records

### 🐛 Fixed
- `buildWebSiteJsonLd` URL no longer includes locale prefix — uses `new URL(siteConfig.siteUrl).origin`
- All JSON-LD `sameAs` arrays centralized through `Object.values(siteConfig.socialLinks)` — no more scattered hardcoded social URLs
- `Footer` converted to use `OutboundLink` client component — was a server component incompatible with `onClick`

---

## [1.0.0] - 2026-03-30

### ✨ Added
- Professional project structure with organized directories
- `docs/architecture.md` — system architecture overview
- `docs/deployment.md` — VPS deployment guide
- GitHub Actions CI/CD pipeline
- Deployment script with health checks and rollback

### 🔧 Changed
- Reorganized root Python scripts into `scripts/legacy/`
- Moved 11 migration files into `pipeline/migrations/`
- Rewrote `README.md` with quick start guide
- Upgraded `.gitignore` with comprehensive rules
- Version bumped from `0.1.0` to `1.0.0`

### 🗑️ Removed
- `dist/` directory from Git tracking (build artifact)
- `tsconfig.tsbuildinfo` from Git tracking
- `deploy/deploy.log` from Git tracking

---

## [0.2.0] - 2026-03-27

> Bug fixes and production stabilization

### 🐛 Fixed
- **`agent6_translator.py`**: Called deleted `get_conn()` and used SQLite `?` paramstyle. Fixed to use `get_pool().getconn()` with `$1` PostgreSQL paramstyle and `RealDictCursor`.
- **`flash_collector.py`**: `_get_recent_flash_texts()` called deleted `get_conn()`. Fixed to use connection pool.
- **`speed_benchmark.py`**: Full rewrite from `sqlite3` to `psycopg2` with PostgreSQL `INTERVAL` syntax.
- **`worker.py`**: `main()` was inside `if __name__ == '__main__'` guard (never true under PM2). Fixed by calling `main()` at module level.
- **`topics/[slug]/page.tsx`** & **`guide/[slug]/page.tsx`**: `generateStaticParams` had no DB error handling; build would abort. Added `try-catch`.
- **`sitemap.ts`**: Added error handling and `export const dynamic = 'force-dynamic'`.
- **`ecosystem.config.cjs`**: Fixed `script: "python"` → resolved Python binary path.
- **`package.json`**: Added missing `ws` dependency.

### ⚡ Performance
- Flash translate per-item instead of batch-8
- Added composite indexes for query optimization

---

## [0.1.0] - 2026-03-26

> Initial feature-complete release

### ✨ Added
- **i18n routing**: Next.js `app/[lang]` layout with automatic language detection
- **N-gram deduplication**: Jaccard similarity filter (>45%) in `flash_collector.py`
- **Agent 6 (English translator)**: LLM-based Chinese→English translation agent
- **LocalizedLink component**: Centralized link wrapper for i18n paths
- 6-agent content pipeline: Collect → Write → Review → SEO → Publish → Translate
- Finnhub WebSocket real-time financial data
- Redis Pub/Sub + WebSocket flash news broadcast
- Admin dashboard with pipeline monitoring
- PostgreSQL + pgvector semantic deduplication
