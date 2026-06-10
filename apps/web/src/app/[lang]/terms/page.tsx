import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en' ? 'Terms of Service' : '服务条款',
    description: locale === 'en'
      ? 'Terms for using YayaNews financial news, market information and related website services.'
      : '使用 YayaNews 财经资讯、市场信息及相关网站服务的条款说明。',
    url: '/terms',
    type: 'website',
    lang: locale,
  });
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const isEn = locale === 'en';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isEn ? 'Terms of Service' : '服务条款',
    url: `${siteConfig.siteUrl}/${locale}/terms`,
    inLanguage: isEn ? 'en' : 'zh-CN',
  };
  const sections = isEn
    ? [
        ['Informational use', 'YayaNews provides financial news, market context and educational content for informational purposes only.'],
        ['No advice', 'Content on this site is not personalized investment, legal, tax or accounting advice.'],
        ['Third-party links', 'External links are provided for reference. Third-party sites are responsible for their own content, policies and services.'],
        ['Availability', 'We may update, suspend or change website features, data sources and content formats as the product evolves.'],
      ]
    : [
        ['信息用途', 'YayaNews 提供财经新闻、市场背景和教育内容，仅供信息参考。'],
        ['非建议声明', '本站内容不构成个性化投资、法律、税务或会计建议。'],
        ['第三方链接', '外部链接仅供参考，第三方网站对其自身内容、政策和服务负责。'],
        ['服务可用性', '随着产品演进，我们可能更新、暂停或调整网站功能、数据来源和内容格式。'],
      ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-10 sm:py-12 lg:max-w-3xl">
        <header className="border-b border-[#ddd5ca] pb-7">
          <p className="yn-meta text-[#1d5c4f]">{isEn ? 'Legal' : '法律条款'}</p>
          <h1 className="yn-page-title mt-3">{isEn ? 'Terms of Service' : '服务条款'}</h1>
          <p className="mt-4 text-sm leading-7 text-[#667067]">
            {isEn
              ? `These terms describe the basic conditions for using ${siteConfig.siteName}.`
              : `以下条款说明使用 ${siteConfig.siteName} 的基本条件。`}
          </p>
        </header>

        <section className="mt-8 space-y-5">
          {sections.map(([title, body]) => (
            <div key={title}>
              <h2 className="yn-heading-sm">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#4a5250]">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-[#ddd5ca] bg-white/70 p-5 text-sm leading-7 text-[#4a5250]">
          <h2 className="text-base font-semibold text-[#14261f]">{isEn ? 'Related Policies' : '相关政策'}</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <LocalizedLink href="/privacy" className="yn-link font-semibold">
              {isEn ? 'Privacy policy' : '隐私政策'}
            </LocalizedLink>
            <LocalizedLink href="/risk-disclosure" className="yn-link font-semibold">
              {isEn ? 'Risk disclosure' : '风险披露'}
            </LocalizedLink>
            <LocalizedLink href="/contact" className="yn-link font-semibold">
              {isEn ? 'Contact' : '联系我们'}
            </LocalizedLink>
          </div>
        </section>
      </div>
    </>
  );
}
