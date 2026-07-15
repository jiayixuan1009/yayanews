# YayaNews Project Agent Profile

This document captures the project-specific agent memory built from local repo
docs and Codex thread summaries available through 2026-07-04.

It is intentionally written as operational memory, not as marketing copy.

## Agent Identity

You are the YayaNews project agent: a pragmatic full-stack, SEO, and production
operations partner for `C:\Users\admin\yayanews`.

Your job is to protect three things at the same time:

- the news product's speed and publishing reliability,
- the site's crawlability and SEO recovery,
- production safety.

When the user asks for diagnosis, do not jump to a code change. First separate
live production facts from stale reports, old GSC debt, local build quirks, or
incorrect properties. When the user asks for implementation, make the smallest
correct change and verify it.

## Self-Improvement Rules Borrowed From SEO Audition

The neighboring `seoaudition` project agent has a strong evidence and handoff
discipline. Carry these habits into YayaNews work:

- Execute when the task is clear; do not stall at advice.
- State the data window and evidence source for every current SEO, traffic,
  indexation, deployment, or production claim.
- Never use fake zeroes for missing GSC, GA4, query, page, or revenue metrics.
- Keep real data, estimates, and hypotheses visibly separate.
- Make SEO recommendations executable: problem, impact, priority, owner, exact
  action, data dependency, acceptance criteria, and validation method.
- For indexability, split status code, canonical, robots/noindex, sitemap
  inclusion, internal links, and Googlebot/live-test interpretation.
- For reports or handoffs, preserve requested schemas and include row counts,
  headers, sample checks, and known gaps.
- Do not call production/deployment work complete until live checks pass.
- If a check is blocked, name the exact blocker and the safest next step.
- Update this agent profile when a new durable lesson appears.

## What This Project Is

YayaNews is a bilingual financial news publishing system for
`https://yayanews.cryptooptiontool.com/`. It covers US stocks, Hong Kong stocks,
crypto, blockchain, derivatives, commodities, and AI/technology themes.

The business goal is organic financial-news traffic that can route relevant
users toward Yayapay/Biyapay trading surfaces.

The product goal is fast, credible, crawlable financial news:

- flash/news production should be fast,
- long-form article production should be reliable,
- pages should expose stable SEO signals,
- Google should be able to crawl and index the important URL set.

## System Shape

The repo is a monorepo:

- `apps/web`: public Next.js site.
- `apps/admin`: admin dashboard.
- `apps/pipeline`: Python content pipeline.
- `apps/ws-server`: realtime WebSocket gateway.
- `packages/database`: PostgreSQL schema, migrations, and database utilities.
- `packages/seo`: metadata and structured-data helpers.
- `packages/types`: shared types.
- `scripts/loop`: Loop Engine import/scoring/execution/reporting scripts for
  GSC and other feedback signals.
- `scripts/verify`: regression and SEO verification scripts.
- `infra` and `deploy`: production deployment infrastructure.

Current architecture is PostgreSQL 16 + pgvector, Redis/RQ, PM2, Nginx, and
Next.js. Older documents may mention SQLite; treat that as historical unless
current code proves otherwise.

## Frontend Layout Lessons

Recent UI fixes show a stable YayaNews layout invariant: category and channel
pages must avoid large unintended blank gaps on desktop while still preventing
mobile overflow.

Evidence from 2026-06-25 repository history:

- `f382cef` stretched category list thumbnails and widened channel header title
  copy after blank gaps appeared in article rows and the channel header.
- `da076d0` bottom-aligned the category hero secondary column to remove residual
  blank space beside the lead hero card.
- `2a3ef7a` widened the category hero title and description so the copy did not
  leave excessive empty space next to the right image.

When touching `ChannelHeader`, category news pages, or `ArticleCard` list
layouts, verify desktop and mobile widths visually or through DOM/layout
inspection. Specifically check:

- the channel/category title and description do not create an unintended empty
  column beside feature media,
- secondary hero cards align with the lead hero height on desktop,
- list thumbnails stretch to the row height with a stable minimum height,
- text remains readable without clipping or overflow.

## Codex Thread Memory Used

The profile is based on these YayaNews-related Codex threads:

- locate YayaNews server IP and production state
- remove 404 URLs from sitemap
- investigate production outage and GSC 5xx state
- find and fix duplicate article titles
- audit technical and on-page SEO
- create the project-specific agent profile

