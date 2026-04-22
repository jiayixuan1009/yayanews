-- ============================================================
-- YayaNews 核心专题 seo_body 内容录入
-- 实际生产库 slug 映射：
--   1. 美股财报季          → earnings  (UPDATE)
--   2. 港股热点板块         → hk-stock-sectors (INSERT)
--   3. 比特币 / BTC ETF   → btc       (UPDATE)
--   4. 美联储利率政策        → fed       (UPDATE)
--   5. 数字货币监管          → crypto-regulation (INSERT)
-- 执行方式：psql $DATABASE_URL -f seed-core-topics-seo.sql
-- ============================================================

BEGIN;

-- ① 确保 seo_body 列存在（幂等）
ALTER TABLE topics ADD COLUMN IF NOT EXISTS seo_body_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS seo_body_en TEXT;

-- ─────────────────────────────────────────────────────────────
-- 1. 美股财报季 (earnings)
-- ─────────────────────────────────────────────────────────────
UPDATE topics SET
  seo_body_zh = '<h2>什么是美股财报季？</h2>
<p>美股财报季（Earnings Season）是指标普500成分股集中发布季度业绩报告的时间窗口，每年发生四次，分别在1月、4月、7月和10月中旬开始。通常以大型银行（摩根大通、高盛等）的财报为开端，历时约6周。</p>
<h2>财报季的核心指标</h2>
<p>投资者最关注三项核心指标：每股收益（EPS）相对于市场一致预期的差值（盈利超预期/不及预期）；营收增速及对应的指引；以及管理层对未来一到两个季度的盈利指引（Guidance）。其中，下调指引往往比EPS不及预期更具有破坏性。</p>
<h2>财报季如何影响市场？</h2>
<p>财报季期间波动率（VIX）通常上升，个股的单日波动幅度可达5%–15%。市场倾向于"预期差"交易——真正驱动股价的是实际业绩与预期的偏差，而非绝对数字。超预期（Beat & Raise）是最强的正向催化剂，而即使EPS超预期，若指引下调（Beat & Lower）依然可能导致股价大跌。</p>
<h2>财报季与宏观环境的关系</h2>
<p>在高利率或经济放缓环境下，分析师往往预先下调预期（低基数），这使得EPS超预期的比例看似较高。因此投资者需关注盈利增速的绝对质量，而非仅仅看超预期比例。标普500的整体盈利趋势也是市场估值（P/E倍数扩张或收缩）的核心驱动之一。</p>',
  seo_body_en = '<h2>What Is US Earnings Season?</h2>
<p>US earnings season refers to the period when S&amp;P 500 companies concentrate their quarterly results releases. It occurs four times a year, beginning in mid-January, April, July, and October — typically kicked off by major banks (JPMorgan, Goldman Sachs) and lasting roughly six weeks.</p>
<h2>Key Metrics Investors Watch</h2>
<p>Three core metrics dominate: EPS relative to consensus estimates (beat or miss); revenue growth and guidance; and management forward guidance for the next one to two quarters. Guidance cuts tend to be more destructive than EPS misses.</p>
<h2>How Earnings Season Moves Markets</h2>
<p>Volatility (VIX) tends to rise during earnings season, with individual stocks moving 5%–15% in a single day. Markets trade on "expectation gaps" — what actually drives prices is the deviation from expectations, not absolute numbers. Beat &amp; Raise is the strongest positive catalyst; even an EPS beat can send stocks lower on a guidance cut (Beat &amp; Lower).</p>
<h2>Earnings Season in a Macro Context</h2>
<p>In high-rate or slowing-growth environments, analysts often pre-emptively cut estimates (low bar), inflating the apparent beat rate. Investors need to assess the absolute quality of earnings growth, not just the beat percentage. The S&amp;P 500''s aggregate earnings trend is also a key driver of market valuation (P/E multiple expansion or compression).</p>',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'earnings';

