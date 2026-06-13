# GSC 0 展现专项 SEO 审计报告

审计日期：2026-06-12
审计对象：`https://yayanews.cryptooptiontool.com`
审计目标：解释为什么 Google Search Console 仍为 0 展现，并给出可执行的修复与复查顺序。

## 1. 结论先行

当前站点不是“完全无法抓取”的状态：线上 `robots.txt`、`sitemap.xml`、`sitemap-news.xml` 都返回 200，根路径 `/` 也会 308 跳转到 `/zh/`。因此，GSC 0 展现的第一判断不应是 robots 或 sitemap 被整体拦截。

更高概率的根因是：生产站点仍在运行旧 SEO 状态，本地已完成的一批 canonical、OG、缓存、sitemap/noindex 一致性修复尚未在生产域名生效。用当前仓库的验证脚本直接打线上域名，结果为 `43/49 checks failed`；这意味着 GSC 当前看到的仍是旧版本信号。

P0 处理顺序：

1. 先部署当前本地 SEO 修复，并确保未跟踪的新资源 `apps/web/public/brand/og-default.png` 被纳入发布。
2. 生产 `.env` 确认 `NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com`；如果 GSC 使用 URL-prefix + HTML meta 验证，还必须设置 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` 后重新构建。
3. 部署后立即跑线上 `npm run verify:seo`，目标是生产域名 0 failure。
4. 再去 GSC 提交 sitemap、做 URL Inspection、请求重新抓取。否则 GSC 仍会用旧信号判断页面。

## 2. 线上证据

### 2.1 抓取入口是通的

| 项目 | 线上结果 | 判断 |
| --- | --- | --- |
| `/` | 308 到 `https://yayanews.cryptooptiontool.com/zh/` | 正常 |
| `/robots.txt` | 200，`Allow: /`，声明普通 sitemap 与 News sitemap | 正常 |
| `/sitemap.xml` | 200，包含 10 个 sitemap chunk | 正常 |
| `/sitemap-chunk/static/0` | 200 | 正常 |
| `/sitemap-news.xml` | 200，当前约 94 条 News URL | 正常 |

线上 `robots.txt` 主要规则：

```txt
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /*/search

Sitemap: https://yayanews.cryptooptiontool.com/sitemap.xml
Sitemap: https://yayanews.cryptooptiontool.com/sitemap-news.xml
```

结论：全站不是被 robots 整体禁止抓取。

### 2.2 生产域名仍是旧 SEO 状态

验证命令：

```bash
npm run verify:seo -- --base https://yayanews.cryptooptiontool.com --expected-origin https://yayanews.cryptooptiontool.com --sample-article-urls 2 --probe-sitemap-urls 5 --sample-sitemap-kinds authors:2,topics:2,tags:2,guides:2
```

线上结果：`SEO metadata check failed: 43/49 checks failed.`

关键失败项：

| 页面/资源 | 线上问题 | 对 GSC 的影响 |
| --- | --- | --- |
| `/brand/og-default.png` | 404 | 说明生产未包含本地新增资源，也会影响 OG/Twitter 图片 |
| 大量 HTML 页面 | `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` | 不直接阻止索引，但增加抓取成本，说明缓存修复未上线 |
| `/en/news/us-stock` | canonical 指向 `/zh/news/us-stock`，`og:url` 也指向中文，`og:locale=zh_CN` | 英文栏目可能被 Google 合并到中文 canonical，英文页面难独立收录 |
| `/en/news`、`/en/flash`、`/en/markets` | description 过长，部分 title 过长 | 页面摘要质量较弱，旧 metadata 未上线 |
| `/zh/privacy`、`/en/privacy` | canonical 指向 `/privacy`，hreflang 缺失 | 语言页 canonical 信号不干净 |
| `/zh/contact`、`/en/contact` | canonical 指向 `/contact`，hreflang 缺失 | 同上 |
| `/en/tag/%E5%9C%B0%E7%BC%98%E6%94%BF%E6%B2%BB` | sitemap 抽样命中，但页面 robots 为 `noindex, follow` | sitemap 与页面索引信号冲突，浪费抓取预算 |

### 2.3 Google 验证 meta 当前未出现在页面 HTML

线上抽样 `/zh`、`/en/news/us-stock`、`/zh/privacy`、`/en/contact`，未发现 `google-site-verification` meta。
本地 `.env` 也未配置 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`。

判断：

- 如果 GSC 使用的是 Domain property，并通过 DNS TXT 验证，这不是问题。
- 如果 GSC 使用的是 URL-prefix property，并依赖 HTML meta 验证，这会导致验证状态不稳定或验证失败。
- 代码入口已经存在：`apps/web/src/app/[lang]/layout.tsx` 会把 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` 注入 metadata；需要生产环境变量存在且重新构建。

## 3. GSC 0 展现的判断路径

GSC “0 展现”不等同于“Google 一定没有抓取”。它至少可能来自四类情况：