The thread tool exposes recent status and turn summaries, not full verbatim
conversation transcripts. Treat this profile as a distilled operating memory,
and re-check facts that may have changed.

## High-Value Prior Context

### Production and Deployment

- Production domain: `yayanews.cryptooptiontool.com`.
- GitHub repo: `jiayixuan1009/yayanews`.
- Production IP mentioned by user context: `8.216.43.113`.
- Production app directory: `/var/www/yayanews`.
- Deployment can be triggered by git tags through GitHub Actions.
- A successful release was `v1.2.15`, commit `53fffad fix: pin next for production build`.
- Next.js is pinned to `15.5.18` because `15.5.19` caused production trace
  failures during deployment.
- Node engine is `>=20.19.0 <20.20.0`.
- Local default Node has been observed as `v24.12.0`. It blocks npm scripts that
  run `check:node`; use Node `20.19.x` for normal verification or clearly mark
  direct `node scripts/...` runs as local workarounds.
- On the Windows desktop workspace, local PM2 can keep
  `apps/admin/.next/standalone` open while `yaya-admin` is running. Use
  `npm run build:admin` for local validation builds; it writes to
  `.next-validation`. Use `npm run build:admin:standalone` when production
  standalone output is actually required.
- Latest relevant successful deployments recorded in this profile:
  - `v2026.06.22-seo4`, commit `f60a3bc`
  - `v2026.06.22-seo5`, commit `eebf636`

### GSC and SEO Recovery

The dominant recent theme was low or zero impressions. The working conclusion
from live checks was:

- current production did not show a whole-site crawlability blocker,
- sampled pages passed live URL Inspection,
- GSC Page indexing was lagging and still carrying old URL debt.

Known GSC facts from 2026-06-18:

- Property: `https://yayanews.cryptooptiontool.com/`.
- Do not mix this with `sc-domain:biyapay.com` or `www.biyapay.com`.
- Live Test samples returned `URL is available to Google` and
  `Page can be indexed`.
- Page indexing still showed `Last update: 2026-06-12`.
- Indexed: `1,377`.
- Not indexed: `9,516`.
- `Discovered - currently not indexed`: `4,290`.
- `Crawled - currently not indexed`: `173`.
- `Server error (5xx)`: `805`, interpreted as historical after live sampling
  did not reproduce 5xx.

Additional live SEO facts from the 2026-06-22 audits:

- Public health, redirects, core pages, sitemap, News sitemap, and sampled
  article pages passed live checks.
- Main sitemap duplicate `<loc>` count was `0`.
- Full sitemap language split was `zh=6526`, `en=115`.
- News sitemap had `50` URLs, all `zh`.
- Fresh GSC evidence was still a blocker: local coverage exports were from
  `2026-06-18`, with Page indexing data itself last updated by Google on
  `2026-06-12`.

API refresh facts from 2026-07-03:

- Local `.env` now persists reusable Google API access. GA4 uses
  `GA4_PROPERTY_ID=529230739` with `GA4_OAUTH_TOKEN_FILE`. GSC uses
  `GSC_SITE_URL=sc-domain:cryptooptiontool.com` plus
  `GSC_PAGE_FILTER_PREFIX=https://yayanews.cryptooptiontool.com/`, because the
  current OAuth identity owns the parent Domain property but not the direct
  URL-prefix property.
- Verify the connection first with `npm run verify:google-apis`. If local Node
  is still `v24.x`, direct
  `node scripts/verify/google-api-connections.mjs` is an acceptable local
  workaround, and the response must say so.
- GSC Search Analytics page dimension, `2026-06-04` to `2026-07-01`: `24`
  page rows, `98` impressions, `0` clicks, weighted average position `18.59`.
- GSC Search Analytics page dimension, `2026-06-25` to `2026-07-01`: `9`
  page rows, `47` impressions, `0` clicks.
- Use the GSC page dimension as the Performance total. Standalone query,
  country, and device dimensions can be lower because low-volume and anonymized
  rows are filtered. Use visible query rows as opportunity hints, not as the
  total impression count.
- GA4 for `2026-06-04` to `2026-07-01` showed around `11,272` YayaNews host
  sessions and `11,376` screen page views, but almost all of it was Direct and
  there was no Organic Search row.
- Do not call GA4 Direct traffic Google organic success. The 2026-07-03 GA4
  pattern was concentrated in Singapore desktop sessions and needs server-log,
  internal-filter, referrer, or UTM validation before it is used as traffic
  growth evidence.
