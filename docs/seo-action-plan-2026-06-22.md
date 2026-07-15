# YayaNews SEO Action Plan - 2026-06-22

## Basis

This plan is based on the rerun audit in:

```text
docs/seo-audit-2026-06-22-rerun.md
```

Current live evidence:

- Public health: pass
- Redirect regression: `24/24` pass
- SEO metadata check: `88/88` pass
- Sitemap URL probe: `100` sampled URLs pass
- Sitemap duplicate locs: `0`
- Full sitemap URLs: `6641`
- Language split: `zh=6526`, `en=115`
- News sitemap: `50` URLs, all `zh`
- Latest local GSC coverage export: `2026-06-18`
- Available GSC Page indexing data itself is stale at `2026-06-12`

## Diagnosis

The current problem is not a live whole-site crawl block. The production site is crawlable and indexable in live checks.

The remaining SEO problems are:

1. Google Search Console data lag and historical URL debt.
2. Weak English content footprint.
3. No English URLs in News sitemap.
4. Historical article trust JSON-LD is incomplete.
5. GSC-discovered URLs include old no-locale, flash-detail, mojibake/tag debt.
6. CTR/query-intent optimization cannot be done precisely without a fresh Performance export.

## Priority 1 - Get Fresh GSC Evidence

### Problem

The latest local GSC export is from `2026-06-18`, and its Page indexing snapshot was last updated by Google on `2026-06-12`. Multiple production fixes were deployed after that.

### Solution

Export fresh GSC data from the correct property:

```text
https://yayanews.cryptooptiontool.com/
```

Needed exports:

- Page indexing overview
- `Discovered - currently not indexed`
- `Crawled - currently not indexed`
- `Server error (5xx)` if still visible
- `Not found (404)` if still high
- Performance Pages, last 7 days and 28 days
- Performance Queries, last 7 days and 28 days

### Acceptance Criteria

- Fresh export date is after `2026-06-22`.
- We can separate historical debt from current live problems.
- Top pages/queries can be mapped for CTR work.

### Validation

```powershell
npm run verify:gsc-export -- <fresh-export-folder-or-zip> --output outputs/<date>/analysis.md
```

## Priority 2 - Verify And Backfill Reviewer Metadata

### Problem

Top News sitemap article samples have visible source/risk/review labels, but `NewsArticle` JSON-LD still has:

```text
reviewedBy: null
sourceOrganization: null
```

### Solution

1. Verify newly published articles after `v2026.06.22-seo4`.
2. Confirm Agent7 now writes `reviewer_id` and `reviewed_at`.
3. If new articles are correct, avoid another code change.
4. For historical articles, run a production-side dry-run to find safe backfill candidates.
5. Only backfill articles with a reliable approved audit signal.

### Acceptance Criteria

- Newly published reviewed articles expose `reviewedBy.name` in `NewsArticle` JSON-LD.
- Historical backfill updates only verified approved articles.
- Article pages continue to show visible source, date, risk disclosure, and reviewer labels.

### Validation

```powershell
npm run db:backfill:review-metadata -- --limit 100
```

Then sample top article pages and confirm JSON-LD.

## Priority 3 - Decide English News Sitemap Strategy

### Problem

News sitemap currently has:

```text
total=50
zh=50
en=0
```

Full sitemap also shows:

```text
zh=6526
en=115
```

### Solution

If English SEO is a goal:

- Reduce English localization delay for high-quality news articles.
- Publish English versions within the Google News time window.
- Keep English slugs ASCII-only.
- Ensure English articles have localized title, description, canonical, hreflang, author, source, risk and review metadata.

If English SEO is not a near-term goal:

- Keep English sitemap smaller but high quality.
- Prioritize evergreen explainers and high-demand topics over bulk translation.

### Acceptance Criteria

- If enabled, News sitemap starts including eligible recent `/en/article/*` URLs.
- English URLs remain canonical, 200, indexable, and not duplicated by translation-group collapse.

## Priority 4 - Clean Tag And Legacy URL Debt

### Problem

Current sitemap contains `304` tag URLs. Old GSC exports show tag and legacy URL debt:

- mojibake/non-ASCII tag URLs
- old no-locale `/tag/*`
- old no-locale `/article/*`
- stale flash-detail URLs

### Solution

1. Generate a tag quality report:
   - URL status
   - article count
   - canonical
   - noindex/index
   - sitemap inclusion
   - non-ASCII/mojibake detection
2. Keep only meaningful, clean, content-rich tags in sitemap.
3. Add redirects for old tag URLs only when a clean equivalent exists.
4. Use 410 or noindex for permanently unsupported legacy detail pages without a good replacement.
5. Keep flash details out of sitemap.

### Acceptance Criteria

- Tag sitemap contains only clean canonical tag URLs.
- GSC tag-related discovered/crawled not indexed examples decline after recrawl.
- Redirect regression covers important no-locale legacy paths.

## Priority 5 - Query-To-Page CTR Optimization

### Problem

Earlier Performance data showed impressions but very low clicks. Technical fixes alone will not solve CTR.

### Solution

After fresh Performance export:

1. Identify pages with:
   - impressions > 100
   - clicks = 0 or CTR < 1%
   - average position 1-10
2. Map each page to top queries.
3. Rewrite title/description to match query intent.
4. Improve first paragraph and summary block.
5. Add relevant internal links from hub/topic/channel pages.

### Acceptance Criteria

- Top 20 zero-click pages have query-mapped title/description revisions.
- CTR improves over the next 7-14 day GSC window.

## Priority 6 - Clarify Guide Sitemap Inclusion

### Problem

The SEO checker reported:

```text
guides:not-in-index
```

### Solution

- Check whether published guides exist.
- If guides are strategic evergreen pages, include them in sitemap.
- If no published guides exist, keep as-is.

### Acceptance Criteria

- Guide sitemap behavior matches product strategy.
- Published guide pages, if any, have canonical, hreflang, metadata and indexable sitemap entries.

## Execution Order

1. Fresh GSC exports.
2. Reviewer JSON-LD validation/backfill dry-run.
3. Tag quality audit and cleanup plan.
4. English News sitemap decision.
5. CTR optimization from fresh Performance data.
6. Guide sitemap decision.

## What Can Be Done Without More User Input

- Add a tag quality audit script.
- Add reviewer JSON-LD regression checks.
- Add a guide sitemap presence check.
- Run production live checks on schedule.
- Keep GitHub Issue SEO monitor active.

## What Requires New Data Or Decision

- Fresh GSC exports require access to current GSC UI/export.
- CTR optimization requires Performance Pages/Queries export.
- English News sitemap requires a product decision: grow English news now, or keep English as selective evergreen coverage.
