import { Router } from 'express';
import { z } from 'zod';
import { paginationSchema } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { recordAudit } from '../audit.js';
import { asyncHandler } from '../middleware/auth.js';
import { parseQuery, validateBody } from '../middleware/validate.js';

/**
 * Contact-form submissions.
 *
 * Read and triage only — inquiries are created by the public endpoint and are
 * never editable here, so the record of what someone actually sent stays
 * intact. Admins can change the status and attach internal notes.
 */

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']).optional(),
  search: z.string().max(160).optional(),
});

const updateInquirySchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const inquiriesRouter: Router = Router();

inquiriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, search } = parseQuery(listQuerySchema, req.query);

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, items, newCount] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { service: { include: { translations: true } } },
      }),
      prisma.inquiry.count({ where: { status: 'NEW' } }),
    ]);

    res.json({ items, total, page, pageSize, newCount });
  }),
);

inquiriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: { service: { include: { translations: true } } },
    });
    if (!inquiry) throw HttpError.notFound('Upit ne postoji');

    // Opening an unread inquiry marks it read, so the dashboard badge
    // reflects what has actually been looked at.
    if (inquiry.status === 'NEW') {
      await prisma.inquiry.update({
        where: { id },
        data: { status: 'READ', readAt: new Date() },
      });
      res.json({ ...inquiry, status: 'READ' });
      return;
    }

    res.json(inquiry);
  }),
);

inquiriesRouter.patch(
  '/:id',
  validateBody(updateInquirySchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const input = req.body as z.infer<typeof updateInquirySchema>;

    const exists = await prisma.inquiry.count({ where: { id } });
    if (exists === 0) throw HttpError.notFound('Upit ne postoji');

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status && input.status !== 'NEW' ? { readAt: new Date() } : {}),
      },
      include: { service: { include: { translations: true } } },
    });

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'inquiry.update',
      entity: 'Inquiry',
      entityId: id,
      diff: { status: input.status },
      ip: req.ip,
    });

    res.json(inquiry);
  }),
);

inquiriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const inquiry = await prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) throw HttpError.notFound('Upit ne postoji');

    await prisma.inquiry.delete({ where: { id } });

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'inquiry.delete',
      entity: 'Inquiry',
      entityId: id,
      // Someone sent this; keep a trace of what was discarded and by whom.
      diff: { email: inquiry.email, createdAt: inquiry.createdAt },
      ip: req.ip,
    });

    res.status(204).end();
  }),
);