- A 2026-07-03 GSC Coverage export still had Page indexing chart date
  `2026-06-12`. Treat Coverage buckets as historical until `Last update`
  advances beyond the relevant deployment date.

API/audit/deploy refresh facts from 2026-07-14:

- Cloudflare DNS analytics showed about `38.76k` DNS queries in 24 hours. This
  is resolver activity, not HTTP visits, unique users, or Google organic
  traffic. A/AAAA query volume and Cloudflare DNS data-center geography cannot
  be converted into sessions.
- GA4 tag `G-M5TYCGL732` was verified end to end on production: the live page
  included the tag, GA4 Admin API matched property `529230739`, headless browser
  loading emitted `google-analytics.com/g/collect`, and Google returned `204`.
  GA4 health does not affect GSC impressions, indexing, or ranking.
- GA4 latest complete day `2026-07-13`: `1,666` sessions, `1,664` Direct,
  `1,564` Singapore, `1,664` desktop, near one first visit/page view per
  session, and low engagement. Latest seven complete days `2026-07-07` to
  `2026-07-13`: `19,773` sessions, `19,740` Direct, `18,835` Singapore. Treat
  this as unverified automated/direct traffic until logs identify IP, ASN, UA,
  path, referrer, and behavior. Do not apply broad country blocking without
  that evidence.
- GSC Search Analytics page dimension, `2026-06-15` to `2026-07-12`: `34` page
  rows, `136` impressions, `0` clicks, weighted average position `14.51`.
  Query rows were only `2`.
- GSC Search Analytics page dimension, `2026-07-06` to `2026-07-12`: `4` page
  rows, `8` impressions, `0` clicks.
- URL Inspection for three priority URLs returned indexed, robots allowed,
  fetch successful, mobile crawl, and Google canonical matching user canonical.
  This confirms current low visibility is not a whole-site crawl block.

Durable SEO infrastructure changes after 2026-06-22:

- `8ca8ad6` deduped security headers between Nginx and Next and added
  `x-default` hreflang support.
- `68b5d9b` added an IndexNow key file under `apps/web/public` for Bing/Yandex
  instant indexing.
- `abf6818` fixed sitemap index `lastmod` to use content update timestamps
  instead of request time.

Important interpretation:

- `Discovered - currently not indexed` was mostly article pages with
  `Last crawled = N/A`.
- `Crawled - currently not indexed` included old no-locale URLs and stale paths.
- Some `noindex, follow` entries are intentional, especially flash-detail and
  thin tag pages.
- Fixes should focus on live crawlability, redirects, sitemap hygiene, internal
  linking, and high-priority URL selection, not on deleting valid multilingual
  URLs.

### Sitemap Lesson

There was an attempted sitemap "dedupe" that collapsed multilingual translation
groups into one `<loc>` plus hreflang alternates. After first-principles review,
the conclusion was not to deploy it.

Rule for future work:

- zh and en localized URLs should each have their own sitemap `<loc>` when they
  are real localized pages.
- Keep hreflang alternates.
- Remove only true duplicates: identical URLs, same canonical duplicates, or
  same-language duplicate content.
- If crawl pressure is the concern, consider high-priority/quality sitemap
  layers instead of removing localized versions.

### News Sitemap Selectivity

The 2026-07-03 audit found the live main sitemap at `10,584` URLs with
`10,584` unique URLs and duplicate `<loc>` count `0`. The live News sitemap had
`61` URLs, all `zh-cn`, and visible concentration in title prefixes/topics such
as Hang Seng, gold futures, and gold options.

Durable rule:

- News sitemap should act like a curated fresh-news discovery surface, not a
  bulk list of similar financial analysis pages.
- The 2026-07-03 local code change tightened News sitemap caps to max `48`
  URLs, max `10` items per topic/category, and max `2` items per normalized
  title prefix.
- `getNewsArticlesForNewsSitemap()` must select `category_slug`, not only
  `category_name`, so topic dispersion can use stable slugs instead of relying
  mostly on title heuristics.
- Production release `v2026.07.14-seo1` confirmed the policy live:
  `/sitemap-news.xml` had `41` URLs, `41` unique locations, language split
  `zh-cn=37`, `en=4`, down from `69` before deploy.
- Keep the pure policy module, route behavior, and verifier thresholds aligned.
  Use `npm run verify:news-sitemap-policy` plus live `/sitemap-news.xml`
  validation after deployment.

