import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

// The database is never reached in this file: every assertion is about
// routing and guards, which run before any handler touches Prisma.
vi.mock('./db.js', () => ({
  prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => vi.fn(async () => null) }) }),
  disconnectDb: vi.fn(),
}));

const { createApp } = await import('./app.js');
const app = createApp();

/** Shape of the private Express router internals this walker reads. */
type RouterEntry = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack: unknown[] };
  regexp?: { source: string };
} & Record<string, unknown>;

/** Walks the Express router tree and collects "METHOD /path" for every route. */
function collectRoutes(): string[] {
  const found: string[] = [];

  const walk = (stack: unknown[], prefix: string) => {
    for (const entry of stack as RouterEntry[]) {
      if (entry.route) {
        const methods = Object.keys(entry.route.methods ?? {})
          .filter((m) => m !== '_all')
          .map((m) => m.toUpperCase());
        for (const method of methods) {
          found.push(`${method} ${prefix}${entry.route.path === '/' ? '' : entry.route.path}`);
        }
      } else if (entry.handle?.stack) {
        const source = entry.regexp?.source ?? '';
        const segment = source
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ':param')
          .replace(/\$$/, '')
          .replace(/\?$/, '');
        walk(entry.handle.stack, prefix + (segment === '/' ? '' : segment));
      }
    }
  };

  walk((app as unknown as { _router: { stack: unknown[] } })._router.stack, '');
  return found;
}

describe('route table', () => {
  const routes = collectRoutes();

  it('registers the public read surface', () => {
    const joined = routes.join('\n');
    for (const path of [
      '/api/v1/public/bootstrap',
      '/api/v1/public/home',
      '/api/v1/public/services',
      '/api/v1/public/projects',
      '/api/v1/public/posts',
      '/api/v1/public/team',
      '/api/v1/public/gallery',
      '/api/v1/public/testimonials',
      '/api/v1/public/clients',
      '/api/v1/public/stats',
    ]) {
      expect(joined, `missing ${path}`).toContain(path);
    }
  });

  it('registers every admin collection', () => {
    const joined = routes.join('\n');
    for (const collection of [
      'media',
      'services',
      'projects',
      'posts',
      'post-categories',
      'gallery',
      'team',
      'testimonials',
      'clients',
      'stats',
      'inquiries',
      'site',
    ]) {
      expect(joined, `missing admin collection ${collection}`).toContain(
        `/api/v1/admin/${collection}`,
      );
    }
  });

  it('declares reorder before the :id route on every collection that has one', () => {
    // Express matches in registration order. If "/:id" came first, a POST to
    // "/reorder" would be handled as an update to an item called "reorder" —
    // which is exactly what the hand-written services router used to do.
    const reorderRoutes = routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => route.startsWith('POST ') && route.endsWith('/reorder'));

    expect(reorderRoutes.length).toBeGreaterThan(0);

    for (const { route, index } of reorderRoutes) {
      const base = route.slice('POST '.length, -'/reorder'.length);
      const firstParamRoute = routes.findIndex((candidate) =>
        new RegExp(`^[A-Z]+ ${base}/:[a-zA-Z]+$`).test(candidate),
      );
      if (firstParamRoute !== -1) {
        expect(index, `${route} must be registered before ${base}/:id`).toBeLessThan(
          firstParamRoute,
        );
      }
    }
  });
});

describe('guards', () => {
  it('leaves health open', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('leaves public reads open', async () => {
    // Prisma is a stub here, so the only thing asserted is that no auth
    // guard rejected the request first.
    const res = await request(app).get('/api/v1/public/clients');
    expect(res.status).not.toBe(401);
  });

  it.each([
    ['get', '/api/v1/admin/dashboard'],
    ['get', '/api/v1/admin/services'],
    ['get', '/api/v1/admin/projects'],
    ['get', '/api/v1/admin/posts'],
    ['get', '/api/v1/admin/gallery'],
    ['get', '/api/v1/admin/team'],
    ['get', '/api/v1/admin/testimonials'],
    ['get', '/api/v1/admin/clients'],
    ['get', '/api/v1/admin/stats'],
    ['get', '/api/v1/admin/inquiries'],
    ['get', '/api/v1/admin/media'],
    ['get', '/api/v1/admin/site/pages'],
    ['get', '/api/v1/admin/site/nav'],
    ['get', '/api/v1/admin/site/settings'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/audit'],
  ])('requires a token: %s %s', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => Promise<{ status: number }>>)[
      method
    ]!(path);
    expect(res.status).toBe(401);
  });

  it('never caches admin responses', async () => {
    const res = await request(app).get('/api/v1/admin/services');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sets a shared cache header on public reads', async () => {
    const res = await request(app).get('/api/v1/public/clients');
    expect(res.headers['cache-control']).toContain('stale-while-revalidate');
  });
});