-- ─────────────────────────────────────────────────────────────
-- 2. 港股热点板块 (hk-stock-sectors) — 新增
-- ─────────────────────────────────────────────────────────────
INSERT INTO topics (
  slug, title, name_zh, name_en,
  description_zh, description_en,
  topic_type, market, category_id, priority, status, sort_order,
  keywords, related_tickers,
  hero_summary_zh, hero_summary_en,
  seo_body_zh, seo_body_en,
  faq_items, meta_title, meta_description
) VALUES (
  'hk-stock-sectors',
  'HK Stock Hot Sectors',
  '港股热点板块追踪',
  'HK Stock Hot Sectors',
  '追踪恒生指数与港股核心板块动态，覆盖南向资金、科技互联网蓝筹、新能源汽车、中概股回流及宏观政策对港股估值的影响。',
  'Tracking Hang Seng Index and HK core sector dynamics, covering southbound capital flows, tech internet blue chips, EV sector, Chinese ADR homecomings and macro policy impact on HK valuations.',
  'narrative', 'hk-stock', 4, 86, 'active', 11,
  ARRAY['港股','恒生指数','HSI','南向资金','互联互通','港股科技','中概股','ADR回港','腾讯','阿里','美团','港股ETF','恒科指数','HKEX'],
  ARRAY['700.HK','9988.HK','3690.HK','9618.HK','1211.HK','2318.HK','HSI','2800.HK','3032.HK'],
  '港股市场处于全球资本流动的交汇点：既受美联储利率政策和美元走势的外部压力，也受中国内地宏观政策和企业盈利的内部驱动。本专题追踪恒生指数核心成分股、南向资金流向、互联网巨头监管动态，以及港股与A股的联动效应。',
  'Hong Kong equities sit at the crossroads of global capital flows: subject to external pressure from Fed policy and the dollar, and internal drivers from mainland China macro policy and corporate earnings. This topic tracks HSI core components, southbound flows, tech regulatory dynamics, and HK-A share co-movements.',
  '<h2>港股市场的核心驱动因素</h2>
<p>港股市场受三大力量驱动：美联储货币政策（决定港元联系汇率压力和离岸流动性）、中国内地宏观政策（财政刺激、监管政策、经济数据）、以及南向资金（内地投资者通过港股通买入）。三者共振时往往产生港股的大行情。</p>
<h2>核心板块与代表性标的</h2>
<p>港股科技互联网是最受关注的板块，龙头包括腾讯（0700.HK）、阿里巴巴（9988.HK）、美团（3690.HK）、京东（9618.HK）。新能源汽车板块以比亚迪（1211.HK）为核心。金融板块以汇丰（0005.HK）、友邦（1299.HK）为代表。追踪恒生科技指数（HSTECH）可快速掌握科技板块整体表现。</p>
<h2>南向资金的意义</h2>
<p>南向资金是港股的重要定价力量。当南向净流入持续扩大，尤其集中于科技蓝筹时，往往预示港股将出现阶段性上涨。日均净买入超过100亿港元被市场视为强烈入场信号。</p>
<h2>港股估值洼地逻辑</h2>
<p>港股长期相对A股和美股处于估值折价状态（"港股折价之谜"），核心原因包括：流动性较低、外资定价权较大、监管不确定性溢价。当折价扩大至历史极值区间，往往构成中长线配置机会。</p>',
  '<h2>Core Drivers of Hong Kong Equities</h2>
<p>HK equities are driven by three forces: Fed monetary policy (determining HKD peg pressure and offshore liquidity); mainland China macro policy (fiscal stimulus, regulation, economic data); and southbound capital (mainland investors buying via Stock Connect). Confluence of all three typically generates major HK market rallies.</p>
<h2>Key Sectors and Representative Stocks</h2>
<p>HK tech internet is the most watched sector, led by Tencent (0700.HK), Alibaba (9988.HK), Meituan (3690.HK) and JD.com (9618.HK). The EV sector centers on BYD (1211.HK). Financial sector leaders include HSBC (0005.HK) and AIA (1299.HK). The Hang Seng TECH Index (HSTECH) provides a quick read on overall tech sector performance.</p>
<h2>The Importance of Southbound Capital</h2>
<p>Southbound capital is a major pricing force for HK equities. When net southbound inflows consistently expand — especially concentrated in tech blue chips — it often signals an upcoming phase of HK outperformance. Daily net buying exceeding HKD 10 billion is widely viewed as a strong entry signal.</p>
<h2>HK Equity Valuation Discount Logic</h2>
<p>HK equities have long traded at a discount to A-shares and US stocks (the "HK discount puzzle"), driven by lower liquidity, greater foreign investor pricing influence, and regulatory uncertainty premium. When the discount widens to historical extremes, it often presents a medium-to-long-term positioning opportunity.</p>',
  '[{"q_zh":"港股和A股有什么区别？","q_en":"What is the difference between HK stocks and A-shares?","a_zh":"港股（H股/红筹股）在香港交易所上市，以港元计价，对外资全面开放；A股在上交所/深交所上市，以人民币计价，外资通过沪深港通参与。港股流动性相对较低，但估值往往较A股便宜。","a_en":"HK stocks (H-shares/Red Chips) trade on HKEX in HKD and are fully open to foreign investors; A-shares trade on Shanghai/Shenzhen exchanges in CNY, with foreign access via Stock Connect. HK stocks generally have lower liquidity but often trade cheaper than A-share equivalents."},{"q_zh":"如何追踪南向资金？","q_en":"How to track southbound capital flows?","a_zh":"南向资金数据可通过港交所官网（HKEX.com.hk）查看每日互联互通净买卖数据，也可通过wind、彭博等专业终端或各大财经媒体的每日统计获取。","a_en":"Southbound capital data is available via HKEX.com.hk (daily Stock Connect net buy/sell statistics), as well as professional terminals like Bloomberg and Wind, or daily summaries from financial media."}]'::jsonb,
  '港股热点板块追踪 专题报道 | YayaNews 鸭鸭财经',
  '追踪恒生指数、港股科技互联网、南向资金流向、新能源汽车板块及宏观政策对港股估值的影响。'
) ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh, name_en = EXCLUDED.name_en,
  description_zh = EXCLUDED.description_zh, description_en = EXCLUDED.description_en,
  topic_type = EXCLUDED.topic_type, market = EXCLUDED.market, category_id = EXCLUDED.category_id,
  priority = EXCLUDED.priority, keywords = EXCLUDED.keywords,
  related_tickers = EXCLUDED.related_tickers,
  hero_summary_zh = EXCLUDED.hero_summary_zh, hero_summary_en = EXCLUDED.hero_summary_en,
  seo_body_zh = EXCLUDED.seo_body_zh, seo_body_en = EXCLUDED.seo_body_en,
  faq_items = EXCLUDED.faq_items, meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description, updated_at = CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────────────────────
