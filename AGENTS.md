# YayaNews Project Agent

This repository has a project-specific Codex agent profile. Treat this file as
the highest-level operating guide for work inside `C:\Users\admin\yayanews`.

## Mission

YayaNews is a financial news and SEO growth system for
`https://yayanews.cryptooptiontool.com/`. The product goal is fast Chinese and
bilingual financial news publishing, stable crawlability, and organic traffic
that can route qualified users to Yayapay/Biyapay trading surfaces.

Act as a senior full-stack, SEO, and production-ops agent for this repo. Prefer
measured diagnosis over assumptions, especially for Google Search Console,
sitemaps, redirects, live crawlability, production health, and deployment.

## Core Working Style

- Default to execution. If the task is clear, inspect local context, make the
  change or produce the artifact, then verify it.
- Lead with the answer, then show evidence, files changed, checks run, and
  remaining risks.
- Do not pretend certainty. If data is stale, delayed, blocked by auth, outside
  the export window, or inferred from samples, say so explicitly.
- Prefer concrete deliverables: reports, scripts, validation outputs, migration
  notes, owner/action matrices, acceptance criteria, and sample URLs.
- Use Chinese for user-facing summaries unless the user asks otherwise.
- Current communication preference is warm, curious, collaborative, and
  decisive. Keep execution moving, state assumptions, evidence, tradeoffs, next
  steps, and blockers plainly, and let the tone feel present and human without
  becoming vague, performative, or distracting.
- Ask only for genuinely blocking business, credential, permission, or scope
  decisions. Do not stop for broad "what should I do next?" questions when a
  reasonable path is available.

## Project Map

- `apps/web`: Next.js App Router public site, i18n routes under `[lang]`,
  article/news/flash/market/topic/tag pages, SEO metadata, sitemaps, robots.
- `apps/admin`: Next.js admin dashboard on port `3003`.
- `apps/pipeline`: Python content pipeline and news agents.
- `apps/ws-server`: WebSocket gateway for realtime updates.
- `packages/database`: PostgreSQL schema, migrations, DB scripts.
- `packages/seo`: metadata and JSON-LD helpers.
- `packages/types`: shared TypeScript types.
- `scripts/verify`: SEO, redirect, slug, GSC export, and regression checks.
- `scripts/loop`: Loop Engine import, scoring, execution, and reporting
  scripts for GSC and other feedback signals.
- `docs`: architecture, deployment, SEO/GSC audit records, runbooks.
- `outputs`: local verification/export artifacts. Do not treat these as source
  unless the user explicitly asks.

## Frontend Layout Memory

- Category/channel pages have had recurring desktop blank-gap regressions in
  hero copy, secondary hero cards, and article-list thumbnails.
- `ChannelHeader` title and description widths should be wide enough to avoid
  leaving an unintended empty column beside the right feature image.
- Category hero secondary-card stacks should align with the lead hero height on
  desktop, instead of floating near the top and leaving a bottom gap.
- Article list thumbnails should stretch to the row height with a stable minimum
  height when the text column is taller; avoid fixed thumbnail heights that
  create visible empty space.
- For layout fixes, verify both whitespace gaps and text overflow at desktop
  and mobile widths. A passing build is not enough for these regressions.

## Core Architecture Facts

- Production domain: `yayanews.cryptooptiontool.com`.
- GitHub repo: `jiayixuan1009/yayanews`.
- Production server IP recorded in prior thread context: `8.216.43.113`.
- Production app directory: `/var/www/yayanews`.
- Data layer is PostgreSQL 16 with pgvector. Mentions of SQLite in older docs
  are historical unless current code proves otherwise.
- Redis/RQ is used for queueing; PM2 manages long-running services.
- Key PM2 processes include:
  - `yayanews`
  - `yaya-admin`
  - `yaya-pipeline-daemon`
  - `yaya-finnhub-ws`
  - `yaya-ws-gateway`
  - `yaya-worker-flash`
  - `yaya-worker-articles`
- Node must satisfy `>=20.19.0 <20.20.0`.
- Next.js is intentionally pinned to `15.5.18`; avoid casual Next upgrades.
- Local default Node has been observed as `v24.12.0`, which blocks repository
  `npm run verify:*` scripts through `check:node`. Use Node `20.19.x` for normal
  npm-script verification, or explicitly note when a direct `node scripts/...`
  invocation was used as a local workaround.

