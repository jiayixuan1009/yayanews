# YayaNews SEO / GSC / GA Audit - 2026-07-03 API Refresh

## 结论

`https://yayanews.cryptooptiontool.com/` 不是因为“项目里没有地方放
sitemap”而不展现。项目使用 Next.js 动态 sitemap 路由，线上也能正常访问，
GSC 覆盖率导出已经识别主 sitemap 和 News sitemap。

最新 API 数据显示，当前问题更准确地分成四类：

1. **Google 已经能看到站点，但搜索曝光仍很低。** GSC Search Analytics
   API 在 `2026-06-04` 到 `2026-07-01` 页面维度记录 `98` 次展现、`0`
   次点击；最近 7 天 `2026-06-25` 到 `2026-07-01` 为 `47` 次展现、`0`
   次点击。
2. **GA4 流量不是搜索流量。** GA4 API 同期记录 YayaNews 主机 `11,272`
   sessions / `11,376` screen page views，但渠道拆分几乎全是 Direct，没有
   Organic Search 行；所以 GA4 访问量不能解释为 Google 自然搜索带来的点击。
3. **Page indexing 仍然是旧口径。** GSC 覆盖率导出的最后图表日期仍是
   `2026-06-12`，用于判断历史索引债务，不代表 2026-07-03 的实时线上状态。
4. **News sitemap 需要更克制。** 线上 News sitemap 可访问，但近期 URL
   集中在少数相似标题/主题。已在代码中把 News sitemap 收窄并增加分散度，
   目标是让 Google News/新闻发现入口更像精选新鲜新闻，而不是批量相似页。

## 数据来源

API 拉取时间：

- GSC API 页面/查询：`2026-07-03T10:51Z`
- GA4 API 流量导入：`2026-07-03T10:52Z`
- GA4 API 渠道/来源/国家/设备：`2026-07-03T10:57Z`
- GSC API 国家/设备尝试：`2026-07-03T11:01Z`

本地证据目录：

- `outputs/api-audit-2026-07-03/gsc-28d/`
- `outputs/api-audit-2026-07-03/gsc-7d/`
- `outputs/api-audit-2026-07-03/ga4-28d/`
- `outputs/api-audit-2026-07-03/ga4-7d/`
- `outputs/api-audit-2026-07-03/ga4-acquisition.json`
- `outputs/api-audit-2026-07-03/gsc-breakdowns.json`

手动 GSC 导出仍作为覆盖率证据保留：

- `outputs/gsc-exports-2026-07-03-read-20260703171332/`

注意：GSC API 的页面维度、查询维度、国家/设备维度不会完全相加。低量查询和
匿名化会让查询、国家、设备维度显著低于页面维度。因此本报告用 **页面维度**
作为 GSC Performance 总量口径，用查询维度只看可见关键词机会。

## API 连通性

已验证 `.env` 中的 GA4/GSC OAuth 配置可用。

连接检查窗口：

- `2026-06-25` 到 `2026-07-01`

检查结果：

- GA4：OK，property `529230739`
- GSC：OK，使用 `sc-domain:cryptooptiontool.com`
- GSC 页面过滤：`https://yayanews.cryptooptiontool.com/`
- GSC 检查样本：`9` 个页面行，`47` impressions，`0` clicks

这说明当前可以通过父级 Domain property + YayaNews 页面前缀稳定读取
YayaNews 的 Search Analytics 数据。

## GSC Search Performance

### 28 天窗口

日期窗口：`2026-06-04` 到 `2026-07-01`

页面维度总量：

| Metric | Value |
| --- | ---: |
| Page rows | 24 |
| Clicks | 0 |
| Impressions | 98 |
| CTR | 0% |
| Weighted average position | 18.59 |

Top pages:

