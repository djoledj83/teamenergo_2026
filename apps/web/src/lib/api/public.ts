import type { Locale } from '@teamenergo/shared';
import { apiFetch, apiFetchOptional } from './client.js';

/**
 * Typed accessors for the public API.
 *
 * Each call carries a Next.js cache tag so an admin save can revalidate
 * exactly the pages that changed, rather than waiting out a timer or dumping
 * the whole cache. The revalidation webhook maps entity names onto these tags.
 */

export const CACHE_TAGS = {
  bootstrap: 'bootstrap',
  home: 'home',
  pages: 'pages',
  services: 'services',
  projects: 'projects',
  posts: 'posts',
  team: 'team',
  gallery: 'gallery',
  testimonials: 'testimonials',
  clients: 'clients',
  stats: 'stats',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** One hour: content edits arrive through revalidation, not by expiry. */
const REVALIDATE = 3600;

function qs(locale: Locale, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams({ locale });
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return `?${params.toString()}`;
}

// ── Types (shaped by the API's flattening layer) ────────────────────────

export interface MediaRef {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  alt: string | null;
  caption: string | null;
}

export interface NavEntry {
  id: string;
  href: string;
  label: string;
  opensInNew: boolean;
  children: Array<{ id: string; href: string; label: string }>;
}

/**
 * A footer certification or download.
 *
 * At least one of `logo` and `file` is always set — the API drops rows with
 * neither, because a row with no badge and no download has nothing to render.
 */
export interface SiteDocumentEntry {
  id: string;
  label: string;
  description: string | null;
  logo: MediaRef | null;
  file: MediaRef | null;
}

export interface Bootstrap {
  locales: Array<{ code: string; name: string; isDefault: boolean }>;
  nav: NavEntry[];
  settings: Record<string, unknown>;
  documents: SiteDocumentEntry[];
}

export interface PageBlock {
  id: string;
  blockKey: string;
  eyebrow: string | null;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  image: MediaRef | null;
  /** YouTube or Vimeo link, played in a modal. Host-checked by the API. */
  videoUrl: string | null;
}

export interface PageContent {
  key: string;
  meta: {
    title: string;
    /** Short rich-text introduction, rendered under the page title. */
    intro: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  } | null;
  blocks: PageBlock[];
}

export interface ServiceSummary {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  /**
   * Search-result copy, typed in the admin. Both fall back to the item's own
   * title and summary, so leaving them blank is the same as before.
   */
  seoTitle: string | null;
  seoDescription: string | null;

  body?: string | null;
  iconName: string | null;
  accent: string | null;
  image: MediaRef | null;
  stats: Array<{ id: string; value: string; label: string }>;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  tag: string | null;
  summary: string | null;
  /**
   * Search-result copy, typed in the admin. Both fall back to the item's own
   * title and summary, so leaving them blank is the same as before.
   */
  seoTitle: string | null;
  seoDescription: string | null;

  body?: string | null;
  year: number | null;
  accent: string | null;
  coverImage: MediaRef | null;
  metrics: Array<{ id: string; value: string; label: string }>;
}

export interface ProjectDetail extends ProjectSummary {
  gallery: MediaRef[];
  service: { slug: string; title: string } | null;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  /**
   * Search-result copy, typed in the admin. Both fall back to the item's own
   * title and summary, so leaving them blank is the same as before.
   */
  seoTitle: string | null;
  seoDescription: string | null;

  publishedAt: string | null;
  coverImage: MediaRef | null;
  categories: Array<{ id: string; slug: string; name: string }>;
}

export interface PostDetail extends PostSummary {
  body: string | null;
  authorName: string | null;
  /** Extra photographs, ordered as the admin arranged them. */
  gallery: Array<{
    id: string;
    sortOrder: number;
    caption: string | null;
    media: MediaRef | null;
  }>;
}

export interface TeamMemberEntry {
  id: string;
  name: string;
  slug: string | null;
  role: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  /** Leads the team page in a row of its own. */
  isManagement: boolean;
  photo: MediaRef | null;
}

export interface AlbumSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: MediaRef | null;
  itemCount: number;
}

export interface AlbumDetail extends Omit<AlbumSummary, 'itemCount'> {
  /**
   * Ordered as the admin arranged them. `caption` is null far more often than
   * not — photos are added in bulk and captioned later, if at all — so nothing
   * downstream may treat a missing caption as a missing photo.
   */
  items: Array<{
    id: string;
    sortOrder: number;
    caption: string | null;
    media: MediaRef | null;
  }>;
}

export interface TestimonialEntry {
  id: string;
  quote: string;
  name: string;
  role: string | null;
  company: string | null;
  avatar: MediaRef | null;
}

export interface ClientEntry {
  id: string;
  name: string;
  websiteUrl: string | null;
  logo: MediaRef | null;
}

