-- ============================================================
-- YayaNews Topic System Setup Script
-- Run on production: sudo -u postgres psql -d yayanews -f /tmp/setup_topics.sql
-- ============================================================

-- 1. Add new columns to topics table
ALTER TABLE topics ADD COLUMN IF NOT EXISTS topic_type VARCHAR(30) DEFAULT 'narrative';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS market VARCHAR(30);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS related_tickers TEXT[] DEFAULT '{}';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS hero_summary_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS hero_summary_en TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS seo_body_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS seo_body_en TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS faq_items JSONB DEFAULT '[]';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS meta_title VARCHAR(200);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS meta_description VARCHAR(500);

-- 2. Add tagging metadata columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS auto_topic_confidence INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS auto_topic_source VARCHAR(20) DEFAULT 'auto';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS topic_review_status VARCHAR(20) DEFAULT 'auto_approved';

-- 3. Ensure unique index on topic_articles
CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_articles_unique ON topic_articles(topic_id, article_id);

-- 4. Audit log table
CREATE TABLE IF NOT EXISTS topic_audit_log (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    old_topic_id INTEGER,
    new_topic_id INTEGER,
    old_confidence INTEGER,
    reviewer VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. Insert 10 base topics
-- ============================================================

INSERT INTO topics (slug, title, name_zh, name_en, description_zh, description_en, topic_type, market, priority, status, sort_order, keywords, related_tickers, hero_summary_zh, hero_summary_en, faq_items, meta_title, meta_description)
VALUES
-- 1. NVIDIA
('nvidia', 'NVIDIA AI Chip Dominance', '英伟达AI芯片霸权', 'NVIDIA AI Chip Dominance',
 '追踪英伟达在AI加速计算领域的战略布局、财报表现、竞争格局及供应链动态。',
 'Tracking NVIDIA''s strategic positioning in AI accelerated computing, earnings performance, competitive landscape and supply chain dynamics.',
 'company', 'us-stock', 95, 'active', 1,
 ARRAY['NVDA','英伟达','NVIDIA','AI芯片','GPU','H100','Blackwell','Jensen Huang','黄仁勋','数据中心'],
 ARRAY['NVDA','AMD','INTC','AVGO','TSM'],
 '英伟达（NVIDIA, $NVDA）凭借其GPU架构在AI训练和推理市场占据绝对主导地位。本专题持续追踪其财报季表现、数据中心业务增长、与AMD/Intel的竞争动态，以及全球AI算力资本开支趋势对其估值的影响。',
 'NVIDIA ($NVDA) dominates AI training and inference markets with its GPU architecture. This topic tracks its earnings performance, data center growth, competition with AMD/Intel, and how global AI capex trends impact its valuation.',
 '[{"q_zh":"英伟达的核心竞争优势是什么？","q_en":"What is NVIDIA''s core competitive advantage?","a_zh":"英伟达的核心优势在于其CUDA生态系统构建了极高的开发者锁定效应，配合世代领先的GPU架构（如H100/Blackwell），在AI训练算力市场占有率超过80%。","a_en":"NVIDIA''s core advantage lies in the CUDA ecosystem''s developer lock-in effect, combined with generation-leading GPU architectures (H100/Blackwell), commanding over 80% market share in AI training compute."},{"q_zh":"英伟达和AMD哪个更值得投资？","q_en":"NVIDIA vs AMD: which is a better investment?","a_zh":"英伟达在AI训练市场占据绝对主导，但估值较高；AMD的MI300X在推理市场具有价格竞争力。选择取决于投资者对AI资本开支增长持续性的判断。","a_en":"NVIDIA dominates AI training but trades at a premium; AMD''s MI300X is price-competitive in inference. The choice depends on your conviction about AI capex growth sustainability."},{"q_zh":"英伟达股票目前估值合理吗？","q_en":"Is NVIDIA stock fairly valued?","a_zh":"以当前预期EPS计算，英伟达PE约为35-40倍，低于历史高峰但高于半导体行业平均水平，合理性取决于AI资本开支能否维持当前增速。","a_en":"At current estimated EPS, NVIDIA trades at roughly 35-40x PE, below historical peaks but above semiconductor averages — valuation depends on AI capex growth sustaining its pace."}]'::jsonb,
 '英伟达AI芯片霸权 专题报道 | YayaNews 鸭鸭财经',
 '追踪英伟达NVDA在AI芯片领域的战略布局、财报分析、竞争格局。覆盖H100/Blackwell架构、数据中心业务及全球算力资本开支趋势。'
),
-- 2. Tesla
('tesla', 'Tesla & The EV Revolution', '特斯拉与电动车革命', 'Tesla & The EV Revolution',
 '追踪特斯拉的交付数据、自动驾驶进展、储能业务扩展及马斯克战略动态。',
 'Tracking Tesla''s delivery data, FSD progress, energy business expansion and Elon Musk''s strategic moves.',
 'company', 'us-stock', 90, 'active', 2,
 ARRAY['TSLA','特斯拉','Tesla','马斯克','Elon Musk','电动车','FSD','Cybertruck','Model Y','自动驾驶'],
 ARRAY['TSLA','RIVN','NIO','LI','XPEV','BYD'],
 '特斯拉（Tesla, $TSLA）不仅是全球电动车龙头，更是AI自动驾驶和储能技术的先驱。本专题持续追踪其季度交付量、FSD自动驾驶里程碑、Robotaxi商业化进度，以及马斯克的全球战略布局。',
 'Tesla ($TSLA) is not just the global EV leader but also a pioneer in AI-driven autonomous driving and energy storage. This topic tracks quarterly deliveries, FSD milestones, Robotaxi commercialization, and Musk''s global strategy.',
 '[{"q_zh":"特斯拉的自动驾驶技术安全吗？","q_en":"Is Tesla''s FSD technology safe?","a_zh":"FSD目前仍处于监督式自动驾驶阶段，司机必须保持注意力。特斯拉已累计收集超过数十亿英里的驾驶数据，但完全自动驾驶的安全性仍需监管机构认证。","a_en":"FSD is still at the supervised autonomy stage — drivers must remain attentive. Tesla has collected billions of miles of driving data, but full autonomy still requires regulatory certification."},{"q_zh":"特斯拉和比亚迪谁更有竞争力？","q_en":"Tesla vs BYD: who is more competitive?","a_zh":"特斯拉在北美和欧洲市场领先，技术品牌溢价高；比亚迪在中国和东南亚市场占据成本和产能优势。两者竞争格局取决于区域市场和产品定位。","a_en":"Tesla leads in North America and Europe with a tech brand premium; BYD dominates China and Southeast Asia with cost and capacity advantages. Competition depends on regional markets and product positioning."}]'::jsonb,
 '特斯拉与电动车革命 专题报道 | YayaNews 鸭鸭财经',
 '追踪特斯拉TSLA交付量、FSD自动驾驶、Robotaxi进展、储能业务及马斯克全球战略。'
),
-- 3. Apple
('apple', 'Apple Inc & Consumer Tech Ecosystem', '苹果公司与消费科技生态', 'Apple Inc & Consumer Tech Ecosystem',
 '追踪苹果公司的产品发布、财报表现、服务生态增长及Apple Intelligence AI战略。',
 'Tracking Apple''s product launches, earnings performance, Services ecosystem growth and Apple Intelligence AI strategy.',
 'company', 'us-stock', 88, 'active', 3,
 ARRAY['AAPL','苹果','Apple','库克','Tim Cook','iPhone','iPad','Mac','Apple Intelligence','Vision Pro'],
 ARRAY['AAPL','GOOG','MSFT','QCOM','SSNLF'],
 '苹果公司（Apple, $AAPL）是全球市值最大的科技公司之一。本专题追踪iPhone产品周期、Apple Intelligence AI功能落地、Services服务收入增长、Vision Pro生态扩展，及其全球供应链和监管挑战。',
 'Apple ($AAPL) is one of the world''s most valuable tech companies. This topic tracks iPhone product cycles, Apple Intelligence AI rollout, Services revenue growth, Vision Pro ecosystem expansion, and global supply chain and regulatory challenges.',
 '[{"q_zh":"苹果的AI战略和ChatGPT有什么区别？","q_en":"How does Apple Intelligence differ from ChatGPT?","a_zh":"Apple Intelligence侧重端侧AI处理和隐私保护，强调在设备上运行个人化AI；而ChatGPT是云端通用大模型。两者定位不同，苹果更注重生态集成。","a_en":"Apple Intelligence focuses on on-device AI processing and privacy, running personalized AI locally; ChatGPT is a cloud-based general-purpose LLM. They serve different purposes — Apple emphasizes ecosystem integration."}]'::jsonb,
 '苹果公司与消费科技生态 专题报道 | YayaNews 鸭鸭财经',
 '追踪苹果AAPL的iPhone产品周期、Apple Intelligence AI战略、Services服务收入及Vision Pro生态。'
),
-- 4. Microsoft × OpenAI
('microsoft-openai', 'Microsoft × OpenAI: AI Commercialization Race', '微软×OpenAI：AI商业化竞赛', 'Microsoft × OpenAI: AI Commercialization Race',
 '追踪微软与OpenAI的深度合作、ChatGPT商业化、Azure AI云增长及GPT模型迭代。',
 'Tracking the Microsoft-OpenAI partnership, ChatGPT commercialization, Azure AI cloud growth and GPT model iterations.',
 'company', 'us-stock', 87, 'active', 4,
 ARRAY['MSFT','微软','Microsoft','OpenAI','ChatGPT','GPT','Copilot','Sam Altman','Azure AI','GPT-4','GPT-5'],
 ARRAY['MSFT','GOOG','META','AMZN'],
 '微软（$MSFT）通过百亿美元投资与OpenAI深度绑定，将ChatGPT/GPT能力注入Azure云平台和Microsoft 365 Copilot。本专题追踪这一AI商业化竞赛中的产品进展、营收表现及竞争动态。',
 'Microsoft ($MSFT) is deeply tied to OpenAI through a multi-billion dollar investment, integrating ChatGPT/GPT capabilities into Azure and Microsoft 365 Copilot. This topic tracks product progress, revenue impact and competitive dynamics in the AI commercialization race.',
 '[{"q_zh":"微软投资OpenAI了多少钱？","q_en":"How much has Microsoft invested in OpenAI?","a_zh":"微软累计向OpenAI投资超过130亿美元，获得了OpenAI利润的分成权以及将GPT模型独家集成到Azure云平台的权利。","a_en":"Microsoft has invested over $13 billion in OpenAI, gaining profit-sharing rights and exclusive rights to integrate GPT models into the Azure cloud platform."}]'::jsonb,
 '微软×OpenAI AI商业化竞赛 专题报道 | YayaNews 鸭鸭财经',
 '追踪微软MSFT与OpenAI合作、ChatGPT商业化进展、Azure AI云增长及GPT模型迭代。'
),
-- 5. Bitcoin ETF
('bitcoin-etf', 'Bitcoin ETF: Institutional Gateway', '比特币ETF：机构入场通道', 'Bitcoin ETF: Institutional Gateway',
 '追踪比特币现货ETF的资金流向、机构持仓变化、新产品审批及对加密市场的结构性影响。',
 'Tracking spot Bitcoin ETF fund flows, institutional holdings shifts, new product approvals and structural impact on the crypto market.',
 'crypto_event', 'crypto', 92, 'active', 5,
 ARRAY['比特币ETF','Bitcoin ETF','BTC ETF','IBIT','GBTC','FBTC','现货ETF','Spot ETF','贝莱德','BlackRock','灰度','Grayscale','ETF资金流','SEC审批'],
 ARRAY['BTC','ETH','IBIT','GBTC','FBTC','ARKB','BITO'],
 '比特币现货ETF的获批标志着加密资产正式进入传统金融体系。本专题追踪IBIT、GBTC、FBTC等主要ETF的每日资金流入流出、机构持仓变化，以及以太坊ETF等新产品的审批进展。',
 'The approval of spot Bitcoin ETFs marks crypto''s formal entry into traditional finance. This topic tracks daily inflows/outflows of IBIT, GBTC, FBTC and other major ETFs, institutional holding changes, and new product approvals like Ethereum ETFs.',
 '[{"q_zh":"比特币ETF和直接买币有什么区别？","q_en":"What''s the difference between Bitcoin ETF and buying Bitcoin directly?","a_zh":"比特币ETF通过传统证券账户交易，无需管理私钥和钱包，受SEC监管保护；但可能有管理费，且不具备链上资产的自主控制权。","a_en":"Bitcoin ETFs trade through traditional brokerage accounts without managing private keys, and are SEC-regulated; however, they may charge management fees and you don''t have self-custody of the underlying asset."},{"q_zh":"哪个比特币ETF最好？","q_en":"Which Bitcoin ETF is the best to buy?","a_zh":"贝莱德的IBIT规模最大且费率较低（0.25%），灰度GBTC历史最久但费率较高（1.5%），富达FBTC费率有竞争力。选择取决于费率、流动性和券商支持。","a_en":"BlackRock''s IBIT has the largest AUM with a competitive fee (0.25%), Grayscale''s GBTC has the longest track record but higher fees (1.5%), and Fidelity''s FBTC offers competitive pricing. Choice depends on fees, liquidity and broker availability."}]'::jsonb,
 '比特币ETF机构入场通道 专题报道 | YayaNews 鸭鸭财经',
 '追踪比特币现货ETF资金流向、IBIT/GBTC机构持仓变化、新ETF审批及对加密市场的结构性影响。'
),
-- 6. Bitcoin Halving
('bitcoin-halving', 'Bitcoin Halving Cycle', '比特币减半周期', 'Bitcoin Halving Cycle',
 '追踪比特币区块奖励减半事件的时间线、对矿工经济和币价周期的影响。',
 'Tracking Bitcoin block reward halving events, their timeline, impact on mining economics and price cycles.',
 'crypto_event', 'crypto', 80, 'active', 6,
 ARRAY['比特币减半','Bitcoin Halving','BTC减半','减半周期','halving cycle','区块奖励','block reward','矿工','算力','hashrate'],
 ARRAY['BTC','MARA','RIOT','CLSK','HUT'],
 '比特币每约4年发生一次区块奖励减半，这是其通缩经济模型的核心机制。本专题追踪减半事件的倒计时、历史价格周期对比、矿工盈利能力变化及市场叙事演变。',
 'Bitcoin''s block reward halves approximately every 4 years — the core mechanism of its deflationary economic model. This topic tracks halving countdowns, historical price cycle comparisons, mining profitability shifts and evolving market narratives.',
 '[{"q_zh":"比特币减半是什么意思？","q_en":"What does Bitcoin halving mean?","a_zh":"比特币减半是指每产生210,000个区块后，矿工获得的区块奖励减少一半。这降低了新币的供应速率，历史上每次减半后12-18个月内比特币都出现了显著上涨。","a_en":"Bitcoin halving means the block reward miners receive is cut in half every 210,000 blocks. This reduces the rate of new supply — historically, Bitcoin has seen significant price appreciation 12-18 months after each halving."},{"q_zh":"减半后比特币一定会涨吗？","q_en":"Does Bitcoin always go up after halving?","a_zh":"历史上三次减半后比特币均大幅上涨，但过去表现不保证未来结果。减半减少供给端压力，但需求端受宏观环境、监管政策和市场情绪等多因素影响。","a_en":"Historically, Bitcoin has rallied significantly after all three previous halvings, but past performance doesn''t guarantee future results. Halving reduces supply-side pressure, but demand depends on macro conditions, regulation and market sentiment."}]'::jsonb,
 '比特币减半周期 专题报道 | YayaNews 鸭鸭财经',
 '追踪比特币BTC减半事件时间线、历史价格周期、矿工经济影响及市场供需变化。'
),
-- 7. Fed Interest Rates
('fed-interest-rates', 'Fed Interest Rates & Market Impact', '美联储利率政策与市场影响', 'Fed Interest Rates & Market Impact',
 '追踪美联储FOMC利率决议、鲍威尔讲话、通胀数据及对全球资产定价的影响。',
 'Tracking Fed FOMC rate decisions, Powell speeches, inflation data and their impact on global asset pricing.',
 'macro', 'derivatives', 93, 'active', 7,
 ARRAY['美联储','Fed','FOMC','利率','加息','降息','鲍威尔','Powell','CPI','通胀','联邦基金利率','美债','量化紧缩','QT','点阵图','dot plot'],
 ARRAY['TLT','SHY','GLD','DXY','SPY'],
 '美联储利率政策是全球资产定价的锚点。本专题追踪FOMC每次会议的利率决议、鲍威尔新闻发布会要点、CPI/非农等关键经济数据，以及利率路径变化对美股、美债、黄金和加密资产的传导机制。',
 'Fed interest rate policy is the anchor for global asset pricing. This topic tracks every FOMC meeting''s rate decision, Powell press conference highlights, CPI/NFP data, and how rate path changes transmit to equities, bonds, gold and crypto.',
 '[{"q_zh":"美联储什么时候会降息？","q_en":"When will the Fed cut interest rates?","a_zh":"降息时间取决于通胀数据（核心PCE）是否持续回落至2%目标附近，以及就业市场是否出现明显降温。市场可通过CME FedWatch工具追踪降息概率。","a_en":"Rate cut timing depends on whether inflation (core PCE) sustainably retreats toward the 2% target and whether the labor market shows clear cooling. Markets can track cut probabilities via the CME FedWatch tool."},{"q_zh":"加息对股市有什么影响？","q_en":"How do interest rate hikes affect the stock market?","a_zh":"加息提高企业融资成本和投资者的折现率，通常压制成长股估值（如科技股）。但如果加息伴随经济强劲增长，有些周期性行业如银行反而受益。","a_en":"Rate hikes raise corporate borrowing costs and investor discount rates, typically compressing growth stock valuations (like tech). However, if rate hikes accompany strong economic growth, cyclical sectors like banks can actually benefit."}]'::jsonb,
 '美联储利率政策与市场影响 专题报道 | YayaNews 鸭鸭财经',
 '追踪美联储FOMC利率决议、鲍威尔讲话、CPI通胀数据及对美股美债黄金加密资产的影响。'
),
-- 8. AI Boom
('artificial-intelligence-boom', 'The AI Boom: Investment & Disruption', 'AI浪潮：投资与变革', 'The AI Boom: Investment & Disruption',
 '追踪AI产业的技术突破、资本开支周期、概念股表现及对全行业的颠覆性影响。',
 'Tracking AI industry breakthroughs, capex cycles, stock performance and disruptive impact across all sectors.',
 'narrative', 'us-stock', 91, 'active', 8,
 ARRAY['AI浪潮','AI Boom','人工智能','大模型','LLM','生成式AI','Generative AI','AI芯片','AI算力','AI资本开支','AI概念股'],
 ARRAY['NVDA','MSFT','GOOG','META','AMZN','AVGO','ORCL','CRM','PLTR','AI'],
 '生成式AI正在引发自互联网以来最大的技术投资浪潮。本专题追踪大模型技术进展、AI芯片供应链动态、科技巨头的AI资本开支趋势，以及AI概念股的估值与泡沫辩论。',
 'Generative AI is sparking the largest technology investment wave since the internet. This topic tracks LLM breakthroughs, AI chip supply chain dynamics, Big Tech AI capex trends, and the valuation-vs-bubble debate for AI stocks.',
 '[{"q_zh":"AI概念股有哪些？","q_en":"What are the top AI stocks?","a_zh":"核心AI概念股包括：英伟达（NVDA, GPU算力）、微软（MSFT, Azure AI/Copilot）、谷歌（GOOG, Gemini）、Meta（META, Llama）、博通（AVGO, AI网络芯片）。此外Palantir(PLTR)和C3.ai(AI)也属AI应用层标的。","a_en":"Core AI stocks include NVIDIA (NVDA, GPU compute), Microsoft (MSFT, Azure AI/Copilot), Google (GOOG, Gemini), Meta (META, Llama), and Broadcom (AVGO, AI networking). Palantir (PLTR) and C3.ai (AI) represent the AI application layer."},{"q_zh":"AI投资是泡沫吗？","q_en":"Is the AI boom a bubble?","a_zh":"目前AI投资与2000年互联网泡沫有相似之处（高估值、资本疯狂涌入），但也有本质区别：AI公司（如NVDA、MSFT）拥有真实的营收增长和利润。关键在于AI资本开支的回报周期是否被市场正确定价。","a_en":"The AI investment wave shares similarities with the 2000 dot-com bubble (high valuations, capital frenzy), but differs fundamentally: AI companies like NVDA and MSFT have real revenue growth and profits. The key question is whether AI capex return cycles are correctly priced by markets."}]'::jsonb,
 'AI浪潮投资与变革 专题报道 | YayaNews 鸭鸭财经',
 '追踪AI产业技术突破、大模型进展、AI芯片供应链、科技巨头AI资本开支及AI概念股估值分析。'
),
-- 9. Earnings Season
('earnings-season', 'US Earnings Season Tracker', '美股财报季追踪', 'US Earnings Season Tracker',
 '追踪美股每季度财报季的重点公司业绩、盈利趋势及市场反应。',
 'Tracking key company results, earnings trends and market reactions during each US quarterly earnings season.',
 'earnings', 'us-stock', 85, 'active', 9,
 ARRAY['财报季','Earnings Season','美股财报','EPS','营收','盈利','财报日历','earnings calendar','earnings beat','guidance','业绩指引'],
 ARRAY['SPY','QQQ','NVDA','AAPL','MSFT','TSLA','GOOG','META','AMZN'],
 '美股财报季是每季度最重要的市场事件之一。本专题汇聚标普500核心公司的财报表现、EPS与营收对比预期、管理层盈利指引变化，以及财报季的整体盈利趋势分析。',
 'US earnings season is one of the most important quarterly market events. This topic aggregates S&P 500 core company results, EPS and revenue vs. estimates, management guidance changes, and overall earnings trend analysis.',
 '[{"q_zh":"财报季什么时候开始？","q_en":"When does earnings season start?","a_zh":"美股财报季通常在每季度结束后的第二周开始，即1月中旬、4月中旬、7月中旬和10月中旬。银行股通常率先发布财报。","a_en":"US earnings season typically starts in the second week after each quarter ends — mid-January, mid-April, mid-July and mid-October. Banks usually report first."},{"q_zh":"EPS超预期股价一定涨吗？","q_en":"Does beating EPS estimates guarantee a stock price increase?","a_zh":"不一定。即使EPS超预期，如果管理层下调未来指引（guidance）、营收增速放缓或市场已提前消化利好（buy the rumor, sell the news），股价仍可能下跌。","a_en":"Not necessarily. Even if EPS beats, the stock can still fall if management lowers forward guidance, revenue growth slows, or the market has already priced in the beat (buy the rumor, sell the news)."}]'::jsonb,
 '美股财报季追踪 专题报道 | YayaNews 鸭鸭财经',
 '追踪美股每季度财报季重点公司业绩表现、EPS与营收预期对比、盈利趋势及市场反应。'
),
-- 10. Crypto Regulation
('crypto-regulation', 'Global Crypto Regulation Watch', '全球加密货币监管动态', 'Global Crypto Regulation Watch',
 '追踪全球主要经济体的加密货币监管政策、SEC执法动态及合规框架演变。',
 'Tracking crypto regulatory policies across major economies, SEC enforcement actions and evolving compliance frameworks.',
 'narrative', 'crypto', 84, 'active', 10,
 ARRAY['加密监管','Crypto Regulation','SEC','加密合规','稳定币','Stablecoin','MiCA','KYC','AML','反洗钱','加密牌照'],
 ARRAY['BTC','ETH','BNB','SOL','USDT','USDC','COIN'],
 '加密货币监管正在全球范围内快速演变。本专题追踪美国SEC的执法行动与诉讼、欧盟MiCA法规实施、稳定币监管框架、各国加密牌照制度，以及监管政策对市场情绪和资产价格的影响。',
 'Crypto regulation is rapidly evolving globally. This topic tracks SEC enforcement actions and lawsuits, EU MiCA implementation, stablecoin regulation frameworks, national licensing regimes, and how regulatory policy impacts market sentiment and asset prices.',
 '[{"q_zh":"加密货币在中国合法吗？","q_en":"Is cryptocurrency legal in China?","a_zh":"中国自2021年起全面禁止加密货币交易和挖矿活动，但持有加密资产本身并未被明确定为违法。在岸交易所和ICO均被禁止。","a_en":"China has banned all crypto trading and mining activities since 2021, though holding crypto assets is not explicitly illegal. Onshore exchanges and ICOs are all prohibited."},{"q_zh":"美国SEC对加密货币的态度是什么？","q_en":"What is the SEC''s stance on cryptocurrency?","a_zh":"SEC将大部分加密代币视为证券，已对Ripple、Binance、Coinbase等发起诉讼。SEC要求加密项目进行证券注册，但行业普遍反对这一分类标准。","a_en":"The SEC classifies most crypto tokens as securities and has filed lawsuits against Ripple, Binance, and Coinbase. It requires crypto projects to register as securities, though the industry broadly contests this classification framework."}]'::jsonb,
 '全球加密货币监管动态 专题报道 | YayaNews 鸭鸭财经',
 '追踪全球加密货币监管政策、SEC执法诉讼、MiCA法规、稳定币监管及对加密市场的影响。'
)
ON CONFLICT (slug) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    topic_type = EXCLUDED.topic_type,
    market = EXCLUDED.market,
    priority = EXCLUDED.priority,
    keywords = EXCLUDED.keywords,
    related_tickers = EXCLUDED.related_tickers,
    hero_summary_zh = EXCLUDED.hero_summary_zh,
    hero_summary_en = EXCLUDED.hero_summary_en,
    faq_items = EXCLUDED.faq_items,
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- 6. Set related_topics links
-- ============================================================
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='artificial-intelligence-boom') WHERE slug='nvidia';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='nvidia') || (SELECT ARRAY[id] FROM topics WHERE slug='artificial-intelligence-boom') WHERE slug='microsoft-openai';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='crypto-regulation') || (SELECT ARRAY[id] FROM topics WHERE slug='bitcoin-halving') WHERE slug='bitcoin-etf';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='bitcoin-etf') WHERE slug='bitcoin-halving';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='bitcoin-etf') WHERE slug='crypto-regulation';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='nvidia') || (SELECT ARRAY[id] FROM topics WHERE slug='microsoft-openai') WHERE slug='artificial-intelligence-boom';
UPDATE topics SET related_topics = (SELECT ARRAY[id] FROM topics WHERE slug='fed-interest-rates') WHERE slug='earnings-season';