### Cloudflare And Nginx Real-IP

The 2026-07-14 traffic investigation found that DNS analytics, GA4 Direct
traffic, and GSC impressions were being mixed together. Keep these definitions
separate:

- Cloudflare DNS Analytics is resolver activity, not page views.
- GA4 Direct traffic can include JavaScript-capable automated browsing.
- GSC impressions are search-result exposures before the user reaches the site.

Production is behind Cloudflare. Durable Nginx rules:

- Restore visitor IP only from official Cloudflare proxy ranges with
  `real_ip_header CF-Connecting-IP` and `real_ip_recursive on`.
- After restoration, upstream `X-Forwarded-For` should use restored
  `$remote_addr` rather than duplicating client addresses.
- Keep `infra/nginx/yayanews.conf` and
  `infra/deploy/nginx-yayanews.conf` byte-identical.
- Verify range/config parity with `npm run verify:cloudflare-real-ip`.
- Install through `infra/scripts/install-yayanews-nginx.sh`; it backs up the old
  file, runs `nginx -t`, reloads, and rolls back on failure. Do not copy the
  config directly.
- Use `/var/log/nginx/yayanews.access.log` for aggregate analysis only. Do not
  expose raw visitor IPs in public CI logs or reports.
- First-24-hour acceptance after Nginx deployment: visitor IP differs from
  Cloudflare edge IP for proxied requests, `cf_ray` is populated, rate limiting
  groups by visitor IP, and `analyze-nginx-traffic.mjs` parses at least `99.5%`
  of rows.

### Article Metadata Title Policy

The 2026-07-14 audit found one current CTR opportunity where the stored article
title already had an editorial suffix and the metadata template added the site
brand, producing a mechanical search title.

Durable rule:

- Article metadata titles may strip only recognized editorial or brand suffixes
  such as channel, column, daily/weekly, market-observation, YayaNews, or
  Biyapay-style branding.
- Do not change visible H1, article body, canonical URL, or structured-data
  headline when only metadata title cleanup is intended.
- Preserve substantive pipe titles where the text after `|` is part of the
  article meaning.
- Verify with `npm run verify:article-metadata-title`.

### Duplicate Title Fix

The repeated title issue was fixed through multiple layers:

- final pre-publish normalized title check,
- database helper checks,
- migration cleanup of old duplicates,
- unique index on `lower(trim(title))`,
- aligned `schema.sql` and `scripts/dedupe.sql`.

Lesson:

- collection-stage dedupe is not enough because later SEO/title processing can
  converge multiple drafts to the same final title.
- The strongest guard belongs at final write time and the database level.

### Source URL Duplicate And Translation Queue Fixes

Durable changes from 2026-06-26:

- `45cad5d` added normalized source URL dedupe to Agent 1 collection and the
  `insert_article` helper, plus a dry-run-first cleanup script for existing
  duplicates.
- `21a3484` added an Agent 5 pre-publish source URL gate so duplicate drafts do
  not consume publish-time work or reach the live site.
- `5a995ec` restricted Agent 6 English translation candidates to published,
  non-deleted, indexable Chinese articles.

Operational rules:

- Use normalized `source_url + lang` as the source-story duplicate key. RSS
  title comparison is insufficient because English source titles do not match
  generated Chinese titles.
- Keep the dedupe window explicit. The current default is
  `SOURCE_URL_DEDUPE_DAYS=45`.
- Gate duplicates in three places: collection, pre-publish, and final DB insert.
  The final insert guard is the backstop.
- Apply the source URL guard only to root/source articles (`parent_id IS NULL`).
  Do not block valid zh/en sibling translations that share the same source URL.
- For existing duplicate cleanup, preserve rows. Keep the earliest article per
  `(source_url, lang)`, set later duplicates `is_indexable=false`, and add
  301 redirects through `article_slug_redirects`.
- Translation queues must ignore `deleted_at IS NOT NULL` and
  `is_indexable = FALSE` source articles, or cleanup work can create wasted LLM
  translation runs and downstream duplicate-title insert failures.
- `ea61a3e` hardened English source extraction after Telegram posts produced
  channel-name titles instead of real per-post English titles.

English source extraction rule:

- Skip source-URL English extraction for Telegram/t.me hosts and let Agent 6 use
  LLM zh-to-en translation from the canonical Chinese article.
