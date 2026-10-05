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

/**
 * PIB and matični broj, for whichever company.
 *
 * Text rather than number: a matični broj is eight digits and can begin with
 * a zero, which a number field would eat, and neither is ever added up.
 */
const REGISTRATION_FIELDS = (prefix: string): SettingsGroup['fields'] => [
  {
    key: `${prefix}.pib`,
    name: `${prefix}.pib`,
    label: 'PIB',
    type: 'text',
    help: 'Poreski identifikacioni broj — 9 cifara.',
  },
  {
    key: `${prefix}.registrationNumber`,
    name: `${prefix}.registrationNumber`,
    label: 'Matični broj',
    type: 'text',
    help: '8 cifara.',
  },
];

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: 'Kontakt',
    description:
      'Podaci glavne kompanije. Prikazuju se u podnožju sajta i na stranici Kontakt.',
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
      // Kept under company.* because they identify the company rather than
      // the way to reach it — but shown here, beside the address, because
      // that is where somebody filling in the company's particulars looks.
      ...REGISTRATION_FIELDS('company'),
    ],
  },
  {
    title: 'Povezana kompanija',
    description:
      'Druga kompanija, na svojoj adresi. Njena kolona u podnožju se pojavljuje tek ' +
      'kada je Naziv popunjen — ostavite sva polja prazna ako postoji samo jedna kompanija.',
    fields: [
      {
        key: 'subsidiary.name',
        name: 'subsidiary.name',
        label: 'Naziv',
        type: 'text',
        span: 2,
        help: 'Naslov kolone u podnožju. Dok je prazan, cela kolona se ne prikazuje.',
      },
      { key: 'subsidiary.email', name: 'subsidiary.email', label: 'Email', type: 'email' },
      { key: 'subsidiary.phone', name: 'subsidiary.phone', label: 'Telefon', type: 'text' },
      {
        key: 'subsidiary.address',
        name: 'subsidiary.address',
        label: 'Adresa',
        type: 'text',
        span: 2,
      },
      { key: 'subsidiary.city', name: 'subsidiary.city', label: 'Grad', type: 'text' },
      { key: 'subsidiary.country', name: 'subsidiary.country', label: 'Država', type: 'text' },
      ...REGISTRATION_FIELDS('subsidiary'),
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