-- ============================================================
-- 7. Auto-match existing articles to topics
-- ============================================================

-- nvidia: match by title keywords or tickers
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'nvidia'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%英伟达%' OR a.title ILIKE '%NVIDIA%' OR a.title ILIKE '%NVDA%'
    OR a.title ILIKE '%Jensen Huang%' OR a.title ILIKE '%黄仁勋%'
    OR a.tickers ILIKE '%NVDA%'
  )
ON CONFLICT DO NOTHING;

-- tesla
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'tesla'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%特斯拉%' OR a.title ILIKE '%Tesla%' OR a.title ILIKE '%TSLA%'
    OR a.title ILIKE '%马斯克%' OR a.title ILIKE '%Elon Musk%'
    OR a.title ILIKE '%Cybertruck%' OR a.title ILIKE '%Model Y%'
    OR a.tickers ILIKE '%TSLA%'
  )
ON CONFLICT DO NOTHING;

-- apple
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'apple'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%苹果%' OR a.title ILIKE '%Apple%' OR a.title ILIKE '%AAPL%'
    OR a.title ILIKE '%iPhone%' OR a.title ILIKE '%库克%' OR a.title ILIKE '%Tim Cook%'
    OR a.title ILIKE '%Vision Pro%' OR a.title ILIKE '%Apple Intelligence%'
    OR a.tickers ILIKE '%AAPL%'
  )
