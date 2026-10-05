import type { Locale } from '@teamenergo/shared';
import { prisma } from '../db.js';
import { flattenEntity, flattenList, flattenMedia, pickTranslation } from './translations.js';

/**
 * Read queries for the public site.
 *
 * Each one returns data already flattened for the requested locale, so route
 * handlers stay thin and React components never deal with translation arrays.
 * Prisma calls are written out explicitly rather than generated, which keeps
 * every `select`/`include` type-checked against the schema.
 */

const publishedOnly = { isPublished: true } as const;

/** Only the media fields a page actually renders. */
const mediaSelect = {
  id: true,
  path: true,
  width: true,
  height: true,
  // Shown next to a download link, so a visitor knows what they are about to
  // fetch before tapping it on a phone.
  sizeBytes: true,
  variants: true,
  translations: { select: { locale: true, alt: true, caption: true } },
} as const;

// ── Layout ──────────────────────────────────────────────────────────────

export async function getBootstrap(locale: Locale) {
  const [locales, navItems, settings, documents] = await Promise.all([
    prisma.locale.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.navItem.findMany({
      where: { isVisible: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: { select: { locale: true, label: true } },
        children: {
          where: { isVisible: true },
          orderBy: { sortOrder: 'asc' },
          include: { translations: { select: { locale: true, label: true } } },
        },
      },
    }),
    prisma.setting.findMany(),
    // Certifications and downloads for the footer. Part of bootstrap because
    // the footer is on every page and this is the call every page already
    // makes for it — a second round trip for six rows would be waste.
    prisma.siteDocument.findMany({
      where: publishedOnly,
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: true,
        logo: { select: mediaSelect },
        file: { select: mediaSelect },
      },
    }),
  ]);

  const nav = navItems
    .map((item) => {
      const flat = flattenEntity(item, locale);
      if (!flat) return null;
      return { ...flat, children: flattenList(item.children, locale) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    locales,
    nav,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    documents: documents
      .map((document) => {
        const flat = flattenEntity(document, locale);
        if (!flat) return null;
        return {
          id: flat.id,
          label: flat.label,
          description: flat.description,
          // Null for a document that has no page yet; the footer badge then
          // links straight to the file, as it always did.
          slug: flat.slug,
          logo: flattenMedia(document.logo, locale),
          file: flattenMedia(document.file, locale),
        };
      })
      // A row with neither a badge nor a download has nothing to show.
      .filter((document) => document !== null && (document.logo || document.file)),
  };
}

export async function getPage(key: string, locale: Locale) {
  const page = await prisma.page.findUnique({
    where: { key },
    include: {
      translations: true,
      blocks: {
        where: { isVisible: true },
        orderBy: { sortOrder: 'asc' },
        include: { translations: true, image: { select: mediaSelect } },
      },
    },
  });
  if (!page) return null;

  const meta = flattenEntity({ ...page, translations: page.translations }, locale);

  const blocks = page.blocks
    .map((block) => {
      const flat = flattenEntity(block, locale);
      if (!flat) return null;
      return { ...flat, image: flattenMedia(block.image, locale) };
    })
    .filter((block): block is NonNullable<typeof block> => block !== null);

  return { key: page.key, meta, blocks };
}

// ── Services ────────────────────────────────────────────────────────────

/**
 * Orders featured services first, then the rest by their own sort order.
 *
 * Two keys rather than one filter: `isFeatured` picks what the homepage leads
 * with, and `sortOrder` fills the remaining places. A homepage that showed
 * only flagged services would be empty until somebody remembered to tick a
 * box, which is a worse default than showing the first few.
 */
const servicesFeaturedFirst = [
  { isFeatured: 'desc' },
  { sortOrder: 'asc' },
] satisfies Array<Record<string, 'asc' | 'desc'>>;

export async function listServices(locale: Locale, limit?: number) {
  const services = await prisma.service.findMany({
    where: publishedOnly,
    orderBy: limit === undefined ? { sortOrder: 'asc' } : servicesFeaturedFirst,
    ...(limit === undefined ? {} : { take: limit }),
    include: {
      translations: true,
      image: { select: mediaSelect },
      stats: {
        orderBy: { sortOrder: 'asc' },
        include: { translations: true },
      },
    },
  });

  return services
    .map((service) => {
      const flat = flattenEntity(service, locale);
      if (!flat) return null;
      return {
        ...flat,
        image: flattenMedia(service.image, locale),
        stats: flattenList(service.stats, locale),
      };
    })
    .filter((service): service is NonNullable<typeof service> => service !== null);
}

/**
 * Every published service, as id and name only.
 *
 * For the enquiry form's dropdown, which needs the complete list but none of
 * the images, stats or body copy that `listServices` carries.
 */
export async function listServiceOptions(locale: Locale) {
  const services = await prisma.service.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    select: { id: true, translations: true },
  });

  return services
    .map((service) => {
      const flat = flattenEntity(service, locale);
      return flat ? { id: flat.id, title: flat.title } : null;
    })
    .filter((option): option is { id: string; title: string } => option !== null);
}

