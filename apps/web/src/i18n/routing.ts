import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@teamenergo/shared';

/**
 * URL shape for the public site.
 *
 * Every public page is prefixed with its language — /sr/usluge, /en/usluge.
 * The prefix is always present, including for Serbian: an implicit default
 * means the same content is reachable at two URLs, which search engines treat
 * as duplicates and which makes the language switcher's job ambiguous.
 *
 * Route SEGMENTS are shared between languages rather than translated, because
 * NavItem.href is a single column on the base table — one href serves both
 * languages by design. Content SLUGS are per-language and come from the
 * translation tables, so /en/usluge/telecommunications and
 * /sr/usluge/telekomunikacije are the same service under two names.
 *
 * Translating the segments too (/en/services) would mean adding an href per
 * locale to NavItem and declaring `pathnames` here. It is a later decision,
 * not a blocked one.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  // The cookie would otherwise pin a visitor to whichever language they saw
  // first, overriding the locale in the URL they were sent.
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];