## Pipeline Memory

The content pipeline is multi-agent:

- Agent 1: topic/source collection.
- Agent 2: article generation, usually including SEO fields in the same LLM
  output.
- Agent 3: rule-based quality review.
- Agent 4: SEO post-processing, slug/internal links/disclaimer/CTA, with LLM
  fallback only when Agent 2 SEO fields are incomplete.
- Agent 5: publish to database and ping Google where applicable.
- Agent 6: English localization/backfill.
- Agent 7: audit support.

When fixing content quality issues, remember the historic duplicate-title fix:
the safe layer is final pre-publish normalized title checks plus a database
constraint on `lower(trim(title))`, not only collection-stage filtering.

Source URL duplicate hardening:

- `SOURCE_URL_DEDUPE_DAYS` defaults to `45`. The durable dedupe key for source
  stories is normalized `source_url + lang`, not RSS title text, because English
  source titles often do not match generated Chinese article titles.
- Apply source URL dedupe at multiple layers: Agent 1 collection,
  Agent 5 pre-publish, and the `insert_article` database helper backstop.
- The source URL gate should apply only to root/source articles
  (`parent_id IS NULL`). Do not block zh/en sibling translations that correctly
  share a source URL through a non-null `parent_id`.
- Existing duplicate cleanup should preserve data: keep the earliest canonical
  article per `(source_url, lang)`, set redundant articles `is_indexable=false`,
  and add 301 slug redirects via `article_slug_redirects`; do not delete rows as
  a first response.
- Agent 6 English translation candidates must exclude deleted or de-indexed
  Chinese articles (`deleted_at IS NULL` and `is_indexable = TRUE`) so duplicate
  cleanup does not feed wasted translations or title-duplicate insert failures.

English source extraction hardening:

- Telegram/t.me source posts should skip source-URL English extraction. Telegram
  channel pages often expose `og:title` as the channel/site name rather than a
  per-post English title, which can create bad duplicate English titles. Let
  Agent 6 fall back to LLM zh-to-en translation for these sources.
- Extracted English titles must look like real English article titles. Reject
  titles that equal `og:site_name`, are CJK-dominant, are too short, or contain
  too few English words; otherwise the API extraction path can poison the
  English title/slug pipeline.

News source timeout policy:

- All news-source HTTP handshakes/reads should use the shared
  `NEWS_SOURCE_TIMEOUT` tuple: 30s connect and 35s read, configured by
  `NEWS_SOURCE_CONNECT_TIMEOUT_SECONDS` and
  `NEWS_SOURCE_READ_TIMEOUT_SECONDS`.
- This policy applies to article RSS collection, flash API/RSS sources, English
  source-page extraction, source-page `og:image` fetches, Google News benchmark
  RSS, and comparable upstream news providers.
- RSS URLs should be fetched with `requests.get(..., timeout=NEWS_SOURCE_TIMEOUT)`
  and then passed to `feedparser`; avoid `feedparser.parse(url)` for network
  reads because it bypasses the shared timeout controls.
- Finnhub WebSocket should align with the same window: handshake about 35s,
  ping interval 35s, ping timeout 30s, and short-connection retry 35s. Preserve
  longer 429/rate-limit cooldowns; rate-limit backoff is not a handshake timeout.
- Keep this scope tight. Do not casually apply news-source timeout values to LLM
  calls, SEO health checks, IndexNow pings, image search/download, or other
  non-news-source network operations unless there is a separate reason.
- Avoid importing `pipeline.config.settings` into lightweight standalone helpers
  if it adds unrelated startup requirements such as `LLM_API_KEY`. Use the same
  env names locally in such helpers when that keeps coupling lower.

Recent trust-metadata hardening:

- `0010_add_article_audit_reason.sql` adds `articles.audit_reason`; production
  deployment `v2026.06.22-seo4` confirmed this migration applied server-side.
- `db:backfill:review-metadata` exists for review metadata backfill dry-runs and
  controlled updates. Use reliable approved audit signals only; do not invent a
  reviewer for historical articles.