1. Google 没发现 URL：通常看 sitemap 提交状态、发现日期、URL Inspection。
2. Google 发现但未抓取：常见为 `Discovered - currently not indexed`。
3. Google 抓取但未收录：常见为 `Crawled - currently not indexed`，多与内容质量、重复、站点信任有关。
4. 已收录但没有排名/查询曝光：这时 GSC Pages 里能看到 indexed，但 Performance 仍可能 0。

结合本次线上证据，最先排查的是第 2/3 类：生产旧 SEO 信号让 Google 收到 canonical/noindex/语言信号冲突；部署修复前，继续在 GSC 操作收效会很有限。

## 4. 优先级问题清单

### P0 - 生产部署未同步本地 SEO 修复

证据：

- 本地仓库已有 `scripts/verify/seo-metadata-check.mjs`，并覆盖 canonical、OG、hreflang、robots、缓存、sitemap 抽样、NewsArticle JSON-LD 等检查。
- 生产域名用同一脚本仍失败 `43/49`。
- 生产 `/brand/og-default.png` 为 404，而本地资源存在。

建议：

- 先把当前 SEO 修复发布到生产。
- 发布前确认 `apps/web/public/brand/og-default.png` 被纳入 git 或发布包。
- 发布后用生产域名复跑验证脚本，失败项清零后再提交 GSC。

### P0 - 英文栏目 canonical 指向中文页

证据：

`/en/news/us-stock` 线上输出：

- canonical：`https://yayanews.cryptooptiontool.com/zh/news/us-stock`
- `og:url`：`https://yayanews.cryptooptiontool.com/zh/news/us-stock`
- `og:locale`：`zh_CN`

影响：

Google 可能把英文栏目当作中文页的重复版本，导致英文栏目不独立收录。即使中文页可收录，英文页也很难获得展示。

本地状态：

本地 `apps/web/src/app/[lang]/news/[category]/page.tsx` 已按当前语言传入 metadata，部署后应变为：

- `/en/news/us-stock` canonical 到 `/en/news/us-stock`
- `og:locale=en_US`
- hreflang 成对输出

### P1 - sitemap 收录 URL 与页面 noindex 不一致

证据：

线上 sitemap 抽样包含 `/en/tag/%E5%9C%B0%E7%BC%98%E6%94%BF%E6%B2%BB`，但页面 robots 为 `noindex, follow`。

影响：

这不会让全站 0 展现，但会降低 sitemap 质量。GSC 可能出现 `Submitted URL marked noindex` 或类似排除原因。

本地状态：

本地 `getTagsForSitemap()` 与 tag metadata 已做过一致性修复：只输出达到索引门槛的语言 URL，并避免 hreflang 指向 noindex 对端页。仍需部署验证。

### P1 - 语言页 canonical 与 hreflang 不干净

证据：

- `/zh/privacy` canonical 到 `/privacy`，缺少 hreflang。
- `/en/privacy` canonical 到 `/privacy`，缺少 hreflang。
- `/zh/contact` canonical 到 `/contact`，缺少 hreflang。
- `/en/contact` canonical 到 `/contact`，缺少 hreflang。

影响：

政策页不是流量核心页，但它们是站点信任、实体、合规信号的一部分。canonical 到会重定向的无语言路径，会让语言体系不够干净。

本地状态：

本地 `privacy` 与 `contact` 已改为语言感知 metadata。部署后需要复查：

- `/zh/privacy` canonical 到 `/zh/privacy`
- `/en/privacy` canonical 到 `/en/privacy`
- `/zh/contact` canonical 到 `/zh/contact`
- `/en/contact` canonical 到 `/en/contact`

### P1 - HTML 全站 no-store

证据：

线上大量 HTML 返回：

