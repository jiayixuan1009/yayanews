import LocalizedLink from '@/components/LocalizedLink';
import { siteConfig } from '@yayanews/types';

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
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-[#91f78e]">{dict.slogan1 || 'The daily edition'}</p>
              <LocalizedLink href="/" className="mt-2 inline-block font-display text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-[#dfffe0] sm:text-[2.8rem]">
                yayanews
              </LocalizedLink>
              <p className="mt-4 max-w-[38ch] text-sm leading-7 text-emerald-50/82">
                {dict.slogan2 || 'Financial news editorial desk.'}
              </p>
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr,auto]">
              <input
                type="email"
                placeholder={dict.emailLabel || 'Email Address'}
                className="min-w-0 border border-[#2d6d5c] bg-[#0d4436] px-4 py-3 text-sm text-white placeholder:text-emerald-50/55 focus:outline-none"
              />
              <button type="button" className="inline-flex items-center justify-center bg-[#91f78e] px-5 py-3 text-sm font-semibold text-[#063428] hover:bg-[#79ea77]">
                {dict.joinBtn || 'Join the Brief'}
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-10 pt-8 sm:pt-10 lg:grid-cols-[1.1fr,0.8fr,0.8fr,0.8fr]">
          <div>
            <p className="text-sm leading-7 text-emerald-50/72">
              &copy; {new Date().getFullYear()} yayanews Media Foundation. {dict.copyrightSlogan || 'The editorial archive...'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-emerald-50/82">
              <a href={siteConfig.parentSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">{dict.officialSite || 'Official Website'}</a>
              <a href={siteConfig.tradingSite} target="_blank" rel="noopener noreferrer" className="hover:text-white">{dict.tradingSite || 'Trading'}</a>
              <LocalizedLink href="/topics" className="hover:text-white">{dict.topicsLink || 'Topics'}</LocalizedLink>
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
