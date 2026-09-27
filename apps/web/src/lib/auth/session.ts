import { cookies } from 'next/headers';
import type { AuthenticatedUser } from '@teamenergo/shared';
import { apiFetch, ApiError } from '../api/client.js';

/**
 * Session handling for the admin panel.
 *
 * Tokens live in httpOnly cookies on the Next.js origin and are never exposed
 * to client-side JavaScript. The browser talks only to Next.js; Next.js
 * forwards the access token to the API as a bearer credential.
 *
 * IMPORTANT — where cookies may be written:
 *
 *   Next.js only allows `cookies().set()` inside a Server Action, a Route
 *   Handler, or middleware. Calling it while rendering a Server Component
 *   throws at runtime.
 *
 *   So this module is split by capability:
 *     - getCurrentUser()  is READ-ONLY and safe in layouts and pages
 *     - refreshSession(), setSessionCookies(), clearSessionCookies() WRITE
 *       cookies and may only be called from a route handler or middleware
 *
 *   Refreshing an expired access token on a full page load is handled by
 *   middleware (see src/middleware.ts), which runs before rendering and is
 *   allowed to set cookies on the response.
 */

export const ACCESS_COOKIE = 'te_at';
export const REFRESH_COOKIE = 'te_rt';

const isProduction = process.env.NODE_ENV === 'production';

/** Mirrors JWT_ACCESS_TTL; a stale cookie is harmless since the JWT itself expires. */
export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  // Lax rather than Strict so following a link into /admin still arrives
  // authenticated; the admin panel performs no cross-site writes.
  sameSite: 'lax' as const,
  path: '/',
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface LoginResult extends TokenPair {
  user: AuthenticatedUser;
}

// ── Writers — route handlers and middleware only ────────────────────────

export async function setSessionCookies(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
  store.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  store.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}

export async function login(email: string, password: string): Promise<AuthenticatedUser> {
  const result = await apiFetch<LoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  await setSessionCookies(result);
  // The tokens never reach the caller, so they cannot leak into a response body.
  return result.user;
}

export async function logout(): Promise<void> {
  const { refreshToken } = await readTokens();
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } });
  } catch {
    // Revoking server-side is best effort; the cookies go regardless.
  }
  await clearSessionCookies();
}

/**
 * Exchanges the refresh token for a new pair and stores it.
 *
 * Writes cookies — route handlers only. Returns null when the session is
 * genuinely over: expired, revoked, or burned by the API's replay detection.
 */
export async function refreshSession(): Promise<TokenPair | null> {
  const { refreshToken } = await readTokens();
  if (!refreshToken) return null;

  try {
    const result = await apiFetch<LoginResult>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    await setSessionCookies(result);
    return result;
  } catch {
    await clearSessionCookies();
    return null;
  }
}

// ── Readers — safe anywhere, including Server Components ────────────────

export async function readTokens(): Promise<Partial<TokenPair>> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

/**
 * Returns the signed-in user, or null.
 *
 * Read-only by design: it never refreshes, because a layout cannot write
 * cookies. Middleware has already refreshed an expired access token by the
 * time this runs, so a null here means the session is genuinely over and the
 * caller should redirect to the login page.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const { accessToken } = await readTokens();
  if (!accessToken) return null;

  try {
    const { user } = await apiFetch<{ user: AuthenticatedUser }>('/api/v1/auth/me', {
      accessToken,
      cache: 'no-store',
    });
    return user;
  } catch (error) {
    // 401 means the token is expired or revoked — an ordinary signed-out
    // state, not a failure worth propagating.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
