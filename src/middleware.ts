import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const publicPages = ['/login'];

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check if this is a public page (strip locale prefix for matching)
  const pathnameWithoutLocale = routing.locales.reduce(
    (path, locale) => path.replace(`/${locale}`, ''),
    pathname
  );

  const isPublicPage = publicPages.some(page => 
    pathnameWithoutLocale === page || pathnameWithoutLocale.startsWith(`${page}/`)
  );

  // Always run intl middleware first to handle locale routing
  const intlResponse = intlMiddleware(req);

  // For public pages, just return the intl response
  if (isPublicPage) {
    return intlResponse;
  }

  // For protected pages, check authentication
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token) {
    // Detect locale from the URL or fallback to default
    const locale = routing.locales.find(l => pathname.startsWith(`/${l}`)) || routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ['/', '/(en|ru|uk)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
