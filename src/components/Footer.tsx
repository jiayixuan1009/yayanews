import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@/lib/types';

const footerColumns = {
  Organization: [
    { label: 'About Us', href: '/about' },
    { label: 'Editorial Guidelines', href: '/guide' },
    { label: 'Masthead', href: '/topics' },
    { label: 'Contact', href: '/contact' },
  ],
  Coverage: [
    { label: 'Markets', href: '/news/us-stock' },
    { label: 'Crypto', href: '/news/crypto' },
    { label: 'Derivatives', href: '/news/derivatives' },
    { label: 'AI', href: '/news/ai' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/privacy' },
  ],
};

export default function Footer({ lang = 'zh' }: { lang?: string }) {
  return (
    <footer className="border-t border-[#0c3b31] bg-[#003326] text-emerald-50">
      <div className="container-main py-12 sm:py-14 lg:py-16">
        <div className="border-b border-[#255e50] pb-8 sm:pb-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-[#91f78e]">The daily edition</p>
              <LocalizedLink href="/" className="mt-2 inline-block font-display text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-[#dfffe0] sm:text-[2.8rem]">
                yayanews
              </LocalizedLink>
              <p className="mt-4 max-w-[38ch] text-sm leading-7 text-emerald-50/82">
                金融新闻编辑台。把美股、港股、加密货币与衍生品的重要变化，整理成更有版面感和连续性的阅读体验。
              </p>
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr,auto]">
              <input
                type="email"
                placeholder="Email Address"
                className="min-w-0 border border-[#2d6d5c] bg-[#0d4436] px-4 py-3 text-sm text-white placeholder:text-emerald-50/55 focus:outline-none"
              />
              <button type="button" className="inline-flex items-center justify-center bg-[#91f78e] px-5 py-3 text-sm font-semibold text-[#063428] hover:bg-[#79ea77]">
                Join the Brief
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-10 pt-8 sm:pt-10 lg:grid-cols-[1.1fr,0.8fr,0.8fr,0.8fr]">
          <div>
            <p className="text-sm leading-7 text-emerald-50/72">
              &copy; {new Date().getFullYear()} yayanews Media Foundation. The editorial archive is curated for signal, context and continuity.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-emerald-50/82">
              <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">官网</a>
              <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">交易</a>
              <LocalizedLink href="/topics" className="hover:text-white">专题</LocalizedLink>
            </div>
          </div>

          {Object.entries(footerColumns).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91f78e]">{title}</h3>
              <ul className="mt-5 space-y-3">
                {links.map(link => (
                  <li key={link.href}>
                    <LocalizedLink href={link.href} className="text-sm text-emerald-50/82 hover:text-white">
                      {link.label}
                    </LocalizedLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
