import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Tells Next.js to rebuild the pages an edit affected.
 *
 * Public pages are statically generated with a long cache window, which is
 * what makes them fast. Without this webhook an editor would save, reload, and
 * still see the old page — the single most common reason a headless CMS feels
 * broken. With it, a save is live within a second or two.
 */

export const REVALIDATE_TAGS = {
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

export type RevalidateTag = (typeof REVALIDATE_TAGS)[keyof typeof REVALIDATE_TAGS];

/**
 * Which cached pages each entity appears on.
 *
 * Most content shows on its own page *and* the homepage, so both are
 * invalidated. Media is deliberately broad: an image can be referenced from
 * anywhere, and there is no cheap way to know where.
 */
const TAGS_BY_ENTITY: Record<string, RevalidateTag[]> = {
  Service: ['services', 'home'],
  Project: ['projects', 'home'],
  // 'home' as well as 'posts' since the homepage gained a news rail. An
  // entity's tags have to list every page it appears on, and this one was
  // written when articles lived only under /vesti — so a new article
  // refreshed the news page and left the homepage showing the old set.
  Post: ['posts', 'home'],
  PostCategory: ['posts'],
  TeamMember: ['team'],
  GalleryAlbum: ['gallery'],
  Testimonial: ['testimonials', 'home'],
  Client: ['clients', 'home'],
  Stat: ['stats', 'home'],
  Page: ['pages', 'home'],
  PageBlock: ['pages', 'home'],
  NavItem: ['bootstrap'],
  Setting: ['bootstrap'],
  // The footer rides on bootstrap, so a certificate or download saved in the
  // admin only appears once that tag is invalidated. An entity missing from
  // this map revalidates nothing at all and the editor waits out the hour
  // cache wondering why the save did not take.
  SiteDocument: ['bootstrap'],
  Media: Object.values(REVALIDATE_TAGS),
};

export function tagsForEntity(entity: string): RevalidateTag[] {
  return TAGS_BY_ENTITY[entity] ?? [];
}

/**
 * Fire-and-forget: a failed revalidation must never fail the editor's save.
 * The page still updates when its cache window expires, so the worst outcome
 * is a delay, not lost work.
 */
export function revalidate(tags: readonly RevalidateTag[]): void {
  if (tags.length === 0) return;

  if (!env.REVALIDATE_SECRET) {
    logger.debug('REVALIDATE_SECRET not set — skipping revalidation');
    return;
  }

  void fetch(`${env.WEB_INTERNAL_URL}/api/revalidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-revalidate-secret': env.REVALIDATE_SECRET,
    },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) {
        logger.warn({ status: response.status, tags }, 'revalidation rejected');
      }
    })
    .catch((error: unknown) => {
      logger.warn({ err: error, tags }, 'revalidation request failed');
    });
}

export function revalidateEntity(entity: string): void {
  revalidate(tagsForEntity(entity));
}
