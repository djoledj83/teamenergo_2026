import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api/client';
import { readTokens, refreshSession, clearSessionCookies } from '@/lib/auth/session';

/**
 * Backend-for-frontend proxy for the admin API.
 *
 * The browser sends only its httpOnly cookie; this handler attaches the bearer
 * token and forwards the request over the internal network. The API container
 * is never exposed publicly, so there is no CORS to configure and no token in
 * client-side JavaScript.
 *
 * A 401 triggers one transparent refresh-and-retry, so a session that has been
 * idle past the 15-minute access-token lifetime resumes without the editor
 * noticing — and without extending how long a leaked access token stays valid.
 */

export const dynamic = 'force-dynamic';

/** Hop-by-hop and length headers must not be copied onto a new request. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'authorization',
  'accept-encoding',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

function buildHeaders(request: NextRequest, accessToken: string | undefined): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // The API trusts proxy headers for rate limiting; pass the real client IP.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) headers.set('x-forwarded-for', forwarded);
  return headers;
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const target = `${API_URL}/api/v1/admin/${path.join('/')}${request.nextUrl.search}`;

  // The body is read once and reused, because a retry after refresh cannot
  // re-consume the original stream.
  const rawBody =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const send = (accessToken: string | undefined) =>
    fetch(target, {
      method: request.method,
      headers: buildHeaders(request, accessToken),
      ...(rawBody && rawBody.byteLength > 0 ? { body: rawBody } : {}),
      cache: 'no-store',
      redirect: 'manual',
    });

  const { accessToken } = await readTokens();
  let response = await send(accessToken);

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      await clearSessionCookies();
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sesija je istekla, prijavite se ponovo' } },
        { status: 401 },
      );
    }
    response = await send(refreshed.accessToken);
  }

  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('Cache-Control', 'no-store');

  return new NextResponse(response.body, { status: response.status, headers });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function PATCH(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function PUT(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function DELETE(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