ON CONFLICT DO NOTHING;

-- microsoft-openai
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'microsoft-openai'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%OpenAI%' OR a.title ILIKE '%ChatGPT%' OR a.title ILIKE '%GPT-4%' OR a.title ILIKE '%GPT-5%'
    OR (a.title ILIKE '%微软%' AND (a.title ILIKE '%AI%' OR a.title ILIKE '%Copilot%'))
    OR (a.title ILIKE '%Microsoft%' AND (a.title ILIKE '%AI%' OR a.title ILIKE '%OpenAI%'))
    OR a.title ILIKE '%Sam Altman%'
    OR a.tickers ILIKE '%MSFT%'
  )
ON CONFLICT DO NOTHING;

-- bitcoin-etf
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'bitcoin-etf'
  AND a.status = 'published'
  AND (
    (a.title ILIKE '%比特币%' AND a.title ILIKE '%ETF%')
    OR (a.title ILIKE '%Bitcoin%' AND a.title ILIKE '%ETF%')
    OR (a.title ILIKE '%BTC%' AND a.title ILIKE '%ETF%')
    OR a.title ILIKE '%IBIT%' OR a.title ILIKE '%GBTC%'
    OR a.title ILIKE '%现货ETF%' OR a.title ILIKE '%Spot ETF%'
  )
