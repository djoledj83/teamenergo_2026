import { prisma } from './db.js';
import { logger } from './logger.js';

export interface AuditEntry {
  adminUserId?: string | undefined;
  action: string;
  entity: string;
  entityId?: string | undefined;
  diff?: unknown;
  ip?: string | undefined;
}

/**
 * Records who changed what.
 *
 * Auditing must never break the operation it is describing, so a failure here
 * is logged and swallowed rather than propagated — losing an audit row is
 * worse than nothing, but failing the user's save because of it is worse still.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: entry.adminUserId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        diff: (entry.diff ?? undefined) as never,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, entry }, 'failed to write audit log');
  }
}

/**
 * Field-level diff for update operations, so the audit trail shows what
 * actually changed rather than the whole record.
 */
export function diffOf<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    const previous = before[key];
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changes[key] = { from: previous, to: next };
    }
  }
  return changes;
}