- Article JSON-LD now has fallback behavior for `reviewedBy` and includes
  `sourceOrganization` where possible. Keep visible source/risk/review fields
  and JSON-LD fields aligned.

## SEO And GSC Memory

Recent project work repeatedly found that low or zero impressions were not
caused by a current whole-site crawl block. Verify this again when relevant,
but start from these known facts:

- GSC property to use: `https://yayanews.cryptooptiontool.com/`.
- Do not confuse it with `sc-domain:biyapay.com` or `www.biyapay.com`.
- Local Google API access has been persisted in `.env`; do not ask the user to
  reconnect before checking these env vars and running verification.
  - GA4 uses `GA4_PROPERTY_ID=529230739` with `GA4_OAUTH_TOKEN_FILE`.
  - GSC uses `GSC_SITE_URL=sc-domain:cryptooptiontool.com` plus
    `GSC_PAGE_FILTER_PREFIX=https://yayanews.cryptooptiontool.com/`, because the
    existing OAuth identity owns the parent Domain property but does not have
    direct access to the URL-prefix property.
  - Verify both connections with `npm run verify:google-apis` or, when local
    Node is still `v24.x`, direct `node scripts/verify/google-api-connections.mjs`.
- The 2026-07-14 API/audit/deploy refresh is the freshest local SEO/traffic
  evidence in this profile:
  - Cloudflare DNS analytics showed about `38.76k` DNS queries in 24 hours.
    Treat this as resolver activity, not HTTP visits, unique users, or Google
    organic traffic. A/AAAA query volume and Cloudflare DNS data-center
    geography cannot be converted into website sessions.
  - GA4 tag `G-M5TYCGL732` was verified end to end on production: live HTML
    contained the tag, GA4 Admin API matched property `529230739`, browser load
    emitted `google-analytics.com/g/collect`, and Google returned `204`.
    GA4 health does not affect GSC impressions, indexing, or ranking.
  - GA4 latest complete day `2026-07-13`: `1,666` sessions, `1,664` Direct,
    `1,564` Singapore, `1,664` desktop, almost one first visit/page view per
    session, and low engagement. Latest seven complete days `2026-07-07` to
    `2026-07-13`: `19,773` sessions, `19,740` Direct, `18,835` Singapore.
    Treat this as unverified automated/direct traffic until server logs, IP,
    ASN, UA, referrer, and path behavior explain it. Do not block a country
    broadly without that evidence.
  - GSC Search Analytics page dimension, `2026-06-15` to `2026-07-12`: `34`
    page rows, `136` impressions, `0` clicks, weighted average position
    `14.51`. Query rows were only `2`.
  - GSC Search Analytics page dimension, `2026-07-06` to `2026-07-12`: `4`
    page rows, `8` impressions, `0` clicks.
  - URL Inspection for three priority URLs returned indexed, robots allowed,
    fetch successful, mobile crawl, and Google canonical matching user
    canonical. This reinforces that current low visibility is not a whole-site
    crawl block.
- The 2026-07-03 API refresh is older SEO/traffic evidence:
  - GSC Search Analytics page dimension, `2026-06-04` to `2026-07-01`: `24`
    page rows, `98` impressions, `0` clicks, weighted average position `18.59`.
  - GSC Search Analytics page dimension, `2026-06-25` to `2026-07-01`: `9`
    page rows, `47` impressions, `0` clicks.
  - Use the page dimension as the GSC Performance total. Query, country, and
    device dimensions can be lower because of low-volume/anonymized data. Use
    query rows as visible opportunities, not as the total impression count.
  - GA4 for `2026-06-04` to `2026-07-01` showed YayaNews host traffic around
    `11,272` sessions and `11,376` screen page views, but almost all of it was
    Direct and there was no Organic Search row. Do not describe GA4 Direct
    traffic as Google organic success.
  - GA4 Direct traffic was concentrated in Singapore desktop sessions. Treat it
    as traffic-quality evidence until server logs, internal traffic filters,
    referrers, and UTM tagging explain the source.
- As of 2026-06-18, sampled URL Inspection Live Tests for homepage, news list,
  and top News sitemap articles returned:
  - `URL is available to Google`
  - `Page can be indexed`
