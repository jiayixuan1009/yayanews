import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['zh', 'en'];
const defaultLocale = 'zh';
const fallbackOrigin = 'https://yayanews.cryptooptiontool.com';
const verificationFiles = new Map([
  [
    '/google557e7d124058718a.html',
    {
      body: 'google-site-verification: google557e7d124058718a.html',
      contentType: 'text/html; charset=utf-8',
    },
  ],
  [
    '/db1162aa32014bba89ab29ba04a5ddba.txt',
    {
      body: 'db1162aa32014bba89ab29ba04a5ddba',
      contentType: 'text/plain; charset=utf-8',
    },
  ],
]);

function getLocale(request: NextRequest): string {
  // 1. Respect explicit user choice (set by LangSwitcher)
  if (request.cookies.has('NEXT_LOCALE')) {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && locales.includes(cookieLocale)) {
      return cookieLocale;
    }
  }

  // 2. Detect browser language
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    if (acceptLang.startsWith('en')) return 'en';
    if (acceptLang.startsWith('zh')) return 'zh';
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  // Check if there is any supported locale in the pathname
  const { pathname, search } = request.nextUrl;
  const verificationFile = verificationFiles.get(pathname);

  if (verificationFile) {
    return new NextResponse(verificationFile.body, {
      headers: {
        'Content-Type': verificationFile.contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Redirect if there is no locale
  const locale = getLocale(request);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'https';
  const origin = host ? `${proto}://${host}` : fallbackOrigin;
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const targetPathname = normalizedPathname === '/' ? `/${locale}` : `/${locale}${normalizedPathname}`;
  const redirectUrl = new URL(`${targetPathname}${search}`, origin);

  // e.g. incoming request is /news
  // The new URL is now /zh/news
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: [
    '/google557e7d124058718a.html',
    '/db1162aa32014bba89ab29ba04a5ddba.txt',
    // Skip all internal paths (_next) and api routes
    '/((?!api|admin|_next/static|_next/image|images|favicon.ico|robots.txt|sitemap.xml|sitemap-news.xml|sitemap-chunk|news.xml|feed-news.xml|.*\\..*).*)',
  ],
};
