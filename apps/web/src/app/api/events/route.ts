import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

/**
 * Forwards a page view to the API.
 *
 * The API is not publicly routable, so the browser posts here, the same shape
 * the contact form and the admin panel use.
 *
 * `apiFetch` is deliberately not used: it parses the response and throws on a
 * bad status, and neither is wanted here. This hands back 204 whatever
 * happens, because the caller is a counter in a visitor's browser and there
 * is nothing it could usefully do with a failure.
 *
 * The visitor's user agent is passed through — the API reduces it to one of
 * three device classes and uses it to drop obvious crawlers, then discards
 * it. The IP is not forwarded and is not stored anywhere.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 2000) return new NextResponse(null, { status: 204 });

    await fetch(`${API_URL}/api/v1/public/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('user-agent')
          ? { 'User-Agent': request.headers.get('user-agent')! }
          : {}),
        ...(request.headers.get('referer')
          ? { Referer: request.headers.get('referer')! }
          : {}),
      },
      body,
      cache: 'no-store',
    });
  } catch {
    /* the API being unreachable is not the visitor's problem */
  }

  return new NextResponse(null, { status: 204 });
}
