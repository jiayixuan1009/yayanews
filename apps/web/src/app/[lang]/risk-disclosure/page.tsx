import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en' ? 'Risk Disclosure' : '风险披露',
    description: locale === 'en'
      ? 'YayaNews risk disclosure for financial news, market analysis, crypto assets, derivatives and investment-related content.'
      : 'YayaNews 关于财经资讯、市场分析、加密资产、衍生品及投资相关内容的风险披露与非投资建议声明。',
    url: '/risk-disclosure',
    type: 'website',
    lang: locale,
  });
}

export default async function RiskDisclosurePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const isEn = locale === 'en';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isEn ? 'Risk Disclosure' : '风险披露',
    url: `${siteConfig.siteUrl}/${locale}/risk-disclosure`,
    inLanguage: isEn ? 'en' : 'zh-CN',
    about: {
      '@type': 'Thing',
      name: isEn ? 'Financial risk disclosure' : '金融风险披露',
    },
  };

  const risks = isEn
    ? [
        'Market prices can move rapidly and may be affected by liquidity, leverage, macro events, regulation and exchange-specific conditions.',
        'Crypto assets and derivatives can be highly volatile and may involve loss of principal, liquidation risk and operational risk.',
        'Historical price performance, backtests or analyst views do not guarantee future results.',
        'News, data and analysis are provided for information only and should not be treated as personalized financial advice.',
      ]
    : [
        '市场价格可能因流动性、杠杆、宏观事件、监管变化和交易场所条件快速波动。',
        '加密资产与衍生品波动较大，可能涉及本金损失、强平风险与操作风险。',
        '历史价格表现、回测结果或分析观点不代表未来结果。',
        '本站新闻、数据与分析仅供信息参考，不构成个性化金融建议。',
      ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-10 sm:py-12 lg:max-w-3xl">
        <header className="border-b border-[#ddd5ca] pb-7">
          <p className="yn-meta text-[#1d5c4f]">{isEn ? 'Investor protection' : '投资者保护'}</p>
          <h1 className="yn-page-title mt-3">{isEn ? 'Risk Disclosure' : '风险披露'}</h1>
          <p className="mt-4 text-sm leading-7 text-[#667067]">
            {isEn
              ? 'YayaNews publishes financial news and market context. We do not provide personalized investment, legal, tax or accounting advice.'
              : 'YayaNews 发布财经资讯与市场背景信息。我们不提供个性化投资、法律、税务或会计建议。'}
          </p>
        </header>

        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-bold text-amber-900">{isEn ? 'Not Investment Advice' : '非投资建议'}</h2>
          <p className="mt-2 text-sm leading-7 text-amber-800">
            {isEn
              ? 'Any article, alert, quote, chart or market commentary on this site is informational. Readers should independently verify facts and consult qualified professionals before making financial decisions.'
              : '本站任何文章、快讯、报价、图表或市场评论均为信息参考。读者在做出金融决策前，应独立核实事实并咨询具备资质的专业人士。'}
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="yn-heading-sm">{isEn ? 'Key Risks' : '主要风险'}</h2>
          <ul className="space-y-3">
            {risks.map(item => (
              <li key={item} className="flex items-start gap-3 text-sm leading-7 text-[#4a5250]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d5c4f]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[#4a5250]">
          <h2 className="yn-heading-sm">{isEn ? 'Editorial Separation' : '编辑独立'}</h2>
          <p>
            {isEn
              ? 'Editorial coverage is separated from commercial partnerships. Sponsored or promotional material, if any, should be labeled according to our advertising policy.'
              : '编辑报道与商业合作保持分离。如存在赞助或推广内容，应按照广告政策进行标注。'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LocalizedLink href="/editorial-policy" className="yn-link font-semibold">
              {isEn ? 'Editorial policy' : '编辑政策'}
            </LocalizedLink>
            <LocalizedLink href="/advertising-policy" className="yn-link font-semibold">
              {isEn ? 'Advertising policy' : '广告政策'}
            </LocalizedLink>
          </div>
        </section>
      </div>
    </>
  );
}
