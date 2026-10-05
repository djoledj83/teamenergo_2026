import { Router } from 'express';
import {
  inquirySchema,
  listQuerySchema,
  localeQuerySchema,
  postListQuerySchema,
  projectListQuerySchema,
  type InquiryInput,
} from '@teamenergo/shared';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { logger } from '../logger.js';
import { asyncHandler } from '../middleware/auth.js';
import { recordEvent } from '../analytics/collect.js';
import { eventSchema } from '../analytics/rules.js';
import { clientIpOf } from '../analytics/geo.js';
import { publicWriteRateLimit } from '../middleware/rate-limit.js';
import { parseQuery, validateBody } from '../middleware/validate.js';
import * as queries from './queries.js';

export const publicRouter: Router = Router();

/**
 * Read endpoints are cacheable for a short window and revalidated in the
 * background, so a burst of traffic does not translate into a burst of
 * queries. Content edits do not wait for this to expire — the admin fires a
 * revalidation webhook at Next.js on save.
 */
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

publicRouter.use((_req, res, next) => {
  res.set('Cache-Control', CACHE_CONTROL);
  next();
});

// ── Layout ──────────────────────────────────────────────────────────────

publicRouter.get(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json(await queries.getBootstrap(locale));
  }),
);

publicRouter.get(
  '/pages/:key',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const page = await queries.getPage(req.params.key as string, locale);
    if (!page) throw HttpError.notFound('Stranica ne postoji');
    res.json(page);
  }),
);

// ── Homepage ────────────────────────────────────────────────────────────

publicRouter.get(
  '/home',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json(await queries.getHomepage(locale));
  }),
);

// ── Services ────────────────────────────────────────────────────────────

publicRouter.get(
  '/services',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listServices(locale) });
  }),
);

publicRouter.get(
  '/services/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const service = await queries.getServiceBySlug(req.params.slug as string, locale);
    if (!service) throw HttpError.notFound('Usluga ne postoji');
    res.json(service);
  }),
);

// ── Projects ────────────────────────────────────────────────────────────

publicRouter.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const { locale, page, pageSize, service, featured } = parseQuery(
      projectListQuerySchema,
      req.query,
    );
    res.json(
      await queries.listProjects({
        locale,
        page,
        pageSize,
        serviceSlug: service,
        featuredOnly: featured,
      }),
    );
  }),
);

publicRouter.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const project = await queries.getProjectBySlug(req.params.slug as string, locale);
    if (!project) throw HttpError.notFound('Projekat ne postoji');
    res.json(project);
  }),
);

// ── News ────────────────────────────────────────────────────────────────

publicRouter.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const { locale, page, pageSize, category } = parseQuery(postListQuerySchema, req.query);
    res.json(await queries.listPosts({ locale, page, pageSize, categorySlug: category }));
  }),
);

publicRouter.get(
  '/posts/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const post = await queries.getPostBySlug(req.params.slug as string, locale);
    if (!post) throw HttpError.notFound('Vest ne postoji');
    res.json(post);
  }),
);

publicRouter.get(
  '/post-categories',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listPostCategories(locale) });
  }),
);

// ── Team ────────────────────────────────────────────────────────────────

publicRouter.get(
  '/team',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listTeam(locale) });
  }),
);

publicRouter.get(
  '/team/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const member = await queries.getTeamMemberBySlug(req.params.slug as string, locale);
    if (!member) throw HttpError.notFound('Član tima ne postoji');
    res.json(member);
  }),
);

// ── Gallery ─────────────────────────────────────────────────────────────

publicRouter.get(
  '/gallery',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(listQuerySchema, req.query);
    res.json({ items: await queries.listGalleryAlbums(locale) });
  }),
);

publicRouter.get(
  '/gallery/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const album = await queries.getGalleryAlbumBySlug(req.params.slug as string, locale);
    if (!album) throw HttpError.notFound('Album ne postoji');
    res.json(album);
  }),
);

// ── Documents and certificates ──────────────────────────────────────────

publicRouter.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listSiteDocuments(locale) });
  }),
);

publicRouter.get(
  '/documents/:slug',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    const document = await queries.getSiteDocumentBySlug(req.params.slug as string, locale);
    if (!document) throw HttpError.notFound('Dokument ne postoji');
    res.json(document);
  }),
);

// ── Social proof ────────────────────────────────────────────────────────

publicRouter.get(
  '/testimonials',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listTestimonials(locale) });
  }),
);

publicRouter.get(
  '/clients',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listClients(locale) });
  }),
);

publicRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { locale } = parseQuery(localeQuerySchema, req.query);
    res.json({ items: await queries.listStats(locale) });
  }),
);

// ── Analytics ───────────────────────────────────────────────────────────

/**
 * A page view or a download, from the site itself.
 *
 * 204 always, and never an error: this is a counter, and a visitor must not
 * see a failed request in their console because a write was rejected. The
 * decision about what is worth storing — and what is dropped unread — is in
 * analytics/collect.ts.
 */
publicRouter.post(
  '/events',
  publicWriteRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (parsed.success) {
      await recordEvent(parsed.data, {
        userAgent: req.get('user-agent'),
        selfHost: hostOf(req.get('referer')) ?? hostOf(req.get('origin')),
        // Forwarded by the web container, which is the only thing that can
        // reach this API and the only hop that sees the visitor.
        ip: clientIpOf(req.get('x-forwarded-for'), req.get('x-real-ip')),
      });
    }
    res.status(204).end();
  }),
);

const hostOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

// ── Contact form ────────────────────────────────────────────────────────

publicRouter.post(
  '/inquiries',
  publicWriteRateLimit,
  validateBody(inquirySchema),
  asyncHandler(async (req, res) => {
    // A write must never be cached; this router sets a shared cache header
    // for reads, so it is overridden here.
    res.set('Cache-Control', 'no-store');

    const input = req.body as InquiryInput;

    // Honeypot: a real browser leaves this hidden field empty. Answer 201 so
    // a bot cannot tell it was caught.
    if (input.website) {
      logger.info({ ip: req.ip }, 'inquiry rejected by honeypot');
      res.status(201).json({ ok: true });
      return;
    }

    // Referencing a service that does not exist would fail the insert on a
    // foreign key, so an unknown id is simply dropped.
    const serviceExists = input.serviceId
      ? await prisma.service.count({ where: { id: input.serviceId } })
      : 0;

    const inquiry = await prisma.inquiry.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        company: input.company ?? null,
        serviceId: serviceExists > 0 ? (input.serviceId as string) : null,
        message: input.message,
        locale: input.locale,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });

    logger.info({ inquiryId: inquiry.id }, 'inquiry received');

    // Nothing about the stored record is echoed back.
    res.status(201).json({ ok: true });
  }),
);