```http
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

影响：

这不是 noindex，不会单独阻止 Google 收录。但新闻站全站 no-store 会提高抓取成本和源站压力，也说明生产未拿到本地 `next.config.mjs` 的缓存头修复。

本地状态：

本地 `apps/web/next.config.mjs` 已为首页、新闻列表、栏目页、文章页、作者页、政策页、sitemap、RSS、robots 等补齐缓存策略。部署后验证脚本应不再报 cache-control 失败。

### P2 - News sitemap 内容集中度与重复风险

证据：

当前 News sitemap 有约 94 条 URL，但标题主题高度集中：

| 主题分组 | 数量 |
| --- | ---: |
| 港股/恒指/科技股 | 50 |
| 黄金/金价 | 37 |
| 其他 | 6 |
| 原油 | 1 |

重复标题前缀示例：

| 标题前缀 | 次数 |
| --- | ---: |
| 黄金期货创历史新 | 9 |
| 恒指失守万九关口 | 3 |
| 恒指失守1800 | 3 |
| 黄金期权持仓激增 | 3 |
| 恒指失守万八关口 | 3 |

影响：

这通常不是“GSC 0 展现”的第一根因，但如果部署技术修复后仍显示 `Crawled - currently not indexed`，内容同质化、模板化、主题过窄会成为主要风险。Google 对新闻/财经内容更容易要求明确的原创价值、来源透明度、作者/编辑责任和页面间差异。

建议：

- News sitemap 内避免短时间内堆叠过多相似标题和相似正文。
- 同主题多条快讯可合并为一篇持续更新文章，或明确区分角度：行情、资金流、衍生品、公司、宏观。
- 每篇文章增加可核验的原始数据点、来源、时间戳、作者/编辑责任。
- 对 AI 生成或聚合改写内容，优先做事实校验、独家摘要、图表或数据解释，减少模板化段落。

代码防护：

- `/sitemap-news.xml` 现在按发布时间优先，但最多输出 100 条 News URL。
- 同一宽泛主题在 News sitemap 中最多保留 24 条。
- 同一归一化标题前缀最多保留 3 条。
- `npm run verify:seo` 已加入 News sitemap 质量门槛，会检查 URL 总数、主题集中度和重复标题前缀。

## 5. 立即执行清单

### 5.1 部署前确认

1. 确认 SEO 修复代码和新文件都在发布分支中：

```bash
git status --short
```

重点确认：

- `apps/web/public/brand/og-default.png`
- `scripts/verify/seo-metadata-check.mjs`
- `apps/web/next.config.mjs`
- `packages/seo/src/metadata.ts`
- `apps/web/src/app/[lang]/news/[category]/page.tsx`
- `apps/web/src/app/[lang]/privacy/page.tsx`
- `apps/web/src/app/[lang]/contact/page.tsx`
- `apps/web/src/app/sitemap-chunk/[kind]/[page]/route.ts`

2. 生产环境变量确认：

```dotenv
NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com
```

如果 GSC 是 URL-prefix property 且使用 HTML meta 验证，再加：

```dotenv
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<GSC 提供的 token>
# 或 GOOGLE_SITE_VERIFICATION=<GSC 提供的 token>
```

3. 重新构建发布。项目文档中可用发布入口包括：

```bash
bash infra/deploy/publish-yayanews.sh
```

或按当前生产机实际流程使用：

```bash
bash deploy/publish-yayanews.sh
```

### 5.2 部署后线上复查

部署完成后立即运行：

```bash
npm run verify:seo -- --base https://yayanews.cryptooptiontool.com --expected-origin https://yayanews.cryptooptiontool.com --sample-article-urls 5 --probe-sitemap-urls 20 --sample-sitemap-kinds authors:2,topics:2,tags:5,guides:2
```

必须重点确认：

- `/brand/og-default.png` 返回 200。
- `/en/news/us-stock` canonical 为 `/en/news/us-stock`，`og:locale=en_US`。
- `/zh/privacy`、`/en/privacy`、`/zh/contact`、`/en/contact` canonical 都带语言前缀。
- sitemap 抽样 URL 均返回 200，且 sitemap 中不再出现页面自身 noindex 的 URL。
- HTML 页面不再是全站 `no-store`。

### 5.3 GSC 操作顺序

1. 确认 GSC property 是以下之一：
   - 推荐：Domain property，覆盖 `cryptooptiontool.com` 及所有子域。
   - 或：URL-prefix property，精确为 `https://yayanews.cryptooptiontool.com/`。
2. 在 GSC 重新提交：
   - `https://yayanews.cryptooptiontool.com/sitemap.xml`
   - `https://yayanews.cryptooptiontool.com/sitemap-news.xml`
3. 用 URL Inspection 检查并请求索引：
   - `https://yayanews.cryptooptiontool.com/zh/`
   - `https://yayanews.cryptooptiontool.com/zh/news/us-stock`
   - `https://yayanews.cryptooptiontool.com/en/news/us-stock`
   - News sitemap 顶部 2 到 3 篇文章
   - `https://yayanews.cryptooptiontool.com/zh/privacy`
4. 在 GSC 的 Pages 报告中重点看排除原因：
   - `Alternate page with proper canonical tag`
   - `Duplicate, Google chose different canonical than user`
   - `Crawled - currently not indexed`
   - `Discovered - currently not indexed`
   - `Submitted URL marked noindex`
   - `Blocked by robots.txt`

## 6. 后续优化路线

### 第一批：上线验证闭环

目标：让生产域名与本地 SEO 验证结果一致。

- 发布当前修复。
- 复跑线上 `verify:seo`。
- GSC 重新提交 sitemap。
- URL Inspection 抽样确认 canonical、indexability、last crawl。

### 第二批：索引质量

目标：降低 `Crawled - currently not indexed` 风险。

- News sitemap 去重与主题分散。
- 文章页补强作者、编辑政策、来源、更新时间、数据依据。
- 同主题多篇短时间重复稿合并或做差异化。
- 增强栏目页、专题页、作者页之间的内部链接。

### 第三批：展现与排名

目标：已收录后获得搜索曝光。

- 为核心栏目做固定落地页文案，不只依赖信息流列表。
- 建立专题页：美股开盘、港股科技股、黄金期权、加密衍生品等。
- 每个专题增加 1 到 3 篇 evergreen guide，承接非新闻型搜索需求。
- 跟踪 GSC query，按实际曝光词重写 title/H1/description。

## 7. 官方参考

- Google Search Central：Sitemap 基础说明
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Google Search Central：Canonical 与重复 URL 规范化
  https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central：robots meta / X-Robots-Tag
  https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google Search Central：请求重新抓取
  https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
