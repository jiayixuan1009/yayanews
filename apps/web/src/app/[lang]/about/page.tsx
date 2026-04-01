import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig, SITE_NAME_ZH, SITE_NAME_EN, SITE_SLOGAN_ZH, SITE_SLOGAN_EN } from '@yayanews/types';
import { createMetadata } from '@yayanews/seo';

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const isZh = params.lang !== 'en';
  return createMetadata({
    title: isZh ? '关于我们' : 'About Us',
    description: isZh
      ? `了解${SITE_NAME_ZH}（${SITE_NAME_EN}）——${SITE_SLOGAN_ZH}。我们致力于为全球投资者提供24/7实时美股、港股、加密货币及衍生品市场的权威资讯与深度分析。`
      : `About ${SITE_NAME_EN} — ${SITE_SLOGAN_EN}. Delivering 24/7 real-time coverage of US stocks, HK markets, crypto and derivatives.`,
    url: '/about',
    type: 'website',
    lang: params.lang as 'zh' | 'en',
  });
}

export default function AboutPage({ params }: { params: { lang: string } }) {
  const isZh = params.lang !== 'en';
  const brandName = isZh ? SITE_NAME_ZH : SITE_NAME_EN;
  const slogan = isZh ? SITE_SLOGAN_ZH : SITE_SLOGAN_EN;

  return (
    <div className="container-main py-12 md:py-20 lg:max-w-4xl mx-auto">
      {/* Header Section */}
      <header className="mb-12 text-center md:text-left border-b border-[#e7dfd2] pb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0d3b30] mb-4">
          {isZh ? '关于我们' : 'About Us'}
        </h1>
        <p className="text-xl md:text-2xl text-[#3a443e] font-medium max-w-2xl leading-relaxed">
          {brandName}：{slogan}
        </p>
      </header>

      <div className="prose prose-lg prose-slate max-w-none text-[#4f5551] leading-relaxed space-y-10">
        
        {/* Mission Section */}
        <section>
          <h2 className="text-2xl font-bold text-[#0d3b30] mb-4 flex items-center gap-2">
            <span className="text-emerald-500">I.</span> {isZh ? '我们的使命' : 'Our Mission'}
          </h2>
          {isZh ? (
            <>
              <p>
                在全球化交易日益互联的今天，信息差往往决定了投资结果。<strong>{SITE_NAME_ZH}（{SITE_NAME_EN}）</strong>
                的诞生正是为了打破这种信息壁垒。我们致力于打造亚洲最快、最专业、投资者最信赖的金融资讯聚合平台。
              </p>
              <p>
                通过自主研发的 AI 资讯引擎与资深金融编辑团队的结合，我们实现真正的 <strong>7×24 小时全天候新闻追踪</strong>
                ，确保核心市场动态在秒级触达专业投资者，让您在瞬息万变的市场中始终"快人一步"。
              </p>
            </>
          ) : (
            <>
              <p>
                In today&apos;s interconnected global markets, information asymmetry often determines investment outcomes. <strong>{SITE_NAME_EN}</strong> was
                created to break down these information barriers, building Asia&apos;s fastest, most professional, and most trusted financial news aggregation platform.
              </p>
              <p>
                Through our proprietary AI news engine combined with a seasoned financial editorial team, we deliver true <strong>24/7 real-time news tracking</strong>,
                ensuring critical market developments reach professional investors within seconds.
              </p>
            </>
          )}
        </section>

        {/* Coverage Section */}
        <section>
          <h2 className="text-2xl font-bold text-[#0d3b30] mb-6 flex items-center gap-2">
            <span className="text-emerald-500">II.</span> {isZh ? '全球市场核心覆盖' : 'Global Market Coverage'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 not-prose">
            <LocalizedLink href="/news/us-stock" className="block p-6 rounded-2xl bg-[#f8f5f0] border border-[#e7dfd2] hover:border-[#0d3b30] transition-colors">
              <h3 className="text-lg font-bold text-[#0d3b30] mb-2 flex items-center gap-2">
                🇺🇸 {isZh ? '美股与全球宏观' : 'US Equities & Global Macro'}
              </h3>
              <p className="text-sm text-[#667067] leading-relaxed">
                {isZh
                  ? '实时追踪纳斯达克、标普 500 等核心指数，覆盖科技巨头财报、美联储决议、宏观经济数据及华尔街一线投行研报。'
                  : 'Real-time tracking of NASDAQ, S&P 500 indices, covering tech earnings, Fed decisions, macro data and Wall Street research.'}
              </p>
            </LocalizedLink>
            
            <LocalizedLink href="/news/crypto" className="block p-6 rounded-2xl bg-[#f8f5f0] border border-[#e7dfd2] hover:border-[#0d3b30] transition-colors">
              <h3 className="text-lg font-bold text-[#0d3b30] mb-2 flex items-center gap-2">
                ₿ {isZh ? '加密资产与 Web3' : 'Crypto & Web3'}
              </h3>
              <p className="text-sm text-[#667067] leading-relaxed">
                {isZh
                  ? '全面监控 Bitcoin、Ethereum 行情异动，深度解析区块链行业政策、ETF 流入资金、链上数据及头部机构持仓变化。'
                  : 'Comprehensive monitoring of Bitcoin and Ethereum price action, blockchain policy analysis, ETF flows, on-chain data and institutional positions.'}
              </p>
            </LocalizedLink>

            <LocalizedLink href="/news/hk-stock" className="block p-6 rounded-2xl bg-[#f8f5f0] border border-[#e7dfd2] hover:border-[#0d3b30] transition-colors">
              <h3 className="text-lg font-bold text-[#0d3b30] mb-2 flex items-center gap-2">
                🇭🇰 {isZh ? '港股与亚太市场' : 'Hong Kong & Asia-Pacific Markets'}
              </h3>
              <p className="text-sm text-[#667067] leading-relaxed">
                {isZh
                  ? '紧盯恒生指数波动与南向资金走向，深度覆盖互联网核心蓝筹、新能源汽车及中概股重要新闻。'
                  : 'Tracking Hang Seng Index movements and southbound capital flows, covering internet blue chips, EV sector and Chinese ADRs.'}
              </p>
            </LocalizedLink>

            <LocalizedLink href="/news/derivatives" className="block p-6 rounded-2xl bg-[#f8f5f0] border border-[#e7dfd2] hover:border-[#0d3b30] transition-colors">
              <h3 className="text-lg font-bold text-[#0d3b30] mb-2 flex items-center gap-2">
                〽️ {isZh ? '衍生品与大宗商品' : 'Derivatives & Commodities'}
              </h3>
              <p className="text-sm text-[#667067] leading-relaxed">
                {isZh
                  ? '提供深入的期权异动分析、VIX 恐慌指数追踪，以及黄金、原油等核心大宗商品的实时报价与宏观逻辑推演。'
                  : 'In-depth options flow analysis, VIX tracking, and real-time pricing of gold, crude oil, and other key commodities.'}
              </p>
            </LocalizedLink>
          </div>
        </section>

        {/* Feature Section */}
        <section>
          <h2 className="text-2xl font-bold text-[#0d3b30] mb-4 flex items-center gap-2">
            <span className="text-emerald-500">III.</span> {isZh ? '我们的护城河：速度与质量' : 'Our Edge: Speed & Quality'}
          </h2>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>{isZh ? '毫秒级快讯矩阵：' : 'Millisecond Flash News: '}</strong>
              <LocalizedLink href="/flash" className="text-[#1d5c4f] hover:underline">
                {isZh ? '7×24 快讯流' : '24/7 Live Wire'}
              </LocalizedLink>
              {isZh
                ? ' 直接对接全球顶级通讯社与开源情报，使用自研算法去重解析，优先展示交易核心要素。'
                : ' — direct integration with global wire services and open-source intelligence, with proprietary deduplication algorithms.'}
            </li>
            <li>
              <strong>{isZh ? '结构化数据图表：' : 'Structured Data Charts: '}</strong>
              {isZh ? '提供涵盖所有资产类别的' : 'Providing '}
              <LocalizedLink href="/markets" className="text-[#1d5c4f] hover:underline">
                {isZh ? '全球行情看板' : 'global market dashboard'}
              </LocalizedLink>
              {isZh ? '，行情变动结合资讯，形成全景判断。' : ' across all asset classes, combining price action with news for holistic analysis.'}
            </li>
            <li>
              <strong>{isZh ? '编辑库准绳：' : 'Editorial Standards: '}</strong>
              {isZh
                ? '摒弃传统媒体的标题党与情绪化。我们只提供"信号、背景与连贯性"，把噪音降至最低。'
                : 'No clickbait, no sensationalism. We deliver signal, context, and continuity — minimizing noise.'}
            </li>
          </ul>
        </section>

        {/* Ecosystem Section */}
        <section className="bg-emerald-900/5 rounded-2xl p-8 border border-emerald-900/10 mt-12 not-prose">
          <h2 className="text-xl font-bold text-[#0d3b30] mb-3">
            {isZh ? '关于 BiyaPay 生态' : 'About the BiyaPay Ecosystem'}
          </h2>
          <p className="text-[#4f5551] text-sm leading-relaxed mb-6">
            {isZh
              ? `${SITE_NAME_ZH} 为 BiyaPay 生态系统下的独立资讯品牌。在获取最新一线投资观点的同时，您可以随时通过我们的兄弟平台享受一站式的法币与数字货币兑换及全球股票投资服务。`
              : `${SITE_NAME_EN} is an independent news brand under the BiyaPay ecosystem. While accessing cutting-edge investment insights, you can enjoy one-stop fiat-to-crypto exchange and global equity investment services through our partner platform.`}
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href={siteConfig.tradingSite} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center rounded-lg bg-[#0d3b30] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a4a3e] transition-colors"
            >
              {isZh ? '前往一站式投资平台' : 'Go to Trading Platform'}
            </a>
            <a 
              href={siteConfig.parentSite} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center rounded-lg border border-[#0d3b30] px-6 py-2.5 text-sm font-semibold text-[#0d3b30] hover:bg-[#0d3b30]/5 transition-colors"
            >
              {isZh ? '了解 BiyaPay' : 'Learn about BiyaPay'}
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
