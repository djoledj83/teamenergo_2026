#!/usr/bin/env node
/**
 * Resets an admin account's password.
 *
 *   npm run db:reset-admin                          # uses ADMIN_INITIAL_PASSWORD
 *   npm run db:reset-admin -- --password "s3cret"   # or an explicit one
 *   npm run db:reset-admin -- --email other@x.rs
 *
 * The seed deliberately will not overwrite a password a person has chosen, so
 * this is the way back in after one is forgotten. It also reactivates a
 * deactivated account and revokes every existing session, since a password
 * that had to be reset should not leave old sessions alive.
 *
 * The account is flagged to change its password at the next login, so the
 * value used here is never a long-lived credential.
 */
import { parseArgs } from 'node:util';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const ok = (m) => console.log(`  \u001b[32m✓\u001b[0m ${m}`);
const bad = (m) => console.log(`  \u001b[31m✗\u001b[0m ${m}`);

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
  },
  strict: false,
});

const email = values.email ?? process.env.ADMIN_EMAIL;
const password = values.password ?? process.env.ADMIN_INITIAL_PASSWORD;

if (!email) {
  bad('No email. Set ADMIN_EMAIL in .env or pass --email you@example.com');
  process.exit(1);
}
if (!password) {
  bad('No password. Set ADMIN_INITIAL_PASSWORD in .env or pass --password "…"');
  process.exit(1);
}
if (password.length < 12) {
  bad(`Password is ${password.length} characters; use at least 12.`);
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.adminUser.findUnique({ where: { email } });

if (!user) {
  bad(`No admin account with the email ${email}.`);

  const others = await prisma.adminUser.findMany({ select: { email: true }, take: 10 });
  if (others.length > 0) {
    console.log(`\n  Accounts that do exist: ${others.map((u) => u.email).join(', ')}\n`);
  } else {
    console.log('\n  There are no admin accounts at all. Run: npm run db:seed\n');
  }
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.adminUser.update({
  where: { id: user.id },
  data: {
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    isActive: true,
    // The next login lands on /admin/password before anything else.
    mustChangePassword: true,
  },
});

const { count } = await prisma.refreshToken.updateMany({
  where: { adminUserId: user.id, revokedAt: null },
  data: { revokedAt: new Date() },
});

ok(`password reset for ${email}`);
if (!user.isActive) ok('account reactivated');
if (count > 0) ok(`${count} existing session(s) revoked`);
ok('a password change is required at the next login');

const source = values.password ? '--password' : 'ADMIN_INITIAL_PASSWORD in .env';
console.log(`\n  Sign in at /admin with the value from ${source}.\n`);

await prisma.$disconnect();
