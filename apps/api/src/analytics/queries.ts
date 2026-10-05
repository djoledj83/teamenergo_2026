import { prisma } from '../db.js';
import { DEFAULT_LOCALE, type Locale } from '@teamenergo/shared';
import { flattenEntity } from '../content/translations.js';

/**
 * Everything the Analitika screen shows, in one payload.
 *
 * One request rather than nine, because the screen is useless half-drawn and
 * these are all cheap aggregates over the same indexed range. The admin is
 * one person looking once a week, not a dashboard on a wall.
 *
 * Every count is a count of VIEWS. There is no visitor identifier in the data
 * — deliberately, see SiteEvent — so nothing here can be labelled "visitors"
 * without lying, and the screen says "pregledi" throughout.
 */

export interface AnalyticsRange {
  days: number;
  from: Date;
  to: Date;
  /** The equal-length period immediately before, for comparison. */
  previousFrom: Date;
}

export function rangeOf(days: number): AnalyticsRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const previousFrom = new Date(from.getTime() - days * 86_400_000);
  return { days, from, to, previousFrom };
}

interface Counted {
  key: string;
  label?: string | null;
  count: number;
}

const topOf = (
  rows: Array<{ [k: string]: unknown; _count: { _all: number } }>,
  field: string,
  limit = 8,
): Counted[] =>
  rows
    .map((row) => ({ key: String(row[field] ?? ''), count: row._count._all }))
    .filter((row) => row.key !== '')
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

