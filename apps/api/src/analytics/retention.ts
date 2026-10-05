import { prisma } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Forgetting, on a schedule.
 *
 * Two jobs, both of which delete things on purpose.
 *
 * Raw events are archived into day totals and then removed once they pass the
 * retention window. The archive is written FIRST and in the same transaction
 * as the delete, so there is no moment where the detail is gone and the
 * summary was never written.
 *
 * Enquiries keep an IP address and a user agent, which exist to tell a real
 * enquiry from a flood of them. That question is settled within days; after a
 * month the fields are two pieces of personal data with no remaining purpose,
 * which is exactly what a retention policy is for. The enquiry itself — who
 * wrote, about what — is business correspondence and is kept.
 */

/** Which day totals are worth keeping once the events are gone. */
const METRICS = [
  { metric: 'view', expression: `''`, where: `"kind" = 'VIEW'` },
  { metric: 'download', expression: `''`, where: `"kind" = 'DOWNLOAD'` },
  { metric: 'page', expression: `"path"`, where: `"kind" = 'VIEW'` },
  { metric: 'referrer', expression: `"referrerHost"`, where: `"kind" = 'VIEW' AND "referrerHost" IS NOT NULL` },
  { metric: 'locale', expression: `"locale"`, where: `"kind" = 'VIEW' AND "locale" IS NOT NULL` },
  { metric: 'device', expression: `"device"`, where: `"kind" = 'VIEW' AND "device" IS NOT NULL` },
] as const;

export async function archiveAndTrim(now = new Date()): Promise<{ archived: number; removed: number }> {
  const cutoff = new Date(now.getTime() - env.ANALYTICS_RETENTION_DAYS * 86_400_000);

  return prisma.$transaction(async (tx) => {
    let archived = 0;
    for (const { metric, expression, where } of METRICS) {
      // Written as one statement per metric rather than read-then-write: the
      // rows being summarised are deleted a few lines below, and a summary
      // computed in application memory could be thrown away by a crash in
      // between while the delete had already been decided.
      const rows = await tx.$executeRawUnsafe(
        `INSERT INTO "analytics_daily" ("id", "day", "metric", "key", "count")
         SELECT gen_random_uuid()::text, date_trunc('day', "createdAt")::date, $1, ${expression}, COUNT(*)
         FROM "site_event"
         WHERE ${where} AND "createdAt" < $2
         GROUP BY 2, 4
         ON CONFLICT ("day", "metric", "key")
         DO UPDATE SET "count" = "analytics_daily"."count" + EXCLUDED."count"`,
        metric,
        cutoff,
      );
      archived += rows;
    }

    const { count: removed } = await tx.siteEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { archived, removed };
  });
}

/** Clears the IP and user agent from enquiries past the retention window. */
export async function scrubInquiries(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.INQUIRY_PII_DAYS * 86_400_000);
  const { count } = await prisma.inquiry.updateMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
    },
    data: { ip: null, userAgent: null },
  });
  return count;
}

/**
 * Runs at boot and every six hours after it.
 *
 * A setInterval in the API process rather than a cron container: there is one
 * API container, the work is seconds long, and a second service to deploy and
 * watch is a poor trade for that. If the API is ever scaled past one instance
 * this needs a lock — the transaction makes a double run harmless rather than
 * wrong, but it would do the work twice.
 */
export function startRetentionJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const { archived, removed } = await archiveAndTrim();
      const scrubbed = await scrubInquiries();
      if (removed || scrubbed) {
        logger.info(
          `[retention] archived ${archived} day totals, removed ${removed} events ` +
            `older than ${env.ANALYTICS_RETENTION_DAYS} days, cleared ${scrubbed} enquiry IPs`,
        );
      }
    } catch (error) {
      // Housekeeping must never take the API down with it.
      logger.error(`[retention] run failed: ${String(error)}`);
    }
  };

  void run();
  return setInterval(run, 6 * 60 * 60 * 1000);
}
