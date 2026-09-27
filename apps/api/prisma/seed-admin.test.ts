import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';

/**
 * Covers the seed's admin account, end to end: run the real seed function,
 * then sign in through the real HTTP endpoint.
 *
 * This file exists because of a bug that every other test missed. The auth
 * tests build an admin user by hand and then log in as it, so the login path
 * was well covered — but nothing ever ran `seedAdminUser()`, and that is where
 * the fault was: the account was created once and then never reconciled, so
 * editing ADMIN_INITIAL_PASSWORD in .env left the stored hash behind. Every
 * test passed while signing in was impossible.
 *
 * So the assertion here is deliberately not "a column changed". It is "after
 * the seed runs, POST /api/v1/auth/login with the password from .env returns
 * 200" — the thing a person actually does.
 */

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '7d';

const EMAIL = 'admin@teamenergo.rs';

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

interface FakeToken {
  id: string;
  tokenHash: string;
  adminUserId: string;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

const users = new Map<string, FakeUser>();
const tokens = new Map<string, FakeToken>();
let nextId = 1;

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && 'lt' in (expected as object)) {
      return (actual as Date) < (expected as { lt: Date }).lt;
    }
    return actual === expected;
  });
}

const prismaFake = {
  adminUser: {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      for (const user of users.values()) {
        if (where.id && user.id === where.id) return user;
        if (where.email && user.email === where.email) return user;
      }
      return null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      const user = users.get(where.id);
      if (!user) throw new Error('not found');
      Object.assign(user, data);
      return user;
    }),
    create: vi.fn(async ({ data }: { data: Omit<FakeUser, 'id' | 'lastLoginAt'> }) => {
      const user: FakeUser = { id: `usr_${nextId++}`, lastLoginAt: null, ...data };
      users.set(user.id, user);
      return user;
    }),
  },
  refreshToken: {
    create: vi.fn(async ({ data }: { data: FakeToken }) => {
      tokens.set(data.id, { ...data, usedAt: null, revokedAt: null });
      return data;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const token = tokens.get(where.id);
      if (!token) return null;
      return { ...token, adminUser: users.get(token.adminUserId) };
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeToken> }) => {
        let count = 0;
        for (const token of tokens.values()) {
          if (matches(token as unknown as Record<string, unknown>, where)) {
            Object.assign(token, data);
            count += 1;
          }
        }
        return { count };
      },
    ),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
  $disconnect: vi.fn(async () => undefined),
};

// The seed constructs its own client; the app imports the shared one. Both
// have to resolve to the same store for the chain to hold together.
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaFake),
  AdminRole: { OWNER: 'OWNER', EDITOR: 'EDITOR' },
}));
vi.mock('../src/db.js', () => ({ prisma: prismaFake, disconnectDb: vi.fn() }));

const { seedAdminUser } = await import('./seed.js');
const { createApp } = await import('../src/app.js');
const app = createApp();

/** What a person does: type the password from .env into the login form. */
function signIn(password: string) {
  return request(app).post('/api/v1/auth/login').send({ email: EMAIL, password });
}

beforeEach(() => {
  users.clear();
  tokens.clear();
  nextId = 1;
  process.env.ADMIN_EMAIL = EMAIL;
});

describe('seedAdminUser', () => {
  it('creates an account that can immediately sign in', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();

    expect(users.size).toBe(1);
    await expect(signIn('FirstPassword123')).resolves.toMatchObject({ status: 200 });
    await expect(signIn('something-else')).resolves.toMatchObject({ status: 401 });
  });

  it('forces a password change on the account it creates', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();
    expect([...users.values()][0]?.mustChangePassword).toBe(true);
  });

  it('is idempotent — a second run changes nothing', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();
    const hashAfterFirst = [...users.values()][0]!.passwordHash;

    await seedAdminUser();

    expect(users.size).toBe(1);
    expect([...users.values()][0]!.passwordHash).toBe(hashAfterFirst);
    await expect(signIn('FirstPassword123')).resolves.toMatchObject({ status: 200 });
  });

  // The regression. Editing .env used to have no effect once the row existed,
  // and the only symptom was a login that insisted the password was wrong.
  it('re-syncs the password when ADMIN_INITIAL_PASSWORD changes', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();

    process.env.ADMIN_INITIAL_PASSWORD = 'SecondPassword456';
    await seedAdminUser();

    await expect(signIn('SecondPassword456')).resolves.toMatchObject({ status: 200 });
    await expect(signIn('FirstPassword123')).resolves.toMatchObject({ status: 401 });
  });

  it('revokes sessions minted against the superseded password', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();

    const { body } = await signIn('FirstPassword123');
    const refreshToken = body.refreshToken as string;

    process.env.ADMIN_INITIAL_PASSWORD = 'SecondPassword456';
    await seedAdminUser();

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  // The other half of the rule: .env is only the source of truth until a
  // person sets their own password.
  it('leaves a password chosen by its owner alone', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();

    // What the admin panel does when the forced change is completed.
    const user = [...users.values()][0]!;
    user.passwordHash = await argon2.hash('ChosenByAPerson789', { type: argon2.argon2id });
    user.mustChangePassword = false;

    process.env.ADMIN_INITIAL_PASSWORD = 'SomeoneEditedDotEnv999';
    await seedAdminUser();

    await expect(signIn('ChosenByAPerson789')).resolves.toMatchObject({ status: 200 });
    await expect(signIn('SomeoneEditedDotEnv999')).resolves.toMatchObject({ status: 401 });
  });

  it('reactivates an account the seed still owns', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'FirstPassword123';
    await seedAdminUser();
    [...users.values()][0]!.isActive = false;

    process.env.ADMIN_INITIAL_PASSWORD = 'SecondPassword456';
    await seedAdminUser();

    await expect(signIn('SecondPassword456')).resolves.toMatchObject({ status: 200 });
  });

  it('does nothing without ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD', async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_INITIAL_PASSWORD;
    await seedAdminUser();
    expect(users.size).toBe(0);
  });
});