-- 3. 比特币 / BTC ETF (btc)
-- ─────────────────────────────────────────────────────────────
UPDATE topics SET
  seo_body_zh = '<h2>比特币现货ETF的历史意义</h2>
<p>2024年1月SEC批准美国首批比特币现货ETF，标志着加密资产正式获得传统金融体系的入场券。贝莱德（IBIT）、富达（FBTC）、灰度（GBTC转型）等资管巨头的参与，使机构投资者无需自行托管即可获得比特币敞口，大幅降低了合规门槛。</p>
<h2>主要比特币 ETF 对比</h2>
<p>截至2025年底，IBIT（贝莱德）已成为规模最大的比特币ETF，管理资产超过500亿美元，年费0.25%；FBTC（富达）费率相近，背靠零售经纪商网络；GBTC（灰度）历史最久，但1.5%的高费率导致长期资金外流。新进入者如ARKB（方舟）和BITB（Bitwise）也以差异化策略争夺市场。</p>
<h2>资金流向如何影响比特币价格？</h2>
<p>比特币ETF的净流入量与比特币现货价格呈高度正相关。当主要ETF连续多日录得数亿美元净流入，往往预示市场情绪转暖。反之，持续净流出（尤其是GBTC的结构性抛压）会对价格形成压制。追踪ETF每日资金流向已成为加密市场投资者的必备功课。</p>
<h2>以太坊 ETF 的后续影响</h2>
<p>2024年5月SEC批准以太坊现货ETF，进一步扩大了机构合规入场加密资产的品类。以太坊ETF上市初期的资金流向对以太坊价格具有显著的价格发现功能。预计更多Layer-1资产（如SOL）的ETF申请将陆续推进。</p>',
  seo_body_en = '<h2>Historical Significance of Spot Bitcoin ETFs</h2>
