import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { SITE_NAME_ZH, SITE_NAME_EN } from '@yayanews/types';
import { createMetadata } from '@yayanews/seo';

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const isZh = params.lang !== 'en';
  return createMetadata({
    title: isZh ? '编辑标准与内容政策' : 'Editorial Standards & Content Policy',
    description: isZh
      ? `${SITE_NAME_ZH}编辑标准、内容审核流程、来源核实政策及免责声明。我们如何确保财经资讯的准确性、及时性与公正性。`
      : `${SITE_NAME_EN} editorial standards, content review process, source verification policy and disclaimer. How we ensure accuracy, timeliness and impartiality.`,
    url: '/editorial',
    type: 'website',
    lang: params.lang as 'zh' | 'en',
  });
}

export default function EditorialPage({ params }: { params: { lang: string } }) {
  const isZh = params.lang !== 'en';

  return (
    <div className="container-main py-12 md:py-20 lg:max-w-3xl mx-auto">
      <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
        <LocalizedLink href="/" className="hover:text-[#1d5c4f]">
          {isZh ? '首页' : 'Home'}
        </LocalizedLink>
        <span>/</span>
        <span className="text-slate-800">{isZh ? '编辑政策' : 'Editorial Policy'}</span>
      </nav>

      <header className="mb-12 border-b border-[#e7dfd2] pb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#1d5c4f]">
          {isZh ? '编辑标准' : 'Editorial Standards'}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#0d3b30]">
          {isZh ? '内容政策与编辑准则' : 'Content Policy & Editorial Guidelines'}
        </h1>
        <p className="mt-4 text-base leading-7 text-[#4a5250]">
          {isZh
            ? `${SITE_NAME_ZH}致力于为投资者提供准确、及时、公正的财经资讯。本页说明我们的内容标准、编辑流程与信息来源政策。`
            : `${SITE_NAME_EN} is committed to delivering accurate, timely and impartial financial news to investors. This page explains our content standards, editorial process and sourcing policy.`}
        </p>
      </header>

      <div className="space-y-12 text-[#14261f]">

        {/* 1. 内容分类与定义 */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-[#0d3b30]">
            {isZh ? '一、内容分类定义' : '1. Content Classification'}
          </h2>
          <div className="space-y-4 text-sm leading-7 text-[#4a5250]">
            <div className="border-l-2 border-[#1d5c4f] pl-4">
              <p className="font-semibold text-[#0d3b30]">{isZh ? '快讯（Flash）' : 'Flash News'}</p>
              <p>{isZh
                ? '基于原始来源的时效性摘要，以第一时间传达市场关键信号为目标。不做深度解读，注重速度与准确性。'
                : 'Time-sensitive summaries based on original sources, focused on delivering key market signals first. No deep analysis — speed and accuracy are paramount.'}</p>
            </div>
            <div className="border-l-2 border-[#1d5c4f] pl-4">
              <p className="font-semibold text-[#0d3b30]">{isZh ? '资讯（Standard）' : 'Standard News'}</p>
              <p>{isZh
                ? '事件覆盖类稿件，包含背景信息、多来源核实及"这意味着什么"的市场解读。'
                : 'Event coverage with background context, multi-source verification and market implications.'}</p>
            </div>
            <div className="border-l-2 border-[#cfa840] pl-4">
              <p className="font-semibold text-[#0d3b30]">{isZh ? '深度分析（Deep Dive）' : 'Deep Dive Analysis'}</p>
              <p>{isZh
                ? '长篇解读类稿件，必须包含：核心判断、支撑依据、反驳观点及风险提示。作者需具备相关领域专业背景。'
                : 'Long-form analysis requiring: core thesis, supporting evidence, counter-arguments and risk disclosures. Authors must have relevant domain expertise.'}</p>
            </div>
          </div>
        </section>

        {/* 2. 来源核实标准 */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-[#0d3b30]">
            {isZh ? '二、来源核实标准' : '2. Source Verification Standards'}
          </h2>
          <ul className="space-y-3 text-sm leading-7 text-[#4a5250]">
            {(isZh ? [
              '所有新闻稿件须标注原始来源，可查阅的一手资料优先（官方公告、监管文件、财报原文）。',
              '二手来源（通讯社转发、媒体报道）须注明原始机构，并在内文体现其来源属性。',
              '观点类内容须明确标注为"分析"或"评论"，与事实性报道区分呈现。',
              'AI 辅助撰写的稿件须经人工编辑核实关键数据及事实，方可发布。',
              '涉及价格、数据的稿件，数据截止时间须在正文或标题中体现。',
            ] : [
              'All articles must cite primary sources where available (official announcements, regulatory filings, earnings releases).',
              'Secondary sources (wire services, media reports) must credit the originating institution.',
              'Opinion and analysis pieces must be clearly labeled as such, distinct from factual reporting.',
              'AI-assisted content must be reviewed and fact-checked by human editors before publication.',
              'Articles citing price data or statistics must specify the data cutoff date.',
            ]).map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d5c4f]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. 编辑独立性 */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-[#0d3b30]">
            {isZh ? '三、编辑独立性声明' : '3. Editorial Independence'}
          </h2>
          <p className="text-sm leading-7 text-[#4a5250]">
            {isZh
              ? `${SITE_NAME_ZH}的编辑内容与商业合作完全隔离。广告主、合作伙伴及关联公司不得干预新闻报道的角度与内容。编辑团队保留对任何内容的最终决策权。`
              : `${SITE_NAME_EN}'s editorial content is completely separated from commercial partnerships. Advertisers, partners and affiliates have no influence over news coverage angle or content. The editorial team retains final decision-making authority over all content.`}
          </p>
        </section>

        {/* 4. 更正政策 */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-[#0d3b30]">
            {isZh ? '四、更正与撤稿政策' : '4. Corrections & Retractions'}
          </h2>
          <p className="text-sm leading-7 text-[#4a5250]">
            {isZh
              ? '发现事实性错误后，我们将在原文底部标注"更正"说明，注明原内容与更正内容及更正时间。重大错误将在显要位置单独说明。不影响核心内容的表述调整不做单独标注。如需举报内容错误，请通过联系页面告知我们。'
              : 'When factual errors are identified, we append a clearly labeled correction at the bottom of the original article, noting the original claim, the correction and the date. Significant errors receive a prominent standalone notice. Stylistic edits that do not affect core content are not separately disclosed. To report an error, please use our contact page.'}
          </p>
          <div className="mt-4">
            <LocalizedLink
              href="/contact"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d5c4f] hover:underline"
            >
              {isZh ? '联系编辑团队 →' : 'Contact the editorial team →'}
            </LocalizedLink>
          </div>
        </section>

        {/* 5. 免责声明 */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-3 text-base font-bold text-amber-900">
            {isZh ? '五、投资免责声明' : '5. Investment Disclaimer'}
          </h2>
          <p className="text-sm leading-7 text-amber-800">
            {isZh
              ? `${SITE_NAME_ZH}发布的所有内容仅供参考，不构成任何投资建议、买卖推荐或专业金融咨询。投资者在做出任何投资决策前，应自行评估风险，必要时咨询持牌金融顾问。市场有风险，投资需谨慎。`
              : `All content published by ${SITE_NAME_EN} is for informational purposes only and does not constitute investment advice, a solicitation to buy or sell, or professional financial advice. Investors should conduct their own due diligence and consult a licensed financial advisor before making investment decisions. Markets involve risk.`}
          </p>
        </section>

      </div>

      <div className="mt-12 border-t border-[#e7dfd2] pt-8 text-xs text-[#667067]">
        {isZh
          ? `本政策最后更新于 ${new Date().toISOString().slice(0, 10)}。如有疑问，请联系我们的编辑团队。`
          : `This policy was last updated ${new Date().toISOString().slice(0, 10)}. For questions, contact our editorial team.`}
      </div>
    </div>
  );
}
