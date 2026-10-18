# YayaNews SEO Audit Rerun - 2026-06-22

## Executive Summary

本次复审基于 `v2026.06.22-seo4` 部署后的线上生产环境。

结论：当前没有发现全站级技术索引阻断。核心页面、robots、sitemap、News sitemap、验证文件、redirect、核心频道页、抽样文章页和 100 个 sitemap URL 线上检查均通过。

最重要的变化：

- 生产 sitemap 已无重复 URL：`6641` 个 `<loc>`，唯一 URL `6641`，重复 `0`。
- 扩展后的 SEO 检查通过：`88/88 checks OK`。
- redirect 回归通过：`24/24 checks OK`。
- News sitemap 当前 `50` 条，全部为中文近期文章。
- 最新可用本地 GSC 覆盖导出仍是 `2026-06-18`，Page Indexing 报告本身仍停在 `2026-06-12`，不能代表今天的实时线上状态。

当前剩余问题已经从“线上不可抓取”转为：

1. GSC 覆盖报告滞后，需要导出更新后的 Page indexing 和 Performance 数据再判断收录走势。
2. 英文内容覆盖远低于中文：sitemap 中 `zh=6526`、`en=115`。
3. News sitemap 顶部文章只有中文，若英文新闻 SEO 是目标，需要补近期英文新闻进入正常发布/News sitemap 节奏。
4. 抽样文章页面有可见信任字段，但历史文章的 `NewsArticle` JSON-LD 仍缺 `reviewedBy` 和 `sourceOrganization`。
5. GSC 历史债务仍包括 discovered/crawled not indexed、旧无语言前缀 URL、旧 flash 详情 URL、旧乱码 tag URL 等，需要等 Google 复爬，同时保持 redirect/noindex/sitemap 策略稳定。

## Scope

Production domain:

```text
https://yayanews.cryptooptiontool.com
```

Deployment baseline:

```text
Commit: f60a3bc fix: harden seo monitor and audit metadata
Tag: v2026.06.22-seo4
Deploy workflow: 27944072302, success
```

Audit evidence:

- Live production HTTP checks
- Googlebot-like UA response sampling
- Live sitemap and News sitemap parsing
- Live article `NewsArticle` JSON-LD sampling
- Existing local GSC exports from `2026-06-18`
- Repository verification scripts

Important limitation:

- No fresher local GSC export was found after `2026-06-18`.
- Current GSC Page indexing figures in the available export were last updated by Google on `2026-06-12`.
- Therefore GSC coverage numbers below are historical/backlog signals, not live production proof.

## Live Production Checks

### Public Health

Command:

```powershell
node scripts\ops\public-health.mjs
```

Result:

```text
OK / -> 308 -> /zh -> 200
OK /news -> 308 -> /zh/news -> 200
OK /zh -> 200
OK /en -> 200
OK /robots.txt -> 200
OK /sitemap.xml -> 200
OK /sitemap-news.xml -> 200
OK /brand/logo-square.png -> 200
OK /google557e7d124058718a.html -> 200
OK /db1162aa32014bba89ab29ba04a5ddba.txt -> 200
```

Interpretation:

- Core public endpoints are live.
- Google/Bing ownership verification files remain accessible.

### Redirect Regression

Command:

```powershell
node scripts\verify\redirect-regression.mjs --base https://yayanews.cryptooptiontool.com --fetch-timeout-ms 30000
```

Result:

```text
Redirect regression check passed: 24/24 checks OK.
```

Coverage includes:

- `/` to `/zh`
- `/news` to `/zh/news`
- English Accept-Language and locale cookie
- `/zh/category/us-stock` to `/zh/news/us-stock`
- `/en/category/crypto` to `/en/news/crypto`
- no-locale article/flash legacy paths
- verification files
- sitemap and News sitemap

Interpretation:

- No current redirect regression was reproduced.
- The earlier transient `/en/news/crypto` 500 did not reproduce after rerun and deploy.

### SEO Metadata And Sitemap Probe

