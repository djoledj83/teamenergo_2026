import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { listQuerySchema, translationsRecord } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../errors.js';
import { recordAudit } from '../audit.js';
import { asyncHandler } from '../middleware/auth.js';
import { parseQuery, validateBody } from '../middleware/validate.js';
import { deleteStoredImage, storeUpload, type StoredVariant } from './storage.js';
import { revalidateEntity } from '../revalidate.js';

/**
 * Files are buffered in memory rather than written to a temp directory: they
 * are size-capped, every upload is re-encoded by sharp anyway, and nothing
 * attacker-supplied ever reaches the filesystem under its own name.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Multer applies one ceiling to every file, so it gets the larger of the
    // two limits and the per-kind limit is enforced after the bytes have been
    // identified. Otherwise an oversized image would be cut off here with a
    // generic multer error instead of "Slika je veća od 3 MB".
    fileSize: Math.max(env.MAX_IMAGE_MB, env.MAX_DOCUMENT_MB) * 1024 * 1024,
    files: 10,
  },
});

const mediaTranslationSchema = z.object({
  alt: z.string().max(300).optional(),
  caption: z.string().max(600).optional(),
});

const updateMediaSchema = z.object({
  folder: z.string().max(120).nullable().optional(),
  translations: translationsRecord(mediaTranslationSchema).optional(),
});

export const mediaRouter: Router = Router();

mediaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parseQuery(listQuerySchema, req.query);
    const folder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    const kind = req.query.kind === 'image' || req.query.kind === 'document' ? req.query.kind : undefined;

    // Kind is derived from the stored mime type rather than a column: it is
    // already implied by the data, and a column would be a migration plus a
    // second source of truth that could disagree with it.
    const where = {
      ...(folder ? { folder } : {}),
      ...(kind === 'image' ? { mimeType: { startsWith: 'image/' } } : {}),
      ...(kind === 'document' ? { NOT: { mimeType: { startsWith: 'image/' } } } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { translations: true },
      }),
    ]);

    res.json({ items, total, page, pageSize });
  }),
);

mediaRouter.post(
  '/',
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw HttpError.badRequest('Nijedan fajl nije poslat');

    const folder = typeof req.body?.folder === 'string' ? req.body.folder : null;

    const created = [];
    for (const file of files) {
      const stored = await storeUpload(file.buffer, file.originalname);

      const media = await prisma.media.create({
        data: {
          filename: stored.filename,
          // Kept only as a human-readable label; never used as a path.
          originalName: file.originalname.slice(0, 255),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          path: stored.path,
          variants: stored.variants as never,
          folder,
          uploadedById: req.auth?.sub ?? null,
        },
        include: { translations: true },
      });

      await recordAudit({
        adminUserId: req.auth?.sub,
        action: 'media.upload',
        entity: 'Media',
        entityId: media.id,
        ip: req.ip,
      });

      created.push(media);
    }

    res.status(201).json({ items: created });
  }),
);

mediaRouter.patch(
  '/:id',
  validateBody(updateMediaSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const input = req.body as z.infer<typeof updateMediaSchema>;

    const existing = await prisma.media.findUnique({ where: { id } });
    if (!existing) throw HttpError.notFound('Fajl ne postoji');

    const media = await prisma.$transaction(async (tx) => {
      if (input.folder !== undefined) {
        await tx.media.update({ where: { id }, data: { folder: input.folder } });
      }

      for (const [locale, copy] of Object.entries(input.translations ?? {})) {
        if (!copy) continue;
        await tx.mediaTranslation.upsert({
          where: { mediaId_locale: { mediaId: id, locale } },
          update: { alt: copy.alt ?? null, caption: copy.caption ?? null },
          create: { mediaId: id, locale, alt: copy.alt ?? null, caption: copy.caption ?? null },
        });
      }

      return tx.media.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    });

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'media.update',
      entity: 'Media',
      entityId: id,
      ip: req.ip,
    });

    revalidateEntity('Media');
    res.json(media);
  }),
);

mediaRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw HttpError.notFound('Fajl ne postoji');

    // Anything still pointing at this image would be left with a broken
    // reference, so the caller is told what is using it rather than the
    // deletion silently blanking a page.
    const [services, projects, projectImages, team, posts, albums, items, testimonials, clients, blocks] =
      await Promise.all([
        prisma.service.count({ where: { imageId: id } }),
        prisma.project.count({ where: { coverImageId: id } }),
        prisma.projectImage.count({ where: { mediaId: id } }),
        prisma.teamMember.count({ where: { photoId: id } }),
        prisma.post.count({ where: { coverImageId: id } }),
        prisma.galleryAlbum.count({ where: { coverImageId: id } }),
        prisma.galleryItem.count({ where: { mediaId: id } }),
        prisma.testimonial.count({ where: { avatarId: id } }),
        prisma.client.count({ where: { logoId: id } }),
        prisma.pageBlock.count({ where: { imageId: id } }),
      ]);

    const usageCount =
      services + projects + projectImages + team + posts + albums + items + testimonials + clients + blocks;

    if (usageCount > 0 && req.query.force !== 'true') {
      throw HttpError.conflict('Slika se koristi na sajtu', {
        usageCount,
        usage: {
          services,
          projects,
          projectImages,
          team,
          posts,
          albums,
          galleryItems: items,
          testimonials,
          clients,
          pageBlocks: blocks,
        },
      });
    }

    await prisma.media.delete({ where: { id } });
    await deleteStoredImage(media.path, (media.variants ?? []) as unknown as StoredVariant[]);

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'media.delete',
      entity: 'Media',
      entityId: id,
      diff: { filename: media.filename, forced: req.query.force === 'true' },
      ip: req.ip,
    });

    revalidateEntity('Media');
    res.status(204).end();
  }),
);
