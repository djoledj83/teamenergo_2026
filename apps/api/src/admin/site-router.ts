import { Router } from 'express';
import { z } from 'zod';
import { translationsRecord } from '@teamenergo/shared';
import { parseVideoEmbed, VIDEO_URL_HELP } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { richText } from '../content/rich-text.js';
import { HttpError } from '../errors.js';
import { recordAudit } from '../audit.js';
import { asyncHandler } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { reorderUpdates, withPrismaErrors, writeTranslations } from './crud.js';
import { revalidateEntity } from '../revalidate.js';

/**
 * Site structure: page metadata, editable page blocks, navigation and
 * settings.
 *
 * Pages and blocks are keyed by strings the page components look up, so those
 * keys are code-owned and cannot be created or renamed from the admin — an
 * editor changing "hero" to "Hero" would blank the homepage. Only the content
 * inside them is editable.
 */

export const siteRouter: Router = Router();

// ── Pages and blocks ────────────────────────────────────────────────────

const pageCopySchema = z.object({
  title: z.string().min(1).max(200),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  ogImageId: z.string().nullable().optional(),
});

const blockCopySchema = z.object({
  eyebrow: z.string().max(160).nullable().optional(),
  heading: z.string().max(300).nullable().optional(),
  subheading: z.string().max(300).nullable().optional(),
  body: richText(20_000),
  ctaLabel: z.string().max(80).nullable().optional(),
  ctaHref: z.string().max(400).nullable().optional(),
});

const updatePageSchema = z.object({
  translations: translationsRecord(pageCopySchema).optional(),
});

/**
 * A YouTube or Vimeo address that actually resolves to a video.
 *
 * Two things have to hold. The value ends up inside an iframe src, so an
 * arbitrary origin here would be a framed-content hole on every page of the
 * public site. And the player has to be able to find an id in it — a channel
 * or playlist URL passes a host check and then renders nothing, silently,
 * which is a worse outcome than a rejected save.
 *
 * parseVideoEmbed answers both, and the site uses the same function to build
 * the embed, so what the API accepts is exactly what the player can show.
 */
const videoUrl = z
  .string()
  .max(400)
  .refine((value) => value.trim() === '' || parseVideoEmbed(value) !== null, VIDEO_URL_HELP)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional();

const updateBlockSchema = z.object({
  imageId: z.string().nullable().optional(),
  videoUrl,
  isVisible: z.boolean().optional(),
  translations: translationsRecord(blockCopySchema).optional(),
});

siteRouter.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const pages = await prisma.page.findMany({
      orderBy: { key: 'asc' },
      include: {
        translations: true,
        blocks: { orderBy: { sortOrder: 'asc' }, select: { id: true, blockKey: true } },
      },
    });
    res.json({ items: pages });
  }),
);

siteRouter.get(
  '/pages/:key',
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({
      where: { key: req.params.key as string },
      include: {
        translations: true,
        blocks: {
          orderBy: { sortOrder: 'asc' },
          include: { translations: true, image: { include: { translations: true } } },
        },
      },
    });
    if (!page) throw HttpError.notFound('Stranica ne postoji');
    res.json(page);
  }),
);

siteRouter.patch(
  '/pages/:key',
  validateBody(updatePageSchema),
  asyncHandler(async (req, res) => {
    const key = req.params.key as string;
    const input = req.body as z.infer<typeof updatePageSchema>;

    const exists = await prisma.page.count({ where: { key } });
    if (exists === 0) throw HttpError.notFound('Stranica ne postoji');

    const page = await withPrismaErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeTranslations(input.translations, (locale, copy) =>
          tx.pageTranslation.upsert({
            where: { pageKey_locale: { pageKey: key, locale } },
            update: {
              title: copy.title,
              seoTitle: copy.seoTitle ?? null,
              seoDescription: copy.seoDescription ?? null,
              ogImageId: copy.ogImageId ?? null,
            },
            create: {
              pageKey: key,
              locale,
              title: copy.title,
              seoTitle: copy.seoTitle ?? null,
              seoDescription: copy.seoDescription ?? null,
              ogImageId: copy.ogImageId ?? null,
            },
          }),
        );
        return tx.page.findUniqueOrThrow({ where: { key }, include: { translations: true } });
      }),
    );

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'page.update',
      entity: 'Page',
      entityId: key,
      ip: req.ip,
    });

    revalidateEntity('Page');

    res.json(page);
  }),
);

const createBlockSchema = z.object({
  blockKey: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Ključ može sadržati samo mala slova, brojeve i crtice'),
  imageId: z.string().nullable().optional(),
  videoUrl,
  isVisible: z.boolean().optional(),
  translations: translationsRecord(blockCopySchema).optional(),
});

