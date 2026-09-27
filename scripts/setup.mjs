#!/usr/bin/env node
/**
 * One command to get from an empty database to a working one.
 *
 *   npm run setup
 *
 * Applies the migration if the tables are missing, seeds if the content is
 * missing, then verifies. Safe to re-run: each step is skipped when it has
 * already been done, so this is the command to reach for whenever the state
 * is unclear.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = resolve(import.meta.dirname, '..');
const step = (m) => console.log(`\n\u001b[1m${m}\u001b[0m`);
const ok = (m) => console.log(`  \u001b[32m✓\u001b[0m ${m}`);
const info = (m) => console.log(`  · ${m}`);

function npm(args) {
  execFileSync('npm', args, { cwd: root, shell: true, stdio: 'inherit' });
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run through: npm run setup');
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
console.log(`\nTarget: ${url.username}@${url.hostname}:${url.port}${url.pathname}`);

/** Waits for Postgres to accept connections; it is not ready the instant the container starts. */
async function waitForDatabase(attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const probe = new PrismaClient();
    try {
      await probe.$queryRaw`SELECT 1`;
      await probe.$disconnect();
      return true;
    } catch {
      await probe.$disconnect().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}

const reachable = await waitForDatabase(3);

if (!reachable) {
  // PostgreSQL is not ours to start. It runs on the machine — on a server,
  // shared with other services — so this reports and stops rather than
  // reaching for a container that no longer exists in this stack.
  console.error(
    `\nCannot reach the database at ${url.hostname}:${url.port}.\n\n` +
      '  · Is PostgreSQL running?   Linux: systemctl status postgresql\n' +
      '  · Is it on that port?      Postgres often runs on 5432 locally and\n' +
      '                             5433 on a machine with more than one.\n' +
      '  · Does DATABASE_URL match? Check the host, port and database name.\n',
  );
  process.exit(1);
}

ok(`database reachable at ${url.hostname}:${url.port}`);

const prisma = new PrismaClient();

step('1. Schema');
const tables = await prisma.$queryRaw`
  SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
`;
const tableCount = tables[0]?.n ?? 0;

if (tableCount === 0) {
  info('no tables — applying the migration');
  await prisma.$disconnect();
  npm(['run', 'db:baseline']);
} else {
  ok(`${tableCount} tables already present`);
  await prisma.$disconnect();
}

step('2. Content');
const after = new PrismaClient();
const serviceCount = await after.service.count();
const localeCount = await after.locale.count();
await after.$disconnect();

if (localeCount === 0 || serviceCount === 0) {
  info(`locales=${localeCount} services=${serviceCount} — seeding`);
  npm(['run', 'db:seed']);
} else {
  ok(`already seeded (${localeCount} locales, ${serviceCount} services)`);
  info('re-running the seed anyway — it is idempotent and repairs gaps');
  npm(['run', 'db:seed']);
}

step('3. Verify');
npm(['run', 'doctor']);

console.log(
  '\n\u001b[1mReady.\u001b[0m  Start the app with:  npm run dev\n' +
    '  Admin: http://localhost:3000/admin\n\n' +
    'If the data disappears again, something is recreating the database.\n' +
    'The usual cause is `docker compose down -v` — the -v flag deletes the\n' +
    'volume. Use plain `docker compose down` (or `stop`) to keep your data.\n',
);
