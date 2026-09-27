import { describe, expect, it } from 'vitest';

// The env module validates process.env at import time and exits on failure,
// so the test process needs a valid configuration before anything is loaded.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

const {
  expiryFrom,
  hashToken,
  newFamilyId,
  newTokenId,
  signAccessToken,
  signRefreshToken,
  tokenHashMatches,
  verifyAccessToken,
  verifyRefreshToken,
} = await import('./tokens.js');

describe('expiryFrom', () => {
  it('parses each supported unit', () => {
    const now = Date.now();
    expect(expiryFrom('30s').getTime() - now).toBeCloseTo(30_000, -2);
    expect(expiryFrom('15m').getTime() - now).toBeCloseTo(900_000, -2);
    expect(expiryFrom('2h').getTime() - now).toBeCloseTo(7_200_000, -3);
    expect(expiryFrom('7d').getTime() - now).toBeCloseTo(604_800_000, -4);
  });

  it('treats a bare number as seconds', () => {
    const now = Date.now();
    expect(expiryFrom('3600').getTime() - now).toBeCloseTo(3_600_000, -3);
  });

  it('tolerates surrounding whitespace', () => {
    expect(() => expiryFrom('  7d  ')).not.toThrow();
  });

  it('rejects anything it cannot interpret, rather than guessing', () => {
    // Silently defaulting here would mean tokens living far longer than
    // intended, so these must throw.
    expect(() => expiryFrom('7 days')).toThrow();
    expect(() => expiryFrom('1w')).toThrow();
    expect(() => expiryFrom('')).toThrow();
    expect(() => expiryFrom('abc')).toThrow();
  });

  it('always returns a future date', () => {
    expect(expiryFrom('1s').getTime()).toBeGreaterThan(Date.now());
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('separates different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('compares digests in constant time', () => {
    const a = hashToken('one');
    const b = hashToken('two');
    expect(tokenHashMatches(a, a)).toBe(true);
    expect(tokenHashMatches(a, b)).toBe(false);
    expect(tokenHashMatches(a, '')).toBe(false);
    expect(tokenHashMatches('', '')).toBe(false);
    expect(tokenHashMatches(a, a.slice(0, 32))).toBe(false);
  });

  it('does not leak the input', () => {
    const secret = 'super-secret-refresh-token';
    const hash = hashToken(secret);
    expect(hash).not.toContain(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('access tokens', () => {
  const claims = { sub: 'user_1', role: 'OWNER' as const, mustChangePassword: false };

  it('round-trips its claims', () => {
    const decoded = verifyAccessToken(signAccessToken(claims));
    expect(decoded.sub).toBe('user_1');
    expect(decoded.role).toBe('OWNER');
    expect(decoded.mustChangePassword).toBe(false);
  });

  it('preserves the mustChangePassword flag', () => {
    const token = signAccessToken({ ...claims, mustChangePassword: true });
    expect(verifyAccessToken(token).mustChangePassword).toBe(true);
  });

  it('rejects a payload edited to escalate privileges', () => {
    const token = signAccessToken({ ...claims, role: 'EDITOR' });
    const [header, payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload as string, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...decoded, role: 'OWNER' })).toString('base64url');
    expect(() => verifyAccessToken(`${header}.${forged}.${signature}`)).toThrow();
  });

  it('rejects garbage', () => {
    expect(() => verifyAccessToken('not-a-token')).toThrow();
  });

  it('will not accept a refresh token', () => {
    // Different secret AND different audience — a refresh token must never
    // be usable to authorise a request.
    const refresh = signRefreshToken({ sub: 'user_1', jti: newTokenId(), fam: newFamilyId() });
    expect(() => verifyAccessToken(refresh)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('round-trips its claims', () => {
    const jti = newTokenId();
    const fam = newFamilyId();
    const decoded = verifyRefreshToken(signRefreshToken({ sub: 'user_1', jti, fam }));
    expect(decoded).toEqual({ sub: 'user_1', jti, fam });
  });

  it('mints a distinct token per call, so hashes never collide', () => {
    const fam = newFamilyId();
    const a = signRefreshToken({ sub: 'user_1', jti: newTokenId(), fam });
    const b = signRefreshToken({ sub: 'user_1', jti: newTokenId(), fam });
    expect(a).not.toBe(b);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it('will not accept an access token', () => {
    const access = signAccessToken({ sub: 'user_1', role: 'OWNER', mustChangePassword: false });
    expect(() => verifyRefreshToken(access)).toThrow();
  });
});

describe('id generators', () => {
  it('produce unique values', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newTokenId()));
    expect(ids.size).toBe(500);
    const families = new Set(Array.from({ length: 500 }, () => newFamilyId()));
    expect(families.size).toBe(500);
  });
});
