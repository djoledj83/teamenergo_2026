import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { createApp } from './app.js';
import { connectDb } from './db.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { ensureUploadDir } from './media/storage.js';

// Confirm the database before accepting traffic, so a misconfigured
// connection is one clear line at startup rather than a stack trace on every
// request. It also puts the database's address in the log, which is the fact
// you need when the app and your database client disagree about what exists.
await connectDb();

/**
 * Say where uploads are being served from, and whether anything is there.
 *
 * UPLOAD_DIR is relative, so it resolves against this process's working
 * directory — and like DATABASE_URL it is read from .env once, at startup.
 * A value changed since the process began, or a path that resolves somewhere
 * unexpected, produces exactly one symptom: every image 404s while the files
 * plainly exist on disk. One line at boot turns that into an obvious answer.
 */
async function reportUploadDir(): Promise<void> {
  const target = resolve(env.UPLOAD_DIR);
  await ensureUploadDir();

  let fileCount: number | null = null;
  try {
    const years = await readdir(target, { withFileTypes: true });
    fileCount = years.length;
  } catch {
    fileCount = null;
  }

  logger.info(`uploads: ${target} (UPLOAD_DIR=${env.UPLOAD_DIR})`);

  if (fileCount === 0) {
    logger.warn(
      'The upload directory is empty. If images used to work, check that ' +
        'UPLOAD_DIR in .env still points where the files actually are — it is ' +
        'read once at startup, so a change since then has not reached this process.',
    );
  }
}

await reportUploadDir();

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info(`API listening on port ${env.API_PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  // Don't hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
