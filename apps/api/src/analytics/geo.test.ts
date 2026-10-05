import { describe, expect, it } from 'vitest';

/**
 * The address-to-country step, tested without the database file.
 *
 * Two things matter here and neither needs a 100 MB download: that the right
 * address is picked out of the proxy headers, and that every failure path
 * ends at null rather than at an exception in a page-view handler.
 */

// geo.ts reaches the logger, which validates process.env at import time and
// exits on failure, so the configuration has to exist before the import.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

const { clientIpOf, countryOf, isPrivateAddress, setLookupForTesting } = await import('./geo.js');

describe('clientIpOf', () => {
  it('takes the FIRST X-Forwarded-For entry', () => {
    // The visitor is first and the proxies are appended after. Taking the
    // last entry — the common mistake — would record nginx's own address
    // for every visit, which resolves to the server's country.
    expect(clientIpOf('203.0.113.9, 10.0.0.1, 172.18.0.4')).toBe('203.0.113.9');
    expect(clientIpOf('203.0.113.9,10.0.0.1')).toBe('203.0.113.9');
    expect(clientIpOf('  203.0.113.9  ')).toBe('203.0.113.9');
  });

  it('falls back to X-Real-IP when there is no forwarded list', () => {
    expect(clientIpOf(undefined, '198.51.100.7')).toBe('198.51.100.7');
    expect(clientIpOf('', '198.51.100.7')).toBe('198.51.100.7');
    expect(clientIpOf('   ', '198.51.100.7')).toBe('198.51.100.7');
  });

  it('prefers the forwarded list over X-Real-IP', () => {
    expect(clientIpOf('203.0.113.9', '198.51.100.7')).toBe('203.0.113.9');
  });

  it('returns null when neither header is set', () => {
    expect(clientIpOf(undefined)).toBeNull();
    expect(clientIpOf(undefined, undefined)).toBeNull();
    expect(clientIpOf('', '')).toBeNull();
  });

  it('strips an IPv6 bracket form and a trailing port', () => {
    expect(clientIpOf('[2001:db8::1]')).toBe('2001:db8::1');
    expect(clientIpOf('203.0.113.9:51234')).toBe('203.0.113.9');
  });

  it('rejects a value too long to be an address', () => {
    expect(clientIpOf('x'.repeat(46))).toBeNull();
  });
});

describe('isPrivateAddress', () => {
  it('recognises the ranges that can never resolve to a country', () => {
    for (const ip of [
      '10.0.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '192.168.1.50',
      '172.16.0.1',
      '172.20.10.3',
      '172.31.255.254',
      '::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('leaves public addresses alone', () => {
    // 172.15 and 172.32 sit either side of the private 172.16–172.31 block;
    // a lazy /^172\./ would swallow both.
    for (const ip of ['203.0.113.9', '8.8.8.8', '172.15.0.1', '172.32.0.1', '2001:db8::1']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('countryOf', () => {
  it('returns the code the database gives', async () => {
    setLookupForTesting(() => 'RS');
    await expect(countryOf('203.0.113.9')).resolves.toBe('RS');
  });

  it('passes the address through unchanged', async () => {
    let seen: string | null = null;
    setLookupForTesting((ip) => {
      seen = ip;
      return 'DE';
    });
    await countryOf('198.51.100.7');
    expect(seen).toBe('198.51.100.7');
  });

  it('never looks up a private address', async () => {
    let called = false;
    setLookupForTesting(() => {
      called = true;
      return 'RS';
    });
    await expect(countryOf('192.168.1.50')).resolves.toBeNull();
    await expect(countryOf('127.0.0.1')).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it('returns null without an address', async () => {
    setLookupForTesting(() => 'RS');
    await expect(countryOf(null)).resolves.toBeNull();
  });

  it('returns null when there is no database', async () => {
    setLookupForTesting(null);
    await expect(countryOf('203.0.113.9')).resolves.toBeNull();
  });

  it('returns null when the address is not in the database', async () => {
    setLookupForTesting(() => null);
    await expect(countryOf('203.0.113.9')).resolves.toBeNull();
  });

  it('rejects anything that is not a two-letter code', async () => {
    for (const value of ['', 'r', 'rs', 'SRB', 'R1', '  RS  ']) {
      setLookupForTesting(() => value);
      await expect(countryOf('203.0.113.9'), value).resolves.toBeNull();
    }
  });

  it('swallows a throwing lookup', async () => {
    // A corrupt database should cost a missing country, not a 500 on a
    // page view that the visitor never asked for.
    setLookupForTesting(() => {
      throw new Error('corrupt database');
    });
    await expect(countryOf('203.0.113.9')).resolves.toBeNull();
  });
});