export async function getServiceBySlug(slug: string, locale: Locale) {
  const service = await prisma.service.findFirst({
    where: { ...publishedOnly, translations: { some: { slug } } },
    include: {
      translations: true,
      image: { select: mediaSelect },
      stats: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
    },
  });
  if (!service) return null;

  const flat = flattenEntity(service, locale);
  if (!flat) return null;

  return {
    ...flat,
    image: flattenMedia(service.image, locale),
    stats: flattenList(service.stats, locale),
  };
}

// ── Projects ────────────────────────────────────────────────────────────

interface ProjectListOptions {
  locale: Locale;
  page: number;
  pageSize: number;
  serviceSlug?: string | undefined;
  featuredOnly?: boolean | undefined;
}

export async function listProjects(options: ProjectListOptions) {
  const { locale, page, pageSize, serviceSlug, featuredOnly } = options;

  const where = {
    ...publishedOnly,
    ...(featuredOnly ? { isFeatured: true } : {}),
    ...(serviceSlug ? { service: { translations: { some: { slug: serviceSlug } } } } : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        translations: true,
        coverImage: { select: mediaSelect },
        metrics: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
      },
    }),
  ]);

  const items = projects
    .map((project) => {
      const flat = flattenEntity(project, locale);
      if (!flat) return null;
      return {
        ...flat,
        coverImage: flattenMedia(project.coverImage, locale),
        metrics: flattenList(project.metrics, locale),
      };
    })
    .filter((project): project is NonNullable<typeof project> => project !== null);

  return { items, total, page, pageSize };
}

export async function getProjectBySlug(slug: string, locale: Locale) {
  const project = await prisma.project.findFirst({
    where: { ...publishedOnly, translations: { some: { slug } } },
    include: {
      translations: true,
      coverImage: { select: mediaSelect },
      metrics: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
      images: { orderBy: { sortOrder: 'asc' }, include: { media: { select: mediaSelect } } },
      service: { include: { translations: true } },
    },
  });
  if (!project) return null;

  const flat = flattenEntity(project, locale);
  if (!flat) return null;

  return {
    ...flat,
    coverImage: flattenMedia(project.coverImage, locale),
    metrics: flattenList(project.metrics, locale),
    gallery: project.images
      .map((image) => flattenMedia(image.media, locale))
      .filter((image): image is NonNullable<typeof image> => image !== null),
    service: project.service ? flattenEntity(project.service, locale) : null,
  };
}

// ── News ────────────────────────────────────────────────────────────────

interface PostListOptions {
  /** Flagged articles first, then by date. For the homepage rail. */
  featuredFirst?: boolean | undefined;
  locale: Locale;
  page: number;
  pageSize: number;
  categorySlug?: string | undefined;
}

export async function listPosts(options: PostListOptions) {
  const { locale, page, pageSize, categorySlug, featuredFirst } = options;

  const where = {
    isPublished: true,
    publishedAt: { lte: new Date() },
    ...(categorySlug ? { categories: { some: { translations: { some: { slug: categorySlug } } } } } : {}),
  };

  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      // "Istaknuto" pins an article to the front of the homepage rail; the
      // full /vesti listing stays purely chronological, which is what a news
      // archive should be.
      orderBy: featuredFirst
        ? [{ isFeatured: 'desc' as const }, { publishedAt: 'desc' as const }]
        : { publishedAt: 'desc' as const },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        translations: true,
        coverImage: { select: mediaSelect },
        categories: { include: { translations: true } },
      },
    }),
  ]);

  const items = posts
    .map((post) => {
      const flat = flattenEntity(post, locale);
      if (!flat) return null;
      // The article body is not needed for a list view.
      const { body: _body, ...summary } = flat as typeof flat & { body?: string };
      return {
        ...summary,
        coverImage: flattenMedia(post.coverImage, locale),
        categories: flattenList(post.categories, locale),
      };
    })
    .filter((post): post is NonNullable<typeof post> => post !== null);

  return { items, total, page, pageSize };
}

