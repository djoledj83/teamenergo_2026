import { Router } from 'express';
import { prisma } from '../db.js';
import {
  asyncHandler,
  blockUntilPasswordChanged,
  requireAuth,
  requireRole,
} from '../middleware/auth.js';
import { adminRateLimit } from '../middleware/rate-limit.js';
import { mediaRouter } from '../media/router.js';
import { servicesRouter } from './services-router.js';
import {
  clientsRouter,
  siteDocumentsRouter,
  statsRouter,
  teamRouter,
  testimonialsRouter,
} from './collections.js';
import { siteRouter } from './site-router.js';
import { inquiriesRouter } from './inquiries-router.js';
import { projectsRouter } from './projects-router.js';
import { postCategoriesRouter, postsRouter } from './posts-router.js';
import { galleryRouter } from './gallery-router.js';
import { auditRouter } from './audit-router.js';

export const adminRouter: Router = Router();

// Everything below requires a valid access token, and nothing is reachable
// while the account still carries a forced password change — so the seeded
// initial credential cannot be used to do real work.
// Set before the auth guard so that 401 and 403 responses carry it too —
// a cached 401 sitting in a proxy would lock out a legitimate session.
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminRouter.use(adminRateLimit);
adminRouter.use(requireAuth);
adminRouter.use(blockUntilPasswordChanged);

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [services, projects, posts, team, albums, media, newInquiries, recentInquiries] =
      await Promise.all([
        prisma.service.count(),
        prisma.project.count(),
        prisma.post.count(),
        prisma.teamMember.count(),
        prisma.galleryAlbum.count(),
        prisma.media.count(),
        prisma.inquiry.count({ where: { status: 'NEW' } }),
        prisma.inquiry.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

    res.json({
      counts: { services, projects, posts, team, albums, media, newInquiries },
      recentInquiries,
    });
  }),
);

adminRouter.use('/media', mediaRouter);
adminRouter.use('/services', servicesRouter);
adminRouter.use('/projects', projectsRouter);
adminRouter.use('/posts', postsRouter);
adminRouter.use('/post-categories', postCategoriesRouter);
adminRouter.use('/gallery', galleryRouter);
adminRouter.use('/team', teamRouter);
adminRouter.use('/testimonials', testimonialsRouter);
adminRouter.use('/clients', clientsRouter);
adminRouter.use('/site-documents', siteDocumentsRouter);
adminRouter.use('/stats', statsRouter);
adminRouter.use('/inquiries', inquiriesRouter);
adminRouter.use('/site', siteRouter);
adminRouter.use('/audit', auditRouter);

// Only an owner may manage other admin accounts.
adminRouter.get(
  '/users',
  requireRole('OWNER'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      // The password hash must never leave the server.
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    res.json({ items: users });
  }),
);

adminRouter.get(
  '/audit',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const entries = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { adminUser: { select: { name: true, email: true } } },
    });
    res.json({ items: entries });
  }),
);
