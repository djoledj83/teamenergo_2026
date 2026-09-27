#!/usr/bin/env node
/**
 * Checks that the environment and database are in a state the app can run in.
 *
 *   npm run doctor
 *
 * Reports what is wrong and what to do about it, rather than leaving a broken
 * setup to surface later as a 500 from a request handler.
 */
import { PrismaClient } from '@prisma/client';

const ok = (m) => console.log(`  \u001b[32m✓\u001b[0m ${m}`);
const bad = (m) => console.log(`  \u001b[31m✗\u001b[0m ${m}`);
const warn = (m) => console.log(`  \u001b[33m!\u001b[0m ${m}`);
const head = (m) => console.log(`\n${m}`);

let failures = 0;
const fail = (m) => {
  bad(m);
  failures += 1;
};

head('Environment');

const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (process.env[key]) ok(`${key} is set`);
  else fail(`${key} is missing`);
}

for (const key of ['API_INTERNAL_URL', 'WEB_INTERNAL_URL']) {
  const value = process.env[key];
  if (!value) warn(`${key} not set — defaults will be used`);
  else if (/:\/\/(api|web):/.test(value)) {
    fail(`${key}=${value} uses a Docker service name; outside Docker use localhost`);
  } else ok(`${key} = ${value}`);
}

let dbUrl;
try {
  dbUrl = new URL(process.env.DATABASE_URL ?? '');
  ok(`database: ${dbUrl.username}@${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`);
} catch {
  fail(
    'DATABASE_URL does not parse. If the password contains @ : / ? # [ ] or a ' +
      'space it must be percent-encoded (@ becomes %40).',
  );
}

if (failures > 0) {
  console.log('\nFix the above before continuing.\n');
  process.exit(1);
}

head('Database');

const prisma = new PrismaClient({ log: [] });

/**
 * Prisma errors open with a blank line and a generic
 * "Invalid `prisma.x()` invocation:" banner; the actual cause is further
 * down. Skip the boilerplate so the reported reason is the useful line.
 */
