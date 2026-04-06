import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@yayanews/types';
import BrandLogo from '@/components/BrandLogo';

export default function Footer({ lang = 'zh', dict }: { lang?: string, dict: Record<string, string> }) {
  const footerColumns = {
    [dict.colOrg || 'Organization']: [
      { label: dict.colAbout || 'About Us', href: '/about' },
      { label: dict.colGuide || 'Editorial Guidelines', href: '/guide' },
      { label: dict.colMasthead || 'Masthead', href: '/topics' },
      { label: dict.colContact || 'Contact', href: '/contact' },
    ],
    [dict.colCov || 'Coverage']: [
      { label: dict.usStock || 'US Stocks', href: '/news/us-stock' },
      { label: dict.crypto || 'Crypto', href: '/news/crypto' },
      { label: dict.derivatives || 'Derivatives', href: '/news/derivatives' },
      { label: dict.ai || 'AI', href: '/news/ai' },
    ],
    [dict.colLegal || 'Legal']: [
      { label: dict.colPrivacy || 'Privacy Policy', href: '/privacy' },
      { label: dict.colTerms || 'Terms of Service', href: '/terms' },
      { label: dict.colCookie || 'Cookie Policy', href: '/privacy' },
    ],
  };

  return (
    <footer className="border-t border-[#0c3b31] bg-[#003326] text-emerald-50">
      <div className="container-main py-12 sm:py-14 lg:py-16">
        <div className="border-b border-[#255e50] pb-8 sm:pb-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
            <div>
              <p className="yn-meta text-[#91f78e] mb-3">{dict.slogan1 || 'The daily edition'}</p>
              <BrandLogo variant="footer" lang={lang} />
              <p className="mt-4 max-w-[38ch] yn-footer-body text-emerald-50/82">
                {dict.slogan2 || 'Financial news editorial desk.'}
              </p>
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr,auto]">
              <input
                type="email"
                placeholder={dict.emailLabel || 'Email Address'}
                className="min-w-0 border border-[#2d6d5c] bg-[#0d4436] px-4 py-3 yn-footer-body text-white placeholder:text-emerald-50/55 focus:outline-none"
              />
              <button type="button" className="inline-flex items-center justify-center bg-[#91f78e] px-5 py-3 yn-action text-[#063428] hover:bg-[#79ea77]">
                {dict.joinBtn || 'Join the Brief'}
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-10 pt-8 sm:pt-10 lg:grid-cols-[1.1fr,0.8fr,0.8fr,0.8fr]">
          <div>
            <p className="yn-legal text-emerald-50/72">
              &copy; {new Date().getFullYear()} yayanews Media Foundation. {dict.copyrightSlogan || 'The editorial archive...'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 yn-footer-body text-emerald-50/82">
              <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">{dict.officialSite || 'Official Website'}</a>
              <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">{dict.tradingSite || 'Trading'}</a>
              <LocalizedLink href="/topics" className="hover:text-white">{dict.topicsLink || 'Topics'}</LocalizedLink>
              <a href="https://t.me/CryptoMan1024" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
              <a href="https://x.com/0xReggieJ" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter
              </a>
            </div>
          </div>

          {Object.entries(footerColumns).map(([title, links]) => (
            <div key={title}>
              <h3 className="yn-footer-title text-[#91f78e]">{title}</h3>
              <ul className="mt-5 space-y-3">
                {links.map(link => (
                  <li key={link.href}>
                    <LocalizedLink href={link.href} className="yn-footer-body text-emerald-50/82 hover:text-white">
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