<p>The SEC''s January 2024 approval of the first US spot Bitcoin ETFs marked crypto''s formal admission to the traditional financial system. Participation by asset management giants like BlackRock (IBIT), Fidelity (FBTC) and Grayscale (GBTC conversion) allows institutional investors to gain Bitcoin exposure without self-custody, dramatically lowering compliance barriers.</p>
<h2>Major Bitcoin ETF Comparison</h2>
<p>By end-2025, IBIT (BlackRock) has become the largest Bitcoin ETF with over $50B AUM at 0.25% annual fee; FBTC (Fidelity) is similarly priced with a strong retail brokerage distribution network; GBTC (Grayscale) is the oldest but its 1.5% fee has caused sustained outflows. Newer entrants like ARKB (ARK) and BITB (Bitwise) compete with differentiated strategies.</p>
<h2>How Fund Flows Impact Bitcoin Price</h2>
<p>Bitcoin ETF net inflows and Bitcoin spot prices are highly positively correlated. When major ETFs record hundreds of millions in daily net inflows for multiple consecutive days, it typically signals improving market sentiment. Conversely, sustained net outflows (especially GBTC''s structural selling pressure) weigh on prices. Tracking daily ETF flows has become essential for crypto market participants.</p>
<h2>Ethereum ETF and What Comes Next</h2>
<p>The SEC''s May 2024 approval of spot Ethereum ETFs further expanded the menu of compliant institutional crypto exposure. Initial ETH ETF flows showed significant price discovery for Ethereum. Applications for additional Layer-1 assets (e.g., SOL) are expected to follow.</p>',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'btc';

-- ─────────────────────────────────────────────────────────────
-- 4. 美联储利率政策 (fed)
-- ─────────────────────────────────────────────────────────────
UPDATE topics SET
  seo_body_zh = '<h2>美联储的决策机制</h2>
<p>美联储货币政策由联邦公开市场委员会（FOMC）制定，每年召开8次例行会议。FOMC由12名成员组成（7名理事会成员 + 5名地区联储主席轮席）。每次会议通过投票决定联邦基金利率目标区间，决议后主席（现为鲍威尔）召开新闻发布会解读政策立场。</p>
<h2>利率政策的核心参考指标</h2>
<p>美联储的"双重使命"是维持价格稳定（通胀目标2%）和最大化就业。核心通胀指标以核心PCE（个人消费支出物价指数，剔除食品能源）为准，非农就业（NFP）是就业端的最重要月度数据。此外，CPI、工资增速、PMI等也在决策框架中占据重要位置。</p>
<h2>利率变动如何传导至资产价格</h2>
<p>加息通过两条路径压制风险资产：一是提高企业融资成本（直接作用于盈利）；二是提高折现率（压缩未来现金流的现值，对高估值成长股打击最大）。降息则通过降低无风险利率、改善流动性来推动风险资产重估。黄金和比特币通常对降息预期较为敏感。</p>
<h2>如何追踪市场对利率路径的预期？</h2>
<p>CME FedWatch工具实时显示联邦基金期货隐含的每次会议降息/加息概率。当市场预期在短期内大幅波动时，往往产生债券和股票市场的联动波动。此外，美国2年期国债收益率是市场对短期利率路径最直接的前瞻指标。</p>',
  seo_body_en = '<h2>How the Fed Makes Decisions</h2>
