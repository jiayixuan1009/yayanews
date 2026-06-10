import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { createMetadata } from '@yayanews/seo';
import { siteConfig } from '@yayanews/types';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  return createMetadata({
    title: locale === 'en' ? 'Corrections Policy' : '更正与撤稿政策',
    description: locale === 'en'
      ? 'How YayaNews reviews, corrects, updates and discloses material errors in financial news coverage.'
      : 'YayaNews 对财经新闻中的事实错误、重大更新与撤稿请求的审核、更正和披露流程。',
    url: '/corrections',
    type: 'website',
    lang: locale,
  });
}

export default async function CorrectionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'zh';
  const isEn = locale === 'en';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isEn ? 'Corrections Policy' : '更正与撤稿政策',
    url: `${siteConfig.siteUrl}/${locale}/corrections`,
    inLanguage: isEn ? 'en' : 'zh-CN',
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
    },
  };

  const steps = isEn
    ? [
        ['Report', 'Readers can report suspected factual errors, broken source links or missing context through the contact page.'],
        ['Review', 'Editors review the original source material, timestamps, market data and any relevant public filings.'],
        ['Correct', 'Material errors are corrected in the article body with a visible note when the change affects the meaning.'],
        ['Disclose', 'Major corrections, retractions or source disputes are recorded with the date of the change.'],
      ]
    : [
        ['提交', '读者可以通过联系页面提交事实错误、来源链接失效、上下文缺失等问题。'],
        ['复核', '编辑会复核原始来源、发布时间、市场数据以及相关公开文件。'],
        ['更正', '影响文章含义的事实错误会在正文中更正，并保留可见的更正说明。'],
        ['披露', '重大更正、撤稿或来源争议会记录更改日期和处理说明。'],
      ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-main py-10 sm:py-12 lg:max-w-3xl">
        <header className="border-b border-[#ddd5ca] pb-7">
          <p className="yn-meta text-[#1d5c4f]">{isEn ? 'Editorial trust' : '编辑信任'}</p>
          <h1 className="yn-page-title mt-3">{isEn ? 'Corrections Policy' : '更正与撤稿政策'}</h1>
          <p className="mt-4 text-sm leading-7 text-[#667067]">
            {isEn
              ? 'Financial news moves quickly. This policy explains how we handle factual corrections, material updates and retractions so readers can evaluate our coverage with context.'
              : '财经新闻节奏很快。本政策说明我们如何处理事实更正、重大更新与撤稿，让读者能在清楚上下文的情况下判断报道。'}
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map(([title, body]) => (
            <div key={title} className="yn-panel p-5">
              <h2 className="text-base font-semibold text-[#14261f]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667067]">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-5 text-sm leading-7 text-[#4a5250]">
          <h2 className="yn-heading-sm">{isEn ? 'What We Correct' : '更正范围'}</h2>
          <p>
            {isEn
              ? 'We correct factual inaccuracies, mislabeled data, incorrect dates, broken attribution, missing source context and material omissions. Style edits that do not change the meaning of an article may be updated without a separate notice.'
              : '我们会更正事实错误、数据标注错误、日期错误、出处归属错误、来源上下文缺失以及影响理解的重要遗漏。不影响文章含义的文字润色，可能不会单独发布说明。'}
          </p>
          <h2 className="yn-heading-sm">{isEn ? 'How to Reach Us' : '如何联系我们'}</h2>
          <p>
            {isEn
              ? 'Please include the article URL, the sentence or data point in question, and the source or evidence you believe supports the correction request.'
              : '提交更正请求时，请附上文章链接、具体句子或数据点，以及支持更正请求的来源或证据。'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LocalizedLink href="/contact" className="yn-link font-semibold">
              {isEn ? 'Contact editorial team' : '联系编辑团队'}
            </LocalizedLink>
            <LocalizedLink href="/editorial-policy" className="yn-link font-semibold">
              {isEn ? 'Editorial policy' : '编辑政策'}
            </LocalizedLink>
          </div>
        </section>
      </div>
    </>
  );
}