/**
 * Adds a block to a page.
 *
 * Pages themselves are fixed — each one has a route rendering it — but the
 * sections inside a page are content, and the client needs to add an "about
 * our history" section without asking a developer. Without this the set of
 * blocks was whatever the seed happened to create, which meant a page the
 * seed did not anticipate could not be written at all.
 *
 * blockKey is unique per page and is what the front end addresses a block by
 * (the homepage looks up "hero"), so it is a slug rather than free text.
 */
siteRouter.post(
  '/pages/:key/blocks',
  validateBody(createBlockSchema),
  asyncHandler(async (req, res) => {
    const key = req.params.key as string;
    const input = req.body as z.infer<typeof createBlockSchema>;

    const page = await prisma.page.count({ where: { key } });
    if (page === 0) throw HttpError.notFound('Stranica ne postoji');

    // New blocks go last; the reorder controls move them from there.
    const last = await prisma.pageBlock.findFirst({
      where: { pageKey: key },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const block = await withPrismaErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await tx.pageBlock.create({
          data: {
            pageKey: key,
            blockKey: input.blockKey,
            imageId: input.imageId ?? null,
            videoUrl: input.videoUrl ?? null,
            isVisible: input.isVisible ?? true,
            sortOrder: (last?.sortOrder ?? -1) + 1,
          },
        });
        await writeTranslations(input.translations, (locale, copy) =>
          tx.pageBlockTranslation.create({
            data: {
              pageBlockId: created.id,
              locale,
              eyebrow: copy.eyebrow ?? null,
              heading: copy.heading ?? null,
              subheading: copy.subheading ?? null,
              body: copy.body ?? null,
              ctaLabel: copy.ctaLabel ?? null,
              ctaHref: copy.ctaHref ?? null,
            },
          }),
        );
        return tx.pageBlock.findUniqueOrThrow({
          where: { id: created.id },
          include: { translations: true, image: { include: { translations: true } } },
        });
      }),
    );

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'block.create',
      entity: 'PageBlock',
      entityId: block.id,
      diff: { pageKey: key, blockKey: input.blockKey },
      ip: req.ip,
    });

    revalidateEntity('PageBlock');
    res.status(201).json(block);
  }),
);

siteRouter.delete(
  '/blocks/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const block = await prisma.pageBlock.findUnique({ where: { id } });
    if (!block) throw HttpError.notFound('Blok ne postoji');

    await prisma.pageBlock.delete({ where: { id } });

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'block.delete',
      entity: 'PageBlock',
      entityId: id,
      diff: { pageKey: block.pageKey, blockKey: block.blockKey },
      ip: req.ip,
    });

    revalidateEntity('PageBlock');
    res.status(204).end();
  }),
);

siteRouter.patch(
  '/blocks/:id',
  validateBody(updateBlockSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const input = req.body as z.infer<typeof updateBlockSchema>;

    const exists = await prisma.pageBlock.count({ where: { id } });
    if (exists === 0) throw HttpError.notFound('Blok ne postoji');

    const block = await withPrismaErrors(() =>
      prisma.$transaction(async (tx) => {
        await tx.pageBlock.update({
          where: { id },
          data: {
            ...(input.imageId !== undefined ? { imageId: input.imageId } : {}),
            ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
            ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
          },
        });
        await writeTranslations(input.translations, (locale, copy) =>
          tx.pageBlockTranslation.upsert({
            where: { pageBlockId_locale: { pageBlockId: id, locale } },
            update: {
              eyebrow: copy.eyebrow ?? null,
              heading: copy.heading ?? null,
              subheading: copy.subheading ?? null,
              body: copy.body ?? null,
              ctaLabel: copy.ctaLabel ?? null,
              ctaHref: copy.ctaHref ?? null,
            },
            create: {
              pageBlockId: id,
              locale,
              eyebrow: copy.eyebrow ?? null,
              heading: copy.heading ?? null,
              subheading: copy.subheading ?? null,
              body: copy.body ?? null,
              ctaLabel: copy.ctaLabel ?? null,
              ctaHref: copy.ctaHref ?? null,
            },
          }),
        );
        return tx.pageBlock.findUniqueOrThrow({
          where: { id },
          include: { translations: true, image: { include: { translations: true } } },
        });
      }),
    );

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'pageBlock.update',
      entity: 'PageBlock',
      entityId: id,
      ip: req.ip,
    });

    revalidateEntity('PageBlock');

    res.json(block);
  }),
);