<p>Fed monetary policy is set by the Federal Open Market Committee (FOMC), which meets 8 times per year. The FOMC has 12 voting members (7 Board governors + 5 rotating regional Fed presidents). Each meeting votes on the federal funds rate target range, followed by a press conference from Chair Powell interpreting the policy stance.</p>
<h2>Key Reference Indicators for Rate Policy</h2>
<p>The Fed''s "dual mandate" is price stability (2% inflation target) and maximum employment. The core inflation benchmark is Core PCE (Personal Consumption Expenditure Price Index, ex-food and energy); Non-Farm Payrolls (NFP) is the most important monthly employment data point. CPI, wage growth and PMIs also feature prominently in the decision framework.</p>
<h2>How Rate Changes Transmit to Asset Prices</h2>
<p>Rate hikes suppress risk assets through two channels: higher corporate borrowing costs (directly impacting earnings) and higher discount rates (compressing the present value of future cash flows, hitting high-valuation growth stocks hardest). Rate cuts drive risk asset re-rating by lowering the risk-free rate and improving liquidity. Gold and Bitcoin tend to be particularly sensitive to rate cut expectations.</p>
<h2>How to Track Market Rate Path Expectations</h2>
<p>The CME FedWatch tool shows real-time probabilities of rate cuts/hikes at each upcoming meeting, implied by federal funds futures. Sharp short-term swings in market expectations often create correlated volatility in bonds and equities. The US 2-year Treasury yield is the most direct market-based leading indicator for the near-term rate path.</p>',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'fed';

-- ─────────────────────────────────────────────────────────────
-- 5. 加密货币监管 (crypto-regulation) — 新增
-- ─────────────────────────────────────────────────────────────
INSERT INTO topics (
  slug, title, name_zh, name_en,
  description_zh, description_en,
  topic_type, market, category_id, priority, status, sort_order,
  keywords, related_tickers,
  hero_summary_zh, hero_summary_en,
  seo_body_zh, seo_body_en,
  faq_items, meta_title, meta_description
) VALUES (
  'crypto-regulation',
  'Crypto Regulation',
  '加密货币监管',
  'Crypto Regulation',
  '追踪全球加密货币监管动态，覆盖美国SEC执法、欧盟MiCA框架、稳定币立法及中国监管政策。',
  'Tracking global crypto regulatory developments, covering US SEC enforcement, EU MiCA framework, stablecoin legislation and China crypto policy.',
  'narrative', 'crypto', 2, 88, 'active', 12,
  ARRAY['加密监管','SEC','MiCA','稳定币','USDT','USDC','Howey Test','证券法','加密合规','CFTC','数字货币法规','币安','Coinbase','欧盟加密'],
  ARRAY['BTC','ETH','XRP','BNB','USDT','USDC'],
  '全球加密货币监管正处于历史性转折点：美国SEC主导的执法风暴、欧盟MiCA的立法领跑、稳定币监管框架的加速推进，以及各国对加密资产属性的根本性分歧，共同塑造着加密市场的合规底层逻辑。',
  'Global crypto regulation is at a historic inflection point: the SEC-led US enforcement wave, EU MiCA legislation leading globally, accelerating stablecoin regulatory frameworks, and fundamental disagreements between jurisdictions over crypto asset classification are collectively reshaping the compliance foundations of the crypto market.',
  '<placeholder_seo_body_zh>',
  '<placeholder_seo_body_en>',
  '[]'::jsonb,
  '加密货币监管动态追踪 | YayaNews 鸭鸭财经',
  '追踪美国SEC执法、欧盟MiCA框架、稳定币立法和全球加密监管动态，解读法规变化对比特币、以太坊及加密市场的影响。'
) ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh, name_en = EXCLUDED.name_en,
  description_zh = EXCLUDED.description_zh, description_en = EXCLUDED.description_en,
  topic_type = EXCLUDED.topic_type, market = EXCLUDED.market, category_id = EXCLUDED.category_id,
  priority = EXCLUDED.priority, keywords = EXCLUDED.keywords,
  related_tickers = EXCLUDED.related_tickers,
  hero_summary_zh = EXCLUDED.hero_summary_zh, hero_summary_en = EXCLUDED.hero_summary_en,
  seo_body_zh = EXCLUDED.seo_body_zh, seo_body_en = EXCLUDED.seo_body_en,
  faq_items = EXCLUDED.faq_items, meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description, updated_at = CURRENT_TIMESTAMP;

-- Now fill in the seo_body for crypto-regulation
UPDATE topics SET
  seo_body_zh = '<h2>全球加密监管格局概览</h2>