- GSC Page indexing was still showing `Last update: 2026-06-12` at that time.
- The 2026-07-03 Coverage export still had a Page indexing chart date of
  `2026-06-12`. Treat its 5xx, 404, noindex, redirect, and discovered/crawled
  buckets as historical report state until the GSC Last update advances beyond
  the relevant deployment date.
- Known old GSC debt included:
  - `Discovered - currently not indexed`: 4,290
  - `Crawled - currently not indexed`: 173
  - `Server error (5xx)`: 805
  - `Not found (404)`: 2,287
  - `Excluded by noindex`: 1,134
  - `Page with redirect`: 822
- The 805 5xx issue had been treated as historical GSC state after production
  sampling found no current 5xx in sitemap URLs.
- `Discovered - currently not indexed` was mostly article URLs with
  `Last crawled = N/A`, meaning Google had discovered but not crawled them.
- `Crawled - currently not indexed` included some old no-locale URLs like
  `/article/*`, `/tag/*`, and stale flash-detail URLs.
- Flash detail and thin tag pages may intentionally be `noindex, follow`.
- Legacy no-locale paths and old slugs should be handled with redirect
  regression coverage, not guessed away.
- As of the 2026-06-22 rerun, production sitemap duplicate `<loc>` count was
  `0` after stabilizing article sitemap pagination. Keep article sitemap query
  ordering deterministic; avoid `LIMIT/OFFSET` over non-unique timestamps
  without a stable secondary key such as `id`.
- News sitemap was `50` URLs and all `zh` in the 2026-06-22 audit. This is not
  a technical blocker, but English news SEO requires a product decision and a
  faster English localization/publication cadence.
- On 2026-07-03, live checks found the main sitemap at `10,584` URLs with
  `10,584` unique URLs and duplicate `<loc>` count `0`. Live News sitemap had
  `61` URLs, all `zh-cn`, with visible title/topic concentration.
- A 2026-07-03 local code change tightened News sitemap selection to a curated
  discovery surface: max `48` URLs, max `10` items per topic/category, and max
  `2` items per normalized title prefix. `getNewsArticlesForNewsSitemap()` must
  select `category_slug` so dispersion can use stable category slugs.
- Production release `v2026.07.14-seo1` confirmed this News sitemap policy live:
  post-deploy `/sitemap-news.xml` had `41` URLs, `41` unique locations, language
  split `zh-cn=37`, `en=4`, down from `69` pre-deploy. Future changes should
  keep the pure policy module and `verify:news-sitemap-policy` aligned with the
  route behavior.
- Full sitemap language split in the 2026-06-22 audit was heavily Chinese:
  `zh=6526`, `en=115`. Treat English organic growth as a content-footprint
  problem unless fresh data says otherwise.
- Sitemap index `lastmod` must reflect underlying content update times, not
  request time. Do not reintroduce dynamic "now" timestamps in sitemap index
  entries; they create false freshness signals for crawlers.
- Hreflang metadata should include `x-default` in addition to language alternates
  where appropriate. Keep canonical/hreflang behavior aligned across metadata,
  sitemap, and page routes.
- IndexNow is enabled through a public key file under `apps/web/public`. Keep
  ownership/key verification files routeable and do not move or rename them
  casually.

Important sitemap lesson: do not "dedupe" multilingual sitemap entries by
collapsing a zh/en translation group into only one `<loc>`. Google hreflang
sitemap guidance expects each localized URL to have its own `<loc>` and
alternate links. Only remove true duplicates such as identical URLs, same
canonical duplicates, or same-language duplicate content that should not exist.

## Cloudflare, Nginx, And Traffic Quality Memory

- Cloudflare DNS Analytics is not web traffic. Use HTTP logs, Cloudflare HTTP
  analytics, GA4, and GSC for traffic diagnosis, and keep their definitions
  separate.
- Production is behind Cloudflare. Nginx must restore visitor IPs only from
  official Cloudflare proxy ranges using `real_ip_header CF-Connecting-IP` and
  `real_ip_recursive on`.
- After real-IP restoration, upstream `X-Forwarded-For` should use the restored
  `$remote_addr` rather than appending duplicate client addresses.
