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
import { HttpError } from '../errors.js';
import { missingLocales } from '../content/translations.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCollectionRouter } from './collection-router.js';
import { reorderUpdates, resolveSlug, writeTranslations } from './crud.js';

/**
 * Gallery albums and their items.
 *
 * An item links an album to a row in the media library; removing one detaches
 * the image rather than deleting the file, which stays available for reuse.
 */

const albumCopySchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().max(2000).nullable().optional(),
});

const createAlbumSchema = publishableSchema.extend({
  coverImageId: z.string().nullable().optional(),
  translations: translationsRecord(albumCopySchema),
});
const updateAlbumSchema = createAlbumSchema.partial();

type CreateAlbum = z.infer<typeof createAlbumSchema>;
type UpdateAlbum = z.infer<typeof updateAlbumSchema>;

const albumInclude = {
  translations: true,
  coverImage: { include: { translations: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { translations: true, media: { include: { translations: true } } },
  },
} as const;

export const galleryRouter: Router = createCollectionRouter<CreateAlbum, UpdateAlbum>({
  entity: 'GalleryAlbum',
  action: 'galleryAlbum',
  label: 'Album',
  createSchema: createAlbumSchema,
  updateSchema: updateAlbumSchema,

  list: async () => {
    const albums = await prisma.galleryAlbum.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: true,
        coverImage: { include: { translations: true } },
        _count: { select: { items: true } },
      },
    });
    return albums.map((album) => ({
      ...album,
      missingLocales: missingLocales(album.translations, LOCALES),
    }));
  },

  find: (id) => prisma.galleryAlbum.findUnique({ where: { id }, include: albumInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.galleryAlbum.create({
        data: {
          coverImageId: input.coverImageId ?? null,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.galleryAlbumTranslation.create({
          data: {
            galleryAlbumId: created.id,
            locale,
            slug: resolveSlug(copy.slug, copy.title),
            title: copy.title,
            description: copy.description ?? null,
          },
        }),
      );
      return tx.galleryAlbum.findUniqueOrThrow({
        where: { id: created.id },
        include: albumInclude,
      });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.galleryAlbumTranslation.findMany({
        where: { galleryAlbumId: id },
      });

      await tx.galleryAlbum.update({
        where: { id },
        data: {
          ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });

      await writeTranslations(input.translations, (locale, copy) => {
        const previous = existing.find((t) => t.locale === locale);
        const slug = copy.slug ?? previous?.slug ?? resolveSlug(undefined, copy.title);
        const data = { slug, title: copy.title, description: copy.description ?? null };
        return tx.galleryAlbumTranslation.upsert({
          where: { galleryAlbumId_locale: { galleryAlbumId: id, locale } },
          update: data,
          create: { ...data, galleryAlbumId: id, locale },
        });
      });

      return tx.galleryAlbum.findUniqueOrThrow({ where: { id }, include: albumInclude });
    }),

  remove: async (id) => {
    // Items cascade; the underlying media files are untouched.
    await prisma.galleryAlbum.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.galleryAlbum.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Album items ─────────────────────────────────────────────────────────

const addItemsSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1).max(100),
});

const captionSchema = z.object({
  captions: translationsRecord(z.string().max(600)),
});

galleryRouter.post(
  '/:id/items',
  validateBody(addItemsSchema),
  asyncHandler(async (req, res) => {
    const galleryAlbumId = req.params.id as string;
    const { mediaIds } = req.body as z.infer<typeof addItemsSchema>;

    if ((await prisma.galleryAlbum.count({ where: { id: galleryAlbumId } })) === 0) {
      throw HttpError.notFound('Album ne postoji');
    }

    const known = await prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true },
    });
    if (known.length !== mediaIds.length) {
      throw HttpError.badRequest('Neke slike ne postoje u biblioteci');
    }

    const last = await prisma.galleryItem.findFirst({
      where: { galleryAlbumId },
      orderBy: { sortOrder: 'desc' },
    });
    let sortOrder = (last?.sortOrder ?? -1) + 1;

    await prisma.galleryItem.createMany({
      data: mediaIds.map((mediaId) => ({ galleryAlbumId, mediaId, sortOrder: sortOrder++ })),
      skipDuplicates: true,
    });

    const items = await prisma.galleryItem.findMany({
      where: { galleryAlbumId },
      orderBy: { sortOrder: 'asc' },
      include: { translations: true, media: { include: { translations: true } } },
    });

    res.status(201).json({ items });
  }),
);

galleryRouter.post(
  '/:id/items/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const { ids } = req.body as z.infer<typeof reorderSchema>;
    const updates = reorderUpdates(ids);

    await prisma.$transaction(
      updates.map((u) =>
        prisma.galleryItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
    res.status(204).end();
  }),
);

galleryRouter.patch(
  '/:id/items/:itemId',
  validateBody(captionSchema),
  asyncHandler(async (req, res) => {
    const itemId = req.params.itemId as string;
    const { captions } = req.body as z.infer<typeof captionSchema>;

    const item = await prisma.galleryItem.findUnique({ where: { id: itemId } });
    if (!item || item.galleryAlbumId !== req.params.id) throw HttpError.notFound();

    await prisma.$transaction(async (tx) => {
      await writeTranslations(captions, (locale, caption) =>
        tx.galleryItemTranslation.upsert({
          where: { galleryItemId_locale: { galleryItemId: itemId, locale } },
          update: { caption },
          create: { galleryItemId: itemId, locale, caption },
        }),
      );
    });

    const updated = await prisma.galleryItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { translations: true, media: { include: { translations: true } } },
    });

    res.json(updated);
  }),
);

galleryRouter.delete(
  '/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const item = await prisma.galleryItem.findUnique({ where: { id: req.params.itemId as string } });
    if (!item || item.galleryAlbumId !== req.params.id) throw HttpError.notFound();

    await prisma.galleryItem.delete({ where: { id: item.id } });
    res.status(204).end();
  }),
);
