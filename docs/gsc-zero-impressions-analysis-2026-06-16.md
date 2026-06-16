# GSC 低展现原因分析 - 2026-06-16

## 范围

- GSC 属性：`https://yayanews.cryptooptiontool.com/`
- 检查时间：2026-06-16
- Performance 数据：GSC 显示 `Last update: 4 hours ago`，图表数据截至 2026-06-13
- Page indexing 数据：GSC 显示 `Last update: 2026-06-12`
- Sitemap 数据：GSC 显示两个 sitemap 均在 2026-06-14 提交并成功读取
- 备注：GSC 导出端点被当前 Chrome 环境拦截为 `ERR_BLOCKED_BY_CLIENT`，本报告使用 GSC 页面可见表格、现有本地 Coverage 导出、生产 HTTP 抽样和 SEO 验证脚本综合判断。

## 结论

当前不是历史全量 0 展现。正确的 yayanews URL-prefix 属性在过去 3 个月有：

| 指标 | 数值 |
| --- | ---: |
| Total clicks | 2 |
| Total impressions | 9,374 |
| Average CTR | 0% |
| Average position | 6 |

但近期确实接近 0：2026-06-04 到 2026-06-11 连续 0 展现，2026-06-12 为 1，2026-06-13 为 4。由于 GSC Performance 当前只更新到 2026-06-13，2026-06-14 之后提交 sitemap 和修复后的效果还没有完整进入 Performance 报表。

主要原因不是当前生产站整站不可访问，而是：

1. 旧索引/旧 URL 在 4 月下旬到 5 月下旬快速衰减。
2. 6 月中旬修复后，新 URL 已被 sitemap 发现，但大量还处在 `Discovered - currently not indexed`。
3. GSC Page indexing 仍保留大量历史 URL 债务，包括 404、redirect、noindex、5xx 等 All known pages 噪音。
4. `Server error (5xx)` 报表是历史状态，GSC 最后更新时间是 2026-06-12；生产抽样未复现 5xx，且验证已在 2026-06-14 开始。
5. 之前浏览器里还开着 `sc-domain:biyapay.com` 且筛选 `www.biyapay.com` 的 GSC Performance 页面，这会导致检查 yayanews URL 时出现属性/筛选不匹配的误判。

## 近期展现走势

| 日期 | Clicks | Impressions |
| --- | ---: | ---: |
| 2026-04-20 | 0 | 622 |
| 2026-04-21 | 0 | 592 |
| 2026-04-22 | 0 | 559 |
| 2026-04-23 | 1 | 585 |
| 2026-04-24 | 0 | 506 |
| 2026-05-01 | 0 | 246 |
| 2026-05-08 | 0 | 319 |
| 2026-05-12 | 1 | 282 |
| 2026-05-18 | 0 | 121 |
| 2026-05-23 | 0 | 9 |
| 2026-05-24 至 2026-05-30 | 0 | 0 |
| 2026-05-31 | 0 | 1 |
| 2026-06-01 至 2026-06-02 | 0 | 0 |
| 2026-06-03 | 0 | 1 |
| 2026-06-04 至 2026-06-11 | 0 | 0 |
| 2026-06-12 | 0 | 1 |
| 2026-06-13 | 0 | 4 |

这个趋势说明：4 月下旬还有一批 URL 获得展现，5 月下旬基本掉完；6 月 14 日以后修复和 sitemap 提交还处在等待 GSC 重新抓取、重新计算的阶段。

## Performance 页面维度

过去 3 个月有展现的页面主要是中文文章页：

| URL | Clicks | Impressions |
| --- | ---: | ---: |
| `/zh/article/heng-zhi-shi-shou-mo-ba-dian-ke-wang-gu-ling-die-yuan-yin-fen-xi-mei-lian-chu-zh` | 1 | 12 |
| `/zh/article/ke-pai-jie-jin-10yi-mei-yuan-chu-shou-nan-fei-jia-you-zhan-ye-wu-yu-a-bu-zha-bi` | 1 | 3 |
| `/zh/article/na-si-da-ke-zhi-shu-wei-he-ju-lie-bo-dong-shen-du-jie-xi-mei-lian-chu-li-lu-jue` | 0 | 999 |
| `/zh/article/mei-lian-chu-jiang-xi-yu-ke-ji-gu-gu-zhi-ji-yu-huan-shi-pao-mo` | 0 | 721 |
| `/zh/article/mei-lian-chu-zan-ting-jia-xi-xia-de-mei-gu-bu-ju-ke-ji-gu-gu-zhi-hui-gui-yu-jie` | 0 | 484 |

Top queries 也集中在中文长尾主题，例如：

