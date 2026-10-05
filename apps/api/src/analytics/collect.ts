import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { deviceOf, isBot, isPagePath, normalisePath, referrerHostOf, type EventInput } from './rules.js';

/**
 * Writing an event, once the rules in ./rules.ts have decided it is worth
 * writing. Split from those rules so they can be tested without a database —
 * they are the privacy guarantees, and a guarantee nobody can run a test
 * against is a comment.
 */

export async function recordEvent(
  input: EventInput,
  context: { userAgent: string | undefined; selfHost: string | null },
): Promise<void> {
  if (isBot(context.userAgent)) return;

  const path = normalisePath(input.path);
  if (!path) return;
  // A download is a stored media path and does not match the page shape.
  if (input.kind === 'VIEW' && !isPagePath(path)) return;

  try {
    await prisma.siteEvent.create({
      data: {
        kind: input.kind,
        path,
        locale: input.locale === 'sr' || input.locale === 'en' ? input.locale : null,
        referrerHost: referrerHostOf(input.referrer, context.selfHost),
        device: deviceOf(context.userAgent),
      },
    });
  } catch (error) {
    // A counter must never be the reason a page fails. Log and move on.
    logger.warn(`[analytics] could not record a ${input.kind}: ${String(error)}`);
  }
}