| Page | Clicks | Impressions | Position |
| --- | ---: | ---: | ---: |
| `/zh/article/yuan-you-qi-huo-qu-xian-dou-qiao-hua-fen-xi-gong-xu-bo-yi-ru-he-tui-dong-yuan-qi` | 0 | 56 | 2.18 |
| `/en/article/hedging-strategies-amid-extreme-copper-price-volatility-a-deep-dive-into-futures` | 0 | 16 | 94.56 |
| `/en/article/monero-xmr-prices-rocket-33-to-438-amid-120-million-onchain-laundering-maze` | 0 | 2 | 8 |
| `/zh/article/bi-an-2026nian-4yue-14ri-geng-xin-zi-chan-biao-qian-farm-highdeng-qi-dai-bi-xin-1` | 0 | 2 | 7 |
| `/zh/article/shen-du-jie-du-mei-lian-chu-jue-yi-qian-biao-pu-500yu-dao-zhi-zou-shi-fen-hua-ke` | 0 | 2 | 2 |
| `/en/article/bitcoin-options-traders-brace-for-pivotal-10-6-billion-june-expiry` | 0 | 2 | 8 |

页面类型拆分：

| Segment | Impressions |
| --- | ---: |
| zh article | 65 |
| en article | 21 |
| zh tag | 5 |
| en topic detail | 3 |
| legacy no-locale article | 1 |
| en home | 1 |
| zh topics index | 1 |
| zh topic detail | 1 |

可见查询只有 2 个：

| Query | Clicks | Impressions | Position |
| --- | ---: | ---: | ---: |
| `copper price volatility` | 0 | 16 | 94.56 |
| `壳牌 加油 站` | 0 | 1 | 38 |

### 最近 7 天窗口

日期窗口：`2026-06-25` 到 `2026-07-01`

页面维度总量：

| Metric | Value |
| --- | ---: |
| Page rows | 9 |
| Clicks | 0 |
| Impressions | 47 |
| CTR | 0% |
| Weighted average position | 30.38 |

Top pages:

| Page | Clicks | Impressions | Position |
| --- | ---: | ---: | ---: |
| `/zh/article/yuan-you-qi-huo-qu-xian-dou-qiao-hua-fen-xi-gong-xu-bo-yi-ru-he-tui-dong-yuan-qi` | 0 | 23 | 1.87 |
| `/en/article/hedging-strategies-amid-extreme-copper-price-volatility-a-deep-dive-into-futures` | 0 | 14 | 94.29 |
| `/zh/article/shen-du-jie-du-mei-lian-chu-jue-yi-qian-biao-pu-500yu-dao-zhi-zou-shi-fen-hua-ke` | 0 | 2 | 2 |
| `/en/article/monero-xmr-prices-rocket-33-to-438-amid-120-million-onchain-laundering-maze` | 0 | 2 | 8 |
| `/en/article/bitcoin-options-traders-brace-for-pivotal-10-6-billion-june-expiry` | 0 | 2 | 8 |

可见查询：

| Query | Clicks | Impressions | Position |
| --- | ---: | ---: | ---: |
| `copper price volatility` | 0 | 14 | 94.29 |

### GSC 解释

- 站点不是完全没有展现；它已经在 Search Analytics 中出现。
- 点击为 0 的核心原因不是 sitemap 缺失，而是曝光规模太小、可见查询太少、
  以及少数曝光页的标题/摘要没有拿到点击。
- 最高曝光中文文章 28 天 `56` impressions，平均位置 `2.18`，仍然 0 点击。
  这是最优先的 CTR/snippet 审查对象。
- 英文页面已有少量曝光，但主要英文查询 `copper price volatility` 平均位置在
  90 名以后，说明英文内容 footprint 和主题权威仍弱。

## GA4 API Traffic

### 28 天窗口

日期窗口：`2026-06-04` 到 `2026-07-01`

GA4 event import 总量：

| Metric | Value |
| --- | ---: |
| Total sessions | 11,280 |
| Total screen page views | 11,384 |
| YayaNews host sessions | 11,272 |
| YayaNews host screen page views | 11,376 |
| Other `cryptooptiontool.com` sessions | 8 |

渠道/来源，host filter = `yayanews.cryptooptiontool.com`：

| Channel / source | Sessions | Active users | Screen page views |
| --- | ---: | ---: | ---: |
| Direct / `(direct) / (none)` | 11,162 | 11,154 | 11,271 |
| Organic Social / `t.co / referral` | 12 | 3 | 102 |
| Unassigned / `(not set)` | 8 | 8 | 3 |

