import argon2 from 'argon2';
import type { AdminRole, AuthenticatedUser } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../errors.js';
import { logger } from '../logger.js';
import {
  expiryFrom,
  hashToken,
  newFamilyId,
  newTokenId,
  signAccessToken,
  signRefreshToken,
  tokenHashMatches,
  verifyRefreshToken,
} from './tokens.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: AuthenticatedUser;
}

interface RequestContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

const ARGON2_OPTIONS = { type: argon2.argon2id } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

function toAuthenticatedUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AdminRole,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Issues a fresh access/refresh pair and records the refresh row. */
async function issueTokens(
  user: { id: string; role: string; mustChangePassword: boolean },
  familyId: string,
  context: RequestContext,
): Promise<TokenPair> {
  const jti = newTokenId();

  // Each token carries a unique jti, so two tokens are never identical even
  // when minted in the same second.
  const refreshToken = signRefreshToken({ sub: user.id, jti, fam: familyId });

  await prisma.refreshToken.create({
    data: {
      id: jti,
      tokenHash: hashToken(refreshToken),
      adminUserId: user.id,
      familyId,
      expiresAt: expiryFrom(env.JWT_REFRESH_TTL),
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role as AdminRole,
    mustChangePassword: user.mustChangePassword,
  });

  return { accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string,
  context: RequestContext,
): Promise<LoginResult> {
  const user = await prisma.adminUser.findUnique({ where: { email } });

  // Same error and roughly the same amount of work whether the account exists
  // or not, so the response cannot be used to enumerate valid emails.
  if (!user) {
    await argon2.hash(password, ARGON2_OPTIONS).catch(() => undefined);
    throw HttpError.unauthorized('Pogrešan email ili lozinka');
  }

  const passwordMatches = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!passwordMatches) {
    throw HttpError.unauthorized('Pogrešan email ili lozinka');
  }

  if (!user.isActive) {
    throw HttpError.forbidden('Nalog je deaktiviran');
  }

  const tokens = await issueTokens(user, newFamilyId(), context);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { ...tokens, user: toAuthenticatedUser(user) };
}

/**
 * Rotates a refresh token.
 *
 * Each token may be spent exactly once. Presenting one that has already been
 * used means either a replay or a stolen token, and in both cases the safe
 * response is to revoke the entire family — every descendant of that login —
 * and force a fresh sign-in.
 */
export async function refresh(rawToken: string, context: RequestContext): Promise<LoginResult> {
  let claims;
  try {
    claims = verifyRefreshToken(rawToken);
  } catch {
    throw HttpError.unauthorized('Sesija je istekla, prijavite se ponovo');
  }

  const record = await prisma.refreshToken.findUnique({
    where: { id: claims.jti },
    include: { adminUser: true },
  });

  if (!record || !tokenHashMatches(record.tokenHash, hashToken(rawToken))) {
    throw HttpError.unauthorized('Sesija je istekla, prijavite se ponovo');
  }

  if (record.revokedAt || record.expiresAt < new Date()) {
    throw HttpError.unauthorized('Sesija je istekla, prijavite se ponovo');
  }

  // Atomic spend: updateMany only matches while the row is still unused, so
  // two concurrent refreshes cannot both succeed.
  const spend = await prisma.refreshToken.updateMany({
    where: { id: record.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date() },
  });

  if (spend.count === 0) {
    await revokeFamily(record.familyId);
    logger.warn(
      { adminUserId: record.adminUserId, familyId: record.familyId },
      'refresh token replay detected — family revoked',
    );
    throw HttpError.unauthorized('Sesija je poništena iz bezbednosnih razloga, prijavite se ponovo');
  }

  if (!record.adminUser.isActive) {
    await revokeFamily(record.familyId);
    throw HttpError.forbidden('Nalog je deaktiviran');
  }

  const tokens = await issueTokens(record.adminUser, record.familyId, context);
  return { ...tokens, user: toAuthenticatedUser(record.adminUser) };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Logs out a single session. Unknown or malformed tokens are ignored. */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  try {
    const claims = verifyRefreshToken(rawToken);
    await revokeFamily(claims.fam);
  } catch {
    // Already invalid — nothing to revoke.
  }
}

/** Logs a user out of every device. */
export async function revokeAllForUser(adminUserId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { adminUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  adminUserId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!user) throw HttpError.unauthorized();

  const matches = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
  if (!matches) throw HttpError.badRequest('Trenutna lozinka nije ispravna');

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });

  // A password change invalidates every existing session, including this one.
  await revokeAllForUser(adminUserId);
}

export async function getUserById(adminUserId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!user || !user.isActive) return null;
  return toAuthenticatedUser(user);
}

/** Housekeeping — removes rows that can no longer authenticate anything. */
export async function pruneExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
