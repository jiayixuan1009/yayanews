import type { Metadata } from 'next';
import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@/lib/types';

export const metadata: Metadata = {
  title: '关于我们',
  description: `${siteConfig.siteName} 是面向中文用户的金融资讯平台，覆盖美股、港股、加密货币与衍生品市场。`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="container-main py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">关于 {siteConfig.siteName}</h1>
      <div className="mt-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <p>
          {siteConfig.siteName}（丫丫资讯）致力于为全球中文读者提供<strong className="text-white">及时、专业</strong>
          的金融与市场资讯，内容覆盖美股、港股、加密货币、区块链及衍生品与大宗商品等领域。
        </p>
        <p>
          我们结合多源市场数据与编辑流程，提供<strong className="text-white">7×24 快讯</strong>、深度资讯与专题聚合，
          帮助用户把握全球市场动态。资讯仅供信息参考，不构成任何投资建议。
        </p>
        <p>
          {siteConfig.siteName} 为{' '}
          <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            Yayapay
          </a>{' '}
          生态下的资讯站点。交易与开户请前往{' '}
          <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            交易平台
          </a>
          。
        </p>
      </div>
      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <LocalizedLink href="/contact" className="text-primary-400 hover:underline">
          联系我们
        </LocalizedLink>
        <LocalizedLink href="/privacy" className="text-primary-400 hover:underline">
          隐私政策
        </LocalizedLink>
        <LocalizedLink href="/" className="text-slate-500 hover:text-slate-300">
          返回首页
        </LocalizedLink>
      </div>
    </div>
  );
}