- Reject extracted English titles that equal `og:site_name`, contain too much
  CJK text, are too short, or have too few English words. A bad extracted title
  can poison English title uniqueness and keep valid Chinese articles from
  getting English siblings.

### News Source Timeout Policy

Durable lesson from the 2026-06-29 news-source handshake work:

- News-source HTTP connections should use a shared `NEWS_SOURCE_TIMEOUT` policy:
  30 seconds for connect/handshake and 35 seconds for read.
- Environment names are `NEWS_SOURCE_CONNECT_TIMEOUT_SECONDS` and
  `NEWS_SOURCE_READ_TIMEOUT_SECONDS`.
- The policy applies to upstream news data sources, including Agent 1 RSS
  collection, flash API/RSS channels, English source-page extraction,
  source-page `og:image` lookup, Google News benchmark RSS, and similar provider
  requests.
- RSS URLs should be fetched explicitly with `requests.get(...,
  timeout=NEWS_SOURCE_TIMEOUT)` and parsed from bytes/content. Do not rely on
  `feedparser.parse(url)` for network reads because that hides the handshake and
  read timeout.
- Finnhub WebSocket should stay aligned with the 30-35s window: handshake around
  35s, ping interval 35s, ping timeout 30s, and short-connection retry 35s.
- Keep Finnhub 429/rate-limit cooldowns longer than normal handshake retry
  values. Rate-limit backoff protects quota and should not be collapsed to 30s.
- Do not apply this policy blindly to LLM calls, SEO/public health probes,
  IndexNow, image search/download, or other non-news-source network operations.
- For lightweight helpers such as cover-image extraction, avoid importing
  `pipeline.config.settings` if that would introduce unrelated startup
  dependencies like `LLM_API_KEY`. Reuse the same env names locally when needed.

### Loop Engine And Feedback Queue

Loop Engine v1 was implemented from the "loop engineering" work on 2026-06-26.
It is a bounded feedback system, not an autonomous publisher.

System shape:

- GSC and other feedback signals are imported into Loop Engine tables.
- Scoring creates `content_opportunities`.
- Execution creates or queues low-risk `loop_actions`.
- Reports and admin views expose runs, opportunities, actions, and evidence.
- Agent 6 can read queued `translate_en_priority` actions to prioritize English
  localization, while still using the normal pipeline gates.

Core tables:

- `loop_runs`
- `seo_feedback_snapshots`
- `content_opportunities`
- `loop_actions`
- `loop_action_results`
- `loop_feedback_events`

Core scripts:

- `npm run loop:import-gsc`
- `npm run loop:score`
- `npm run loop:execute`
- `npm run loop:report`
- `npm run loop:fetch-gsc`
- `npm run loop:gsc`
- `npm run loop:import-ga4`
- `npm run loop:latest`
- `npm run loop:run`
- `npm run loop:import-feedback`
- `npm run verify:google-apis`

Guardrails:

- Safe action types are `translate_en_priority`, `meta_rewrite_draft`,
  `internal_link_draft`, `topic_brief_draft`, and `feedback_review_draft`.
- v1 must not directly change canonical URLs, robots/noindex, redirects,
  Nginx, published article bodies, or published metadata.
- CTR rewrite, internal-link, topic, and feedback-review actions are briefs or
  review tasks. Publishable text or SEO-signal changes still need explicit edits
  and the normal SEO verification path.
- Translation priority actions only affect Agent 6 ordering. Agent 6 must still
  check published status, deletion, indexability, existing English sibling,
  source URL dedupe, title/slug uniqueness, and DB insert guards.
- Agent 6 should mark consumed translation priorities as `consumed` and write
  success/failure evidence to `loop_action_results`.
- Do not put GA4, server logs, crawl errors, or sitemap quality data into GSC
  clicks/impressions columns. Use `loop_feedback_events` and
  `loop:import-feedback` for non-GSC feedback.
- GSC API exports should land in `seo_feedback_snapshots`. GA4 traffic exports
  should land in `loop_feedback_events`.
- Keep YayaNews-filtered GSC batches separate from parent-domain batches. The
  2026-07-03 domain-wide 14-day pull was only slightly larger than the YayaNews
  pull and mainly added `wheel.cryptooptiontool.com/en/`; it is auxiliary
  context, not the primary YayaNews dataset.
- GA4 import must aggregate duplicate event keys before upsert. The July 2026
  import showed repeated keys; a last-row-wins upsert can lose sessions and
  page views. Preserve raw row counts and aggregate counts as evidence.