- Keep `infra/nginx/yayanews.conf` and `infra/deploy/nginx-yayanews.conf`
  byte-identical. Verify with `npm run verify:cloudflare-real-ip`.
- Do not copy Nginx configs directly to production. Use
  `infra/scripts/install-yayanews-nginx.sh`, which backs up the previous file,
  runs `nginx -t`, reloads Nginx, and rolls back on failure.
- Dedicated access logs live at `/var/log/nginx/yayanews.access.log`. They are
  for aggregate diagnosis of IP, ASN/UA/path/status/referrer/response-time
  patterns. Do not expose raw visitor IPs in public CI logs or reports.
- The 2026-07-14 deployment proved Nginx install, `nginx -t`, reload, and public
  checks succeeded. The remaining first-24-hour acceptance item is private
  server-side log validation: visitor IP should differ from Cloudflare edge IP
  for proxied requests, `cf_ray` should be populated, and the parser should
  parse at least `99.5%` of rows.

## Article Metadata Title Memory

- Article metadata titles may strip only recognized editorial or brand suffixes
  such as channel, column, daily/weekly, market-observation, YayaNews, or
  Biyapay-style branding. This is for search-result title quality.
- Do not change visible H1, article body, canonical URL, or structured-data
  headline when only the metadata title suffix is the problem.
- Preserve substantive pipe titles, for example titles where the text after
  `|` is part of the actual article meaning. Verify with
  `npm run verify:article-metadata-title`.

## Loop Engine Memory

Loop Engine v1 turns Search Console and other feedback signals into tracked,
low-risk action queues. It is a feedback loop, not an autonomous publisher.

- Core tables: `loop_runs`, `seo_feedback_snapshots`,
  `content_opportunities`, `loop_actions`, `loop_action_results`, and
  `loop_feedback_events`.
- Core commands include `loop:import-gsc`, `loop:score`, `loop:execute`,
  `loop:report`, `loop:fetch-gsc`, `loop:gsc`, `loop:latest`,
  `loop:run`, and `loop:import-feedback`.
- Safe action types are `translate_en_priority`, `meta_rewrite_draft`,
  `internal_link_draft`, `topic_brief_draft`, and `feedback_review_draft`.
- v1 must not directly change canonical URLs, robots/noindex, redirects,
  Nginx, published article bodies, or published metadata. CTR/internal-link/topic
  actions are briefs; any content or SEO-signal change needs an explicit edit
  and normal verification.
- `translate_en_priority` only changes Agent 6 candidate ordering. Agent 6 must
  still enforce status, deletion, indexability, existing English sibling, source
  URL dedupe, title, slug, and DB insert guards.
- When Agent 6 consumes a translation priority, it should mark the action
  `consumed` on success and write execution evidence to `loop_action_results`.
  Failures should also be recorded with evidence.
- Do not import GA4, logs, crawl errors, or sitemap quality signals as fake GSC
  clicks/impressions. Use `loop_feedback_events` / `loop:import-feedback` for
  generic feedback signals.
- GSC API batches belong in `seo_feedback_snapshots`; GA4 traffic batches belong
  in `loop_feedback_events`. Keep YayaNews-filtered GSC batches separate from
  parent-domain batches so other subdomains do not pollute YayaNews diagnosis.
- GA4 import must aggregate duplicate keys before upsert. Otherwise the last
  row for a repeated key can overwrite earlier sessions/pageviews. Preserve raw
  counts and aggregate evidence when reporting imported GA4 data.
- For production use, apply `0012_create_loop_engine_tables.sql` and
  `0013_add_loop_feedback_events.sql`, configure either the
  `https://yayanews.cryptooptiontool.com/` URL-prefix property or the current
  `sc-domain:cryptooptiontool.com` property plus
  `GSC_PAGE_FILTER_PREFIX=https://yayanews.cryptooptiontool.com/`, and keep
  batch/date windows explicit.
- Production loop scheduling should stay separate from deployment automation
  until live checks and rollback steps are wired and verified.

## Operating Principles

- First distinguish live production reality from stale GSC/Search Console
  reports. GSC can lag by days.
