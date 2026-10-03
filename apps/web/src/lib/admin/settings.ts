import type { FieldConfig } from './collections';

/**
 * The settings screen, described rather than hand-built.
 *
 * The API stores settings as an open key/value map, which is right for the
 * database — a new setting needs no migration. But an open map makes a poor
 * editing surface: it offers a bare list of dotted keys with no grouping, no
 * labels and no idea which are expected. This config supplies that, and the
 * screen renders from it.
 *
 * A key that exists in the database but is not listed here still shows, under
 * "Ostalo", so nothing becomes invisible by being forgotten here.
 */

export interface SettingsGroup {
  title: string;
  description?: string;
  fields: Array<FieldConfig & { key: string }>;
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: 'Kontakt',
    description: 'Prikazuje se u podnožju sajta i na stranici Kontakt.',
    fields: [
      { key: 'contact.email', name: 'contact.email', label: 'Email', type: 'email' },
      {
        key: 'contact.phone',
        name: 'contact.phone',
        label: 'Telefon',
        type: 'text',
        help: 'Prazno polje se ne prikazuje na sajtu.',
      },
      { key: 'contact.address', name: 'contact.address', label: 'Adresa', type: 'text', span: 2 },
      { key: 'contact.city', name: 'contact.city', label: 'Grad', type: 'text' },
      { key: 'contact.country', name: 'contact.country', label: 'Država', type: 'text' },
    ],
  },
  {
    title: 'Kompanija',
    fields: [
      { key: 'company.name', name: 'company.name', label: 'Naziv', type: 'text' },
      {
        key: 'company.foundedYear',
        name: 'company.foundedYear',
        label: 'Godina osnivanja',
        type: 'number',
      },
    ],
  },
  {
    title: 'Društvene mreže',
    description: 'Ikonica se pojavljuje u podnožju samo ako je link popunjen.',
    fields: [
      { key: 'social.linkedin', name: 'social.linkedin', label: 'LinkedIn', type: 'text', span: 2 },
      {
        key: 'social.instagram',
        name: 'social.instagram',
        label: 'Instagram',
        type: 'text',
        span: 2,
      },
      { key: 'social.facebook', name: 'social.facebook', label: 'Facebook', type: 'text', span: 2 },
    ],
  },
  // No map group any more. The map on the Kontakt page reads the address
  // above, so there is one address on the site rather than an address and a
  // pair of coordinates that drift apart the first time the office moves.
  // map.lat and map.lng were never read by anything; if either is still in
  // the database it appears under "Ostalo" and can be deleted there.
];

/** Every key the groups above account for. */
export const KNOWN_SETTING_KEYS = new Set(
  SETTINGS_GROUPS.flatMap((group) => group.fields.map((field) => field.key)),
);
