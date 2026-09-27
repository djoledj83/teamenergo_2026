import { z } from 'zod';
import { LOCALES } from './locales.js';

/**
 * Builds the schema for an entity's translations: a partial map of locale to
 * copy, so an editor can save Serbian now and English later without the
 * missing language being written as empty strings.
 *
 * `z.record` with an enum key would demand every locale be present, and
 * spelling the locales out as object keys would hardcode the language list
 * that the Locale table is supposed to own — hence the string key plus an
 * explicit check.
 */
export function translationsRecord<T extends z.ZodTypeAny>(schema: T) {
  return z
    .record(z.string(), schema)
    .refine(
      (value) => Object.keys(value).every((key) => (LOCALES as readonly string[]).includes(key)),
      { message: `Nepoznat jezik. Dozvoljeni: ${LOCALES.join(', ')}` },
    );
}

/** Shared shape for reorder endpoints. */
export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

/** Fields present on nearly every content base table. */
export const publishableSchema = z.object({
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug može sadržati samo mala slova, brojeve i crtice');

/** Turns a title into a URL-safe slug, transliterating Serbian diacritics. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    č: 'c', ć: 'c', đ: 'dj', š: 's', ž: 'z',
    Č: 'c', Ć: 'c', Đ: 'dj', Š: 's', Ž: 'z',
  };
  return input
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}
