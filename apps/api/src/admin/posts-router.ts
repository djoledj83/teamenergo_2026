import type { Router } from 'express';
import { z } from 'zod';
import { LOCALES, reorderSchema, slugSchema, translationsRecord } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { richText } from '../content/rich-text.js';
import { HttpError } from '../errors.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { revalidateEntity } from '../revalidate.js';
import { missingLocales } from '../content/translations.js';
import { createCollectionRouter } from './collection-router.js';
import { reorderUpdates, resolveSlug, writeTranslations } from './crud.js';

/**
 * News (Vesti) and their categories.
 */

const postCopySchema = z.object({
  title: z.string().min(1).max(250),
  slug: slugSchema.optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  body: richText(100_000),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});

const createPostSchema = z.object({
  coverImageId: z.string().nullable().optional(),
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  translations: translationsRecord(postCopySchema),
});
const updatePostSchema = createPostSchema.partial();

type CreatePost = z.infer<typeof createPostSchema>;
type UpdatePost = z.infer<typeof updatePostSchema>;

const postImageInclude = {
  orderBy: { sortOrder: 'asc' },
  include: { media: { include: { translations: true } } },
} as const;

const postInclude = {
  images: postImageInclude,
  translations: true,
  coverImage: { include: { translations: true } },
  categories: { include: { translations: true } },
  author: { select: { id: true, name: true } },
} as const;

/**
 * Publishing without an explicit date stamps "now".
 *
 * The public feed orders by publishedAt and filters out future dates, so a
 * post published with a null date would silently never appear.
 */
function resolvePublishedAt(
  input: UpdatePost,
  existing?: { publishedAt: Date | null } | null,
): Date | null | undefined {
  if (input.publishedAt !== undefined) return input.publishedAt;
  if (input.isPublished === true && !existing?.publishedAt) return new Date();
  return undefined;
}

export const postsRouter: Router = createCollectionRouter<CreatePost, UpdatePost>({
  entity: 'Post',
  action: 'post',
  label: 'Vest',
  createSchema: createPostSchema,
  updateSchema: updatePostSchema,

  list: async () => {
    const posts = await prisma.post.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: postInclude,
    });
    return posts.map((post) => ({
      ...post,
      missingLocales: missingLocales(post.translations, LOCALES),
    }));
  },

  find: (id) => prisma.post.findUnique({ where: { id }, include: postInclude }),

  create: (input, ctx) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          coverImageId: input.coverImageId ?? null,
          authorId: ctx.adminUserId ?? null,
          isPublished: input.isPublished ?? false,
          isFeatured: input.isFeatured ?? false,
          publishedAt: resolvePublishedAt(input) ?? null,
          ...(input.categoryIds?.length
            ? { categories: { connect: input.categoryIds.map((id) => ({ id })) } }
            : {}),
        },
      });

      await writeTranslations(input.translations, (locale, copy) =>
        tx.postTranslation.create({
          data: {
            postId: created.id,
            locale,
            slug: resolveSlug(copy.slug, copy.title),
            title: copy.title,
            excerpt: copy.excerpt ?? null,
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
        }),
      );

      return tx.post.findUniqueOrThrow({ where: { id: created.id }, include: postInclude });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUniqueOrThrow({
        where: { id },
        include: { translations: true },
      });
      const publishedAt = resolvePublishedAt(input, existing);

      await tx.post.update({
        where: { id },
        data: {
          ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(publishedAt !== undefined ? { publishedAt } : {}),
          // `set` replaces the whole list, so unticking a category actually
          // removes it rather than only ever adding.
          ...(input.categoryIds !== undefined
            ? { categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) } }
            : {}),
        },
      });

      await writeTranslations(input.translations, (locale, copy) => {
        const previous = existing.translations.find((t) => t.locale === locale);
        const slug = copy.slug ?? previous?.slug ?? resolveSlug(undefined, copy.title);
        const data = {
          slug,
          title: copy.title,
          excerpt: copy.excerpt ?? null,
          body: copy.body ?? null,
          seoTitle: copy.seoTitle ?? null,
          seoDescription: copy.seoDescription ?? null,
        };
        return tx.postTranslation.upsert({
          where: { postId_locale: { postId: id, locale } },
          update: data,
          create: { ...data, postId: id, locale },
        });
      });

      return tx.post.findUniqueOrThrow({ where: { id }, include: postInclude });
    }),

  remove: async (id) => {
    await prisma.post.delete({ where: { id } });
  },
});

// ── Categories ──────────────────────────────────────────────────────────

const categoryCopySchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().max(600).nullable().optional(),
});

const createCategorySchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
  translations: translationsRecord(categoryCopySchema),
});
const updateCategorySchema = createCategorySchema.partial();

type CreateCategory = z.infer<typeof createCategorySchema>;
type UpdateCategory = z.infer<typeof updateCategorySchema>;

export const postCategoriesRouter: Router = createCollectionRouter<
  CreateCategory,
  UpdateCategory
>({
  entity: 'PostCategory',
  action: 'postCategory',
  label: 'Kategorija',
  createSchema: createCategorySchema,
  updateSchema: updateCategorySchema,

  list: async () =>
    prisma.postCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { translations: true, _count: { select: { posts: true } } },
    }),

  find: (id) =>
    prisma.postCategory.findUnique({
      where: { id },
      include: { translations: true, _count: { select: { posts: true } } },
    }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.postCategory.create({ data: { sortOrder: input.sortOrder ?? 0 } });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.postCategoryTranslation.create({
          data: {
            postCategoryId: created.id,
            locale,
            slug: resolveSlug(copy.slug, copy.name),
            name: copy.name,
            description: copy.description ?? null,
          },
        }),
      );
      return tx.postCategory.findUniqueOrThrow({
        where: { id: created.id },
        include: { translations: true },
      });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.postCategoryTranslation.findMany({
        where: { postCategoryId: id },
      });
      if (input.sortOrder !== undefined) {
        await tx.postCategory.update({ where: { id }, data: { sortOrder: input.sortOrder } });
      }
      await writeTranslations(input.translations, (locale, copy) => {
        const previous = existing.find((t) => t.locale === locale);
        const slug = copy.slug ?? previous?.slug ?? resolveSlug(undefined, copy.name);
        const data = { slug, name: copy.name, description: copy.description ?? null };
        return tx.postCategoryTranslation.upsert({
          where: { postCategoryId_locale: { postCategoryId: id, locale } },
          update: data,
          create: { ...data, postCategoryId: id, locale },
        });
      });
      return tx.postCategory.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    }),

  checkDelete: async (id) => {
    const posts = await prisma.postCategory
      .findUnique({ where: { id }, include: { _count: { select: { posts: true } } } })
      .then((c) => c?._count.posts ?? 0);
    return posts > 0
      ? { reason: 'Kategorija se koristi na vestima', details: { posts } }
      : null;
  },

  remove: async (id) => {
    await prisma.postCategory.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.postCategory.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Gallery images ──────────────────────────────────────────────────────
// The same three endpoints projects have, against post_image. Articles and
// references carry an ordered list of library images in an identical shape,
// which is what lets one admin editor and one lightbox serve both.

const attachPostImagesSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1).max(50),
});

const postImages = (postId: string) =>
  prisma.postImage.findMany({ where: { postId }, ...postImageInclude });

postsRouter.post(
  '/:id/images',
  validateBody(attachPostImagesSchema),
  asyncHandler(async (req, res) => {
    const postId = req.params.id as string;
    const { mediaIds } = req.body as z.infer<typeof attachPostImagesSchema>;

    if ((await prisma.post.count({ where: { id: postId } })) === 0) {
      throw HttpError.notFound('Vest ne postoji');
    }

    const known = await prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true },
    });
    if (known.length !== mediaIds.length) {
      throw HttpError.badRequest('Neke slike ne postoje u biblioteci');
    }

    const last = await prisma.postImage.findFirst({
      where: { postId },
      orderBy: { sortOrder: 'desc' },
    });
    let sortOrder = (last?.sortOrder ?? -1) + 1;

    // skipDuplicates keeps re-attaching an image idempotent rather than
    // failing on the [postId, mediaId] unique constraint.
    await prisma.postImage.createMany({
      data: mediaIds.map((mediaId) => ({ postId, mediaId, sortOrder: sortOrder++ })),
      skipDuplicates: true,
    });

    revalidateEntity('Post');
    res.status(201).json({ items: await postImages(postId) });
  }),
);

postsRouter.post(
  '/:id/images/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const { ids } = req.body as z.infer<typeof reorderSchema>;
    await prisma.$transaction(
      reorderUpdates(ids).map((u) =>
        prisma.postImage.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
    revalidateEntity('Post');
    res.status(204).end();
  }),
);

postsRouter.delete(
  '/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    const image = await prisma.postImage.findUnique({
      where: { id: req.params.imageId as string },
    });
    if (!image || image.postId !== req.params.id) throw HttpError.notFound();

    // Detaches from the article only; the file stays in the media library.
    await prisma.postImage.delete({ where: { id: image.id } });
    revalidateEntity('Post');
    res.status(204).end();
  }),
);
