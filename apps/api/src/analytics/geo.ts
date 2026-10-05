import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../logger.js';

/**
 * An IP address in, a country code out — and the address gone.
 *
 * The lookup is a file on this server, not a service. That is the point: an
 * HTTP geolocation API would mean sending every visitor's address to a third
 * party, which is the one thing this whole feature was built to avoid. A
 * local database answers the same question with nothing leaving the machine.
 *
 * The data is DB-IP's IP-to-Country Lite, CC-BY 4.0, downloaded during the
 * Docker build. No account and no key, which is why it is this one rather
 * than MaxMind's GeoLite2 — a licence key in .env is one more secret to
 * rotate and one more way for a deploy to fail. The licence asks for a credit
 * where results are shown, and the Analitika screen carries it.
 *
 * Everything degrades to null. A missing file, an unparseable address, a
 * private address: no country, and the rest of the analytics are unaffected.
 * A missing country is a missing country, never a broken page.
 */

/** Set by the Dockerfile; absent in development unless somebody fetches it. */
const DATABASE_PATH = process.env.GEOIP_DB ?? './data/dbip-country-lite.mmdb';

type Lookup = (ip: string) => string | null;

let lookup: Lookup | null = null;
let attempted = false;

/**
 * Private, loopback and link-local ranges.
 *
 * Checked before the database rather than relying on it to return nothing:
 * every request arriving from the web container on the Docker network has one
 * of these, and a lookup per request for an address that can never resolve is
 * work done to learn nothing.
 */
const PRIVATE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

export function isPrivateAddress(ip: string): boolean {
  return PRIVATE.test(ip.trim());
}

/**
 * The visitor's address out of a proxy header.
 *
 * X-Forwarded-For is a list, appended to by each hop, so the visitor is the
 * FIRST entry and the rest are proxies. Taking the last — a common mistake —
 * gives you nginx.
 *
 * The header is only trusted because the API is not publicly routable: the
 * only thing that can reach it is the web container on the internal Docker
 * network. Were that ever to change, this would be a value a visitor could
 * set themselves.
 */
export function clientIpOf(forwardedFor: string | undefined, realIp?: string | undefined): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  const candidate = first || realIp?.trim();
  if (!candidate) return null;
  // Strip an IPv6 bracket form and any port.
  const bare = candidate.replace(/^\[|\]$/g, '').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1');
  return bare.length > 0 && bare.length <= 45 ? bare : null;
}

/**
 * Opened once, on first use, and never retried on failure.
 *
 * Retrying would mean a filesystem check on every page view for a file that
 * is not going to appear; one warning at the point of first use says what is
 * missing and what it costs.
 */
async function getLookup(): Promise<Lookup | null> {
  if (attempted) return lookup;
  attempted = true;

  // Size, not just existence: a build whose download failed leaves an empty
  // file behind on purpose, so that COPY in the Dockerfile still has
  // something to copy. Opening it would fail with "Unknown type NaN at
  // offset 0", which says nothing about what actually went wrong.
  const path = resolve(DATABASE_PATH);
  const bytes = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
  if (bytes === 0) {
    logger.warn(
      `[analytics] no GeoIP database at ${path}, so visits will have no country. ` +
        'The Docker build downloads it; a container built before this feature, ' +
        'or a build whose download failed, will not have it.',
    );
    return null;
  }

  try {
    // maxmind's own CountryResponse rather than a hand-written shape: its
    // `open` constrains the type parameter to the response union, and a
    // structural stand-in is not a member of it.
    const maxmind = await import('maxmind');
    const reader = await maxmind.open<import('maxmind').CountryResponse>(path);
    lookup = (ip: string) => reader.get(ip)?.country?.iso_code ?? null;
    logger.info(`[analytics] GeoIP database loaded from ${path}`);
  } catch (error) {
    logger.warn(`[analytics] could not open the GeoIP database: ${String(error)}`);
    lookup = null;
  }
  return lookup;
}

/** For tests: supply a lookup and skip the file entirely. */
export function setLookupForTesting(fn: Lookup | null): void {
  lookup = fn;
  attempted = true;
}

export async function countryOf(ip: string | null): Promise<string | null> {
  if (!ip || isPrivateAddress(ip)) return null;
  const resolveIp = await getLookup();
  if (!resolveIp) return null;
  try {
    const code = resolveIp(ip);
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
