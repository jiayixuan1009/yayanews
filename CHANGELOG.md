# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