const NOISE = /^(Invalid `prisma\.|invocation:|at\s)/i;

function firstMeaningfulLine(text) {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !NOISE.test(line)) ?? text.trim()
  );
}

try {
  await prisma.$queryRaw`SELECT 1`;
  ok('connection succeeded');

  // WHICH Postgres is this? The most expensive confusion in this setup is
  // DATABASE_URL reaching a PostgreSQL installed directly on the machine
  // while docker compose runs a second one — same hostname, different port,
  // completely separate data. Everything looks fine in isolation; the two
  // simply never contain the same rows. The version banner names the build,
  // so it can say which one answered.
  try {
    const [row] = await prisma.$queryRaw`SELECT version() AS v, current_database() AS db`;
    const banner = String(row.v);
    const major = banner.match(/PostgreSQL (\d+)/)?.[1] ?? '?';

    const flavour = /Visual C\+\+/i.test(banner)
      ? 'installed on Windows'
      : /musl|alpine/i.test(banner)
        ? 'an Alpine image (this is what docker compose runs)'
        : /Debian|Ubuntu/i.test(banner)
          ? 'a Debian/Ubuntu package'
          : 'unidentified build';

    ok(`server: PostgreSQL ${major}, ${flavour} — database "${row.db}"`);

    // PostgreSQL is expected to be the machine's own — there is no database
    // container in this stack. The banner is reported rather than judged,
    // because on a shared server it is useful to see at a glance which
    // installation answered.
    if (major && Number(major) < 14) {
      warn(`PostgreSQL ${major} is older than this schema was developed against (17)`);
    }
  } catch {
    // version() is harmless to lose — the checks below still stand.
  }
} catch (error) {
  const full = error instanceof Error ? error.message : String(error);
  const reason = firstMeaningfulLine(full);
  fail(`cannot connect: ${reason}`);

  // Distinguish the causes: blaming the credentials for a missing engine or a
  // stopped server sends you looking in the wrong place.
  if (/Query Engine|binaryTargets/i.test(full)) {
    console.log('\n  The Prisma client was generated for a different platform.\n' +
                '  Run: npx prisma generate --schema apps/api/prisma/schema.prisma\n');
  } else if (/authentication failed|password|role .* does not exist/i.test(full)) {
    console.log('\n  The server answered and rejected the credentials, so something IS\n' +
                '  listening there — check the user and password in DATABASE_URL, and\n' +
                '  that any @ : / ? # in the password is percent-encoded (@ = %40).\n');
  } else if (/database .* does not exist/i.test(full)) {
    console.log(`\n  The database ${dbUrl.pathname.slice(1)} does not exist. Create it first.\n`);
  } else {
    console.log('\n  Is Postgres running and listening on ' +
                `${dbUrl.hostname}:${dbUrl.port}?\n`);
  }
  process.exit(1);
}

// Can this role actually create objects? Postgres checks the CREATE
// privilege on the database before it evaluates `CREATE SCHEMA IF NOT
// EXISTS`, so a role without it fails on line 2 of the migration — long
// before anything interesting happens.
try {
  await prisma.$executeRawUnsafe('CREATE TABLE _doctor_probe (id int)');
  await prisma.$executeRawUnsafe('DROP TABLE _doctor_probe');
  ok('role can create tables');
} catch (error) {
  const message = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .find((line) => line.includes('permission denied')) ?? 'permission denied';
  fail(`role cannot create tables — ${message.trim()}`);

  // Any connected role can read pg_catalog, so we can name whoever is able
  // to fix this instead of leaving you guessing at a superuser password.
  let owners = null;
  try {
    const [row] = await prisma.$queryRaw`
      SELECT
        pg_get_userbyid(d.datdba)  AS database_owner,
        pg_get_userbyid(n.nspowner) AS schema_owner,
        current_user                AS connected_as,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser
      FROM pg_database d, pg_namespace n
      WHERE d.datname = current_database() AND n.nspname = 'public'
    `;
    owners = row;
  } catch {
    // Not fatal — the guidance below still stands without it.
  }

  const db = dbUrl.pathname.slice(1);

  if (owners) {
    console.log('');
    ok(`connected as        : ${owners.connected_as}`);
    ok(`database owner      : ${owners.database_owner}`);
    ok(`public schema owner : ${owners.schema_owner}`);
  }

  console.log(
    '\n  The migration will fail on its first statement.\n\n' +
      `  Run the grant as a role that can do it — "${owners?.database_owner ?? 'postgres'}"\n` +
      '  (the database owner) or any superuser:\n\n' +
      '    npx prisma db execute \\\n' +
      `      --url "postgresql://${owners?.database_owner ?? 'postgres'}:PASSWORD@${dbUrl.hostname}:${dbUrl.port}/${db}" \\\n` +
      '      --file scripts/sql/grant-privileges.sql\n\n' +
      '  That password is the one set when PostgreSQL was installed, or when\n' +
      `  the "${owners?.database_owner ?? 'postgres'}" role was created. pgAdmin usually has it saved.\n\n` +
      '  No password to hand? Two alternatives that need no superuser:\n' +
      `    - have "${owners?.connected_as ?? 'your role'}" create its own database and point\n` +
      '      DATABASE_URL at it — the creator owns it and can create tables\n' +
      '    - in pgAdmin: right-click the database, Properties, set Owner to\n' +
      `      "${owners?.connected_as ?? 'your role'}"\n\n` +
      '  Then: npm run doctor  (to confirm)  and  npm run db:baseline\n',
  );
  await prisma.$disconnect();
  process.exit(1);
}

const tables = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`;
const tableNames = tables.map((row) => row.table_name);

if (tableNames.length === 0) {
  fail('no tables — the migration has not been applied');
  console.log('\n  Run: npm run db:baseline\n');
  process.exit(1);
}
ok(`${tableNames.length} tables present`);

for (const expected of ['locale', 'admin_user', 'service', 'service_translation', 'media']) {
  if (tableNames.includes(expected)) ok(`table ${expected}`);
  else fail(`table ${expected} is MISSING — the migration applied only partially`);
}

if (tableNames.includes('_prisma_migrations')) {
  const applied = await prisma.$queryRaw`
    SELECT migration_name, finished_at FROM _prisma_migrations
    WHERE finished_at IS NOT NULL ORDER BY finished_at
  `;
  if (applied.length > 0) ok(`migrations recorded: ${applied.map((m) => m.migration_name).join(', ')}`);
  else warn('tables exist but no migration is recorded — run npm run db:baseline to record it');
} else {
  warn('_prisma_migrations does not exist — the schema was applied outside Prisma');
}

head('Seed data');

// Structural rows the seed is responsible for. Zero here means the seed has
// not run against THIS database.
const counts = {
  locale: await prisma.locale.count(),
  adminUser: await prisma.adminUser.count(),
  page: await prisma.page.count(),
  navItem: await prisma.navItem.count(),
  service: await prisma.service.count(),
};

for (const [name, count] of Object.entries(counts)) {
  if (count > 0) ok(`${name}: ${count}`);
  else fail(`${name}: 0 — seed has not run`);
}

// Everything the admin panel writes. Reported, never failed on: an empty
// collection is a normal state for a site that has not been filled in yet.
//
// The published column is the one that matters for "I entered it but the
// site does not show it" — the public API returns published rows only, so
// an unpublished row is invisible to visitors by design.
head('Content (what the admin panel has written)');

const collections = [
  ['service', prisma.service],
  ['project', prisma.project],
  ['stat', prisma.stat],
  ['testimonial', prisma.testimonial],
  ['client', prisma.client],
  ['post', prisma.post],
  ['teamMember', prisma.teamMember],
  ['album', prisma.album],
];

let hiddenRows = 0;

for (const [name, model] of collections) {
  if (!model) continue;
  const total = await model.count();
  let published = total;
  try {
    published = await model.count({ where: { isPublished: true } });
  } catch {
    // Not every collection carries a publish flag.
  }
  const hidden = total - published;
  hiddenRows += hidden;
  const suffix = hidden > 0 ? `  (${hidden} unpublished — not shown on the site)` : '';
  if (total === 0) console.log(`  · ${name}: 0`);
  else ok(`${name}: ${total}${suffix}`);
}

const mediaCount = await prisma.media.count().catch(() => 0);
const inquiryCount = await prisma.inquiry.count().catch(() => 0);
console.log(`  · media: ${mediaCount}   inquiries: ${inquiryCount}`);

if (hiddenRows > 0) {
  console.log(
    '\n  Rows marked unpublished are stored but deliberately hidden from the\n' +
      '  public site. Toggle "Objavljeno" on the row in /admin to show it.\n',
  );
}

if (counts.adminUser > 0) {
  const admin = await prisma.adminUser.findFirst({
    select: { email: true, isActive: true, mustChangePassword: true, role: true },
  });
  ok(`admin: ${admin.email} (${admin.role})`);
  if (!admin.isActive) fail('admin account is deactivated — login will return 403');
  if (admin.mustChangePassword) {
    warn('admin must change password on first login — this is expected');
  }
} else {
  console.log('\n  Run: npm run db:seed\n');
}

await prisma.$disconnect();

// ── The running API ────────────────────────────────────────────────────
//
// Everything above talks to the database directly. The app talks to it
// through the API process, which read .env when it started. If .env changed
// since then, the API is still pointed at the old database — and the symptom
// is a login that fails with "wrong password" while the data plainly exists.
head('Running API');

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function probe(path, init) {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(4000),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return null;
  }
}

const health = await probe('/health');

if (!health) {
  warn(`not running at ${apiUrl} — start it with: npm run dev`);
} else {
  ok(`reachable at ${apiUrl}`);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    warn('ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set — skipping the login check');
  } else if (counts.adminUser === 0) {
    warn('no admin user in the database — skipping the login check');
  } else {
    const login = await probe('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (login?.ok) {
      ok(`login works for ${email}`);
    } else if (login?.status === 401) {
      fail('login rejected, but the admin user EXISTS in the database');
      console.log(
        '\n  The API is almost certainly connected to a different database.\n' +
          '  It reads .env once at startup, so a change since then has not\n' +
          '  reached it.\n\n' +
          '  Stop `npm run dev` (Ctrl+C) and start it again.\n\n' +
          '  If it still fails after a restart, the password was changed — the\n' +
          '  seeded one only applies to a freshly created account.\n',
      );
    } else if (login?.status === 403) {
      ok('credentials accepted (account flagged for password change)');
    } else {
      warn(`login returned ${login?.status ?? 'no response'}`);
    }
  }
}

head(failures === 0 ? '\u001b[32mAll checks passed.\u001b[0m' : `\u001b[31m${failures} problem(s) found.\u001b[0m`);
console.log('');
process.exit(failures === 0 ? 0 : 1);
