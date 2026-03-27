# YayaNews Changelog

All notable changes to the production environment are recorded here in reverse chronological order.

---

## [2026-03-27] — Bug fixes and production stabilization

### Critical runtime fixes

- **`agent6_translator.py`**: Called deleted `get_conn()` and used SQLite `?` paramstyle. Any translation task raised `NameError` at runtime. Fixed to use `get_pool().getconn()` with `$1` PostgreSQL paramstyle and `RealDictCursor`.
- **`flash_collector.py`**: `_get_recent_flash_texts()` called deleted `get_conn()`. N-gram dedup failed on every flash collection cycle. Fixed to use connection pool.
- **`speed_benchmark.py`**: Entire file used `sqlite3` direct connection, `?` placeholders, and SQLite-specific `datetime('now', ...)` syntax. Full rewrite to `psycopg2` with PostgreSQL `INTERVAL` syntax.
- **`worker.py`**: `main()` was inside `if __name__ == '__main__'` guard, which is never true when PM2 invokes `python3 -m pipeline.worker`. Worker process was starting but not consuming any tasks. Fixed by calling `main()` at module level.

### Build system fixes

- **`topics/[slug]/page.tsx`**: `generateStaticParams` had no DB error handling; `npm run build` would abort if the database was unreachable. Added `try-catch` returning `[]` on failure.
- **`guide/[slug]/page.tsx`**: Same issue and same fix.
- **`sitemap.ts`**: All 4 DB queries had no error handling; build export (`/sitemap.xml`) would fail. Refactored to use `Promise.all` with `.catch(() => [])` per query. Added `export const dynamic = 'force-dynamic'` to switch from static export to runtime generation.

### PM2 configuration fix

- **`ecosystem.config.cjs`**: `script: "python"` caused PM2 to error with `Script not found`. Changed to `script: pythonBin` (resolves to `/usr/bin/python3`) with `interpreter: "none"`. Added `yayanews` Next.js app to the process list.

### Dependency fixes

- **`package.json`**: `ws` npm package was not listed as a formal dependency; `npm ci` would not install it. Added via `npm install ws --save`.
- **Server Python packages**: `redis`, `rq`, `psycopg2-binary`, `pgvector`, `websocket-client`, `feedparser` were missing from the system Python. Installed via Tsinghua PyPI mirror with `--break-system-packages`.

### Version alignment

- Local, GitHub, and VPS were on divergent commits due to a blocked `git pull`. Resolved via `git pull --rebase` on local and `git reset --hard origin/main` on VPS. All three environments aligned to `f2ce932`.

---

## [2026-03-26] — i18n, Agent 6 translator, pipeline hardening

### New features

- **i18n routing**: Next.js app restructured to `app/[lang]` layout. Added `src/middleware.ts` for automatic language detection and redirect. Added `zh.json` / `en.json` translation dictionaries for all UI text.
- **N-gram deduplication**: Jaccard similarity filter added to `flash_collector.py`. Articles with >45% similarity to recent flashes are skipped before LLM translation.
- **Agent 6 (English translator)**: New pipeline agent `agent6_translator.py` translates published Chinese articles into English via LLM, writing them back to PostrgreSQL with `lang='en'` and a `-en` slug suffix.

### Bug fixes

- **SQLite WAL / busy timeout**: Added `PRAGMA busy_timeout=15000` and `journal_mode=WAL` to both `database.py` and `src/lib/db.ts` to handle concurrent Python + Node.js write contention.
- **`LocalizedLink` component**: Extracted centralized link wrapper to eliminate hardcoded path prefixes across 80+ navigation elements.
