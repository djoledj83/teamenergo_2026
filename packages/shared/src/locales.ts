/**
 * Supported content locales.
 *
 * Adding a locale here plus a row in the `locale` table is the whole cost of
 * a new language — the translation-table schema needs no migration.
 */
export const LOCALES = ['sr', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'sr';

export const LOCALE_LABELS: Record<Locale, string> = {
  sr: 'Srpski',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Narrows an arbitrary value to a Locale, falling back to the default. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
