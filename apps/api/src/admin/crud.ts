import type { Locale } from '@teamenergo/shared';
import { LOCALES, slugify } from '@teamenergo/shared';
import { HttpError } from '../errors.js';

/**
 * Small helpers shared by the admin collection routers.
 *
 * Deliberately NOT a generic CRUD factory. A factory would have to reach into
 * Prisma delegates dynamically, which throws away the compile-time checking
 * that was the whole reason for choosing typed translation tables over JSONB.
 * Instead the repetitive shapes live here and each router keeps its own fully
 * typed Prisma calls.
 */

/**
 * Applies a partial locale->copy map by calling `write` once per supplied
 * language. Languages the editor left out are untouched, so saving Serbian
 * does not blank an existing English translation.
 */
export async function writeTranslations<T>(
  translations: Record<string, T> | undefined,
  write: (locale: Locale, copy: T) => Promise<unknown>,
): Promise<void> {
  if (!translations) return;
  for (const [locale, copy] of Object.entries(translations)) {
    if (copy === undefined || copy === null) continue;
    if (!(LOCALES as readonly string[]).includes(locale)) {
      throw HttpError.badRequest(`Nepoznat jezik: ${locale}`);
    }
    await write(locale as Locale, copy);
  }
}

/**
 * Derives a slug when the editor did not supply one.
 *
 * Slugs are only auto-filled on create. Changing a published slug silently on
 * every title edit would break existing links and lose accumulated SEO, so an
 * update must set it explicitly.
 */
export function resolveSlug(explicit: string | undefined, title: string | undefined): string {
  const candidate = explicit?.trim() || slugify(title ?? '');
  if (!candidate) throw HttpError.badRequest('Nije moguće napraviti slug iz praznog naslova');
  return candidate;
}

/**
 * Turns an ordered list of ids into per-row sortOrder updates.
 *
 * Returned as data rather than executed so the caller can run it inside its
 * own transaction with a typed delegate.
 */
export function reorderUpdates(ids: readonly string[]): Array<{ id: string; sortOrder: number }> {
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw HttpError.badRequest('Lista sadrži duplikate');
  }
  return ids.map((id, index) => ({ id, sortOrder: index }));
}

/**
 * Prisma raises P2002 on a unique-constraint violation. For content that is
 * almost always a slug already taken in that language, which deserves a clear
 * message rather than a 500.
 */
export function translatePrismaError(error: unknown): never {
  const code = (error as { code?: string }).code;
  const target = (error as { meta?: { target?: string[] } }).meta?.target ?? [];

  if (code === 'P2002') {
    if (target.includes('slug')) {
      throw HttpError.conflict('Taj slug je već zauzet za ovaj jezik', { field: 'slug' });
    }
    throw HttpError.conflict('Vrednost već postoji', { fields: target });
  }
  if (code === 'P2025') {
    throw HttpError.notFound();
  }
  throw error;
}

/** Wraps a Prisma write so constraint violations become clean API errors. */
export async function withPrismaErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return translatePrismaError(error);
  }
}
