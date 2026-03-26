import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/types';

export const metadata: Metadata = {
  title: '隐私政策',
  description: `${siteConfig.siteName} 隐私政策与用户数据说明。`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="container-main py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">隐私政策</h1>
      <p className="mt-2 text-xs text-slate-500">最近更新：2026 年 3 月</p>

      <div className="mt-8 space-y-6 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">1. 概述</h2>
          <p>
            本政策说明 {siteConfig.siteName}（以下简称「本站」）在提供资讯服务时，如何收集、使用与保护与您相关的信息。
            使用本站即表示您同意本政策。若您不同意，请停止使用本站。
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white mb-2">2. 我们收集的信息</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-400">
            <li><strong className="text-gray-300">浏览数据</strong>：页面访问、大致地区（由 CDN/服务器日志产生）等，用于安全与统计分析。</li>
            <li><strong className="text-gray-300">管理后台</strong>：仅限授权人员通过 Token 访问，不面向公众收集账户体系。</li>
            <li>本站<strong className="text-white">不要求</strong>普通读者注册即可浏览资讯。</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white mb-2">3. Cookie 与本地存储</h2>
          <p>
            本站可能使用必要的技术手段（如 Cookie 或本地存储）以维持会话、偏好或安全。您可通过浏览器设置管理 Cookie。
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white mb-2">4. 第三方链接</h2>
          <p>
            本站含跳转至 Yayapay、交易平台及外部新闻来源的链接。第三方站点的隐私实践由其自行负责，请查阅对方政策。
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white mb-2">5. 变更</h2>
          <p>我们可能适时修订本政策，更新后于本页发布。重大变更时将在站内适当位置提示。</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white mb-2">6. 联系我们</h2>
          <p>
            有关本政策的疑问，请通过{' '}
            <Link href="/contact" className="text-primary-400 hover:underline">
              联系我们
            </Link>{' '}
            页面所列渠道与母公司取得联系。
          </p>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/about" className="text-primary-400 hover:underline">
          关于我们
        </Link>
        <Link href="/" className="text-slate-500 hover:text-slate-300">
          返回首页
        </Link>
      </div>
    </div>
  );
}
