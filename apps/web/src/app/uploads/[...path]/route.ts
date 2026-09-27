import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api/client';

/**
 * Serves uploaded media by proxying to the API.
 *
 * This was a `rewrites()` entry in next.config.mjs, and it could not work in
 * production. Next resolves rewrites at BUILD time and freezes them into the
 * standalone server's config, but API_INTERNAL_URL only exists at RUN time —
 * docker-compose sets it on the container, not on the builder. So the
 * destination was baked as the fallback, `http://localhost:4000`, which inside
 * the web container is the web container itself. Every image 502'd with
 * ECONNREFUSED while the file sat correctly on disk:
 *
 *   Failed to proxy http://localhost:4000/uploads/2026/09/….webp ECONNREFUSED
 *   ⨯ The requested resource isn't a valid image … received null
 *
 * A route handler runs per request, so it reads the address at the moment it
 * needs it and there is nothing to bake wrong. Passing API_INTERNAL_URL as a
 * Docker build arg would have silenced this particular failure while keeping
 * the real defect — a deployment address compiled into the image.
 *
 * The cost is that bytes pass through Node rather than being streamed by the
 * API's express.static. In practice next/image requests these once and caches
 * the optimised output, so the origin is hit rarely; correctness is worth more
 * than the difference.
 */

export const dynamic = 'force-dynamic';

/** Upstream headers worth preserving; the rest are the API's business. */
const FORWARD = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  // Rebuilt segment by segment rather than joined raw, so a crafted path
  // cannot climb out of the uploads directory on the API side.
  const safe = path
    .filter((segment) => segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (!safe) return new NextResponse(null, { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/uploads/${safe}`, {
      cache: 'no-store',
      // Conditional requests pass through, so a browser that already has the
      // file still gets its 304 instead of the bytes again.
      headers: {
        ...(request.headers.get('if-none-match')
          ? { 'If-None-Match': request.headers.get('if-none-match')! }
          : {}),
        ...(request.headers.get('if-modified-since')
          ? { 'If-Modified-Since': request.headers.get('if-modified-since')! }
          : {}),
      },
    });
  } catch (error) {
    console.error(`[uploads] could not reach the API at ${API_URL}:`, error);
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 304) {
    return new NextResponse(null, { status: upstream.status });
  }

  const headers = new Headers();
  for (const name of FORWARD) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (upstream.status === 304) return new NextResponse(null, { status: 304, headers });

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
