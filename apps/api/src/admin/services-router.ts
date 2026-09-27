import type { Router } from 'express';
import { z } from 'zod';
import { LOCALES, publishableSchema, slugSchema, translationsRecord } from '@teamenergo/shared';
import { richText } from '../content/rich-text.js';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { missingLocales } from '../content/translations.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCollectionRouter } from './collection-router.js';
import { resolveSlug, writeTranslations } from './crud.js';

/**
 * Services (Usluge).
 *
 * Main CRUD comes from the shared collection router; the per-service stat
 * figures are a sub-resource appended afterwards.
 */

const serviceCopySchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  category: z.string().max(120).nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
  body: richText(50_000),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});

const createServiceSchema = publishableSchema.extend({
  iconName: z.string().max(60).nullable().optional(),
  accent: z.enum(['amber', 'blue', 'red']).nullable().optional(),
  imageId: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  translations: translationsRecord(serviceCopySchema),
});
const updateServiceSchema = createServiceSchema.partial();

type CreateService = z.infer<typeof createServiceSchema>;
type UpdateService = z.infer<typeof updateServiceSchema>;

const serviceInclude = {
  translations: true,
  image: { include: { translations: true } },
  stats: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
} as const;

export const servicesRouter: Router = createCollectionRouter<CreateService, UpdateService>({
  entity: 'Service',
  action: 'service',
  label: 'Usluga',
  createSchema: createServiceSchema,
  updateSchema: updateServiceSchema,

  list: async () => {
    const services = await prisma.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: serviceInclude,
    });
    return services.map((service) => ({
      ...service,
      // Lets the list show a "needs English" badge instead of the editor
      // discovering the gap on the live site.
      missingLocales: missingLocales(service.translations, LOCALES),
    }));
  },

  find: (id) => prisma.service.findUnique({ where: { id }, include: serviceInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          iconName: input.iconName ?? null,
          accent: input.accent ?? null,
          imageId: input.imageId ?? null,
          isFeatured: input.isFeatured ?? false,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });

      await writeTranslations(input.translations, (locale, copy) =>
        tx.serviceTranslation.create({
          data: {
            serviceId: created.id,
            locale,
            slug: resolveSlug(copy.slug, copy.title),
            title: copy.title,
            category: copy.category ?? null,
            summary: copy.summary ?? null,
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
        }),
      );

      return tx.service.findUniqueOrThrow({ where: { id: created.id }, include: serviceInclude });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.serviceTranslation.findMany({ where: { serviceId: id } });

      await tx.service.update({
        where: { id },
        data: {
          ...(input.iconName !== undefined ? { iconName: input.iconName } : {}),
          ...(input.accent !== undefined ? { accent: input.accent } : {}),
          ...(input.imageId !== undefined ? { imageId: input.imageId } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });

      await writeTranslations(input.translations, (locale, copy) => {
        const previous = existing.find((t) => t.locale === locale);
        // Slug is auto-derived only the first time a language is written; an
        // existing one changes only if explicitly supplied, so published URLs
        // do not move every time someone edits a title.
        const slug = copy.slug ?? previous?.slug ?? resolveSlug(undefined, copy.title);
        const data = {
          slug,
          title: copy.title,
          category: copy.category ?? null,
          summary: copy.summary ?? null,
          body: copy.body ?? null,
          seoTitle: copy.seoTitle ?? null,
          seoDescription: copy.seoDescription ?? null,
        };
        return tx.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: id, locale } },
          update: data,
          create: { ...data, serviceId: id, locale },
        });
      });

      return tx.service.findUniqueOrThrow({ where: { id }, include: serviceInclude });
    }),

  checkDelete: async (id) => {
    // Projects and inquiries reference a service with onDelete: SetNull, so
    // nothing breaks — but silently unlinking history deserves a warning.
    const service = await prisma.service.findUnique({
      where: { id },
      include: { _count: { select: { projects: true, inquiries: true } } },
    });
    const projects = service?._count.projects ?? 0;
    const inquiries = service?._count.inquiries ?? 0;

    return projects + inquiries > 0
      ? { reason: 'Usluga je povezana sa projektima ili upitima', details: { projects, inquiries } }
      : null;
  },

  remove: async (id) => {
    await prisma.service.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.service.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Stat figures shown on a service card ────────────────────────────────

const statSchema = z.object({
  value: z.string().min(1).max(60),
  labels: translationsRecord(z.string().min(1).max(120)),
});

servicesRouter.post(
  '/:id/stats',
  validateBody(statSchema),
  asyncHandler(async (req, res) => {
    const serviceId = req.params.id as string;
    const input = req.body as z.infer<typeof statSchema>;

    if ((await prisma.service.count({ where: { id: serviceId } })) === 0) {
      throw HttpError.notFound('Usluga ne postoji');
    }

    const last = await prisma.serviceStat.findFirst({
      where: { serviceId },
      orderBy: { sortOrder: 'desc' },
    });

    const stat = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceStat.create({
        data: { serviceId, value: input.value, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      await writeTranslations(input.labels, (locale, label) =>
        tx.serviceStatTranslation.create({
          data: { serviceStatId: created.id, locale, label },
        }),
      );
      return tx.serviceStat.findUniqueOrThrow({
        where: { id: created.id },
        include: { translations: true },
      });
    });

    res.status(201).json(stat);
  }),
);

servicesRouter.delete(
  '/:id/stats/:statId',
  asyncHandler(async (req, res) => {
    const stat = await prisma.serviceStat.findUnique({
      where: { id: req.params.statId as string },
    });
    if (!stat || stat.serviceId !== req.params.id) throw HttpError.notFound();

    await prisma.serviceStat.delete({ where: { id: stat.id } });
    res.status(204).end();
  }),
);
