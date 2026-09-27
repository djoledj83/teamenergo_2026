import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

/**
 * Two unrelated jobs share this file, and they must not run on each other's
 * routes.
 *
 * PUBLIC ROUTES get next-intl's middleware: it works out the language from
 * the URL, the cookie or Accept-Language and redirects /usluge to /sr/usluge.
 *
 * /admin GETS NONE OF THAT. The admin panel is a single-language tool and its
 * URLs are stable, so adding a locale prefix would only break bookmarks and
 * the auth redirects. What it needs instead is:
 *
 *   1. the request path exposed as a header, since Next.js gives layouts no
 *      way to read it and the admin layout needs it for the auth guard;
 *   2. an expired access token refreshed before any Server Component renders
 *      — cookies may only be written in middleware, a Route Handler or a
 *      Server Action, never during render.
 */

const ACCESS_COOKIE = 'te_at';
const REFRESH_COOKIE = 'te_rt';

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Reads a JWT's expiry without verifying the signature.
 *
 * Verification belongs to the API, which owns the secret and is the actual
 * security boundary. Middleware only needs to decide whether to bother
 * refreshing, so an unverified peek at `exp` is sufficient — and a forged
 * token gains nothing, since the API still rejects it.
 */
function secondsUntilExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === 'number' ? exp - Math.floor(Date.now() / 1000) : null;
  } catch {
    return null;
  }
}

async function handleAdmin(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  // The login page must stay reachable without a session.
  if (request.nextUrl.pathname.startsWith('/admin/login')) return pass();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) return pass();

  const remaining = accessToken ? secondsUntilExpiry(accessToken) : null;
  // A small margin, so a token that expires mid-render does not slip through.
  const stillValid = remaining !== null && remaining > 30;
  if (stillValid) return pass();

  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

  let refreshed: { accessToken: string; refreshToken: string } | null = null;
  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (response.ok) {
      refreshed = (await response.json()) as { accessToken: string; refreshToken: string };
    }
  } catch {
    // API unreachable — fall through and let the page render signed-out
    // rather than trapping the user in a redirect loop.
    return pass();
  }

  if (!refreshed) {
    // The session is genuinely over. Clear the cookies and let the layout
    // send the user to the login page.
    const response = pass();
    response.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }

  const setTokens = (response: NextResponse) => {
    response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_MAX_AGE,
    });
    response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    });
    return response;
  };

  // Guard against a redirect loop: if the freshly issued token does not parse
  // either, redirecting would send us straight back here to refresh again,
  // forever. Fall through instead and let the API reject it normally.
  if (secondsUntilExpiry(refreshed.accessToken) === null) return setTokens(pass());

  // Redirect to the same URL so the next request carries the new cookies.
  // Rewriting the inbound cookie header instead would leave the browser
  // holding the old pair, and the rotated refresh token would be spent
  // without ever being stored — which the API's replay detection would
  // correctly treat as a stolen token on the following request.
  return setTokens(NextResponse.redirect(request.nextUrl));
}

export default async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) return handleAdmin(request);
  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals, proxied uploads, static
  // assets and any path that looks like a file.
  matcher: ['/((?!api|_next|_vercel|uploads|assets|favicon.ico|.*\\..*).*)'],
};