国家和设备：

| Dimension | Top values |
| --- | --- |
| Country | Singapore `9,635`, China `1,516`, then small single-digit countries |
| Device | desktop `11,178`, mobile `9` |

### 最近 7 天窗口

日期窗口：`2026-06-25` 到 `2026-07-01`

GA4 event import 总量：

| Metric | Value |
| --- | ---: |
| Total sessions | 9,252 |
| Total screen page views | 9,348 |
| YayaNews host sessions | 9,252 |
| YayaNews host screen page views | 9,348 |

渠道/来源，host filter = `yayanews.cryptooptiontool.com`：

| Channel / source | Sessions | Active users | Screen page views |
| --- | ---: | ---: | ---: |
| Direct / `(direct) / (none)` | 9,152 | 9,131 | 9,249 |
| Organic Social / `t.co / referral` | 7 | 1 | 96 |
| Unassigned / `(not set)` | 7 | 7 | 3 |

国家和设备：

| Dimension | Top values |
| --- | --- |
| Country | Singapore `8,397`, China `788`, then small single-digit countries |
| Device | desktop `9,162`, mobile `7` |

### GA4 解释

- GA4 没有返回 Organic Search 行，和 GSC `0` clicks 一致。
- GA4 的访问集中在 Direct、Singapore、desktop，且 sessions 接近 active
  users，page views 接近 sessions。这不像自然搜索增长，更像直接访问、内部/
  自动化流量、监控、爬虫或未标记推广入口。
- GA4 页面报表使用 `--page-limit 5000`，因此页面类型拆分只代表已拉取的前
  5000 行，不能当作全站完整页面分布。
- 后续需要用服务器访问日志、GA4 internal traffic rules、referrer/UTM
  标记来确认这批 Direct 流量的真实来源。

## Coverage Export

GSC Page indexing / Coverage 没有等价的 Search Analytics API 输出，本节仍来自
2026-07-03 手动导出的覆盖率文件。

导出的 Page indexing 图表仍然滞后：

- Last chart date: `2026-06-12`

All known pages:

| Metric | Count |
| --- | ---: |
| Indexed | 1,377 |
| Not indexed | 9,516 |

Top reasons:

| Reason | Pages |
| --- | ---: |
| Discovered - currently not indexed | 4,290 |
| Not found (404) | 2,287 |
| Excluded by noindex tag | 1,134 |
| Page with redirect | 822 |
| Server error (5xx) | 805 |
| Crawled - currently not indexed | 173 |

Submitted News sitemap:

| Metric | Count |
| --- | ---: |
| Indexed | 2 |
| Not indexed | 221 |
| Main reason | Discovered - currently not indexed |

Submitted main sitemap:

| Metric | Count |
| --- | ---: |
| Indexed | 1,296 |
| Not indexed | 4,645 |

Main sitemap reasons:

| Reason | Pages |
| --- | ---: |
| Discovered - currently not indexed | 4,290 |
| Server error (5xx) | 139 |
| Crawled - currently not indexed | 126 |
| Excluded by noindex tag | 77 |
| Not found (404) | 12 |
| Duplicate without user-selected canonical | 1 |

解释：

- GSC 已识别提交的主 sitemap 和 News sitemap。
- 提交 sitemap 内最主要的问题是 `Discovered - currently not indexed`，也就是
  Google 知道 URL，但抓取/索引优先级不足。
- `5xx`、`404`、`noindex`、redirect 桶里有大量历史债务。需要等 Page
  indexing 的 `Last update` 超过新部署日期后，再重新导出 drilldown 判断哪些
  仍是当前问题。

## Sitemap And Live Crawlability

项目没有静态 `public/sitemap.xml`。当前 sitemap 是动态路由：

- Main sitemap index: `apps/web/src/app/sitemap.xml/route.ts`
- News sitemap: `apps/web/src/app/sitemap-news.xml/route.ts`
- Sitemap chunks: `apps/web/src/app/sitemap-chunk/[kind]/[page]/route.ts`
- Robots sitemap declarations: `apps/web/src/app/robots.ts`