export async function getPostBySlug(slug: string, locale: Locale) {
  const post = await prisma.post.findFirst({
    where: { isPublished: true, translations: { some: { slug } } },
    include: {
      translations: true,
      coverImage: { select: mediaSelect },
      images: { orderBy: { sortOrder: 'asc' }, include: { media: { select: mediaSelect } } },
      categories: { include: { translations: true } },
      author: { select: { name: true } },
    },
  });
  if (!post) return null;

  const flat = flattenEntity(post, locale);
  if (!flat) return null;

  return {
    ...flat,
    coverImage: flattenMedia(post.coverImage, locale),
    // Shaped like an album's items so the gallery component is shared rather
    // than reimplemented: the lightbox already knows this shape.
    gallery: post.images.map((image) => ({
      id: image.id,
      sortOrder: image.sortOrder,
      caption: null,
      media: flattenMedia(image.media, locale),
    })),
    categories: flattenList(post.categories, locale),
    authorName: post.author?.name ?? null,
  };
}

export async function listPostCategories(locale: Locale) {
  const categories = await prisma.postCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { translations: true },
  });
  return flattenList(categories, locale);
}

// ── Team ────────────────────────────────────────────────────────────────

/**
 * One team member, by their slug in any language.
 *
 * Matching across languages rather than only the requested one is what lets
 * the language switcher work on this page: /en/tim/aleksandar-radivojevic
 * finds the person by their Serbian slug and returns the English row, and the
 * page then redirects to the canonical English address.
 */
export async function getTeamMemberBySlug(slug: string, locale: Locale) {
  const member = await prisma.teamMember.findFirst({
    where: { ...publishedOnly, translations: { some: { slug } } },
    include: { translations: true, photo: { select: mediaSelect } },
  });
  if (!member) return null;

  const flat = flattenEntity(member, locale);
  if (!flat) return null;

  return { ...flat, photo: flattenMedia(member.photo, locale) };
}

export async function listTeam(locale: Locale) {
  const members = await prisma.teamMember.findMany({
    where: publishedOnly,
    // Management first so the page can take the leading group off the front
    // without sorting again; sortOrder arranges within each group.
    orderBy: [{ isManagement: 'desc' }, { sortOrder: 'asc' }],
    include: { translations: true, photo: { select: mediaSelect } },
  });

  return members
    .map((member) => {
      const flat = flattenEntity(member, locale);
      if (!flat) return null;
      return { ...flat, photo: flattenMedia(member.photo, locale) };
    })
    .filter((member): member is NonNullable<typeof member> => member !== null);
}

// ── Gallery ─────────────────────────────────────────────────────────────

export async function listGalleryAlbums(locale: Locale) {
  const albums = await prisma.galleryAlbum.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    include: {
      translations: true,
      coverImage: { select: mediaSelect },
      _count: { select: { items: true } },
    },
  });

  return albums
    .map((album) => {
      const flat = flattenEntity(album, locale);
      if (!flat) return null;
      const { _count, ...rest } = flat as typeof flat & { _count: { items: number } };
      return { ...rest, coverImage: flattenMedia(album.coverImage, locale), itemCount: _count.items };
    })
    .filter((album): album is NonNullable<typeof album> => album !== null);
}

export async function getGalleryAlbumBySlug(slug: string, locale: Locale) {
  const album = await prisma.galleryAlbum.findFirst({
    where: { ...publishedOnly, translations: { some: { slug } } },
    include: {
      translations: true,
      coverImage: { select: mediaSelect },
      items: {
        orderBy: { sortOrder: 'asc' },
        include: { translations: true, media: { select: mediaSelect } },
      },
    },
  });
  if (!album) return null;

  const flat = flattenEntity(album, locale);
  if (!flat) return null;

  return {
    ...flat,
    coverImage: flattenMedia(album.coverImage, locale),
    // Deliberately NOT flattenEntity, for the same reason as flattenMedia.
    //
    // A gallery item's only translated field is its caption, and a caption is
    // optional — images are added to an album in bulk and captioned later, if
    // at all. flattenEntity returns null when an entity has no translation
    // row in any language, so routing items through it dropped every
    // uncaptioned photo: the album reported its item count correctly and then
    // rendered empty. A missing caption now costs the caption, not the photo.
    items: album.items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      caption: pickTranslation(item.translations, locale)?.caption ?? null,
      media: flattenMedia(item.media, locale),
    })),
  };
}