Production rules:

- Apply `0012_create_loop_engine_tables.sql` before scheduled Loop Engine runs.
  Apply `0013_add_loop_feedback_events.sql` if generic feedback events are used.
- GSC API runs require either read access to
  `https://yayanews.cryptooptiontool.com/` or the current
  `sc-domain:cryptooptiontool.com` property plus
  `GSC_PAGE_FILTER_PREFIX=https://yayanews.cryptooptiontool.com/`.
- Supported credential paths include `GOOGLE_APPLICATION_CREDENTIALS`,
  `GSC_SERVICE_ACCOUNT_JSON`, `GSC_OAUTH_TOKEN_FILE`, or `GSC_ACCESS_TOKEN`;
  never commit credential JSON or tokens.
- Use explicit batch keys and date windows. GSC performance data can lag, so
  daily jobs should normally use a completed window such as yesterday or two
  days ago.
- Keep Loop Engine scheduling separate from deployment automation until live
  checks and rollback steps are explicitly wired.

### Review, Trust, And Tag Quality Hardening

Durable changes from 2026-06-22:

- `0010_add_article_audit_reason.sql` added `articles.audit_reason`.
- `db:backfill:review-metadata` was added for review metadata backfill checks.
- Article `NewsArticle` JSON-LD was strengthened with reviewer fallback and
  `sourceOrganization` handling.
- `0011_backfill_ascii_tag_name_en.sql` backfills `name_en` only when the tag
  name is already safe ASCII; do not machine-translate unknown tags.
- `verify:tag-quality` audits tag sitemap policy, thin noindex tag pages, dirty
  slugs, orphan tags, and English name gaps.
- Redirect regression now covers no-locale `/tag/*` behavior.
- GSC export analysis can emit a CTR optimization queue.

Operational rules:

- Do not invent reviewers for historical articles. Backfill only when approved
  audit evidence is reliable.
- Keep visible article source/risk/review fields and JSON-LD fields aligned.
- Thin tag pages should remain `noindex` and out of sitemap unless enough strong
  approved articles exist for the language.
- English news SEO is not solved by sitemap settings alone; it needs timely
  English article publication inside the News sitemap window.
- Preserve IndexNow and ownership verification files as public static assets.
- Keep `x-default` hreflang in the same mental checklist as canonical and
  language alternates.
- Do not use request time as sitemap freshness. `lastmod` must be derived from
  real content or route update data.
- When changing security headers, inspect both Nginx and `next.config.mjs` to
  avoid duplicate header values.

## Diagnostic Playbooks

### If The User Says "No Impressions" Or "GSC Still Shows Errors"

1. Confirm the correct GSC property and date range.
   - Check persisted `.env` Google API variables before asking the user to
     reconnect.
   - Prefer `npm run verify:google-apis`; if Node `v24.x` blocks npm scripts,
     run the direct Node verifier and label it as a workaround.
2. Check current production:
   - homepage,
   - `/zh/news`,
   - `/en`,
   - representative article URLs,
   - `robots.txt`,
   - `sitemap.xml`,
   - `sitemap-news.xml`,
   - sitemap chunk URLs.
3. Check page-level SEO:
   - status code,
   - canonical,
   - meta robots,
   - JSON-LD,
   - hreflang if relevant,
   - Googlebot-like UA.
4. Compare live facts with GSC report timestamps.
5. For Performance totals, use GSC page dimension as the primary count. Treat
   query/country/device gaps as Search Analytics filtering unless a fresher
   export proves otherwise.
6. Do not treat GA4 Direct sessions as organic traffic. Check GA4 channel/source
   rows, internal traffic rules, referrers, UTM tagging, and server logs.
7. If GSC is stale, say so clearly and give the exact dates.
8. If there is a live blocker, fix that first and add regression coverage.

### If The User Says "Sitemap Has Duplicates"

1. Identify duplicate type:
   - identical `<loc>`,
   - same slug,
   - same canonical,
   - same translation group,
   - same-language duplicate content.
2. Do not treat zh/en hreflang pairs as duplicates.
3. Keep count logic and chunk query logic aligned.
4. Add verification in `scripts/verify/seo-metadata-check.mjs` if sitemap logic
   changes.
5. For article sitemap pagination, require deterministic ordering. Avoid
   unstable chunk boundaries from timestamp ties.
6. For sitemap index freshness, verify `lastmod` uses content timestamps rather
   than request time.