export interface StatEntry {
  id: string;
  value: number;
  prefix: string | null;
  suffix: string | null;
  isDecimal: boolean;
  iconName: string | null;
  accent: string | null;
  label: string;
  description: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Homepage {
  page: PageContent | null;
  /** Already limited by the API; `servicesTotal` says how many exist. */
  services: ServiceSummary[];
  servicesTotal: number;
  /** Every published service, names only — for the enquiry form's dropdown. */
  serviceOptions: Array<{ id: string; title: string }>;
  posts: PostSummary[];
  postsTotal: number;
  stats: StatEntry[];
  projects: ProjectSummary[];
  testimonials: TestimonialEntry[];
  clients: ClientEntry[];
}

// ── Accessors ───────────────────────────────────────────────────────────

const get = <T>(path: string, tag: CacheTag) =>
  apiFetch<T>(`/api/v1/public${path}`, { tags: [tag], revalidate: REVALIDATE });

const getOptional = <T>(path: string, tag: CacheTag) =>
  apiFetchOptional<T>(`/api/v1/public${path}`, { tags: [tag], revalidate: REVALIDATE });

export const getBootstrap = (locale: Locale) =>
  get<Bootstrap>(`/bootstrap${qs(locale)}`, CACHE_TAGS.bootstrap);

export const getHomepage = (locale: Locale) =>
  get<Homepage>(`/home${qs(locale)}`, CACHE_TAGS.home);

export const getPage = (key: string, locale: Locale) =>
  getOptional<PageContent>(`/pages/${key}${qs(locale)}`, CACHE_TAGS.pages);

export const getServices = (locale: Locale) =>
  get<{ items: ServiceSummary[] }>(`/services${qs(locale)}`, CACHE_TAGS.services);

export const getService = (slug: string, locale: Locale) =>
  getOptional<ServiceSummary>(`/services/${slug}${qs(locale)}`, CACHE_TAGS.services);

export const getProjects = (
  locale: Locale,
  options: { page?: number; pageSize?: number; service?: string; featured?: boolean } = {},
) =>
  get<Paginated<ProjectSummary>>(
    `/projects${qs(locale, {
      page: options.page,
      pageSize: options.pageSize,
      service: options.service,
      featured: options.featured ? 'true' : undefined,
    })}`,
    CACHE_TAGS.projects,
  );

export const getProject = (slug: string, locale: Locale) =>
  getOptional<ProjectDetail>(`/projects/${slug}${qs(locale)}`, CACHE_TAGS.projects);

export const getPosts = (
  locale: Locale,
  options: { page?: number; pageSize?: number; category?: string } = {},
) =>
  get<Paginated<PostSummary>>(
    `/posts${qs(locale, {
      page: options.page,
      pageSize: options.pageSize,
      category: options.category,
    })}`,
    CACHE_TAGS.posts,
  );

export const getPost = (slug: string, locale: Locale) =>
  getOptional<PostDetail>(`/posts/${slug}${qs(locale)}`, CACHE_TAGS.posts);

export const getPostCategories = (locale: Locale) =>
  get<{ items: Array<{ id: string; slug: string; name: string }> }>(
    `/post-categories${qs(locale)}`,
    CACHE_TAGS.posts,
  );

export const getTeam = (locale: Locale) =>
  get<{ items: TeamMemberEntry[] }>(`/team${qs(locale)}`, CACHE_TAGS.team);

export const getTeamMember = (slug: string, locale: Locale) =>
  getOptional<TeamMemberEntry>(`/team/${slug}${qs(locale)}`, CACHE_TAGS.team);

export const getAlbums = (locale: Locale) =>
  get<{ items: AlbumSummary[] }>(`/gallery${qs(locale)}`, CACHE_TAGS.gallery);

export const getAlbum = (slug: string, locale: Locale) =>
  getOptional<AlbumDetail>(`/gallery/${slug}${qs(locale)}`, CACHE_TAGS.gallery);

export const getTestimonials = (locale: Locale) =>
  get<{ items: TestimonialEntry[] }>(`/testimonials${qs(locale)}`, CACHE_TAGS.testimonials);

export const getClients = (locale: Locale) =>
  get<{ items: ClientEntry[] }>(`/clients${qs(locale)}`, CACHE_TAGS.clients);

export const getStats = (locale: Locale) =>
  get<{ items: StatEntry[] }>(`/stats${qs(locale)}`, CACHE_TAGS.stats);

/** Builds a public URL for a stored media file. */
export function mediaUrl(media: Pick<MediaRef, 'path'> | null | undefined): string | null {
  return media ? `/uploads/${media.path}` : null;
}

/**
 * A URL that saves the file rather than opening it, under a readable name.
 *
 * Stored filenames are generated, so without the query string a saved
 * certificate lands on the visitor's disk as `a7f3c91e.pdf`.
 */
export function downloadUrl(
  media: Pick<MediaRef, 'path'> | null | undefined,
  name: string,
): string | null {
  const url = mediaUrl(media);
  return url ? `${url}?download=${encodeURIComponent(name)}` : null;
}
