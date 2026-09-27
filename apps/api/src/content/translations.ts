import { DEFAULT_LOCALE, type Locale } from '@teamenergo/shared';

/**
 * Turning base + translation rows into something a component can render.
 *
 * The database keeps language-independent data (images, ordering, dates) on
 * the base row and copy on a per-locale translation row. React components
 * should never see that split — they receive one flat object with `title` and
 * `summary` already resolved for the requested locale.
 *
 * These helpers are deliberately generic over plain data rather than over
 * Prisma delegates: the shaping is identical for every collection, while the
 * queries stay explicit and fully typed in each router.
 */

interface HasLocale {
  locale: string;
}

/**
 * Picks the translation for `locale`, falling back to the default language.
 *
 * Falling back matters because the admin can publish an entity before every
 * language is filled in — an English visitor should see Serbian text rather
 * than a hole in the page.
 */
export function pickTranslation<T extends HasLocale>(
  translations: readonly T[],
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE,
): T | undefined {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === fallbackLocale)
  );
}

type Flattened<B, T> = Omit<B, 'translations'> & Omit<T, 'locale' | 'id'>;

/**
 * Merges the matching translation into the base row.
 *
 * Returns null when no translation exists in either language, which means the
 * entity has no usable copy and should be omitted from the response rather
 * than rendered with empty fields.
 *
 * Note the signature: `T` has to appear in a parameter position for TypeScript
 * to infer it. Declaring it only inside a constraint
 * (`B extends { translations: T[] }`) makes inference fall back to the
 * constraint, and the returned type then carries none of the translated
 * fields — so `result.title` fails to compile at every call site.
 */
export function flattenEntity<B extends object, T extends HasLocale & { id?: string }>(
  entity: B & { translations: readonly T[] },
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE,
): Flattened<B, T> | null {
  const translation = pickTranslation(entity.translations, locale, fallbackLocale);
  if (!translation) return null;

  const { translations: _translations, ...base } = entity;
  const { locale: _locale, id: _translationId, ...copy } = translation;

  return { ...base, ...copy } as Flattened<B, T>;
}

/** Flattens a list, dropping entities that have no copy in either language. */
export function flattenList<B extends object, T extends HasLocale & { id?: string }>(
  entities: readonly (B & { translations: readonly T[] })[],
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE,
): Array<Flattened<B, T>> {
  return entities
    .map((entity) => flattenEntity<B, T>(entity, locale, fallbackLocale))
    .filter((entity): entity is Flattened<B, T> => entity !== null);
}

/**
 * Reports which languages an entity is missing.
 *
 * This is what lets the admin list show a "needs English" badge instead of the
 * editor discovering the gap on the live site.
 */
export function missingLocales<T extends HasLocale>(
  translations: readonly T[],
  activeLocales: readonly Locale[],
): Locale[] {
  const present = new Set(translations.map((t) => t.locale));
  return activeLocales.filter((locale) => !present.has(locale));
}

/**
 * Builds the nested `createMany` payload for an entity's translations.
 *
 * Accepts a partial map so an admin can save Serbian now and English later
 * without the absent language being written as empty strings.
 */
export function translationCreateData<T extends Record<string, unknown>>(
  byLocale: Partial<Record<Locale, T>>,
): { createMany: { data: Array<T & { locale: string }> } } | undefined {
  const data = Object.entries(byLocale)
    .filter(([, value]) => value !== undefined)
    .map(([locale, value]) => ({ ...(value as T), locale }));

  return data.length > 0 ? { createMany: { data } } : undefined;
}

/**
 * Flattens a media record for one language.
 *
 * Deliberately NOT flattenEntity. That helper returns null when an entity has
 * no translation in any language, which is right for content — a service with
 * no title is not a service. It is wrong for media: a file's identity is its
 * path and dimensions, and `alt` and `caption` are optional descriptions of
 * it.
 *
 * Routing media through flattenEntity meant every freshly uploaded image was
 * discarded here, because the upload endpoint creates no translation rows —
 * alt text is written later, if at all. The image was attached correctly, the
 * file was on disk, and the page rendered without it. Missing alt text now
 * costs the alt text, not the picture.
 */
export function flattenMedia<
  T extends { translations: Array<{ locale: string; alt: string | null; caption: string | null }> },
>(media: T | null, locale: Locale) {
  if (!media) return null;
  const { translations, ...base } = media;
  const copy = pickTranslation(translations, locale);
  return { ...base, alt: copy?.alt ?? null, caption: copy?.caption ?? null };
}
