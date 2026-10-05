import { LOCALES, type Locale } from '@teamenergo/shared';

/**
 * The admin panel, described as data.
 *
 * Every list and edit screen is generated from these definitions. Adding a
 * content type is a config entry here plus its API router — not five new React
 * screens. Without this, a CMS admin reliably grows into a few thousand lines
 * of near-identical CRUD components, and every fix has to be applied nine
 * times.
 *
 * The API layer is deliberately NOT generated this way: there, dynamic access
 * would cost the compile-time checking that typed translation tables exist to
 * provide. Here there is no such trade-off — the UI is uniform by nature.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'slug'
  | 'number'
  | 'boolean'
  | 'select'
  | 'image'
  /** PDF or Word document, picked from the same library. */
  | 'document'
  | 'date'
  | 'url'
  | 'email';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  /** Rendered once per language with SR/EN tabs. */
  translatable?: boolean;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Width within the two-column form grid. */
  span?: 1 | 2;
}

export type ColumnType = 'text' | 'badge' | 'image' | 'date' | 'boolean' | 'number';

export interface ColumnConfig {
  key: string;
  label: string;
  type?: ColumnType;
  /** Reads from the entity's translation in the active admin language. */
  translated?: boolean;
}

export interface AdminCollection {
  /** URL segment under /admin and path under /api/admin. */
  key: string;
  label: string;
  labelSingular: string;
  /** Heroicon name for the sidebar. */
  icon: string;
  group: 'content' | 'site' | 'system';
  columns: ColumnConfig[];
  fields: FieldConfig[];
  /** Shows drag handles and enables the reorder endpoint. */
  sortable?: boolean;
  /** Shows the publish toggle and the draft badge. */
  publishable?: boolean;
  /** Hidden from the sidebar; reached from somewhere else. */
  hidden?: boolean;
  emptyHint?: string;
}

const ACCENT_OPTIONS = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Plava' },
  { value: 'red', label: 'Crvena' },
];

const seo: FieldConfig[] = [
  {
    name: 'seoTitle',
    label: 'SEO naslov',
    type: 'text',
    translatable: true,
    help: 'Prikazuje se u rezultatima pretrage. Ako je prazno, koristi se naslov.',
  },
  {
    name: 'seoDescription',
    label: 'SEO opis',
    type: 'textarea',
    translatable: true,
    span: 2,
  },
];

