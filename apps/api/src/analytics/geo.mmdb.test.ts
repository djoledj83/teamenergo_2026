import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * The real reader path, against a real database file.
 *
 * geo.test.ts injects a lookup and so never touches the half of countryOf
 * that matters most on the server: finding the file, loading `maxmind`, and
 * reading a country out of whatever shape the database holds. DB-IP's file is
 * 100 MB and this sandbox cannot download it, so this test builds a database
 * of its own — one address, in the MaxMind-DB binary format the real file
 * uses — and reads it with the same library the API uses.
 *
 * What this proves is the shape: that `country.iso_code` is where the code
 * looks for it, and that a file in that format opens at all. What it cannot
 * prove is that DB-IP's actual data says Serbia for a Serbian address; that
 * is a claim about their data, and only the deployed container can show it.
 */

// ── a minimal MaxMind-DB file ────────────────────────────────────────────────
// Format: a binary search tree, sixteen zero bytes, the data, a marker, then
// the metadata. https://maxmind.github.io/MaxMind-DB/

const MARKER = Buffer.from('abcdef4d61784d696e642e636f6d', 'hex');

const str = (s: string): Buffer => {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from([(2 << 5) | b.length]), b]); // type 2, short form
};
const u16 = (n: number): Buffer =>
  n === 0 ? Buffer.from([5 << 5]) : Buffer.from([(5 << 5) | 1, n]);
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  const first = b.findIndex((x) => x !== 0);
  const trimmed = b.subarray(first === -1 ? 3 : first);
  return Buffer.concat([Buffer.from([(6 << 5) | trimmed.length]), trimmed]);
};
const u64 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return Buffer.concat([Buffer.from([4, 2]), b]); // extended type 9, four bytes
};
const map = (pairs: Array<[string, Buffer]>): Buffer =>
  Buffer.concat([
    Buffer.from([(7 << 5) | pairs.length]),
    ...pairs.flatMap(([k, v]) => [str(k), v]),
  ]);
const arr = (items: Buffer[]): Buffer =>
  Buffer.concat([Buffer.from([items.length, 4]), ...items]); // extended type 11

function buildMmdb(ip: string, isoCode: string): Buffer {
  const octets = ip.split('.').map(Number);
  const bitAt = (i: number) => (octets[i >> 3]! >> (7 - (i % 8))) & 1;

  const NODE_COUNT = 32;
  const NOT_FOUND = NODE_COUNT;
  const DATA_BASE = NODE_COUNT + 16; // the record value meaning "data offset 0"

  // One node per bit of the address: the matching bit walks to the next node,
  // every other address lands on "not found".
  const tree = Buffer.alloc(NODE_COUNT * 8);
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const hit = i === NODE_COUNT - 1 ? DATA_BASE : i + 1;
    tree.writeUInt32BE(bitAt(i) === 0 ? hit : NOT_FOUND, i * 8);
    tree.writeUInt32BE(bitAt(i) === 1 ? hit : NOT_FOUND, i * 8 + 4);
  }

  const data = map([['country', map([['iso_code', str(isoCode)]])]]);
  const metadata = map([
    ['node_count', u32(NODE_COUNT)],
    ['record_size', u16(32)],
    ['ip_version', u16(4)],
    ['database_type', str('DBIP-Country-Lite')],
    ['languages', arr([str('en')])],
    ['binary_format_major_version', u16(2)],
    ['binary_format_minor_version', u16(0)],
    ['build_epoch', u64(Math.floor(Date.now() / 1000))],
    ['description', map([['en', str('synthetic fixture')]])],
  ]);

  return Buffer.concat([tree, Buffer.alloc(16), data, MARKER, metadata]);
}

// ── the test ────────────────────────────────────────────────────────────────

const directory = mkdtempSync(join(tmpdir(), 'geoip-'));
const path = join(directory, 'dbip-country-lite.mmdb');
writeFileSync(path, buildMmdb('203.0.113.9', 'RS'));

// geo.ts reads GEOIP_DB at import time, and the logger it pulls in validates
// the environment and exits if it is empty.
process.env.GEOIP_DB = path;
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

const { countryOf } = await import('./geo.js');

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('countryOf, against a database on disk', () => {
  it('reads the country code out of the file', async () => {
    await expect(countryOf('203.0.113.9')).resolves.toBe('RS');
  });

  it('returns null for an address the database does not hold', async () => {
    await expect(countryOf('8.8.8.8')).resolves.toBeNull();
  });

  it('still refuses a private address', async () => {
    await expect(countryOf('192.168.1.50')).resolves.toBeNull();
  });

  it('opens the database once and answers repeatedly', async () => {
    await expect(countryOf('203.0.113.9')).resolves.toBe('RS');
    await expect(countryOf('203.0.113.9')).resolves.toBe('RS');
  });
});

/**
 * Every one of these degrades to no country, so what is actually being
 * tested is the WARNING. This feature can only fail on the server, and the
 * log line is the whole diagnosis: "no GeoIP database" sends somebody to the
 * build, "could not open" sends them to the file.
 */
describe('a database that is not there', () => {
  it('treats a zero-byte file as no database at all', async () => {
    // What a Docker build leaves behind when the download fails: the file
    // exists so COPY has something to copy, and it is empty.
    const empty = join(directory, 'empty.mmdb');
    writeFileSync(empty, '');
    const { countryOf: lookup, warnings } = await freshGeo(empty);
    await expect(lookup('203.0.113.9')).resolves.toBeNull();
    expect(warnings.join('\n')).toMatch(/no GeoIP database/);
  });

  it('says the same for a file that was never there', async () => {
    const { countryOf: lookup, warnings } = await freshGeo(join(directory, 'not-here.mmdb'));
    await expect(lookup('203.0.113.9')).resolves.toBeNull();
    expect(warnings.join('\n')).toMatch(/no GeoIP database/);
  });

  it('says something different for a file it cannot read', async () => {
    const junk = join(directory, 'junk.mmdb');
    writeFileSync(junk, 'this is an HTML error page, not a database');
    const { countryOf: lookup, warnings } = await freshGeo(junk);
    await expect(lookup('203.0.113.9')).resolves.toBeNull();
    expect(warnings.join('\n')).toMatch(/could not open the GeoIP database/);
  });
});

/**
 * geo.ts reads the path once at import and opens the file once after that,
 * so each case needs its own copy of the module.
 */
async function freshGeo(path: string) {
  process.env.GEOIP_DB = path;
  const warnings: string[] = [];
  vi.resetModules();
  vi.doMock('../logger.js', () => ({
    logger: { warn: (m: string) => warnings.push(m), info: () => {}, error: () => {} },
  }));
  const { countryOf: lookup } = await import('./geo.js');
  vi.doUnmock('../logger.js');
  return { countryOf: lookup, warnings };
}