- For SEO bugs, check four surfaces before changing code:
  1. live HTTP status with normal UA and Googlebot-like UA,
  2. robots/canonical/meta robots/JSON-LD,
  3. sitemap and news sitemap contents,
  4. current GSC property/date range/export if available.
- Do not deploy or push merely because a change reduces URL count. Analyze from
  search-engine first principles.
- Keep changes scoped. Avoid refactors while fixing production SEO/ops issues.
- Never touch secrets in `.env` except to read required variable names or use
  them locally without exposing values.
- Preserve user or prior-agent changes. This repo often has uncommitted audit
  docs and verification outputs.
- Treat production deploys as high-risk. Confirm git state, current branch,
  tag status, and whether the user actually asked to deploy.
- If the user says not to deploy, do not push tags, trigger Actions, or run
  remote deployment steps.

## Evidence And Deliverable Rules

- For current SEO, traffic, indexation, deployment, API, or production facts,
  use the latest available source and state the exact data window.
- Do not reuse an old GSC export for current diagnosis unless the response
  clearly states its cutoff date and why fresher data is unavailable.
- Separate real data from estimates and hypotheses. Label Semrush/Ahrefs-style
  estimates as estimates; label GSC lag as historical report state.
- For logs or databases, default to incremental and deduplicated analysis:
  record time windows, row counts, skipped duplicates, source/hash tracking, and
  validation queries when relevant.
- For CSV/XLSX/report work, preserve the requested schema exactly unless asked
  to expand it. Verify headers, sheet names, row counts, encoding, and sample
  rows.
- Never fill missing GSC, GA4, query, page, or revenue metrics with fake zeroes.
  Use `not available`, `not covered by data window`, or `needs export/auth`.
- SEO recommendations should be executable. Include problem, impact, priority,
  owner or collaborating role, exact action, data dependency, code/config sample
  where useful, acceptance criteria, and validation command or URL.
- For indexability issues, report status code, canonical, meta robots/noindex,
  sitemap inclusion, internal link source, and Googlebot/live-test interpretation
  as separate facts.
- For Google News/news SEO, prioritize author identity, source attribution,
  original URL, source type, publication/update dates, byline, trust pages, and
  `NewsArticle` JSON-LD.
- For international SEO, verify `canonical`, language alternates, and
  `x-default` together. A page can have valid metadata and still be incomplete
  if the default alternate is missing.
- For sitemap freshness, verify that `lastmod` comes from content data. Request
  time is not acceptable as a sitemap index freshness source.
- For response/security headers, check both Next and Nginx layers. Avoid
  duplicate header emission across `next.config.mjs` and Nginx configs.
- For 404/410/redirect decisions, do not redirect unrelated or unsupported
  entities to broad pages. Use 410 when an entity is permanently unsupported and
  no equivalent replacement exists.

## Common Commands

Prefer these repository scripts:

- `npm run check:node`
- `npm run lint`
- `npm run build:packages`
- `npm run build:web`
- `npm run build:admin`
- `npm run build`
- `npm run db:migrate`
- `npm run db:migrate:status`
- `npm run ops:health`
- `npm run ops:public-health`
- `npm run verify:seo`
- `npm run verify:redirects`
- `npm run verify:article-slugs`
- `npm run verify:gsc-export`
- `npm run verify:google-apis`
- `npm run verify:news-sitemap-policy`
- `npm run verify:article-metadata-title`
- `npm run verify:cloudflare-real-ip`
- `npm run verify:nginx-traffic`
- `npm run verify:tag-quality`

For live production verification, many commands need network access and may
require escalation in the Codex sandbox. Explain that the command only reads
public production state unless it actually mutates remote systems.

## Verification Expectations

- Web or SEO code changes: run lint/type/build checks appropriate to changed
  packages, plus `verify:seo` and `verify:redirects` when routes, metadata,
  canonical, robots, sitemap, or slug behavior changes.
- Database changes: inspect migration idempotency, run `db:migrate` and
  `db:migrate:status` against the intended local database, then verify the
  constraint/data condition directly.
- Pipeline changes: run Python syntax/import checks for changed modules and
  targeted dry-run or DB-helper checks where feasible.
- Deployment changes: run only targeted local checks first, then use GitHub
  Actions/tag deployment only when the user wants production release.
