import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '7d';

/**
 * An in-memory stand-in for the handful of Prisma calls the auth service
 * makes. The real client needs a native engine that isn't available in this
 * environment, and the point of these tests is the rotation and replay logic
 * rather than Prisma's own query behaviour.
 */
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
  ip: string | null;
  userAgent: string | null;
}

const users = new Map<string, FakeUser>();
const tokens = new Map<string, FakeToken>();
const audit: Array<Record<string, unknown>> = [];

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
  auditLog: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      audit.push(data);
      return data;
    }),
  },
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
};

vi.mock('../db.js', () => ({ prisma: prismaFake, disconnectDb: vi.fn() }));

const { createApp } = await import('../app.js');
const app = createApp();

const PASSWORD = 'CorrectHorse1Battery';

async function seedUser(overrides: Partial<FakeUser> = {}) {
  users.clear();
  tokens.clear();
  audit.length = 0;
  const user: FakeUser = {
    id: 'usr_1',
    email: 'admin@teamenergo.rs',
    passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
    name: 'Administrator',
    role: 'OWNER',
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    ...overrides,
  };
  users.set(user.id, user);
  return user;
}

beforeEach(async () => {
  await seedUser();
});

describe('POST /api/v1/auth/login', () => {
  it('returns a token pair and the user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe('admin@teamenergo.rs');
    expect(res.body.user.role).toBe('OWNER');
  });

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });
    expect(JSON.stringify(res.body)).not.toContain('$argon2');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('gives the same answer for an unknown email, so accounts cannot be enumerated', async () => {
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@teamenergo.rs', password: PASSWORD });
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: 'wrong-password' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('refuses a deactivated account', async () => {
    await seedUser({ isActive: false });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('validates its input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('records an audit entry', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });
    expect(audit.some((entry) => entry.action === 'auth.login')).toBe(true);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  it('returns the user for a valid token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('usr_1');
  });

  it('will not accept a refresh token as a credential', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.refreshToken}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  async function login() {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });
    return res.body as { accessToken: string; refreshToken: string };
  }

  it('rotates to a brand-new pair', async () => {
    const first = await login();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('issues a token that itself works', async () => {
    const first = await login();
    const second = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    const third = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.body.refreshToken });

    expect(third.status).toBe(200);
  });

  it('revokes the whole family when a spent token is replayed', async () => {
    const first = await login();

    // Legitimate rotation.
    const second = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    expect(second.status).toBe(200);

    // An attacker replays the stolen original.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);

    // The legitimate holder's newer token is now dead too — the whole login
    // chain is burned, forcing a fresh sign-in.
    const afterBreach = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.body.refreshToken });
    expect(afterBreach.status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a.b.c' });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const first = await login();
    for (const token of tokens.values()) token.expiresAt = new Date(Date.now() - 1000);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(401);
  });

  it('refuses once the account is deactivated', async () => {
    const first = await login();
    users.get('usr_1')!.isActive = false;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('kills the session', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: login.body.refreshToken });
    expect(out.status).toBe(204);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(401);
  });

  it('is harmless without a token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(204);
  });
});

describe('POST /api/v1/auth/change-password', () => {
  async function accessToken() {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });
    return res.body.accessToken as string;
  }

  it('changes the password and clears the must-change flag', async () => {
    const token = await accessToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'BrandNewPassw0rd',
        confirmPassword: 'BrandNewPassw0rd',
      });

    expect(res.status).toBe(204);
    const user = users.get('usr_1')!;
    expect(user.mustChangePassword).toBe(false);
    expect(await argon2.verify(user.passwordHash, 'BrandNewPassw0rd')).toBe(true);
  });

  it('logs every other session out', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamenergo.rs', password: PASSWORD });

    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'BrandNewPassw0rd',
        confirmPassword: 'BrandNewPassw0rd',
      });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong current password', async () => {
    const token = await accessToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'not-the-password',
        newPassword: 'BrandNewPassw0rd',
        confirmPassword: 'BrandNewPassw0rd',
      });
    expect(res.status).toBe(400);
  });

  it('enforces the password policy', async () => {
    const token = await accessToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short', confirmPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('requires the confirmation to match', async () => {
    const token = await accessToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'BrandNewPassw0rd',
        confirmPassword: 'DifferentPassw0rd',
      });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/auth/change-password').send({
      currentPassword: PASSWORD,
      newPassword: 'BrandNewPassw0rd',
      confirmPassword: 'BrandNewPassw0rd',
    });
    expect(res.status).toBe(401);
  });
});

describe('error envelope', () => {
  it('uses the shared shape for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });
});
