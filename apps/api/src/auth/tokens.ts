import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AccessTokenClaims, AdminRole } from '@teamenergo/shared';
import { env } from '../env.js';

/**
 * Two tokens, two jobs.
 *
 * The ACCESS token is a short-lived JWT signed with JWT_SECRET. It is verified
 * statelessly on every request — no database round trip.
 *
 * The REFRESH token is also a JWT (signed with a separate secret) but its
 * `jti` points at a row in `refresh_token`. That row is what makes revocation
 * possible: a plain JWT is valid until it expires and cannot be withdrawn,
 * which is unacceptable for a CMS where an account may need to be locked out
 * immediately. The signature is checked first so forged tokens are rejected
 * without touching the database.
 */

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  fam: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'teamenergo',
    audience: 'teamenergo-admin',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'teamenergo',
    audience: 'teamenergo-admin',
  });
  if (typeof payload === 'string') throw new Error('Malformed access token');
  return {
    sub: String(payload.sub),
    role: payload.role as AdminRole,
    mustChangePassword: Boolean(payload.mustChangePassword),
  };
}

export function signRefreshToken(claims: RefreshTokenClaims): string {
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
    issuer: 'teamenergo',
    audience: 'teamenergo-refresh',
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'teamenergo',
    audience: 'teamenergo-refresh',
  });
  if (typeof payload === 'string') throw new Error('Malformed refresh token');
  return {
    sub: String(payload.sub),
    jti: String(payload.jti),
    fam: String(payload.fam),
  };
}

/**
 * Refresh tokens are stored hashed, so a leaked database dump cannot be
 * replayed. SHA-256 rather than argon2 is deliberate: the token is 256 bits of
 * random data, not a low-entropy human password, so there is nothing to
 * brute-force and hashing runs on every refresh request.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison of two hex digests. An attacker would have to forge
 * a valid JWT signature before reaching this check, so a timing leak here is
 * not practically exploitable — but comparing secrets in constant time costs
 * nothing and removes the question entirely.
 */
export function tokenHashMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function newTokenId(): string {
  return randomUUID();
}

export function newFamilyId(): string {
  return randomUUID();
}

/** Converts "7d" / "15m" / "3600" into a Date in the future. */
export function expiryFrom(ttl: string): Date {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!match) throw new Error(`Unsupported TTL format: ${ttl}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const seconds = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return new Date(Date.now() + amount * seconds * 1000);
}
