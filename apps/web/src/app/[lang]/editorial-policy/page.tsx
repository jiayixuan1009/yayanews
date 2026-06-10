import type { Metadata } from 'next';
import { SITE_NAME_ZH, SITE_NAME_EN } from '@yayanews/types';
import { createMetadata } from '@yayanews/seo';
import EditorialPolicyPage from '../editorial/EditorialPolicyPage';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const isZh = lang !== 'en';
  return createMetadata({
    title: isZh ? '编辑标准与内容政策' : 'Editorial Standards & Content Policy',
    description: isZh
      ? `${SITE_NAME_ZH} 编辑标准、内容审核流程、来源核实政策及免责声明。了解我们如何确保财经资讯的准确性、及时性与公正性。`
      : `${SITE_NAME_EN} editorial standards, content review process, source verification policy and disclaimer. How we ensure accuracy, timeliness and impartiality.`,
    url: '/editorial-policy',
    type: 'website',
    lang: lang as 'zh' | 'en',
  });
}

export default EditorialPolicyPage;
