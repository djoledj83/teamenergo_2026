import type { Router } from 'express';
import { z } from 'zod';
import { LOCALES, publishableSchema, slugSchema, translationsRecord } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { missingLocales } from '../content/translations.js';
import { createCollectionRouter } from './collection-router.js';
import { resolveSlug, writeTranslations } from './crud.js';

/**
 * Collections whose shape is base row + translation row and nothing else.
 *
 * Each one supplies its own explicit, typed Prisma calls; the HTTP layer comes
 * from createCollectionRouter.
 */

const withMissing = <T extends { translations: Array<{ locale: string }> }>(items: T[]) =>
  items.map((item) => ({ ...item, missingLocales: missingLocales(item.translations, LOCALES) }));

// ── Team ────────────────────────────────────────────────────────────────

const teamCopySchema = z.object({
  // Stored per locale because Serbian names transliterate between scripts.
  name: z.string().min(1).max(160),
  // Left blank in the form and derived from the name, the same rule every
  // other addressable entity uses — so a team member's page is
  // /tim/aleksandar-radivojevic rather than /tim/clx7k2p9q0001.
  slug: slugSchema.optional(),
  role: z.string().max(160).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
});

const createTeamSchema = publishableSchema.extend({
  photoId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  isManagement: z.boolean().optional(),
  translations: translationsRecord(teamCopySchema),
});
const updateTeamSchema = createTeamSchema.partial();

type CreateTeam = z.infer<typeof createTeamSchema>;
type UpdateTeam = z.infer<typeof updateTeamSchema>;

const teamInclude = { translations: true, photo: { include: { translations: true } } } as const;