ON CONFLICT DO NOTHING;

-- bitcoin-halving
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'bitcoin-halving'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%减半%' OR a.title ILIKE '%halving%'
    OR (a.title ILIKE '%比特币%' AND a.title ILIKE '%区块奖励%')
    OR (a.title ILIKE '%Bitcoin%' AND a.title ILIKE '%block reward%')
  )
ON CONFLICT DO NOTHING;

-- fed-interest-rates
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'fed-interest-rates'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%美联储%' OR a.title ILIKE '%FOMC%' OR a.title ILIKE '%联邦基金利率%'
    OR a.title ILIKE '%鲍威尔%' OR a.title ILIKE '%Powell%'
    OR a.title ILIKE '%加息%' OR a.title ILIKE '%降息%'
    OR a.title ILIKE '%Fed%rate%' OR a.title ILIKE '%interest rate%'
    OR (a.title ILIKE '%央行%' AND a.title ILIKE '%利率%')
  )
ON CONFLICT DO NOTHING;

-- artificial-intelligence-boom (broader AI industry, exclude company-specific)
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'artificial-intelligence-boom'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%AI浪潮%' OR a.title ILIKE '%AI Boom%'
    OR a.title ILIKE '%AI概念股%' OR a.title ILIKE '%AI stocks%'
    OR a.title ILIKE '%大模型%' OR a.title ILIKE '%LLM%'
    OR a.title ILIKE '%生成式AI%' OR a.title ILIKE '%Generative AI%'
    OR a.title ILIKE '%AI芯片%' OR a.title ILIKE '%AI chip%'
    OR a.title ILIKE '%人工智能%' OR a.title ILIKE '%artificial intelligence%'
    OR a.title ILIKE '%AI算力%' OR a.title ILIKE '%AI compute%'
    OR a.title ILIKE '%AI资本开支%' OR a.title ILIKE '%AI capex%'
    OR a.category_id = (SELECT id FROM categories WHERE slug='ai' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- earnings-season
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'earnings-season'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%财报季%' OR a.title ILIKE '%Earnings Season%'
    OR a.title ILIKE '%财报%' OR a.title ILIKE '%earnings%'
    OR a.title ILIKE '%EPS%' OR a.title ILIKE '%营收%超%'
    OR a.title ILIKE '%业绩%' OR a.title ILIKE '%quarterly results%'
  )