// ── Navigation ──────────────────────────────────────────────────────────

const navCopySchema = z.object({ label: z.string().min(1).max(120) });

const createNavSchema = z.object({
  parentId: z.string().nullable().optional(),
  location: z.enum(['header', 'footer']).default('header'),
  href: z.string().min(1).max(400),
  isVisible: z.boolean().optional(),
  opensInNew: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  translations: translationsRecord(navCopySchema),
});
const updateNavSchema = createNavSchema.partial();

const navInclude = {
  translations: true,
  children: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
} as const;

siteRouter.get(
  '/nav',
  asyncHandler(async (_req, res) => {
    const items = await prisma.navItem.findMany({
      where: { parentId: null },
      orderBy: [{ location: 'asc' }, { sortOrder: 'asc' }],
      include: navInclude,
    });
    res.json({ items });
  }),
);

siteRouter.post(
  '/nav',
  validateBody(createNavSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof createNavSchema>;

    const item = await withPrismaErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await tx.navItem.create({
          data: {
            parentId: input.parentId ?? null,
            location: input.location,
            href: input.href,
            isVisible: input.isVisible ?? true,
            opensInNew: input.opensInNew ?? false,
            sortOrder: input.sortOrder ?? 0,
          },
        });
        await writeTranslations(input.translations, (locale, copy) =>
          tx.navItemTranslation.create({
            data: { navItemId: created.id, locale, label: copy.label },
          }),
        );
        return tx.navItem.findUniqueOrThrow({ where: { id: created.id }, include: navInclude });
      }),
    );

    revalidateEntity('NavItem');
    res.status(201).json(item);
  }),
);

siteRouter.post(
  '/nav/reorder',
  validateBody(z.object({ ids: z.array(z.string().min(1)).min(1) })),
  asyncHandler(async (req, res) => {
    const { ids } = req.body as { ids: string[] };
    const updates = reorderUpdates(ids);
    await prisma.$transaction(
      updates.map((u) =>
        prisma.navItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
    res.status(204).end();
  }),
);

siteRouter.patch(
  '/nav/:id',
  validateBody(updateNavSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const input = req.body as z.infer<typeof updateNavSchema>;

    const exists = await prisma.navItem.count({ where: { id } });
    if (exists === 0) throw HttpError.notFound('Stavka menija ne postoji');

    if (input.parentId === id) {
      throw HttpError.badRequest('Stavka ne može biti sopstveni roditelj');
    }

    const item = await withPrismaErrors(() =>
      prisma.$transaction(async (tx) => {
        await tx.navItem.update({
          where: { id },
          data: {
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.location !== undefined ? { location: input.location } : {}),
            ...(input.href !== undefined ? { href: input.href } : {}),
            ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
            ...(input.opensInNew !== undefined ? { opensInNew: input.opensInNew } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          },
        });
        await writeTranslations(input.translations, (locale, copy) =>
          tx.navItemTranslation.upsert({
            where: { navItemId_locale: { navItemId: id, locale } },
            update: { label: copy.label },
            create: { navItemId: id, locale, label: copy.label },
          }),
        );
        return tx.navItem.findUniqueOrThrow({ where: { id }, include: navInclude });
      }),
    );

    revalidateEntity('NavItem');
    res.json(item);
  }),
);

siteRouter.delete(
  '/nav/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const exists = await prisma.navItem.count({ where: { id } });
    if (exists === 0) throw HttpError.notFound('Stavka menija ne postoji');

    // Children cascade, so an accidental parent deletion takes a submenu with
    // it — worth saying so rather than doing it silently.
    const children = await prisma.navItem.count({ where: { parentId: id } });
    if (children > 0 && req.query.force !== 'true') {
      throw HttpError.conflict('Stavka ima podstavke koje će takođe biti obrisane', { children });
    }

    await prisma.navItem.delete({ where: { id } });
    revalidateEntity('NavItem');
    res.status(204).end();
  }),
);

// ── Settings ────────────────────────────────────────────────────────────

const settingsSchema = z.record(z.string().min(1).max(120), z.unknown());

siteRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json({ items: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  }),
);

siteRouter.put(
  '/settings',
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as Record<string, unknown>;

    await prisma.$transaction(
      Object.entries(input).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: value as never },
          create: { key, value: value as never },
        }),
      ),
    );

    await recordAudit({
      adminUserId: req.auth?.sub,
      action: 'settings.update',
      entity: 'Setting',
      diff: { keys: Object.keys(input) },
      ip: req.ip,
    });

    revalidateEntity('Setting');

    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json({ items: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  }),
);
