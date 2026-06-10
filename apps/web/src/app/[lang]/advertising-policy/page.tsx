import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en' ? 'Advertising Policy' : '广告与赞助政策',
    description: locale === 'en'
      ? 'YayaNews advertising policy covering editorial independence, sponsorship labeling and commercial content separation.'
      : 'YayaNews 广告与赞助政策，说明编辑独立、赞助标注和商业内容分离原则。',
    url: '/advertising-policy',
    type: 'website',
    lang: locale,
  });
}

export default async function AdvertisingPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const isEn = locale === 'en';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isEn ? 'Advertising Policy' : '广告与赞助政策',
    url: `${siteConfig.siteUrl}/${locale}/advertising-policy`,
    inLanguage: isEn ? 'en' : 'zh-CN',
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
    },
  };

  const principles = isEn
    ? [
        ['Editorial independence', 'Advertisers, affiliates and commercial partners do not control newsroom assignments, headlines, rankings or conclusions.'],
        ['Clear labeling', 'Sponsored, promotional or affiliate content should be clearly labeled when it appears on YayaNews.'],
        ['Separation', 'News articles and analysis are produced separately from advertising sales and business development.'],
        ['Corrections', 'Potential conflicts, labeling errors or misleading sponsored content can be reported through our contact page.'],
      ]
    : [
        ['编辑独立', '广告主、关联方和商业合作伙伴不得控制新闻选题、标题、排序或结论。'],
        ['清晰标注', '如 YayaNews 出现赞助、推广或联盟内容，应进行清晰标注。'],
        ['内容分离', '新闻报道和分析内容与广告销售、商务拓展流程保持分离。'],
        ['问题反馈', '潜在利益冲突、标注错误或误导性赞助内容可通过联系页面反馈。'],
      ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-10 sm:py-12 lg:max-w-3xl">
        <header className="border-b border-[#ddd5ca] pb-7">
          <p className="yn-meta text-[#1d5c4f]">{isEn ? 'Commercial transparency' : '商业透明度'}</p>
          <h1 className="yn-page-title mt-3">{isEn ? 'Advertising Policy' : '广告与赞助政策'}</h1>
          <p className="mt-4 text-sm leading-7 text-[#667067]">
            {isEn
              ? 'This policy explains how YayaNews separates editorial coverage from advertising, sponsorships and commercial partnerships.'
              : '本政策说明 YayaNews 如何将编辑报道与广告、赞助和商业合作保持分离。'}
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {principles.map(([title, body]) => (
            <div key={title} className="yn-panel p-5">
              <h2 className="text-base font-semibold text-[#14261f]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667067]">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-5 text-sm leading-7 text-[#4a5250]">
          <h2 className="yn-heading-sm">{isEn ? 'Sponsored Content' : '赞助内容'}</h2>
          <p>
            {isEn
              ? 'If sponsored content is published, the sponsorship relationship should be visible near the content and should not be presented as independent editorial analysis.'
              : '如发布赞助内容，应在内容附近清晰展示赞助关系，不应将其包装为独立编辑分析。'}
          </p>
          <h2 className="yn-heading-sm">{isEn ? 'Affiliate Links' : '联盟链接'}</h2>
          <p>
            {isEn
              ? 'Some outbound links may point to partner products or services. Such links do not change our editorial standards or risk disclosure obligations.'
              : '部分外链可能指向合作方产品或服务。此类链接不改变我们的编辑标准或风险披露义务。'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LocalizedLink href="/contact" className="yn-link font-semibold">
              {isEn ? 'Report a concern' : '反馈问题'}
            </LocalizedLink>
            <LocalizedLink href="/risk-disclosure" className="yn-link font-semibold">
              {isEn ? 'Risk disclosure' : '风险披露'}
            </LocalizedLink>
          </div>
        </section>
      </div>
    </>
  );
}
