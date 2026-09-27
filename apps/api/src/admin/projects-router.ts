import type { Router } from 'express';
import { z } from 'zod';
import {
  LOCALES,
  publishableSchema,
  reorderSchema,
  slugSchema,
  translationsRecord,
} from '@teamenergo/shared';
import { prisma } from '../db.js';
import { richText } from '../content/rich-text.js';
import { HttpError } from '../errors.js';
import { missingLocales } from '../content/translations.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCollectionRouter } from './collection-router.js';
import { reorderUpdates, resolveSlug, writeTranslations } from './crud.js';

/**
 * Projects (Reference).
 *
 * Main CRUD comes from the shared collection router; metrics and the per-
 * project image gallery are sub-resources appended afterwards. Appending is
 * safe because "/:id/metrics" is two path segments and cannot be matched by
 * the "/:id" route registered inside the factory.
 */

const projectCopySchema = z.object({
  title: z.string().min(1).max(250),
  slug: slugSchema.optional(),
  location: z.string().max(200).nullable().optional(),
  tag: z.string().max(120).nullable().optional(),
  summary: z.string().max(1500).nullable().optional(),
  body: richText(50_000),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});

const createProjectSchema = publishableSchema.extend({
  serviceId: z.string().nullable().optional(),
  coverImageId: z.string().nullable().optional(),
  accent: z.enum(['amber', 'blue', 'red']).nullable().optional(),
  year: z.number().int().min(1900).max(2200).nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  isFeatured: z.boolean().optional(),
  translations: translationsRecord(projectCopySchema),
});
const updateProjectSchema = createProjectSchema.partial();

type CreateProject = z.infer<typeof createProjectSchema>;
type UpdateProject = z.infer<typeof updateProjectSchema>;

const projectInclude = {
  translations: true,
  coverImage: { include: { translations: true } },
  service: { include: { translations: true } },
  metrics: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
  images: {
    orderBy: { sortOrder: 'asc' },
    include: { media: { include: { translations: true } } },
  },
} as const;

function baseData(input: UpdateProject) {
  return {
    ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
    ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId } : {}),
    ...(input.accent !== undefined ? { accent: input.accent } : {}),
    ...(input.year !== undefined ? { year: input.year } : {}),
    ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
}