线上 URL：

- `https://yayanews.cryptooptiontool.com/sitemap.xml`
- `https://yayanews.cryptooptiontool.com/sitemap-news.xml`

2026-07-03 live checks before code change:

- Public health check: key public endpoints OK.
- Live SEO metadata check: `72/72` OK.
- Main sitemap: `10,584` URLs, `10,584` unique URLs, duplicate URL count `0`.
- News sitemap: `61` URLs, all `zh-cn`.
- Googlebot-like article sample: `200 OK`。

Live News sitemap title concentration:

| Prefix | Count |
| --- | ---: |
| 恒指失守 | 7 |
| 黄金期货 | 6 |
| 黄金期权 | 5 |
| 地缘风险 | 3 |
| 港股恒指 | 3 |
| 中东局势 | 3 |
| 铜价飙升 | 3 |

## Code Changes Made

已把 News sitemap 从“较宽的新闻列表”收窄为更精选的发现入口：

- `apps/web/src/app/sitemap-news.xml/route.ts`
  - `MAX_NEWS_SITEMAP_ITEMS`: `100` -> `48`
  - `MAX_ITEMS_PER_TOPIC`: `24` -> `10`
  - `MAX_ITEMS_PER_TITLE_PREFIX`: `3` -> `2`
- `apps/web/src/lib/queries.ts`
  - 在 `getNewsArticlesForNewsSitemap()` 中增加 `c.slug as category_slug`，
    让 sitemap 分散策略可以使用稳定 category slug。
- `scripts/verify/seo-metadata-check.mjs`
  - 把 News sitemap 校验阈值同步到新策略。

预期部署后：

- `/sitemap-news.xml` URL 数量 `<= 48`。
- 任一检测到的 topic `<= 10` 条。
- 任一标准化标题前缀 `<= 2` 条。
- News sitemap 看起来更像精选新闻入口，而不是同模板金融文章批次。

## URL Inspection Priority List

先检查这些 URL，区分 indexed-no-click、discovered-not-crawled、legacy redirect
和 crawled-not-indexed。

High-impression, zero-click pages:

1. `https://yayanews.cryptooptiontool.com/zh/article/yuan-you-qi-huo-qu-xian-dou-qiao-hua-fen-xi-gong-xu-bo-yi-ru-he-tui-dong-yuan-qi`
2. `https://yayanews.cryptooptiontool.com/en/article/hedging-strategies-amid-extreme-copper-price-volatility-a-deep-dive-into-futures`
3. `https://yayanews.cryptooptiontool.com/zh/article/shen-du-jie-du-mei-lian-chu-jue-yi-qian-biao-pu-500yu-dao-zhi-zou-shi-fen-hua-ke`

Fresh News sitemap samples:

1. `https://yayanews.cryptooptiontool.com/zh/article/guo-ji-jin-jie-zai-chuang-xin-gao-huang-jin-qi-quan-yin-han-bo-dong-lu-biao-sheng-yan-sh`
2. `https://yayanews.cryptooptiontool.com/zh/article/heng-zhi-shi-shou-liang-mo-dian-da-guan-teng-xun-a-li-ling-die-ke-ji-ban-kuai-gang-gu-ho`
3. `https://yayanews.cryptooptiontool.com/zh/article/huang-jin-qi-quan-chi-cang-ji-zeng-mei-lian-chu-jiang-xi-yu-qi-yu-di-yuan-feng-xian-xia`
4. `https://yayanews.cryptooptiontool.com/zh/article/heng-zhi-shi-shou-er-mo-dian-guan-kou-teng-xun-a-li-ling-die-tuo-lei-gang-gu-shi-chang-f`

Legacy URL from Performance:

1. `https://yayanews.cryptooptiontool.com/article/bi-te-bi-etfzi-jin-lian-xu-san-ri-jing-liu-chu-shi-chang-qing-xu-zhuan-xiang-jin`

Live check on the legacy URL:

