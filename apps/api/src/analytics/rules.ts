import { z } from 'zod';

/**
 * Turning a request into a stored event — and deciding what never gets
 * stored.
 *
 * Everything that could identify a person is dropped here, at the edge,
 * rather than being written and cleaned up later: the IP is never read, the
 * user agent is reduced to one of three words and discarded, and the referrer
 * is reduced to its host. A retention policy that forgets things is good
 * practice; not collecting them is better, because there is no window in
 * which a leak or a backup can hold them.
 */

/**
 * Paths worth counting.
 *
 * Without this the table fills with whatever a scanner probes — /wp-login.php,
 * /.env, /admin.php — and the "top pages" list becomes a list of attacks. The
 * shape is fixed by the routing: a language prefix, then lowercase segments.
 * Anything else is not a page of this site, whoever asked for it.
 */
const PATH = /^\/(sr|en)(\/[a-z0-9\-._~%]+)*\/?$/;

/**
 * A relative segment is never a page of this site.
 *
 * Browsers resolve `..` before sending a request, so a path containing one
 * arrived from something hand-writing a POST. It cannot reach anything — this
 * string is only ever stored and displayed — but it is precisely the junk the
 * check above exists to keep out of the "top pages" list, and the segment
 * character class allows a dot, so `..` slipped through the first version.
 */
export function isPagePath(path: string): boolean {
  if (path.split('/').includes('..')) return false;
  return PATH.test(path);
}

export const eventSchema = z.object({
  kind: z.enum(['VIEW', 'DOWNLOAD']),
  path: z.string().min(1).max(300),
  locale: z.string().max(5).optional(),
  /** The full referring URL; only its host survives. */
  referrer: z.string().max(500).optional(),
});

export type EventInput = z.infer<typeof eventSchema>;

/**
 * Obvious automation, by its own admission.
 *
 * This is not a defence — anything that wants to be counted can be. It is
 * hygiene: the crawlers that announce themselves are the overwhelming
 * majority of non-human traffic, and leaving them in makes every number
 * wrong in a way nobody can see.
 */
const BOT =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime|semrush|ahrefs|screaming|postman|axios|node-fetch/i;

export function isBot(userAgent: string | undefined): boolean {
  // No user agent at all is a script, not a browser.
  if (!userAgent || userAgent.trim() === '') return true;
  return BOT.test(userAgent);
}

/** 'mobile' | 'tablet' | 'desktop', then the user agent is forgotten. */
export function deviceOf(userAgent: string | undefined): string {
  if (!userAgent) return 'desktop';
  if (/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|windows phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/**
 * The referring site's host, or null.
 *
 * Null for our own pages — a visitor moving around the site is not a referral,
 * and counting it would bury the handful of rows that say where people
 * actually came from. Null too for anything unparseable, rather than storing
 * a fragment of a URL whose shape we do not know.
 */
export function referrerHostOf(referrer: string | undefined, selfHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (!host) return null;
    if (selfHost && host === selfHost.replace(/^www\./, '')) return null;
    return host.slice(0, 180);
  } catch {
    return null;
  }
}

/** Trailing slash removed, query and hash already gone, length capped. */
export function normalisePath(path: string): string | null {
  const clean = path.split(/[?#]/)[0] ?? '';
  const trimmed = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  return trimmed.length <= 300 && trimmed.startsWith('/') ? trimmed : null;
}
