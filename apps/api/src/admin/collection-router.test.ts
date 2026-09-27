import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

const auditEntries: Array<Record<string, unknown>> = [];
vi.mock('../audit.js', () => ({
  recordAudit: vi.fn(async (entry: Record<string, unknown>) => {
    auditEntries.push(entry);
  }),
  diffOf: vi.fn(() => ({})),
}));

const { createCollectionRouter } = await import('./collection-router.js');
const { errorHandler, notFoundHandler } = await import('../middleware/error-handler.js');

/**
 * Exercises the shared HTTP wiring with in-memory handlers. Six collections
 * depend on this plumbing, so a bug here would surface in all of them.
 */
const rows = new Map<string, { id: string; name: string; sortOrder: number }>();

const createSchema = z.object({ name: z.string().min(2) });
const updateSchema = createSchema.partial();

let checkDeleteResult: { reason: string; details: unknown } | null = null;
const removed: string[] = [];
const reordered: Array<{ id: string; sortOrder: number }> = [];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    '/items',
    createCollectionRouter<z.infer<typeof createSchema>, z.infer<typeof updateSchema>>({
      entity: 'Item',
      action: 'item',
      label: 'Stavka',
      createSchema,
      updateSchema,
      list: async () => [...rows.values()],
      find: async (id) => rows.get(id) ?? null,
      create: async (input) => {
        const row = { id: `it_${rows.size + 1}`, name: input.name, sortOrder: rows.size };
        rows.set(row.id, row);
        return row;
      },
      update: async (id, input) => {
        const row = rows.get(id)!;
        if (input.name !== undefined) row.name = input.name;
        return row;
      },
      checkDelete: async () => checkDeleteResult,
      remove: async (id) => {
        removed.push(id);
        rows.delete(id);
      },
      reorder: async (updates) => {
        reordered.splice(0, reordered.length, ...updates);
      },
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

beforeEach(() => {
  rows.clear();
  rows.set('it_1', { id: 'it_1', name: 'First', sortOrder: 0 });
  rows.set('it_2', { id: 'it_2', name: 'Second', sortOrder: 1 });
  auditEntries.length = 0;
  removed.length = 0;
  reordered.length = 0;
  checkDeleteResult = null;
});

describe('list and read', () => {
  it('wraps the list in an items envelope', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('returns a single row', async () => {
    const res = await request(app).get('/items/it_1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('First');
  });

  it('404s an unknown id with the collection label', async () => {
    const res = await request(app).get('/items/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Stavka');
  });
});

describe('create', () => {
  it('returns 201 with the created row', async () => {
    const res = await request(app).post('/items').send({ name: 'Third' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Third');
  });

  it('validates the body', async () => {
    const res = await request(app).post('/items').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('records an audit entry carrying the new id', async () => {
    const res = await request(app).post('/items').send({ name: 'Third' });
    const entry = auditEntries.find((e) => e.action === 'item.create');
    expect(entry).toBeDefined();
    expect(entry?.entityId).toBe(res.body.id);
  });
});

describe('update', () => {
  it('applies a partial change', async () => {
    const res = await request(app).patch('/items/it_1').send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('404s before touching an unknown row', async () => {
    const res = await request(app).patch('/items/nope').send({ name: 'Renamed' });
    expect(res.status).toBe(404);
    expect(auditEntries.some((e) => e.action === 'item.update')).toBe(false);
  });

  it('still validates on a partial update', async () => {
    const res = await request(app).patch('/items/it_1').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('delete', () => {
  it('removes the row and returns 204', async () => {
    const res = await request(app).delete('/items/it_1');
    expect(res.status).toBe(204);
    expect(removed).toEqual(['it_1']);
  });

  it('refuses when something still references the row', async () => {
    checkDeleteResult = { reason: 'Još uvek se koristi', details: { projects: 2 } };
    const res = await request(app).delete('/items/it_1');
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ projects: 2 });
    expect(removed).toEqual([]);
  });

  it('proceeds when the caller passes force=true', async () => {
    checkDeleteResult = { reason: 'Još uvek se koristi', details: {} };
    const res = await request(app).delete('/items/it_1?force=true');
    expect(res.status).toBe(204);
    expect(removed).toEqual(['it_1']);
    expect(auditEntries.find((e) => e.action === 'item.delete')?.diff).toEqual({ forced: true });
  });

  it('404s an unknown id rather than reporting a phantom delete', async () => {
    const res = await request(app).delete('/items/nope');
    expect(res.status).toBe(404);
    expect(removed).toEqual([]);
  });
});

describe('reorder', () => {
  it('is not swallowed by the /:id route', async () => {
    // Express matches in registration order, so "/reorder" has to be declared
    // before "/:id" or it arrives as an update to an item literally named
    // "reorder". Registration order is the only thing keeping this working.
    const res = await request(app).post('/items/reorder').send({ ids: ['it_2', 'it_1'] });
    expect(res.status).toBe(204);
    expect(reordered).toEqual([
      { id: 'it_2', sortOrder: 0 },
      { id: 'it_1', sortOrder: 1 },
    ]);
  });

  it('rejects duplicate ids', async () => {
    const res = await request(app).post('/items/reorder').send({ ids: ['it_1', 'it_1'] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('duplikate');
  });

  it('rejects an empty list', async () => {
    const res = await request(app).post('/items/reorder').send({ ids: [] });
    expect(res.status).toBe(400);
  });
});
