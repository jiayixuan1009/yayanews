# GSC URL Inspection and Page Indexing Check - 2026-06-18

## Scope

- Property: `https://yayanews.cryptooptiontool.com/`
- Checked in Google Search Console on 2026-06-18, Asia/Singapore afternoon.
- Live tested:
  - `https://yayanews.cryptooptiontool.com/zh/`
  - `https://yayanews.cryptooptiontool.com/zh/news`
  - Top 3 URLs from `https://yayanews.cryptooptiontool.com/sitemap-news.xml`
- Exported Page indexing overview plus two drilldowns:
  - `Discovered - currently not indexed`
  - `Crawled - currently not indexed`

## URL Inspection Results

| URL | Google index status shown before live test | Live Test result |
| --- | --- | --- |
| `https://yayanews.cryptooptiontool.com/zh/` | `URL is not on Google`; `URL is unknown to Google` | `URL is available to Google`; `Page can be indexed` |
| `https://yayanews.cryptooptiontool.com/zh/news` | `URL is on Google` | `URL is available to Google`; `Page can be indexed` |
| `https://yayanews.cryptooptiontool.com/zh/article/huang-jin-qi-quan-yin-han-bo-dong-lu-biao-sheng-shi-chang-ya-zhu-mei-lian-chu-zhuan-xian` | `URL is not on Google`; `URL is unknown to Google` | `URL is available to Google`; `Page can be indexed` |
| `https://yayanews.cryptooptiontool.com/zh/article/heng-zhi-shi-shou-mo-ba-guan-kou-ke-ji-gu-ling-die-gang-gu-cheng-ya-hou-shi-ru-he-yan-yi` | `URL is not on Google`; `URL is unknown to Google` | `URL is available to Google`; `Page can be indexed` |
| `https://yayanews.cryptooptiontool.com/zh/article/gang-gu-heng-zhi-wu-hou-v-xing-fan-dan-teng-xun-ji-hou-huo-da-xing-chang-hao-hou-shi-gua` | `URL is not on Google`; `URL is unknown to Google` | `URL is available to Google`; `Page can be indexed` |

## Page Indexing Snapshot

GSC Page indexing still shows:

- Last update: `2026-06-12`
- Indexed pages: `1,377`
- Not indexed pages: `9,516`

Reason breakdown:

| Reason | Source | Validation | Pages |
| --- | --- | --- | ---: |
| Blocked by robots.txt | Website | Not Started | 4 |
| Duplicate without user-selected canonical | Website | Not Started | 1 |
| Not found (404) | Website | Started | 2,287 |
| Excluded by `noindex` tag | Website | Started | 1,134 |
| Page with redirect | Website | Started | 822 |
| Server error (5xx) | Website | Started | 805 |
| Discovered - currently not indexed | Google systems | Started | 4,290 |
| Crawled - currently not indexed | Google systems | Started | 173 |

## Drilldown Exports

Local exports:

- Overview: `outputs/gsc-coverage-2026-06-18`
- Discovered drilldown: `outputs/gsc-coverage-2026-06-18-discovered`
- Crawled drilldown: `outputs/gsc-coverage-2026-06-18-crawled`

Discovered drilldown:

- Exported rows: `1,000`
- Total affected shown by GSC: `4,290`
- Last crawled: `N/A` for exported examples
- URL kind distribution in exported examples:
  - `article-detail`: `908`
  - `tag-detail`: `72`
  - `topic-detail`: `8`
  - other/list/static: `12`
- Language prefix:
  - `zh`: `943`
  - `en`: `57`

Crawled drilldown:

- Exported rows: `173`
- Total affected shown by GSC: `173`
- Last crawled range: `2026-04-03` to `2026-06-13`
- URL kind distribution:
  - `article-detail`: `150`
  - `tag-detail`: `10`
  - `flash-detail`: `8`
  - other/list/home/topic: `5`
- Language prefix:
  - `zh`: `131`
  - missing locale prefix: `31`
  - `en`: `11`

## Interpretation

There is no current live crawlability blocker in the sampled URLs. All five Live Tests returned `URL is available to Google` and `Page can be indexed`.

The main problem visible in GSC is reporting and indexing lag, not a live 5xx failure on these sampled pages. Page indexing data is still dated `2026-06-12`, while validation was started on `2026-06-14`, after the latest SEO/route fixes.

The three fresh News sitemap article URLs are still `URL is unknown to Google` in the Google index view, even though Live Test can fetch and index them. This means Google has not yet processed those URLs into its index state.

`Discovered - currently not indexed` is mostly article pages with `Last crawled = N/A`, so Google has discovered the URLs but has not crawled them yet.

`Crawled - currently not indexed` is smaller and includes some older no-locale legacy URLs such as `/article/...` and `/tag/...`, plus stale flash-detail URLs. These should be treated as cleanup/backlog signals while redirect and sitemap fixes recrawl.

## Follow-up

1. Keep monitoring Page indexing until GSC updates past `2026-06-14`.
2. Re-check the same five URL Inspection targets after the next Page indexing update.
3. Do not deploy sitemap translation-group deduping as a fix for this issue; the sampled problem is discovery/crawl backlog, not duplicate sitemap `<loc>` entries.
4. Keep legacy redirect regression coverage active for `/article/*`, `/flash/*`, `/tag/*`, and no-locale paths while GSC recrawls old URLs.