export const teamRouter: Router = createCollectionRouter<CreateTeam, UpdateTeam>({
  entity: 'TeamMember',
  action: 'team',
  label: 'Član tima',
  createSchema: createTeamSchema,
  updateSchema: updateTeamSchema,

  list: async () =>
    withMissing(
      await prisma.teamMember.findMany({ orderBy: { sortOrder: 'asc' }, include: teamInclude }),
    ),

  find: (id) => prisma.teamMember.findUnique({ where: { id }, include: teamInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.teamMember.create({
        data: {
          photoId: input.photoId ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          linkedinUrl: input.linkedinUrl ?? null,
          isManagement: input.isManagement ?? false,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.teamMemberTranslation.create({
          data: {
            teamMemberId: created.id,
            locale,
            name: copy.name,
            slug: resolveSlug(copy.slug, copy.name),
            role: copy.role ?? null,
            bio: copy.bio ?? null,
          },
        }),
      );
      return tx.teamMember.findUniqueOrThrow({ where: { id: created.id }, include: teamInclude });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      await tx.teamMember.update({
        where: { id },
        data: {
          ...(input.photoId !== undefined ? { photoId: input.photoId } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl } : {}),
          ...(input.isManagement !== undefined ? { isManagement: input.isManagement } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.teamMemberTranslation.upsert({
          where: { teamMemberId_locale: { teamMemberId: id, locale } },
          update: {
            name: copy.name,
            slug: resolveSlug(copy.slug, copy.name),
            role: copy.role ?? null,
            bio: copy.bio ?? null,
          },
          create: {
            teamMemberId: id,
            locale,
            name: copy.name,
            slug: resolveSlug(copy.slug, copy.name),
            role: copy.role ?? null,
            bio: copy.bio ?? null,
          },
        }),
      );
      return tx.teamMember.findUniqueOrThrow({ where: { id }, include: teamInclude });
    }),

  remove: async (id) => {
    await prisma.teamMember.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.teamMember.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Testimonials ────────────────────────────────────────────────────────

const testimonialCopySchema = z.object({
  quote: z.string().min(1).max(3000),
  name: z.string().min(1).max(160),
  // Left blank in the form and derived from the name, the same rule every
  // other addressable entity uses — so a team member's page is
  // /tim/aleksandar-radivojevic rather than /tim/clx7k2p9q0001.
  slug: slugSchema.optional(),
  role: z.string().max(160).nullable().optional(),
  company: z.string().max(160).nullable().optional(),
});

const createTestimonialSchema = publishableSchema.extend({
  avatarId: z.string().nullable().optional(),
  translations: translationsRecord(testimonialCopySchema),
});
const updateTestimonialSchema = createTestimonialSchema.partial();

type CreateTestimonial = z.infer<typeof createTestimonialSchema>;
type UpdateTestimonial = z.infer<typeof updateTestimonialSchema>;

const testimonialInclude = {
  translations: true,
  avatar: { include: { translations: true } },
} as const;

export const testimonialsRouter: Router = createCollectionRouter<
  CreateTestimonial,
  UpdateTestimonial
>({
  entity: 'Testimonial',
  action: 'testimonial',
  label: 'Izjava',
  createSchema: createTestimonialSchema,
  updateSchema: updateTestimonialSchema,

  list: async () =>
    withMissing(
      await prisma.testimonial.findMany({
        orderBy: { sortOrder: 'asc' },
        include: testimonialInclude,
      }),
    ),

  find: (id) => prisma.testimonial.findUnique({ where: { id }, include: testimonialInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.testimonial.create({
        data: {
          avatarId: input.avatarId ?? null,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.testimonialTranslation.create({
          data: {
            testimonialId: created.id,
            locale,
            quote: copy.quote,
            name: copy.name,
            role: copy.role ?? null,
            company: copy.company ?? null,
          },
        }),
      );
      return tx.testimonial.findUniqueOrThrow({
        where: { id: created.id },
        include: testimonialInclude,
      });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      await tx.testimonial.update({
        where: { id },
        data: {
          ...(input.avatarId !== undefined ? { avatarId: input.avatarId } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.testimonialTranslation.upsert({
          where: { testimonialId_locale: { testimonialId: id, locale } },
          update: {
            quote: copy.quote,
            name: copy.name,
            role: copy.role ?? null,
            company: copy.company ?? null,
          },
          create: {
            testimonialId: id,
            locale,
            quote: copy.quote,
            name: copy.name,
            role: copy.role ?? null,
            company: copy.company ?? null,
          },
        }),
      );
      return tx.testimonial.findUniqueOrThrow({ where: { id }, include: testimonialInclude });
    }),

  remove: async (id) => {
    await prisma.testimonial.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.testimonial.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Clients (ticker logos) ──────────────────────────────────────────────
// Company names are proper nouns and are not translated, so there is no
// translation table here.

const createClientSchema = publishableSchema.extend({
  name: z.string().min(1).max(160),
  logoId: z.string().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
});
const updateClientSchema = createClientSchema.partial();

type CreateClient = z.infer<typeof createClientSchema>;
type UpdateClient = z.infer<typeof updateClientSchema>;

const clientInclude = { logo: { include: { translations: true } } } as const;

export const clientsRouter: Router = createCollectionRouter<CreateClient, UpdateClient>({
  entity: 'Client',
  action: 'client',
  label: 'Klijent',
  createSchema: createClientSchema,
  updateSchema: updateClientSchema,

  list: () => prisma.client.findMany({ orderBy: { sortOrder: 'asc' }, include: clientInclude }),
  find: (id) => prisma.client.findUnique({ where: { id }, include: clientInclude }),

  create: (input) =>
    prisma.client.create({
      data: {
        name: input.name,
        logoId: input.logoId ?? null,
        websiteUrl: input.websiteUrl ?? null,
        isPublished: input.isPublished ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      include: clientInclude,
    }),

  update: (id, input) =>
    prisma.client.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.logoId !== undefined ? { logoId: input.logoId } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: clientInclude,
    }),

  remove: async (id) => {
    await prisma.client.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.client.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Stats (homepage count-up figures) ───────────────────────────────────

const statCopySchema = z.object({
  label: z.string().min(1).max(160),
  description: z.string().max(400).nullable().optional(),
});

const createStatSchema = publishableSchema.extend({
  value: z.number().finite(),
  prefix: z.string().max(10).nullable().optional(),
  suffix: z.string().max(20).nullable().optional(),
  isDecimal: z.boolean().optional(),
  iconName: z.string().max(60).nullable().optional(),
  accent: z.enum(['amber', 'blue', 'red']).nullable().optional(),
  translations: translationsRecord(statCopySchema),
});
const updateStatSchema = createStatSchema.partial();

type CreateStat = z.infer<typeof createStatSchema>;
type UpdateStat = z.infer<typeof updateStatSchema>;

/** Decimal does not survive JSON, so it is converted at the boundary. */
const serialiseStat = <T extends { value: unknown }>(stat: T) => ({
  ...stat,
  value: Number(stat.value),
});

export const statsRouter: Router = createCollectionRouter<CreateStat, UpdateStat>({
  entity: 'Stat',
  action: 'stat',
  label: 'Statistika',
  createSchema: createStatSchema,
  updateSchema: updateStatSchema,

  list: async () =>
    withMissing(
      await prisma.stat.findMany({ orderBy: { sortOrder: 'asc' }, include: { translations: true } }),
    ).map(serialiseStat),

  find: async (id) => {
    const stat = await prisma.stat.findUnique({ where: { id }, include: { translations: true } });
    return stat ? serialiseStat(stat) : null;
  },

  create: async (input) => {
    const created = await prisma.$transaction(async (tx) => {
      const stat = await tx.stat.create({
        data: {
          value: input.value,
          prefix: input.prefix ?? null,
          suffix: input.suffix ?? null,
          isDecimal: input.isDecimal ?? false,
          iconName: input.iconName ?? null,
          accent: input.accent ?? null,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.statTranslation.create({
          data: {
            statId: stat.id,
            locale,
            label: copy.label,
            description: copy.description ?? null,
          },
        }),
      );
      return tx.stat.findUniqueOrThrow({ where: { id: stat.id }, include: { translations: true } });
    });
    return serialiseStat(created);
  },

  update: async (id, input) => {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.stat.update({
        where: { id },
        data: {
          ...(input.value !== undefined ? { value: input.value } : {}),
          ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
          ...(input.suffix !== undefined ? { suffix: input.suffix } : {}),
          ...(input.isDecimal !== undefined ? { isDecimal: input.isDecimal } : {}),
          ...(input.iconName !== undefined ? { iconName: input.iconName } : {}),
          ...(input.accent !== undefined ? { accent: input.accent } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.statTranslation.upsert({
          where: { statId_locale: { statId: id, locale } },
          update: { label: copy.label, description: copy.description ?? null },
          create: {
            statId: id,
            locale,
            label: copy.label,
            description: copy.description ?? null,
          },
        }),
      );
      return tx.stat.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    });
    return serialiseStat(updated);
  },

  remove: async (id) => {
    await prisma.stat.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.stat.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});

// ── Site documents (footer certifications and downloads) ────────────────
// One collection covers ISO badges, the certificate PDFs behind them, and
// standalone documents: a row carries an optional logo and an optional file,
// and the footer decides what to render from which of the two is present.

const siteDocumentCopySchema = z.object({
  label: z.string().min(1).max(160),
  description: z.string().max(400).nullable().optional(),
  slug: slugSchema.optional(),
  body: z.string().nullable().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});

const createSiteDocumentSchema = publishableSchema.extend({
  logoId: z.string().nullable().optional(),
  fileId: z.string().nullable().optional(),
  translations: translationsRecord(siteDocumentCopySchema),
});
const updateSiteDocumentSchema = createSiteDocumentSchema.partial();

type CreateSiteDocument = z.infer<typeof createSiteDocumentSchema>;
type UpdateSiteDocument = z.infer<typeof updateSiteDocumentSchema>;

const siteDocumentInclude = {
  translations: true,
  logo: { include: { translations: true } },
  file: { include: { translations: true } },
} as const;

export const siteDocumentsRouter: Router = createCollectionRouter<
  CreateSiteDocument,
  UpdateSiteDocument
>({
  entity: 'SiteDocument',
  action: 'site-document',
  label: 'Dokument',
  createSchema: createSiteDocumentSchema,
  updateSchema: updateSiteDocumentSchema,

  list: async () =>
    withMissing(
      await prisma.siteDocument.findMany({
        orderBy: { sortOrder: 'asc' },
        include: siteDocumentInclude,
      }),
    ),

  find: (id) => prisma.siteDocument.findUnique({ where: { id }, include: siteDocumentInclude }),

  create: (input) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.siteDocument.create({
        data: {
          logoId: input.logoId ?? null,
          fileId: input.fileId ?? null,
          isPublished: input.isPublished ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.siteDocumentTranslation.create({
          data: {
            documentId: created.id,
            locale,
            label: copy.label,
            description: copy.description ?? null,
            // Derived from the name when left blank, like every other
            // sluggable entity. Without a slug the document has no page.
            slug: resolveSlug(copy.slug, copy.label),
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
        }),
      );
      return tx.siteDocument.findUniqueOrThrow({
        where: { id: created.id },
        include: siteDocumentInclude,
      });
    }),

  update: (id, input) =>
    prisma.$transaction(async (tx) => {
      await tx.siteDocument.update({
        where: { id },
        data: {
          ...(input.logoId !== undefined ? { logoId: input.logoId } : {}),
          ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await writeTranslations(input.translations, (locale, copy) =>
        tx.siteDocumentTranslation.upsert({
          where: { documentId_locale: { documentId: id, locale } },
          update: {
            label: copy.label,
            description: copy.description ?? null,
            slug: resolveSlug(copy.slug, copy.label),
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
          create: {
            documentId: id,
            locale,
            label: copy.label,
            description: copy.description ?? null,
            slug: resolveSlug(copy.slug, copy.label),
            body: copy.body ?? null,
            seoTitle: copy.seoTitle ?? null,
            seoDescription: copy.seoDescription ?? null,
          },
        }),
      );
      return tx.siteDocument.findUniqueOrThrow({ where: { id }, include: siteDocumentInclude });
    }),

  remove: async (id) => {
    await prisma.siteDocument.delete({ where: { id } });
  },

  reorder: async (updates) => {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.siteDocument.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }),
      ),
    );
  },
});
