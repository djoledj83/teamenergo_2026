import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Strips the password so the target can be logged.
 * postgresql://user:secret@host:5433/db → user@host:5433/db
 */
function describe(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.username}@${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return '(DATABASE_URL could not be parsed)';
  }
}

export const DATABASE_TARGET = describe(env.DATABASE_URL);

export const prisma = new PrismaClient({
  // Passed explicitly rather than left to Prisma's own environment lookup.
  // Prisma loads .env files itself, from the schema directory and the working
  // directory, and those are not necessarily the file the process was started
  // with. Naming the value that env.ts already validated means the API can
  // only ever open the database that was actually configured.
  datasourceUrl: env.DATABASE_URL,
  log: ['warn', 'error'],
});

/**
 * Opens the connection once, at boot.
 *
 * Without this the first failure surfaces as a 500 with a full Prisma stack
 * trace on every single request, which buries the one fact that matters:
 * which database the process is pointed at. Failing here instead prints that
 * address once and stops.
 */
export async function connectDb(): Promise<void> {
  try {
    const [row] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() AS version`;
    const banner = row?.version ?? '';
    const major = banner.match(/PostgreSQL (\d+)/)?.[1] ?? '?';
    const flavour = /musl|alpine/i.test(banner)
      ? 'alpine container'
      : /Visual C\+\+/i.test(banner)
        ? 'installed on Windows'
        : /Debian|Ubuntu/i.test(banner)
          ? 'Debian/Ubuntu package'
          : 'unidentified build';

    logger.info(`database: ${DATABASE_TARGET} — PostgreSQL ${major}, ${flavour}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error(`Cannot open the database at ${DATABASE_TARGET}`);

    if (/[Aa]uthentication failed/.test(message)) {
      logger.error(
        'The server answered and rejected the credentials, so something IS ' +
          'listening there — check the user and password in DATABASE_URL, and that ' +
          'any @ : / ? # in the password is percent-encoded (@ becomes %40). ' +
          'On a machine running several PostgreSQL instances, also check the port: ' +
          'the credentials may be right for a different one. Then: npm run doctor',
      );
    } else if (/does not exist/.test(message)) {
      logger.error(`The database named in DATABASE_URL does not exist. Run: npm run setup`);
    } else if (/ECONNREFUSED|Can't reach database server/i.test(message)) {
      // PostgreSQL runs on the host, not in this stack, so the fix is never
      // "start the container". Inside Docker this is nearly always the
      // localhost mistake, and naming it here saves the search.
      logger.error(
        `Nothing is listening at ${DATABASE_TARGET}. If this process is in a container, ` +
          'note that localhost means the container itself, not the machine — the host ' +
          "is reached as host.docker.internal (which needs extra_hosts: host-gateway, " +
          'already set in docker-compose.yml). Otherwise: is PostgreSQL running, and on ' +
          'that port?',
      );
    } else {
      logger.error(message.split('\n')[0] ?? message);
    }

    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