ON CONFLICT DO NOTHING;

-- crypto-regulation
INSERT INTO topic_articles (topic_id, article_id)
SELECT t.id, a.id FROM topics t, articles a
WHERE t.slug = 'crypto-regulation'
  AND a.status = 'published'
  AND (
    a.title ILIKE '%加密监管%' OR a.title ILIKE '%Crypto Regulation%'
    OR a.title ILIKE '%加密货币监管%'
    OR (a.title ILIKE '%SEC%' AND (a.title ILIKE '%加密%' OR a.title ILIKE '%crypto%' OR a.title ILIKE '%币%'))
    OR a.title ILIKE '%稳定币法案%' OR a.title ILIKE '%Stablecoin Act%'
    OR a.title ILIKE '%MiCA%'
    OR (a.title ILIKE '%监管%' AND (a.title ILIKE '%加密%' OR a.title ILIKE '%crypto%'))
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Set primary topic_id for articles (highest-priority topic wins)
-- ============================================================
UPDATE articles a SET topic_id = sub.topic_id
FROM (
    SELECT DISTINCT ON (ta.article_id) ta.article_id, ta.topic_id
    FROM topic_articles ta
    JOIN topics t ON t.id = ta.topic_id
    ORDER BY ta.article_id, t.priority DESC
) sub
WHERE a.id = sub.article_id AND a.topic_id IS NULL;

-- Done! Print summary
SELECT t.slug, t.name_zh, COUNT(ta.article_id) as article_count
FROM topics t
LEFT JOIN topic_articles ta ON ta.topic_id = t.id
GROUP BY t.id, t.slug, t.name_zh
ORDER BY t.sort_order;
