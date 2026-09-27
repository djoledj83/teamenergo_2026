import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { CACHE_TAGS, type CacheTag } from '@/lib/api/public';

/**
 * Revalidation webhook.
 *
 * The API calls this after an admin saves, so the statically generated public
 * pages pick up the change within seconds instead of waiting out the cache
 * window. Without it, a headless CMS feels broken: the editor saves, reloads,
 * and sees the old page.
 *
 * Authenticated with a shared secret rather than a session, because the caller
 * is the API container, not a person.
 */

export const dynamic = 'force-dynamic';

const KNOWN_TAGS = new Set<string>(Object.values(CACHE_TAGS));

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // Refusing when unconfigured is deliberate: an empty secret would otherwise
  // compare equal to a missing header and leave the endpoint wide open.
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'NOT_CONFIGURED', message: 'REVALIDATE_SECRET is not set' } },
      { status: 503 },
    );
  }

  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid secret' } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as { tags?: string[] } | null;
  const requested = body?.tags ?? [];
  const valid = requested.filter((tag): tag is CacheTag => KNOWN_TAGS.has(tag));

  // No tags means a content-wide change, e.g. a settings or navigation edit.
  const tags = valid.length > 0 ? valid : Object.values(CACHE_TAGS);
  for (const tag of tags) revalidateTag(tag);

  return NextResponse.json({ revalidated: tags, at: new Date().toISOString() });
}