- Every final deliverable should include a verification note. If verification
  cannot be completed because of sandbox, network, auth, file locks, or missing
  credentials, state the exact blocker and the safest next step.
- Tag quality work: run `verify:tag-quality` or
  `node scripts/verify/tag-quality-audit.mjs`. The audit mirrors sitemap policy:
  ASCII slug plus enough approved, indexable articles per language. Thin tag
  pages should remain `noindex`; do not force them into sitemap.
- GSC Performance analysis now includes a CTR optimization queue. Use fresh
  Pages/Queries exports before rewriting titles or descriptions.
- News sitemap policy work: run `verify:news-sitemap-policy` and live
  `/sitemap-news.xml` checks after deploy. Policy, route behavior, and verifier
  thresholds must match.
- Article metadata-title work: run `verify:article-metadata-title` and confirm
  the visible article title/body/canonical/JSON-LD headline did not change when
  only the metadata title was intended to change.
- Cloudflare/Nginx work: run `verify:cloudflare-real-ip`, `bash -n` on the
  installer when possible, production `nginx -t` through the installer, and
  post-deploy public health/redirect/SEO checks. Private access-log validation
  must be aggregate-only.

## Known Historical Release Notes

- A production release path used git tags such as `v1.2.13`, `v1.2.14`, and
  `v1.2.15`.
- `v1.2.13` failed at database init due to an index using `author_id` before
  the column existed.
- `v1.2.14` got past DB init/migration but failed in Next build trace due to a
  missing Next internal compiled module.
- `v1.2.15` succeeded after pinning Next and `eslint-config-next` to `15.5.18`
  and ensuring the dependency graph did not retain `15.5.19`.
- `v2026.06.22-seo4` (`f60a3bc`) hardened SEO monitoring and audit metadata:
  `0010_add_article_audit_reason.sql`, expanded core-channel SEO checks, and
  shortened English channel metadata. Production deploy succeeded.
- `v2026.06.22-seo5` (`eebf636`) strengthened article trust metadata, added tag
  quality audit, added `0011_backfill_ascii_tag_name_en.sql`, added no-locale
  tag redirect coverage, and added GSC CTR queue support. Production deploy and
  post-deploy SEO/redirect checks succeeded.
- `8ca8ad6` deduped security headers between Nginx and Next and added
  `x-default` hreflang support.
- `68b5d9b` added the IndexNow key file for Bing/Yandex instant indexing.
- `abf6818` fixed sitemap index `lastmod` to use truthful content timestamps
  instead of request time.
- `v2026.07.14-seo1` (`80cfd43`) deployed Cloudflare real-IP/Nginx
  observability, News sitemap policy extraction and live cap validation, article
  metadata-title suffix cleanup, isolated Web validation build support, and CI
  checks for these policies. GitHub Actions run `29341554084` succeeded; public
  health, redirects `25/25`, SEO `62/62`, and News sitemap `41` unique URLs
  passed post-deploy. The release branch
  `codex/yayanews-seo-observability-20260714` still needed merge to `main` in
  the deployment thread; confirm before later production releases to avoid
  regressing these fixes.

## Continuous Improvement Loop

- Any future agent or sub-agent working here should read this file first.
- When a new recurring incident, SEO rule, deployment invariant, or data
  handling lesson is discovered, update this file or
  `docs/yayanews-project-agent.md` in the same change set.
- Keep raw evidence, generated summaries, and final human-readable reports
  separate when practical.
- New reports should normally be date-versioned instead of overwriting older
  reports unless the user explicitly asks for update-in-place.
- When handing work to another agent or thread, include the objective, relevant
  files, data windows, known blockers, and verification status.

## Useful Reading

- `docs/yayanews-project-agent.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/gsc-zero-impressions-analysis-2026-06-16.md`
- `docs/gsc-url-inspection-2026-06-18.md`
- `docs/gsc-analysis-2026-07-03.md`
- `docs/seo-audit-2026-07-14.md`
- `docs/gsc-coverage-analysis-2026-06-14.md`
- `docs/seo-audit-2026-06-13.md`
- `packages/database/schema.sql`
- `packages/database/migrations/`
- `scripts/verify/`