export const ADMIN_COLLECTIONS: AdminCollection[] = [
  {
    key: 'services',
    label: 'Usluge',
    labelSingular: 'Usluga',
    icon: 'WrenchScrewdriverIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'image', label: '', type: 'image' },
      { key: 'title', label: 'Naslov', translated: true },
      { key: 'category', label: 'Kategorija', type: 'badge', translated: true },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'title', label: 'Naslov', type: 'text', translatable: true, required: true },
      {
        name: 'slug',
        label: 'Slug',
        type: 'slug',
        translatable: true,
        help: 'Deo URL adrese. Menja se samo ručno — izmena raskida postojeće linkove.',
      },
      { name: 'category', label: 'Kategorija', type: 'text', translatable: true },
      { name: 'summary', label: 'Kratak opis', type: 'textarea', translatable: true, span: 2 },
      { name: 'body', label: 'Opis', type: 'richtext', translatable: true, span: 2 },
      { name: 'imageId', label: 'Slika', type: 'image' },
      { name: 'iconName', label: 'Ikonica', type: 'text', help: 'Heroicon, npr. BoltIcon' },
      { name: 'accent', label: 'Akcenat', type: 'select', options: ACCENT_OPTIONS },
      { name: 'isFeatured', label: 'Istaknuto na početnoj', type: 'boolean' },
      ...seo,
    ],
  },
  {
    key: 'projects',
    label: 'Reference',
    labelSingular: 'Projekat',
    icon: 'BuildingOffice2Icon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'coverImage', label: '', type: 'image' },
      { key: 'title', label: 'Naslov', translated: true },
      { key: 'location', label: 'Lokacija', translated: true },
      { key: 'year', label: 'Godina', type: 'number' },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'title', label: 'Naslov', type: 'text', translatable: true, required: true },
      { name: 'slug', label: 'Slug', type: 'slug', translatable: true },
      { name: 'location', label: 'Lokacija', type: 'text', translatable: true },
      { name: 'tag', label: 'Oznaka', type: 'text', translatable: true },
      { name: 'summary', label: 'Kratak opis', type: 'textarea', translatable: true, span: 2 },
      { name: 'body', label: 'Opis', type: 'richtext', translatable: true, span: 2 },
      { name: 'coverImageId', label: 'Naslovna slika', type: 'image' },
      { name: 'year', label: 'Godina', type: 'number' },
      { name: 'completedAt', label: 'Datum završetka', type: 'date' },
      { name: 'accent', label: 'Akcenat', type: 'select', options: ACCENT_OPTIONS },
      { name: 'isFeatured', label: 'Istaknuto na početnoj', type: 'boolean' },
      ...seo,
    ],
  },
  {
    key: 'posts',
    label: 'Vesti',
    labelSingular: 'Vest',
    icon: 'NewspaperIcon',
    group: 'content',
    publishable: true,
    columns: [
      { key: 'coverImage', label: '', type: 'image' },
      { key: 'title', label: 'Naslov', translated: true },
      { key: 'publishedAt', label: 'Objavljeno', type: 'date' },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'title', label: 'Naslov', type: 'text', translatable: true, required: true },
      { name: 'slug', label: 'Slug', type: 'slug', translatable: true },
      { name: 'excerpt', label: 'Uvod', type: 'textarea', translatable: true, span: 2 },
      { name: 'body', label: 'Tekst', type: 'richtext', translatable: true, span: 2 },
      { name: 'coverImageId', label: 'Naslovna slika', type: 'image' },
      {
        name: 'publishedAt',
        label: 'Datum objave',
        type: 'date',
        help: 'Ako je prazno pri objavljivanju, upisuje se trenutni datum.',
      },
      { name: 'isFeatured', label: 'Istaknuto', type: 'boolean' },
      ...seo,
    ],
  },
  {
    key: 'post-categories',
    label: 'Kategorije vesti',
    labelSingular: 'Kategorija',
    icon: 'TagIcon',
    group: 'content',
    sortable: true,
    hidden: true,
    columns: [
      { key: 'name', label: 'Naziv', translated: true },
      { key: 'slug', label: 'Slug', translated: true },
    ],
    fields: [
      { name: 'name', label: 'Naziv', type: 'text', translatable: true, required: true },
      { name: 'slug', label: 'Slug', type: 'slug', translatable: true },
      { name: 'description', label: 'Opis', type: 'textarea', translatable: true, span: 2 },
    ],
  },
  {
    key: 'gallery',
    label: 'Galerija',
    labelSingular: 'Album',
    icon: 'PhotoIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'coverImage', label: '', type: 'image' },
      { key: 'title', label: 'Naslov', translated: true },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'title', label: 'Naslov', type: 'text', translatable: true, required: true },
      { name: 'slug', label: 'Slug', type: 'slug', translatable: true },
      { name: 'description', label: 'Opis', type: 'textarea', translatable: true, span: 2 },
      { name: 'coverImageId', label: 'Naslovna slika', type: 'image' },
    ],
  },
  {
    key: 'team',
    label: 'Tim',
    labelSingular: 'Član tima',
    icon: 'UsersIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'photo', label: '', type: 'image' },
      { key: 'name', label: 'Ime', translated: true },
      { key: 'role', label: 'Pozicija', translated: true },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      {
        name: 'name',
        label: 'Ime i prezime',
        type: 'text',
        translatable: true,
        required: true,
        help: 'Po jeziku, jer se imena transliteruju između pisama.',
      },
      {
        name: 'slug',
        label: 'Slug',
        type: 'slug',
        translatable: true,
        help: 'Adresa stranice člana tima. Ostavite prazno da se napravi iz imena.',
      },
      { name: 'role', label: 'Pozicija', type: 'text', translatable: true },
      { name: 'bio', label: 'Biografija', type: 'textarea', translatable: true, span: 2 },
      { name: 'photoId', label: 'Fotografija', type: 'image' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Telefon', type: 'text' },
      { name: 'linkedinUrl', label: 'LinkedIn', type: 'url' },
      {
        name: 'isManagement',
        label: 'Rukovodstvo',
        type: 'boolean',
        help: 'Prikazuje se u prvom redu na stranici Tim, iznad ostalih članova.',
      },
    ],
  },
  {
    key: 'site-documents',
    label: 'Dokumenti i sertifikati',
    labelSingular: 'Dokument',
    icon: 'DocumentCheckIcon',
    group: 'site',
    // Without `publishable` the form renders no publish toggle, so the payload
    // never carries isPublished, the API falls back to false, and the footer —
    // which shows published rows only — stays empty however many documents
    // were added. Without `sortable` the footer's order cannot be changed.
    sortable: true,
    publishable: true,
    emptyHint: 'Dodajte ISO oznake, sertifikate i dokumente za preuzimanje.',
    columns: [
      { key: 'logo', label: '', type: 'image' },
      { key: 'label', label: 'Naziv', translated: true },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'label', label: 'Naziv', type: 'text', translatable: true, required: true },
      {
        name: 'slug',
        label: 'Slug',
        type: 'slug',
        translatable: true,
        help: 'Adresa stranice dokumenta, npr. /sertifikati/iso-9001. Ostavite prazno '
          + 'da se napravi iz naziva.',
      },
      {
        name: 'description',
        label: 'Opis',
        type: 'textarea',
        translatable: true,
        span: 2,
        help: 'Jedna rečenica. Prikazuje se pri prelasku mišem u podnožju i kao opis '
          + 'stranice u rezultatima pretrage ako SEO opis nije popunjen.',
      },
      {
        name: 'body',
        label: 'Tekst',
        type: 'richtext',
        translatable: true,
        span: 2,
        help: 'Sadržaj stranice dokumenta — šta sertifikat pokriva, kada je izdat, ko ga '
          + 'je izdao. Prazno polje se ne prikazuje.',
      },
      {
        name: 'logoId',
        label: 'Logo (npr. ISO oznaka)',
        type: 'image',
        help: 'Prikazuje se u podnožju i na stranici dokumenta.',
      },
      {
        name: 'fileId',
        label: 'Fajl za preuzimanje',
        type: 'document',
        help: 'PDF ili Word dokument. Dugme za preuzimanje stoji na stranici dokumenta '
          + 'i, ako nema loga, u podnožju.',
      },
      ...seo,
    ],
  },
  {
    key: 'testimonials',
    label: 'Izjave',
    labelSingular: 'Izjava',
    icon: 'ChatBubbleLeftRightIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'avatar', label: '', type: 'image' },
      { key: 'name', label: 'Ime', translated: true },
      { key: 'company', label: 'Kompanija', translated: true },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'quote', label: 'Izjava', type: 'textarea', translatable: true, required: true, span: 2 },
      { name: 'name', label: 'Ime', type: 'text', translatable: true, required: true },
      { name: 'role', label: 'Pozicija', type: 'text', translatable: true },
      { name: 'company', label: 'Kompanija', type: 'text', translatable: true },
      { name: 'avatarId', label: 'Fotografija', type: 'image' },
    ],
  },
  {
    key: 'clients',
    label: 'Klijenti',
    labelSingular: 'Klijent',
    icon: 'BuildingStorefrontIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    columns: [
      { key: 'logo', label: '', type: 'image' },
      { key: 'name', label: 'Naziv' },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      {
        name: 'name',
        label: 'Naziv',
        type: 'text',
        required: true,
        help: 'Nazivi kompanija se ne prevode.',
      },
      { name: 'logoId', label: 'Logo', type: 'image' },
      { name: 'websiteUrl', label: 'Sajt', type: 'url' },
    ],
  },
  {
    key: 'stats',
    label: 'Statistika',
    labelSingular: 'Podatak',
    icon: 'ChartBarIcon',
    group: 'content',
    sortable: true,
    publishable: true,
    emptyHint:
      'Brojke sa početne strane. Sve su trenutno neobjavljene sa vrednošću 0 — zamenite ih stvarnim podacima pre objave.',
    columns: [
      { key: 'label', label: 'Naziv', translated: true },
      { key: 'value', label: 'Vrednost', type: 'number' },
      { key: 'isPublished', label: 'Status', type: 'boolean' },
    ],
    fields: [
      { name: 'label', label: 'Naziv', type: 'text', translatable: true, required: true },
      { name: 'description', label: 'Opis', type: 'textarea', translatable: true, span: 2 },
      { name: 'value', label: 'Vrednost', type: 'number', required: true },
      { name: 'prefix', label: 'Prefiks', type: 'text' },
      { name: 'suffix', label: 'Sufiks', type: 'text', placeholder: '+ , MW, %' },
      { name: 'isDecimal', label: 'Decimalni broj', type: 'boolean' },
      { name: 'iconName', label: 'Ikonica', type: 'text' },
      { name: 'accent', label: 'Akcenat', type: 'select', options: ACCENT_OPTIONS },
    ],
  },
];

export function findCollection(key: string): AdminCollection | undefined {
  return ADMIN_COLLECTIONS.find((collection) => collection.key === key);
}

export const ADMIN_LOCALES: Locale[] = [...LOCALES];

/** Sidebar sections, in display order. */
export const NAV_GROUPS = [
  { key: 'content' as const, label: 'Sadržaj' },
  { key: 'site' as const, label: 'Sajt' },
  { key: 'system' as const, label: 'Sistem' },
];