// ── Social proof ────────────────────────────────────────────────────────

export async function listTestimonials(locale: Locale) {
  const testimonials = await prisma.testimonial.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    include: { translations: true, avatar: { select: mediaSelect } },
  });

  return testimonials
    .map((testimonial) => {
      const flat = flattenEntity(testimonial, locale);
      if (!flat) return null;
      return { ...flat, avatar: flattenMedia(testimonial.avatar, locale) };
    })
    .filter((testimonial): testimonial is NonNullable<typeof testimonial> => testimonial !== null);
}

export async function listClients(locale: Locale) {
  const clients = await prisma.client.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    include: { logo: { select: mediaSelect } },
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    websiteUrl: client.websiteUrl,
    logo: flattenMedia(client.logo, locale),
  }));
}

export async function listStats(locale: Locale) {
  const stats = await prisma.stat.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    include: { translations: true },
  });

  // Decimal does not survive JSON, so it is converted at the boundary.
  return flattenList(stats, locale).map((stat) => ({
    ...stat,
    value: Number(stat.value),
  }));
}

// ── Homepage composite ──────────────────────────────────────────────────

/** How many services and news items the homepage leads with. */
export const HOME_SERVICES = 5;
export const HOME_POSTS = 8;

/**
 * One call for the whole homepage.
 *
 * Server-rendering the page with separate round trips would be wasteful, and
 * the queries are independent, so they run in parallel.
 *
 * The section limits are applied here rather than in the components: sending
 * every service and every article to the browser so React can drop most of
 * them is waste on a page that is already the heaviest on the site. The
 * totals come back alongside so a section knows whether to offer "see all"
 * without having to fetch the rest to find out.
 */
export async function getHomepage(locale: Locale) {
  const [page, services, allServices, posts, stats, projects, testimonials, clients] =
    await Promise.all([
      getPage('home', locale),
      listServices(locale, HOME_SERVICES),
      // The enquiry form's "Odaberite uslugu" dropdown needs every service,
      // not the five the section shows, or a visitor cannot ask about the
      // sixth one. Names and ids only — the form needs nothing else, and the
      // full records are already in `services` for the part of the page that
      // displays them.
      listServiceOptions(locale),
      listPosts({ locale, page: 1, pageSize: HOME_POSTS, featuredFirst: true }),
      listStats(locale),
      listProjects({ locale, page: 1, pageSize: 3, featuredOnly: true }),
      listTestimonials(locale),
      listClients(locale),
    ]);

  return {
    page,
    services,
    servicesTotal: allServices.length,
    serviceOptions: allServices,
    posts: posts.items,
    postsTotal: posts.total,
    stats,
    projects: projects.items,
    testimonials,
    clients,
  };
}

// ── Documents and certificates ──────────────────────────────────────────

const siteDocumentInclude = {
  translations: true,
  logo: { select: mediaSelect },
  file: { select: mediaSelect },
} as const;

/**
 * Every published document that has a page, newest arrangement first.
 *
 * Rows without a slug are left out rather than linked to a 404. They still
 * appear in the footer — this list is only for the pages.
 */
export async function listSiteDocuments(locale: Locale) {
  const documents = await prisma.siteDocument.findMany({
    where: publishedOnly,
    orderBy: { sortOrder: 'asc' },
    include: siteDocumentInclude,
  });

  return documents
    .map((document) => {
      const flat = flattenEntity(document, locale);
      if (!flat?.slug) return null;
      return {
        ...flat,
        logo: flattenMedia(document.logo, locale),
        file: flattenMedia(document.file, locale),
      };
    })
    .filter((document): document is NonNullable<typeof document> => document !== null);
}

export async function getSiteDocumentBySlug(slug: string, locale: Locale) {
  const document = await prisma.siteDocument.findFirst({
    where: { ...publishedOnly, translations: { some: { slug } } },
    include: siteDocumentInclude,
  });
  if (!document) return null;

  const flat = flattenEntity(document, locale);
  if (!flat) return null;

  return {
    ...flat,
    logo: flattenMedia(document.logo, locale),
    file: flattenMedia(document.file, locale),
  };
}