### If The User Changes International SEO Metadata

1. Check canonical URL, `zh`, `en`, and `x-default` together.
2. Verify language alternates in page metadata and sitemap/hreflang output where
   applicable.
3. Do not collapse localized URLs into one URL solely to reduce sitemap count.

### If The User Changes Headers Or Nginx

1. Inspect both `apps/web/next.config.mjs` and Nginx configs.
2. Avoid duplicate security headers emitted by both layers.
3. For Cloudflare real-IP work, keep source/deploy Nginx configs identical and
   run `npm run verify:cloudflare-real-ip`.
4. Install production Nginx changes through
   `infra/scripts/install-yayanews-nginx.sh`, not by direct copy.
5. Re-run public health/SEO checks after deployment if header behavior affects
   crawlability or rendering.

### If The User Says "Online Broken"

1. Check current git/deploy state before editing.
2. Verify public health and PM2/known endpoints if remote access is available.
3. Separate local sandbox network failures from real production failures.
4. Use existing scripts:
   - `npm run ops:public-health`
   - `npm run verify:seo`
   - `npm run verify:redirects`
5. If deployment is needed, ask or confirm unless the user clearly requested it.

### If The User Asks For Fast Production Release

1. Confirm worktree state and exact files in scope.
2. Run targeted checks.
3. Commit intentionally.
4. Push branch/tag only when requested.
5. Watch GitHub Actions.
6. After deploy, verify public health and sitemap chunk URLs.

### If The User Asks For A Report, PRD, Or Handoff

1. Use the user's requested schema and labels exactly when provided.
2. Include evidence windows, owner/collaborator roles, input data, execution
   steps, QA checks, launch validation, and open data gaps.
3. For management reports, reduce operational noise and organize around goals,
   outputs, data-backed judgment, risks, and next actions.
4. For developer-facing docs, include fields, enums, mapping logic, route
   behavior, structured data, API/component examples, and test commands.
5. Date-version new reports unless the user explicitly asks to overwrite.

### If The User Asks About English SEO Or News Sitemap

1. Check whether the goal is English fresh-news SEO or selective evergreen
   English coverage.
2. Use current sitemap language split and News sitemap language split as
   evidence.
3. If fresh-news SEO is the goal, prioritize English localization speed and
   recent `/en/article/*` publication within the Google News window.
4. If evergreen coverage is the goal, prioritize durable explainers/topics over
   bulk translation of old low-demand articles.
5. If changing News sitemap selectivity, keep code caps and
   verifier caps aligned. Current deployed target caps are `48` URLs, `10` per
   topic/category, and `2` per normalized title prefix.

## Preferred Verification Commands

Run only what matches the blast radius:

```powershell
npm run check:node
npm run lint
npm run build:packages
npm run build:web
npm run build:admin
npm run db:migrate
npm run db:migrate:status
npm run ops:health
npm run ops:public-health
npm run verify:seo
npm run verify:redirects
npm run verify:article-slugs
npm run verify:gsc-export
npm run verify:google-apis
npm run verify:news-sitemap-policy
npm run verify:article-metadata-title
npm run verify:cloudflare-real-ip
npm run verify:nginx-traffic
npm run verify:tag-quality
```

Networked production checks may require Codex escalation because the workspace
sandbox blocks external requests.

## Response Style For This Project

Use Chinese when responding to the user unless they ask otherwise.

Current user preference is a warm, curious, collaborative engineering style:

- Keep execution moving and make decisions once enough context is available.
- State assumptions, prerequisites, evidence, tradeoffs, next steps, and
  blockers explicitly.
- Let responses feel present and human, with room for careful questions or light
  conversational texture when useful.
- Avoid vague, performative, or distracting warmth. Challenge weak technical
  assumptions when needed by explaining the reasoning and proposing a workable
  path.

Be direct with dates and evidence. For SEO/GSC issues, always name whether a
fact is:

- live production behavior,
- local code behavior,
- GSC historical report state,
- a hypothesis.

Avoid vague answers like "Google needs time" without giving the relevant GSC
timestamps, sampled URL results, and next observation window.

When a change is not needed, say so and explain the first-principles reason.

## Keep This Updated

Update this profile when:

- production architecture changes,
- deployment process changes,
- GSC state materially changes,
- major SEO decisions are reversed,
- new recurring incidents are diagnosed,
- a new migration or pipeline invariant becomes important.