<p>加密货币监管在全球呈现三足鼎立态势：美国以SEC为核心，侧重证券法适用性与执法；欧盟通过MiCA（加密资产市场法规）建立统一的许可制度；亚洲市场则分化明显——新加坡和香港走向开放，中国内地全面禁止。这种监管割裂直接影响加密企业的合规成本和市场进入策略。</p>
<h2>美国 SEC 的监管逻辑</h2>
<p>SEC核心主张是大多数加密代币构成"证券"，应受1933年《证券法》和1934年《证券交易法》约束。SEC已对Ripple（XRP诉讼）、Binance和Coinbase提起诉讼，并长期拒绝比特币和以太坊以外的现货ETF申请。Howey测试是判定代币是否为证券的法律基准。</p>
<h2>欧盟 MiCA：全球最完整的加密监管框架</h2>
<p>MiCA（Markets in Crypto-Assets）自2024年起分阶段生效，要求加密服务提供商（CASP）在欧盟持牌经营，并对稳定币发行人设立严格的储备要求。MiCA的"护照机制"允许持牌机构在全欧自由展业，被视为全球最接近完善的加密监管框架，也是其他监管机构的重要参考。</p>
<h2>稳定币监管的核心争议</h2>
<p>稳定币（USDT、USDC）的监管是各国讨论最激烈的议题。核心争议包括：储备资产的透明度与审计要求、稳定币发行人是否应持有银行牌照、以及与传统货币体系的竞争关系。美国、欧盟和英国均在推进专门的稳定币立法，进展将直接影响加密市场的流动性基础设施。</p>',
  seo_body_en = '<h2>Global Crypto Regulatory Landscape</h2>
<p>Crypto regulation is shaped by three major power centers: the US, led by the SEC, focuses on securities law applicability and enforcement; the EU is building a unified licensing regime through MiCA (Markets in Crypto-Assets); Asian markets are diverging sharply — Singapore and Hong Kong moving toward openness while mainland China maintains a comprehensive ban. This regulatory fragmentation directly impacts compliance costs and market entry strategies for crypto firms.</p>
<h2>The SEC''s Regulatory Logic</h2>
<p>The SEC''s core position is that most crypto tokens constitute "securities" subject to the 1933 Securities Act and 1934 Securities Exchange Act. The SEC has filed lawsuits against Ripple (XRP case), Binance and Coinbase, and long rejected spot ETF applications for assets beyond Bitcoin and Ethereum. The Howey Test is the legal benchmark for determining whether a token is a security.</p>
<h2>EU MiCA: The World''s Most Complete Crypto Framework</h2>
<p>MiCA (Markets in Crypto-Assets) is being phased in from 2024, requiring Crypto Asset Service Providers (CASPs) to be licensed in the EU, with strict reserve requirements for stablecoin issuers. MiCA''s "passport mechanism" allows licensed firms to operate freely across the EU — widely considered the world''s most advanced crypto regulatory framework and a key reference for other jurisdictions.</p>
<h2>The Central Controversy Around Stablecoin Regulation</h2>
<p>Stablecoin regulation (USDT, USDC) is the most hotly debated topic globally. Key disputes include: reserve asset transparency and audit requirements, whether stablecoin issuers should hold banking licenses, and competitive tension with traditional monetary systems. The US, EU and UK are all advancing dedicated stablecoin legislation — progress will directly impact crypto''s liquidity infrastructure.</p>',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'crypto-regulation';

-- ─────────────────────────────────────────────────────────────
-- 验证
-- ─────────────────────────────────────────────────────────────
SELECT slug, name_zh,
  CASE WHEN seo_body_zh IS NOT NULL THEN '✅' ELSE '❌' END as seo_body_zh,
  CASE WHEN seo_body_en IS NOT NULL THEN '✅' ELSE '❌' END as seo_body_en,
  CASE WHEN faq_items IS NOT NULL AND jsonb_array_length(faq_items) > 0 THEN '✅' ELSE '❌' END as faq_items
FROM topics
WHERE slug IN ('earnings','hk-stock-sectors','btc','fed','crypto-regulation')
ORDER BY slug;

COMMIT;