- Current behavior: `308` to `/zh/article/...`, then `200 OK`.
- Interpretation: likely historical URL debt, not a current broken page.

## Action Plan

Priority 1 - deploy and validate sitemap change:

- Deploy the News sitemap selectivity change.
- Fetch `https://yayanews.cryptooptiontool.com/sitemap-news.xml`.
- Confirm URL count `<= 48`, topic count `<= 10`, normalized prefix count `<= 2`.
- Re-run live SEO metadata check against production after deployment.

Priority 2 - resubmit and inspect:

- In GSC, resubmit:
  - `https://yayanews.cryptooptiontool.com/sitemap.xml`
  - `https://yayanews.cryptooptiontool.com/sitemap-news.xml`
- Use URL Inspection on the high-impression zero-click URLs and fresh News
  sitemap samples listed above.
- Do not re-export Coverage as “new truth” until Page indexing `Last update`
  moves later than the deployment date.

Priority 3 - CTR review for the only meaningful current SERP opportunity:

- Review title, meta description, H1, intro paragraph, visible source/trust
  fields, and structured data for the `56`-impression Chinese article.
- Acceptance criterion: next 7-14 day GSC window shows at least one click or a
  measurable CTR/position improvement for that URL.

Priority 4 - GA4 traffic quality:

- Add or confirm GA4 internal traffic filters for office/server/monitoring IPs.
- Add UTM tagging for X/Twitter and any manual promotion channels.
- Compare server logs for `2026-06-25` to `2026-07-01` against GA4 Direct
  traffic, especially Singapore desktop traffic.
- Treat GA4 Direct sessions as traffic-quality evidence, not SEO success, until
  source is verified.

Priority 5 - content/indexing quality:

- Keep English growth framed as a footprint and authority problem: current GSC
  English exposure exists but ranks poorly.
- For `Discovered - currently not indexed`, use a smaller sitemap surface,
  stronger internal links, and higher-trust article pages rather than simply
  publishing more thin URLs.
- For historical `404`/`5xx`/redirect buckets, wait for fresh Coverage drilldown
  before changing redirects or noindex policy.

## Validation Commands

After deployment, run:

```text
node scripts/verify/seo-metadata-check.mjs --base https://yayanews.cryptooptiontool.com --expected-origin https://yayanews.cryptooptiontool.com --sample-article-urls 5 --probe-sitemap-urls 20 --sample-sitemap-kinds authors:2,topics:2,tags:5,guides:2 --check-concurrency 3 --fetch-timeout-ms 30000
```

For API refresh:

```text
node scripts/verify/google-api-connections.mjs --date-start 2026-06-25 --date-end 2026-07-01 --env .env
node scripts/loop/fetch-gsc-performance.mjs --date-start 2026-06-04 --date-end 2026-07-01 --out-dir outputs/api-audit-2026-07-03/gsc-28d --env .env
node scripts/loop/fetch-gsc-performance.mjs --date-start 2026-06-25 --date-end 2026-07-01 --out-dir outputs/api-audit-2026-07-03/gsc-7d --env .env
node scripts/loop/import-ga4-traffic.mjs --date-start 2026-06-04 --date-end 2026-07-01 --out-dir outputs/api-audit-2026-07-03/ga4-28d --batch ga4-audit-2026-06-04-2026-07-01 --page-limit 5000 --env .env
node scripts/loop/import-ga4-traffic.mjs --date-start 2026-06-25 --date-end 2026-07-01 --out-dir outputs/api-audit-2026-07-03/ga4-7d --batch ga4-audit-2026-06-25-2026-07-01 --page-limit 5000 --env .env
```

## Acceptance Criteria

- GSC Sitemaps view shows both submitted sitemaps as successful.
- Page indexing `Last update` advances beyond the sitemap deployment date.
- News sitemap live URL count is `<= 48`.
- `Discovered - currently not indexed` decreases for submitted sitemap URLs.
- Top high-impression page gets CTR/snippet review and shows at least one click
  or improved CTR in the next 7-14 day Performance window.
- GA4 Organic Search remains checked separately from Direct traffic; Direct
  traffic source is either verified or filtered/tagged.
