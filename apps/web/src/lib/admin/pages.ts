/**
 * Where each page row actually lives on the public site.
 *
 * A page's key and its address are not the same thing and never were: the
 * keys are English and stable, the routes are Serbian. `gallery` is at
 * /galerija, `about` at /o-nama, `projects` at /reference. The admin printed
 * `/{key}` under each page's title as though that were the address, so every
 * one of the nine was wrong — and the moment a page key appeared that nobody
 * recognised, somebody typed it into a browser and got a 404.
 *
 * Declared here rather than derived, because next-intl is configured without
 * a `pathnames` map: route segments are shared between languages so that
 * NavItem.href can stay one column. That is a deliberate choice recorded in
 * i18n/routing.ts, and the price is this table.
 *
 * A key with no entry gets no link rather than a guessed one — the same rule
 * as everywhere else in this admin: say nothing before saying something that
 * is not true.
 */
export const PAGE_PATHS: Record<string, string> = {
  home: '/',
  about: '/o-nama',
  team: '/tim',
  services: '/usluge',
  projects: '/reference',
  news: '/vesti',
  gallery: '/galerija',
  contact: '/kontakt',
  documents: '/sertifikati',
};

/** The page's path, or null when nothing on the site renders this key. */
export function pagePath(key: string): string | null {
  return PAGE_PATHS[key] ?? null;
}
