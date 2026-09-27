import { Router } from 'express';
import type { ZodType } from 'zod';
import { reorderSchema } from '@teamenergo/shared';
import { HttpError } from '../errors.js';
import { recordAudit } from '../audit.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { reorderUpdates, withPrismaErrors } from './crud.js';
import { revalidateEntity } from '../revalidate.js';

/**
 * Shared HTTP wiring for an admin collection.
 *
 * The split here is deliberate. The *transport* concerns — validation,
 * status codes, audit entries, Prisma error translation, 404 handling — are
 * identical for every collection and live here once. The *data access* stays
 * in each collection's own handlers, written as explicit Prisma calls.
 *
 * A factory that reached into `prisma[modelName]` dynamically would collapse
 * both halves into one, but it would also discard the compile-time checking
 * that typed translation tables exist to provide. Callbacks keep the queries
 * fully typed while still removing six copies of the same Express plumbing.
 */

export interface ActorContext {
  adminUserId?: string | undefined;
  ip?: string | undefined;
}

export interface CollectionConfig<TCreate, TUpdate> {
  /** Entity name used in audit entries, e.g. "TeamMember". */
  entity: string;
  /** Action prefix used in audit entries, e.g. "team". */
  action: string;
  /** Serbian label used in not-found messages, e.g. "Član tima". */
  label: string;

  createSchema: ZodType<TCreate>;
  updateSchema: ZodType<TUpdate>;

  list: () => Promise<unknown>;
  find: (id: string) => Promise<unknown | null>;
  create: (input: TCreate, ctx: ActorContext) => Promise<{ id: string }>;
  update: (id: string, input: TUpdate, ctx: ActorContext) => Promise<unknown>;

  /**
   * Returns a reason string to refuse the deletion, or null to allow it.
   * Lets a collection warn that something still references the row instead of
   * silently breaking a page.
   */
  checkDelete?: (id: string) => Promise<{ reason: string; details: unknown } | null>;
  remove: (id: string) => Promise<void>;
  reorder?: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
}

function actorOf(req: { auth?: { sub: string }; ip?: string | undefined }): ActorContext {
  return { adminUserId: req.auth?.sub, ip: req.ip };
}

export function createCollectionRouter<TCreate, TUpdate>(
  config: CollectionConfig<TCreate, TUpdate>,
): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ items: await config.list() });
    }),
  );

  // Registered before "/:id" so the literal path is not swallowed by the
  // parameter route.
  if (config.reorder) {
    router.post(
      '/reorder',
      validateBody(reorderSchema),
      asyncHandler(async (req, res) => {
        const { ids } = req.body as { ids: string[] };
        await config.reorder!(reorderUpdates(ids));
        await recordAudit({
          ...actorOf(req),
          action: `${config.action}.reorder`,
          entity: config.entity,
        });
        revalidateEntity(config.entity);
        res.status(204).end();
      }),
    );
  }

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const found = await config.find(req.params.id as string);
      if (!found) throw HttpError.notFound(`${config.label} ne postoji`);
      res.json(found);
    }),
  );

  router.post(
    '/',
    validateBody(config.createSchema),
    asyncHandler(async (req, res) => {
      const created = await withPrismaErrors(() =>
        config.create(req.body as TCreate, actorOf(req)),
      );
      await recordAudit({
        ...actorOf(req),
        action: `${config.action}.create`,
        entity: config.entity,
        entityId: created.id,
      });
      revalidateEntity(config.entity);
      res.status(201).json(created);
    }),
  );

  router.patch(
    '/:id',
    validateBody(config.updateSchema),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      if (!(await config.find(id))) throw HttpError.notFound(`${config.label} ne postoji`);

      const updated = await withPrismaErrors(() =>
        config.update(id, req.body as TUpdate, actorOf(req)),
      );
      await recordAudit({
        ...actorOf(req),
        action: `${config.action}.update`,
        entity: config.entity,
        entityId: id,
      });
      revalidateEntity(config.entity);
      res.json(updated);
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      if (!(await config.find(id))) throw HttpError.notFound(`${config.label} ne postoji`);

      const force = req.query.force === 'true';
      if (config.checkDelete && !force) {
        const blocker = await config.checkDelete(id);
        if (blocker) throw HttpError.conflict(blocker.reason, blocker.details);
      }

      await config.remove(id);
      await recordAudit({
        ...actorOf(req),
        action: `${config.action}.delete`,
        entity: config.entity,
        entityId: id,
        diff: force ? { forced: true } : undefined,
      });
      revalidateEntity(config.entity);
      res.status(204).end();
    }),
  );

  return router;
}