Command:

```powershell
node scripts\verify\seo-metadata-check.mjs `
  --base https://yayanews.cryptooptiontool.com `
  --expected-origin https://yayanews.cryptooptiontool.com `
  --sample-article-urls 10 `
  --probe-sitemap-urls 100 `
  --sample-sitemap-kinds authors:5,topics:5,tags:10,guides:3 `
  --check-concurrency 3 `
  --fetch-timeout-ms 30000
```

Result:

```text
SEO metadata check passed: 88/88 checks OK.
OK sitemap URL probe (100 URLs)
OK sitemap duplicate loc check
```

Coverage includes:

- Root redirects
- `/zh`, `/en`
- `/zh/news`, `/en/news`
- All core news channels in zh/en:
  - `us-stock`
  - `hk-stock`
  - `derivatives`
  - `crypto`
  - `ai`
  - `other`
- flash, markets, topics, authors, guide
- static trust/legal pages
- search noindex pages
- OG default image
- robots, RSS, sitemap index, sitemap chunk, News sitemap
- 10 sampled article URLs from News/article sitemaps
- sampled author/topic/tag long-tail pages

Guides note:

```text
Skipped sitemap kinds: guides:not-in-index
```

This means the sitemap index currently did not expose a `guides` chunk during sampling. If guide pages are intended as SEO assets, this deserves a small follow-up check.

## Robots And Crawl Directives

`robots.txt` currently returns `200` and contains:

```text
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /*/search

User-Agent: Googlebot-News
Allow: /

Sitemap: https://yayanews.cryptooptiontool.com/sitemap.xml
Sitemap: https://yayanews.cryptooptiontool.com/sitemap-news.xml
```

Googlebot-like UA sampling:

| Path | Status | Content-Type | Cache-Control |
| --- | ---: | --- | --- |
| `/` | 308 | n/a | n/a |
| `/zh` | 200 | `text/html; charset=utf-8` | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| `/en` | 200 | `text/html; charset=utf-8` | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| `/zh/news` | 200 | `text/html; charset=utf-8` | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| `/en/news/crypto` | 200 | `text/html; charset=utf-8` | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| `/sitemap.xml` | 200 | `application/xml; charset=utf-8` | `public, max-age=3600, s-maxage=3600, stale-while-revalidate=600` |
| `/sitemap-news.xml` | 200 | `application/xml; charset=utf-8` | `public, max-age=300, s-maxage=300, stale-while-revalidate=600` |
| `/robots.txt` | 200 | `text/plain` | `public, max-age=86400, stale-while-revalidate=3600` |

Interpretation:

- No robots-level block for public pages.
- Search pages are intentionally blocked/noindex-style surfaces.
- Googlebot-News is allowed.
- Sitemaps are declared correctly.

## Sitemap Audit

Live sitemap index:

```text
Sitemap chunks: 12
Total locs: 6641
Unique locs: 6641
Duplicate locs: 0
```

Chunk distribution:

| Chunk | URL Count |
| --- | ---: |
| `/sitemap-chunk/static/0` | 30 |
| `/sitemap-chunk/categories/0` | 8 |
| `/sitemap-chunk/authors/0` | 10 |
| `/sitemap-chunk/articles/0` | 1000 |
| `/sitemap-chunk/articles/1` | 1000 |
| `/sitemap-chunk/articles/2` | 1000 |
| `/sitemap-chunk/articles/3` | 1000 |
| `/sitemap-chunk/articles/4` | 1000 |
| `/sitemap-chunk/articles/5` | 1000 |
| `/sitemap-chunk/articles/6` | 270 |
| `/sitemap-chunk/topics/0` | 19 |
| `/sitemap-chunk/tags/0` | 304 |

Language distribution:

| Language | URL Count |
| --- | ---: |
| zh | 6526 |
| en | 115 |

Route distribution:

| Route Type | URL Count |
| --- | ---: |
| article | 6270 |
| tag | 304 |
| topics | 21 |
| authors | 12 |
| news category | 10 |
| flash list | 2 |
| markets | 2 |
| trust/legal/static | 18 |
| root locale pages | 2 |

Interpretation:

- The earlier exact duplicate sitemap URL issue is fixed.
- Article sitemap pagination is stable enough in current live parse.
- The site is heavily Chinese-weighted. This is fine if Chinese SEO is primary; it is a gap if bilingual/English SEO growth is a target.
- Tag pages are a meaningful chunk (`304`). Because old GSC exports had tag/mojibake issues, tag quality/indexability should remain under watch.

## News Sitemap Audit

Live News sitemap:

```text
News sitemap URLs: 50
zh: 50
en: 0
```

Top sampled URLs are recent Chinese article detail pages such as:

```text
/zh/article/tong-jie-biao-sheng-zhi-li-shi-xin-gao-gong-xu-que-kou-kuo-da-yu-lu-se-zhuan-xing-qu-don
/zh/article/heng-zhi-zhen-dang-shou-zhang-teng-xun-a-li-ling-zhang-ke-ji-ban-kuai-gang-gu-fan-dan-do
/zh/article/zhong-dong-ju-shi-rao-dong-gong-ying-yu-qi-yuan-you-qi-huo-bo-dong-lu-ji-zeng-ji-jiao-yi
```

Interpretation:

- News sitemap is current and crawlable.
- Flash detail pages are not in News sitemap, matching the current strategy.
- If English Google News/news SEO is desired, the current publication/localization cadence is not feeding English URLs into News sitemap.

## Article Trust And JSON-LD Sampling

Sample: top 5 News sitemap article URLs.

All sampled article pages returned:

- HTTP `200`
- `NewsArticle` JSON-LD present
- `headline` present
- `author`: `YayaNews`
- `publisher`: `Yaya Financial News`
- `datePublished` present
- `dateModified` present
- visible source label present
- visible risk/disclaimer text present
- visible reviewed label present

Observed gaps in sampled JSON-LD:

```text
reviewedBy: null
sourceOrganization: null
```

Interpretation:

- The visible article trust block is present.
- Historical top News sitemap articles still do not expose reviewer/source organization inside JSON-LD.
- The `v2026.06.22-seo3` and `v2026.06.22-seo4` changes should improve future article reviewer metadata, but older articles may require a safe production backfill and another validation run.

Acceptance criteria for follow-up:

- Recent newly published articles should show `reviewedBy.name` in `NewsArticle` JSON-LD when `reviewer_id/reviewed_at` exists.
- If an article has a third-party source with `author_profile`/source profile, JSON-LD should expose the source entity consistently where schema supports it.

## GSC Coverage Data

Latest local export found:

```text
outputs/gsc-coverage-2026-06-18
outputs/gsc-coverage-2026-06-18-discovered
outputs/gsc-coverage-2026-06-18-crawled
```

Page indexing snapshot in that export:

```text
Last update: 2026-06-12
Indexed pages: 1377
Not indexed pages: 9516
```

Reason breakdown:

| Reason | Source | Validation | Pages |
| --- | --- | --- | ---: |
| Blocked by robots.txt | Website | Not Started | 4 |
| Duplicate without user-selected canonical | Website | Not Started | 1 |
| Not found (404) | Website | Started | 2287 |
| Excluded by noindex tag | Website | Started | 1134 |
| Page with redirect | Website | Started | 822 |
| Server error (5xx) | Website | Started | 805 |
| Discovered - currently not indexed | Google systems | Started | 4290 |
| Crawled - currently not indexed | Google systems | Started | 173 |

Important interpretation:

- These numbers are stale and predate multiple fixes deployed after `2026-06-14`.
- Live production checks did not reproduce the `805` 5xx bucket.
- The bucket should still be monitored after GSC updates past the deployed fixes.

### Discovered - Currently Not Indexed

Exported rows: `1000`.

GSC affected count: `4290`.

URL kind distribution in exported examples:

| URL Kind | Count |
| --- | ---: |
| article-detail | 908 |
| tag-detail | 72 |
| topic-detail | 8 |
| unknown/list/static | 12 |

Language prefix:

| Prefix | Count |
| --- | ---: |
| zh | 943 |
| en | 57 |

Signals:

| Signal | Count |
| --- | ---: |
| non-ascii-or-mojibake-url | 22 |
| english-detail-slug-review | 10 |
| unknown-route | 5 |

Interpretation:

- This is mostly discovery without crawl (`Last crawled = N/A` in the export), not pages being crawled and rejected.
- Main lever is crawl prioritization and URL quality, not another broad technical unblock.

### Crawled - Currently Not Indexed

Exported rows: `173`.

URL kind distribution:

| URL Kind | Count |
| --- | ---: |
| article-detail | 150 |
| tag-detail | 10 |
| flash-detail | 8 |
| topic/detail/list/home/news | 5 |

Language prefix:

| Prefix | Count |
| --- | ---: |
| zh | 131 |
| missing locale prefix | 31 |
| en | 11 |

Signals:

| Signal | Count |
| --- | ---: |
| legacy-no-locale | 31 |
| non-ascii-or-mojibake-url | 11 |
| flash-detail | 8 |
| english-detail-slug-review | 1 |

Interpretation:

- Smaller bucket than Discovered.
- Contains old no-locale paths such as `/article/*`, `/tag/*`, and stale flash detail URLs.
- These are expected to age out if redirects/noindex/sitemap stay stable.

## Findings

### P0 - No Current Whole-Site Technical Blocker Found

Evidence:

- Public health passed.
- Redirect regression passed.
- SEO metadata check passed.
- sitemap duplicate check passed.
- Googlebot-like UA can fetch public HTML and XML resources.

Action:

- No emergency crawl-block fix required.
- Continue post-deploy monitoring and GSC validation.

### P1 - Fresh GSC Export Is Required Before Diagnosing Current Indexing Trend

Problem:

- Available GSC Page indexing data is stale (`Last update: 2026-06-12`).
- Multiple major fixes were deployed after that date.

Impact:

- We cannot safely conclude from the old `5xx`, `404`, or discovered backlog that those are live production failures today.

Action:

- Export current GSC Page indexing overview.
- Export current drilldowns for:
  - `Discovered - currently not indexed`
  - `Crawled - currently not indexed`
  - `Server error (5xx)` if still present
  - `Not found (404)` if still high
- Export GSC Performance Pages and Queries for the last 7/28 days.

Validation:

```powershell
npm run verify:gsc-export -- <fresh-export-folder-or-zip> --output outputs/<date>/analysis.md
```

### P1 - Historical Articles Lack Reviewer JSON-LD

Problem:

- Top 5 News sitemap sampled articles show visible reviewed labels, but `reviewedBy` is null in `NewsArticle` JSON-LD.

Impact:

- Trust/compliance signals are weaker than they could be for Google News-like evaluation and finance YMYL-style content quality.

Likely cause:

- Historical rows do not have `reviewer_id/reviewed_at` populated, while future Agent7 flow was only recently fixed.

Action:

- Verify the next newly published articles after `v2026.06.22-seo3/seo4`.
- If new articles contain reviewer DB fields, no code change is needed for future content.
- For historical articles, run a safe production-side dry-run/backfill only when there is a reliable approved audit signal.

Acceptance criteria:

- New reviewed articles expose `reviewedBy.name` in `NewsArticle` JSON-LD.
- Sampled article pages show author, publisher, published/modified dates, source, risk disclosure, and reviewer consistently.

### P1 - News Sitemap Currently Has No English URLs

Problem:

- News sitemap has `50` URLs, all `zh`.

Impact:

- English fresh-news discovery is weak if English SEO/Google News coverage is an active goal.

Action:

- Decide whether English News sitemap inclusion is required.
- If yes, reduce translation/localization delay and ensure qualifying recent English article pages are published within the News sitemap time window.

Acceptance criteria:

- News sitemap includes eligible recent English article URLs when English content is published within the Google News window.

### P2 - English Sitemap Coverage Is Very Small

Problem:

- Full sitemap language split: `zh=6526`, `en=115`.

Impact:

- English organic growth ceiling is low regardless of technical crawlability.

Action:

- Continue English slug policy enforcement.
- Backfill English versions only for articles/topics that have durable search demand.
- Prioritize English evergreen explainers and topic pages rather than bulk-translating thin/old articles.

Acceptance criteria:

- English sitemap count grows through indexable, canonical, non-duplicate content.
- English pages maintain ASCII slugs and localized metadata.

### P2 - Tag Pages Need Ongoing Quality Control

Problem:

- Sitemap contains `304` tag URLs.
- Old GSC exports show tag-detail examples with non-ASCII/mojibake URLs.

Impact:

- Weak or malformed tag pages can waste crawl budget and contribute to discovered/crawled not indexed buckets.

Current evidence:

- Current sampled tag pages passed SEO checks.
- No current duplicate sitemap locs.

Action:

- Keep high-value tags indexable.
- Consider noindex or removal from sitemap for low-volume/thin/garbled legacy tags.
- Preserve redirects where old tag URLs have equivalents.

Acceptance criteria:

- Tag sitemap only contains meaningful, clean, canonical tag URLs.
- GSC tag-related discovered/crawled not indexed examples trend down after recrawl.

### P2 - CTR/Query Intent Optimization Still Needs Fresh Performance Export

Problem:

- Earlier GSC Performance evidence showed impressions but very low clicks.
- No fresh Performance export was found during this rerun.

Impact:

- If pages are ranking but not clicked, technical crawl fixes alone will not grow traffic.

Action:

- Export Performance Pages and Queries.
- Map top zero-click pages to their top queries.
- Rewrite titles/descriptions for query intent where appropriate.
- Improve above-the-fold article summaries for top-impression pages.

Acceptance criteria:

- Top high-impression/zero-click pages show CTR improvement over the next 7-14 days.

### P3 - Guides Sitemap Presence Should Be Clarified

Observation:

- SEO checker skipped guide sampling because guides were not in sitemap index: `guides:not-in-index`.

Impact:

- Low if guide pages are not currently strategic.
- Medium if guide pages are intended evergreen acquisition pages.

Action:

- Check whether published guides exist.
- If yes, include guide sitemap chunk and verify guide detail metadata.

## Recommended Next Batch

1. Get fresh GSC exports.
   Priority: highest, because current GSC coverage data is stale.

2. Validate new article reviewer JSON-LD after the next pipeline publish.
   Priority: high, because trust/compliance fields matter for finance news.

3. Decide English News sitemap strategy.
   Priority: high if English SEO is a goal; otherwise medium.

4. Audit tag sitemap quality.
   Priority: medium, because tag pages are a sizable sitemap slice.

5. Start query-to-page CTR optimization from fresh Performance data.
   Priority: medium-high once data is available.

## Verification Commands Used

```powershell
node scripts\ops\public-health.mjs
node scripts\verify\redirect-regression.mjs --base https://yayanews.cryptooptiontool.com --fetch-timeout-ms 30000
node scripts\verify\seo-metadata-check.mjs --base https://yayanews.cryptooptiontool.com --expected-origin https://yayanews.cryptooptiontool.com --sample-article-urls 10 --probe-sitemap-urls 100 --sample-sitemap-kinds authors:5,topics:5,tags:10,guides:3 --check-concurrency 3 --fetch-timeout-ms 30000
```

## Current Status

No new code changes were made by this audit report.

Current live SEO status:

```text
Core crawlability: PASS
Redirects: PASS
Sitemap duplicate locs: PASS
News sitemap availability: PASS
Article JSON-LD basic presence: PASS
Historical reviewer JSON-LD completeness: NEEDS FOLLOW-UP
Fresh GSC evidence: NEEDS EXPORT
```