export async function getAnalytics(days: number, locale: Locale = DEFAULT_LOCALE) {
  const range = rangeOf(days);
  const within = { gte: range.from, lte: range.to };
  const before = { gte: range.previousFrom, lt: range.from };

  const [
    views,
    downloads,
    inquiries,
    previousViews,
    previousDownloads,
    previousInquiries,
    viewSeries,
    inquirySeries,
    pages,
    referrers,
    locales,
    devices,
    downloadRows,
    inquiriesByService,
  ] = await Promise.all([
    prisma.siteEvent.count({ where: { kind: 'VIEW', createdAt: within } }),
    prisma.siteEvent.count({ where: { kind: 'DOWNLOAD', createdAt: within } }),
    prisma.inquiry.count({ where: { createdAt: within } }),
    prisma.siteEvent.count({ where: { kind: 'VIEW', createdAt: before } }),
    prisma.siteEvent.count({ where: { kind: 'DOWNLOAD', createdAt: before } }),
    prisma.inquiry.count({ where: { createdAt: before } }),

    // Per-day buckets. Prisma's groupBy cannot truncate a timestamp to a day,
    // so these two are raw — the only place in this file that needs to be.
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
      FROM "site_event"
      WHERE "kind" = 'VIEW' AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
      FROM "inquiry"
      WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
      GROUP BY 1 ORDER BY 1
    `,

    prisma.siteEvent.groupBy({
      by: ['path'],
      where: { kind: 'VIEW', createdAt: within },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ['referrerHost'],
      where: { kind: 'VIEW', createdAt: within, referrerHost: { not: null } },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ['locale'],
      where: { kind: 'VIEW', createdAt: within },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ['device'],
      where: { kind: 'VIEW', createdAt: within },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ['path'],
      where: { kind: 'DOWNLOAD', createdAt: within },
      _count: { _all: true },
    }),
    prisma.inquiry.groupBy({
      by: ['serviceId'],
      where: { createdAt: within },
      _count: { _all: true },
    }),
  ]);

  const topPages = topOf(pages, 'path', 10);

  return {
    range: { days, from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      views: { value: views, previous: previousViews },
      downloads: { value: downloads, previous: previousDownloads },
      inquiries: { value: inquiries, previous: previousInquiries },
    },
    series: {
      views: fillDays(viewSeries, range),
      inquiries: fillDays(inquirySeries, range),
    },
    pages: topPages,
    referrers: topOf(referrers, 'referrerHost'),
    locales: topOf(locales, 'locale', 5),
    devices: topOf(devices, 'device', 5),
    downloads: await labelDownloads(topOf(downloadRows, 'path', 10), locale),
    articles: await labelArticles(pages, locale),
    inquiriesByService: await labelServices(inquiriesByService, locale),
  };
}

/**
 * One entry per day in the range, zeros included.
 *
 * A chart drawn from only the days that had traffic lies about the shape: a
 * quiet week renders as a continuous line at the same height as a busy one,
 * because the empty days simply are not there.
 */
function fillDays(
  rows: Array<{ day: Date; count: bigint }>,
  range: AnalyticsRange,
): Array<{ day: string; count: number }> {
  const counts = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
  );
  const out: Array<{ day: string; count: number }> = [];
  for (let i = range.days; i >= 0; i -= 1) {
    const day = new Date(range.to.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

/** Stored media paths mean nothing to a reader; show the document's name. */
async function labelDownloads(rows: Counted[], locale: Locale): Promise<Counted[]> {
  if (rows.length === 0) return rows;
  const paths = rows.map((row) => row.key.replace(/^\/uploads\//, ''));
  const documents = await prisma.siteDocument.findMany({
    where: { file: { path: { in: paths } } },
    include: { translations: true, file: { select: { path: true } } },
  });
  // Annotated rather than inferred: flattenEntity's return widens through
  // a generic, and an inferred Map<string, {}> only shows up as a confusing
  // error at the call site.
  const byPath = new Map<string, string>(
    documents.flatMap((document): Array<[string, string]> => {
      const flat = flattenEntity(document, locale);
      return document.file && flat ? [[document.file.path, flat.label as string]] : [];
    }),
  );
  return rows.map((row) => ({
    ...row,
    label: byPath.get(row.key.replace(/^\/uploads\//, '')) ?? null,
  }));
}

/** The news pages out of the page list, named by their article titles. */
async function labelArticles(
  pages: Array<{ path: string | null; _count: { _all: number } }>,
  locale: Locale,
): Promise<Counted[]> {
  const matches = pages.flatMap((row) => {
    const found = /^\/(?:sr|en)\/vesti\/([^/]+)$/.exec(row.path ?? '');
    return found?.[1] ? [{ slug: decodeURIComponent(found[1]), count: row._count._all }] : [];
  });
  if (matches.length === 0) return [];

  // The same article under two languages is two slugs and two rows; add them.
  const translations = await prisma.postTranslation.findMany({
    where: { slug: { in: matches.map((m) => m.slug) } },
    select: { postId: true, slug: true, title: true, locale: true },
  });
  const byPost = new Map<string, { label: string; count: number }>();
  for (const match of matches) {
    const translation = translations.find((t) => t.slug === match.slug);
    if (!translation) continue;
    const existing = byPost.get(translation.postId);
    const preferred =
      translation.locale === locale || !existing ? translation.title : existing.label;
    byPost.set(translation.postId, {
      label: preferred,
      count: (existing?.count ?? 0) + match.count,
    });
  }
  return [...byPost.entries()]
    .map(([postId, entry]) => ({ key: postId, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/** Which service the enquiry form was sent about. */
async function labelServices(
  rows: Array<{ serviceId: string | null; _count: { _all: number } }>,
  locale: Locale,
): Promise<Counted[]> {
  const ids = rows.flatMap((row) => (row.serviceId ? [row.serviceId] : []));
  const services = ids.length
    ? await prisma.service.findMany({ where: { id: { in: ids } }, include: { translations: true } })
    : [];
  const byId = new Map<string, string>(
    services.flatMap((service): Array<[string, string]> => {
      const flat = flattenEntity(service, locale);
      return flat ? [[service.id, flat.title as string]] : [];
    }),
  );
  return rows
    .map((row) => ({
      key: row.serviceId ?? '',
      // An enquiry that named no service is still an enquiry, and lumping it
      // in with the first service would be worse than naming it.
      label: row.serviceId ? (byId.get(row.serviceId) ?? null) : 'Bez izabrane usluge',
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
