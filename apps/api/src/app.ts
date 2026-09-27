import { resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './auth/router.js';
import { publicRouter } from './content/public-router.js';
import { adminRouter } from './admin/router.js';
import { env } from './env.js';
import { prisma } from './db.js';

export function createApp() {
  const app = express();

  // Behind the Next.js BFF / reverse proxy, so client IPs arrive via headers.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Readiness differs from liveness: this one proves the database answers,
  // which is what an orchestrator should gate traffic on.
  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable', reason: 'database' });
    }
  });

  // Uploaded media. Filenames are content-addressed UUIDs that never change,
  // so these can be cached indefinitely. Next.js rewrites /uploads/* here, so
  // the API still needs no public exposure.
  app.use(
    '/uploads',
    express.static(resolve(env.UPLOAD_DIR), {
      immutable: true,
      maxAge: '1y',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res, path) => {
        // An uploaded SVG is markup and could carry script.
        if (path.endsWith('.svg')) {
          res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        }

        // Documents are handed over as downloads, never rendered in place.
        //
        // A PDF can contain JavaScript, and the browser's built-in viewer
        // executes it. Opening one inline at /uploads/x.pdf would run that
        // script on this origin — the same origin as the admin panel and its
        // session cookie. Content-Disposition: attachment means the browser
        // saves the file instead of running it, and the CSP denies everything
        // to anything that renders it anyway.
        if (path.endsWith('.pdf') || path.endsWith('.docx')) {
          res.set('Content-Disposition', 'attachment');
          res.set('Content-Security-Policy', "default-src 'none'; sandbox");
          res.set('X-Content-Type-Options', 'nosniff');
        }
      },
    }),
  );

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
