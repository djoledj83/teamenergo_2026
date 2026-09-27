import { Router } from 'express';
import { z } from 'zod';
import { paginationSchema } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { asyncHandler, requireRole } from '../middleware/auth.js';
import { parseQuery } from '../middleware/validate.js';

/**
 * The change history.
 *
 * Read-only by design and with no delete route at all: an audit trail an
 * admin can edit or clear records nothing worth having. Rows are written by
 * recordAudit() as a side effect of the operations themselves.
 *
 * Restricted to owners. The log carries IP addresses and the before/after of
 * every change, which is more than an editor needs to do their job.
 */

const listQuerySchema = paginationSchema.extend({
  entity: z.string().max(60).optional(),
  action: z.string().max(60).optional(),
  adminUserId: z.string().max(40).optional(),
});

export const auditRouter: Router = Router();

auditRouter.use(requireRole('OWNER'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, entity, action, adminUserId } = parseQuery(
      listQuerySchema,
      req.query,
    );

    const where = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(adminUserId ? { adminUserId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          adminUser: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    res.json({ items, total, page, pageSize });
  }),
);

/**
 * The distinct values actually present, so the filter UI offers what exists
 * rather than a hardcoded list that drifts as actions are added.
 */
auditRouter.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const [entities, actions, users] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ['entity'],
        select: { entity: true },
        orderBy: { entity: 'asc' },
      }),
      prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      prisma.adminUser.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      entities: entities.map((row) => row.entity),
      actions: actions.map((row) => row.action),
      users,
    });
  }),
);