| Query | Clicks | Impressions |
| --- | ---: | ---: |
| 新能源汽车板块估值 市场情绪 | 0 | 52 |
| 新能源汽车板块估值 市场情绪分析 | 0 | 52 |
| 美联储政策对纳斯达克指数的影响 | 0 | 49 |
| 美国科技巨头财报季对纳斯达克指数的影响 | 0 | 48 |
| 美联储货币政策对科技股估值的影响 | 0 | 47 |

判断：历史可见流量来自部分中文长尾内容，平均排名不差，但 CTR 很低；当前首要瓶颈仍是索引/抓取恢复，而不是单纯排名。

## Page Indexing 状态

GSC 当前 Page indexing 总览：

| 状态 | 数量 |
| --- | ---: |
| Indexed | 1,377 |
| Not indexed | 9,516 |

未索引原因：

| Reason | Source | Validation | Pages |
| --- | --- | --- | ---: |
| Discovered - currently not indexed | Google systems | Started | 4,290 |
| Not found (404) | Website | Started | 2,287 |
| Excluded by `noindex` tag | Website | Started | 1,134 |
| Page with redirect | Website | Started | 822 |
| Server error (5xx) | Website | Started | 805 |
| Crawled - currently not indexed | Google systems | Started | 173 |
| Blocked by robots.txt | Website | Not Started | 4 |
| Duplicate without user-selected canonical | Website | Not Started | 1 |

最大的问题是 `Discovered - currently not indexed`，样例的 `Last crawled` 为 `N/A`，说明 Google 发现了 URL 但还没有抓取。这与 2026-06-14 刚提交 sitemap 后等待抓取的状态一致。

## Sitemap 状态

GSC 里当前只有 2 个提交 sitemap：

| Sitemap | Type | Submitted | Last read | Status | Discovered pages |
| --- | --- | --- | --- | --- | ---: |
| `/sitemap.xml` | Sitemap index | 2026-06-14 | 2026-06-14 | Success | 6,184 |
| `/sitemap-news.xml` | Sitemap | 2026-06-14 | 2026-06-14 | Success | 54 |

生产复核结果：

- `npm run verify:seo -- --base https://yayanews.cryptooptiontool.com ...` 通过：`71/71 checks OK`
- 抽样 50 条 sitemap URL 通过
- `/robots.txt` 声明 `/sitemap.xml` 和 `/sitemap-news.xml`
- 主 sitemap 与新闻 sitemap 当前可访问

判断：当前 sitemap 层面不是阻断原因。

## 5xx 状态判断

GSC `Server error (5xx)`：

- Affected pages：805
- Last update：2026-06-12
- Validation started：2026-06-14
- 样例 Last crawled 多集中在 2026-06-07 至 2026-06-08

实时抽样未复现 5xx：

| 样例 | 当前状态 |
| --- | --- |
| `/article/gang-jiao-suo-xin-yan-sheng-pin-zhan-lue...` | 308 到 `/zh/article/...` |
| `/en/article/hua-er-jie-yin-xing-cai-bao...` | 308 到 `/zh/article/...` |
| `/zh/article/mei-gu-ke-ji-qi-ju-tou...` | 200 |
| `/zh/flash/门罗币24小时涨8-至404美元-75473` | 200 |
| `/flash/29m-in-token-unlocks-this-week-57592` | 308 到 `/zh/flash/...` |
| `/zh/tag/ai-investment` | 404 |

判断：GSC 的 5xx 是历史抓取状态，目前生产抽样没有发现仍然返回 5xx。短期应等待 GSC validation 结果；如果 validation 失败，再回查 Googlebot 抓取时段的生产日志。

## noindex 状态判断

GSC noindex 样例包含 flash 和 tag：

- flash 详情页 `noindex, follow` 是当前策略，快讯不进 sitemap，也不作为主索引入口。
- tag 页按当前规则：当前语言下少于 3 篇 indexable article 的 tag 页面 `noindex, follow`。
- 抽查的 noindex tag 样例当前不在生产 `sitemap-chunk/tags/0` 中，因此不是当前 sitemap 持续提交 noindex tag 的问题。

实时抽样：

| URL | 当前 robots |
| --- | --- |
| `/en/tag/institutional-investors` | `noindex, follow` |
| `/zh/tag/futures` | `noindex, follow` |
| `/en/tag/数据中心` | `noindex, follow` |
| `/zh/flash/比特币持稳于高位-或进一步上涨-93698` | `noindex, follow` |

判断：noindex 数量主要来自历史发现 URL 与薄 tag/flash 策略，不是当前核心文章页索引阻断。

## Discovered Not Indexed 抽样

