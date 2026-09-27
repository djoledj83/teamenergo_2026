import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { clearSessionCookies, readTokens, refreshSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Password change.
 *
 * Not part of the /api/admin proxy because the endpoint lives under the API's
 * auth router, and because the outcome is special: the API revokes every
 * session on success, so the cookies here have to go too.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;

  const send = (accessToken: string | undefined) =>
    apiFetch<void>('/api/v1/auth/change-password', {
      method: 'POST',
      body,
      accessToken,
      cache: 'no-store',
    });

  try {
    const { accessToken } = await readTokens();
    try {
      await send(accessToken);
    } catch (error) {
      // One transparent retry, matching the admin proxy's behaviour.
      if (error instanceof ApiError && error.status === 401) {
        const refreshed = await refreshSession();
        if (!refreshed) throw error;
        await send(refreshed.accessToken);
      } else {
        throw error;
      }
    }

    // The API revoked every refresh token, this one included.
    await clearSessionCookies();
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }
}