export const projectsRouter: Router = createCollectionRouter<CreateProject, UpdateProject>({
  entity: 'Project',
  action: 'project',
  label: 'Projekat',
  createSchema: createProjectSchema,
  updateSchema: updateProjectSchema,

  list: async () => {
    const projects = await prisma.project.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: projectInclude,
    });
    return projects.map((project) => ({
      ...project,
      missingLocales: missingLocales(project.translations, LOCALES),
    }));
  },

  find: (id) => prisma.project.findUnique({ where: { id }, include: projectInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          serviceId: input.serviceId ?? null,
          coverImageId: input.coverImageId ?? null,
          accent: input.accent ?? null,
          year: input.year ?? null,
          completedAt: input.completedAt ?? null,
          isFeatured: input.isFeatured ?? false,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.projectTranslation.create({
          data: {
            projectId: created.id,
            locale,
            slug: resolveSlug(copy.slug, copy.title),
            title: copy.title,
            location: copy.location ?? null,
            tag: copy.tag ?? null,
            summary: copy.summary ?? null,
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
        }),
      );
      return tx.project.findUniqueOrThrow({ where: { id: created.id }, include: projectInclude });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      const before = await tx.projectTranslation.findMany({ where: { projectId: id } });
      await tx.project.update({ where: { id }, data: baseData(input) });

      await writeTranslations(input.translations, (locale, copy) => {
        const existing = before.find((t) => t.locale === locale);
        // Only auto-derive a slug the first time a language is written;
        // changing a live slug would break inbound links.
        const slug = copy.slug ?? existing?.slug ?? resolveSlug(undefined, copy.title);
        const data = {
          slug,
          title: copy.title,
          location: copy.location ?? null,
          tag: copy.tag ?? null,
          summary: copy.summary ?? null,
          body: copy.body ?? null,
          seoTitle: copy.seoTitle ?? null,
          seoDescription: copy.seoDescription ?? null,
        };
        return tx.projectTranslation.upsert({
          where: { projectId_locale: { projectId: id, locale } },
          update: data,
          create: { ...data, projectId: id, locale },
        });
      });

      return tx.project.findUniqueOrThrow({ where: { id }, include: projectInclude });
    }),

  remove: async (id) => {
    await prisma.project.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.project.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Metrics ─────────────────────────────────────────────────────────────

const metricSchema = z.object({
  value: z.string().min(1).max(60),
  labels: translationsRecord(z.string().min(1).max(120)),
});

projectsRouter.post(
  '/:id/metrics',
  validateBody(metricSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const input = req.body as z.infer<typeof metricSchema>;

    if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
      throw HttpError.notFound('Projekat ne postoji');
    }

    const last = await prisma.projectMetric.findFirst({
      where: { projectId },
      orderBy: { sortOrder: 'desc' },
    });

    const metric = await prisma.$transaction(async (tx) => {
      const created = await tx.projectMetric.create({
        data: { projectId, value: input.value, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      await writeTranslations(input.labels, (locale, label) =>
        tx.projectMetricTranslation.create({
          data: { projectMetricId: created.id, locale, label },
        }),
      );
      return tx.projectMetric.findUniqueOrThrow({
        where: { id: created.id },
        include: { translations: true },
      });
    });

    res.status(201).json(metric);
  }),
);

projectsRouter.delete(
  '/:id/metrics/:metricId',
  asyncHandler(async (req, res) => {
    const metric = await prisma.projectMetric.findUnique({
      where: { id: req.params.metricId as string },
    });
    if (!metric || metric.projectId !== req.params.id) throw HttpError.notFound();

    await prisma.projectMetric.delete({ where: { id: metric.id } });
    res.status(204).end();
  }),
);

// ── Gallery images ──────────────────────────────────────────────────────

const attachImagesSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1).max(50),
});

projectsRouter.post(
  '/:id/images',
  validateBody(attachImagesSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const { mediaIds } = req.body as z.infer<typeof attachImagesSchema>;

    if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
      throw HttpError.notFound('Projekat ne postoji');
    }

    const known = await prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true },
    });
    if (known.length !== mediaIds.length) {
      throw HttpError.badRequest('Neke slike ne postoje u biblioteci');
    }

    const last = await prisma.projectImage.findFirst({
      where: { projectId },
      orderBy: { sortOrder: 'desc' },
    });
    let sortOrder = (last?.sortOrder ?? -1) + 1;

    // createMany with skipDuplicates keeps re-attaching an image idempotent
    // rather than failing on the [projectId, mediaId] unique constraint.
    await prisma.projectImage.createMany({
      data: mediaIds.map((mediaId) => ({ projectId, mediaId, sortOrder: sortOrder++ })),
      skipDuplicates: true,
    });

    const images = await prisma.projectImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: { media: { include: { translations: true } } },
    });

    res.status(201).json({ items: images });
  }),
);

projectsRouter.post(
  '/:id/images/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const { ids } = req.body as z.infer<typeof reorderSchema>;
    const updates = reorderUpdates(ids);

    await prisma.$transaction(
      updates.map((u) =>
        prisma.projectImage.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
    res.status(204).end();
  }),
);

projectsRouter.delete(
  '/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    const image = await prisma.projectImage.findUnique({
      where: { id: req.params.imageId as string },
    });
    if (!image || image.projectId !== req.params.id) throw HttpError.notFound();

    // Detaches from the project only; the file stays in the media library.
    await prisma.projectImage.delete({ where: { id: image.id } });
    res.status(204).end();
  }),
);