GSC 样例多为英文文章，Last crawled 为 `N/A`：

- `/en/article/analysis-of-surging-gold-option-implied-volatility-how-geopolitical-risks-fuel-d`
- `/en/article/behind-bitcoin-s-new-high-how-spot-etfs-are-reshaping-institutional-allocation-l`
- `/en/article/bitcoin-plunges-after-breaking-70k-analysis-reveals-new-institutional-game-betwe`
- `/en/article/crypto-today-south-korea-tightens-crypto-exchange-reserve-rules`

实时抽样结果：

| URL | 当前状态 |
| --- | --- |
| `/en/article/analysis-of-surging-gold-option-implied-volatility-how-geopolitical-risks-fuel-d` | 200, `index, follow`, canonical 自指 |
| `/en/article/behind-bitcoin-s-new-high-how-spot-etfs-are-reshaping-institutional-allocation-l` | 200, `index, follow`, canonical 自指 |
| `/en/article/bitcoin-plunges-after-breaking-70k-analysis-reveals-new-institutional-game-betwe` | 200, `index, follow`, canonical 自指 |
| `/en/article/crypto-today-south-korea-tightens-crypto-exchange-reserve-rules` | 200, `index, follow`, canonical 自指 |
| `/en/article/fang-cheng-shi-xin-wen-bwenews` | 404，属于旧 slug 债务 |

判断：大量新英文文章不是当前页面级技术阻断，而是 Google 尚未抓取；少量旧 slug 会进入 404/redirect 清理池。

## 为什么现在看起来还是 0

1. 如果看的是最近 7 天或 24 小时，GSC 数据延迟会让 2026-06-14 至 2026-06-16 的修复效果暂时不可见。
2. 2026-06-04 至 2026-06-11 的确是连续 0，6 月 12/13 只恢复到 1/4。
3. 当前 GSC 仍有大量 All known pages 历史债务，视觉上会显得站点很差，但这不等于当前 sitemap 和文章页不可访问。
4. 4 月下旬到 5 月中旬曾有展现的旧 URL 池已经衰减；新 sitemap 提交后还没有被充分抓取和索引。
5. 如果误选 `sc-domain:biyapay.com` 并筛选 `www.biyapay.com`，再检查 yayanews URL，会出现属性不匹配或 0 数据误判。

## 优先级建议

### P0：观察正确属性和正确时间窗

- 后续只看 `https://yayanews.cryptooptiontool.com/` 这个 URL-prefix 属性。
- 不用 24 小时或最近 7 天单独判断本轮修复效果。
- 重点看 2026-06-17 至 2026-06-21 期间，GSC 是否开始显示 2026-06-14 之后的 sitemap 提交效果。

### P1：继续推进 GSC 验证

- `Server error (5xx)` 已在 2026-06-14 开始 validation，等待结果。
- 如果 validation 失败，抽取失败 URL 并对照生产日志查 Googlebot 访问时返回的真实状态。
- 对首页、新闻列表、语言首页、5-10 篇高质量文章继续 URL Inspection，记录：
  - Live test 状态
  - Crawling allowed
  - Indexing allowed
  - User-declared canonical
  - Google-selected canonical

### P1：处理旧 URL 债务

- 对 404 中仍有业务价值的旧文章 slug，补充 redirect mapping 到 canonical URL。
- 无价值的旧 flash/tag/乱码 URL 可以让其自然清理，不再加入 sitemap。
- 继续保持无语言前缀 `/article/*`、`/tag/*`、`/flash/*` 的 redirect 回归测试。

### P2：提高被发现后的收录优先级

- 从 `Discovered - currently not indexed` 中挑 20 篇高质量英文文章做 URL Inspection。
- 优先给首页、新闻列表、专题页、相关文章模块增加内链到高质量文章。
- 对已经有 impressions 的中文长尾主题强化标题和摘要 CTR，例如美联储、纳指、新能源车估值、科技股财报季。
- 如果 7-10 天后仍大量 `Discovered`，考虑把主 sitemap 分层为高优先级文章/普通归档，减少新站一次性提交过多低权重 URL 的噪音。

## 当前判断

生产站当前没有发现整站级 SEO 技术阻断。现在的低展现主要是 GSC 历史抓取状态、旧 URL 债务、新 sitemap 刚被读取后的抓取延迟，以及站点/内容权重尚未恢复共同造成的。

最关键的观察窗口是 2026-06-17 到 2026-06-21：如果这几天 Performance 和 Page indexing 仍没有明显改善，就应从 GSC 导出完整 Pages/Performance 数据，按 URL 批量建立 redirect 和 URL Inspection 优先队列。
