'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { parseVideoEmbed, VIDEO_URL_HELP } from '@teamenergo/shared';
import { ADMIN_LOCALES, type FieldConfig } from '@/lib/admin/collections';
import { pagePath } from '@/lib/admin/pages';
import FormField, { type FieldValue } from './FormField';

/**
 * Editor for one page and the blocks inside it.
 *
 * Pages are not a collection: there is one row per section of the site,
 * created by the seed, and no route would exist for a page added here. So
 * this screen edits rather than manages — the page's own title and SEO, then
 * each block's copy.
 *
 * Every block is saved on its own request. Saving all of them together would
 * mean one slow round trip where a single rejected field discards the rest of
 * the work; per-block saves keep each edit small and recoverable.
 */

interface Translation {
  locale: string;
  [key: string]: unknown;
}

interface Block {
  id: string;
  blockKey: string;
  imageId: string | null;
  videoUrl: string | null;
  isVisible: boolean;
  translations: Translation[];
}

export interface PageData {
  key: string;
  translations: Translation[];
  blocks: Block[];
}

const PAGE_FIELDS: FieldConfig[] = [
  { name: 'title', label: 'Naslov stranice', type: 'text', translatable: true, required: true },
  {
    name: 'intro',
    label: 'Uvodni tekst',
    type: 'richtext',
    translatable: true,
    span: 2,
    help: 'Kratak uvod ispod naslova stranice. Prazno polje se ne prikazuje.',
  },
  { name: 'seoTitle', label: 'SEO naslov', type: 'text', translatable: true, span: 2 },
  { name: 'seoDescription', label: 'SEO opis', type: 'textarea', translatable: true, span: 2 },
];

/**
 * The home page has no PageHero, so it has nowhere to put an intro — its
 * opening copy is the hero block's own text. Offering the field there would
 * be another one that saves cleanly and renders nothing.
 */
const PAGE_FIELDS_NO_INTRO = PAGE_FIELDS.filter((field) => field.name !== 'intro');

const BLOCK_FIELDS: FieldConfig[] = [
  { name: 'eyebrow', label: 'Nadnaslov', type: 'text', translatable: true },
  { name: 'heading', label: 'Naslov', type: 'text', translatable: true },
  { name: 'subheading', label: 'Podnaslov', type: 'text', translatable: true, span: 2 },
  { name: 'body', label: 'Tekst', type: 'richtext', translatable: true, span: 2 },
  { name: 'ctaLabel', label: 'Tekst dugmeta', type: 'text', translatable: true },
  {
    name: 'ctaHref',
    label: 'Link dugmeta',
    type: 'text',
    translatable: true,
    help: 'Npr. /usluge — bez oznake jezika, ona se dodaje sama.',
  },
];

/** The subset of BLOCK_FIELDS a particular block actually renders. */
const only = (...names: string[]) =>
  BLOCK_FIELDS.filter((field) => names.includes(field.name));

/**
 * Friendlier names for the blocks the seed creates, and a line saying what
 * each one actually controls on the site.
 *
 * "Blok: hero" is accurate and useless. Somebody looking for the big picture
 * at the top of the home page needs to be told that this is it, and that the
 * figures floating beside it are the statistics, which live somewhere else.
 */
const BLOCK_INFO: Record<string, { label: string; description: string }> = {
  hero: {
    label: 'Glavni blok (hero)',
    description:
      'Prva sekcija na početnoj strani. Ovde se postavlja velika fotografija — ' +
      'polje Slika ispod. Brojke koje lebde pored nje su statistike i uređuju se ' +
      'u meniju Statistika; prikazuju se samo one koje su objavljene.',
  },
  intro: { label: 'Uvod', description: 'Uvodni tekst ispod glavnog bloka.' },
  video: {
    label: 'Video kompanije',
    description:
      'Posebna sekcija ispod „U brojkama“, sa naslovom i velikim dugmetom koje '
      + 'otvara snimak u prozoru. „Tekst dugmeta“ je natpis na njemu. Video se može '
      + 'dodati i na bilo koji drugi blok — tamo se pojavljuje kao manje dugme uz '
      + 'tekst — a ovaj blok postoji da snimak dobije sekciju za sebe.',
  },
  cta: { label: 'Poziv na akciju', description: 'Traka sa dugmetom.' },
  contact: {
    label: 'Kontakt sekcija',
    description:
      'Poslednja sekcija početne strane, sa formom za upit. Nadnaslov, naslov, '
      + 'podnaslov u crvenom kurzivu i tekst levo od forme. Adresa, telefon i '
      + 'e-pošta se uređuju u meniju Podešavanja.',
  },
  services: {
    label: 'Naslov iznad usluga',
    description:
      'Nadnaslov i naslov sekcije „Naše usluge“ na početnoj. Podnaslov je deo '
      + 'naslova koji se prikazuje crvenim kurzivom. Same usluge se uređuju u meniju Usluge.',
  },
  news: {
    label: 'Naslov iznad vesti',
    description:
      'Nadnaslov i naslov sekcije sa vestima na početnoj. Podnaslov je deo naslova '
      + 'u crvenom kurzivu. Vesti se uređuju u meniju Vesti.',
  },
  stats: {
    label: 'Naslov iznad brojki',
    description:
      'Nadnaslov i naslov sekcije „U brojkama“. Podnaslov je deo naslova u crvenom '
      + 'kurzivu. Same brojke se uređuju u meniju Statistika.',
  },
  projects: {
    label: 'Naslov iznad referenci',
    description:
      'Nadnaslov i naslov sekcije sa referencama na početnoj. Podnaslov je deo '
      + 'naslova u crvenom kurzivu. Reference se uređuju u meniju Reference.',
  },
  testimonials: {
    label: 'Naslov iznad izjava',
    description:
      'Nadnaslov sekcije sa izjavama — ona nema veliki naslov, pa se Naslov i '
      + 'Podnaslov ovde ne prikazuju. Izjave se uređuju u meniju Izjave.',
  },
};

/**
 * A block that is only the heading above a section whose content lives in its
 * own menu. No image, no video, and no visibility switch: the section appears
 * when it has something to show, and hiding the block would only put the text
 * built into the page back in its place.
 */
const TITLE_ONLY = { image: false, video: false, visible: false } as const;

/**
 * What one block of a fixed-layout page offers. Everything defaults to on,
 * so a block listed as `{}` gets the full form.
 */
interface FixedBlock {
  /** Narrowed when the section reads only some of the text fields. */
  fields?: FieldConfig[];
  image?: boolean;
  video?: boolean;
  /** Whether hiding the block actually hides anything. */
  visible?: boolean;
}

/**
 * Which pages render whatever blocks they are given, and which only read
 * specific keys — and, for those, exactly which fields of each.
 *
 * Most pages end with <PageBlocks>, which renders every visible block in
 * order and reads every field of it, so a new block there appears on the site
 * in full. The home page does not: it is a composed layout that looks up each
 * key by name, renders it with its own component, and ignores both the keys
 * and the fields that component does not read. Adding a block to it used to
 * be possible, pointless and completely silent — you filled it in, saved, and
 * nothing appeared anywhere, with nothing on screen to say why. The same was
 * true field by field: a rich-text body on the services title, a button on
 * the video section, an image on the contact block.
 *
 * So the declaration is per page, not per block key: the same key on a page
 * that ends in <PageBlocks> does render all of it, and must keep every field.
 *
 * This is a second place that has to agree with the page components, which is
 * the same coupling BLOCK_INFO already has. The alternative — the API telling
 * the admin what each page renders — means the server knowing about the front
 * end, which is worse.
 */
interface FixedPage {
  blocks: Record<string, FixedBlock>;
  note: string;
}

const FIXED_BLOCK_PAGES: Record<string, FixedPage> = {
  home: {
    // In the order the page renders them, which is the order they are listed
    // in; orderBlocks() below puts the form in the same order.
    blocks: {
      hero: {},
      services: { fields: only('eyebrow', 'heading', 'subheading'), ...TITLE_ONLY },
      news: { fields: only('eyebrow', 'heading', 'subheading'), ...TITLE_ONLY },
      stats: { fields: only('eyebrow', 'heading', 'subheading'), ...TITLE_ONLY },
      projects: { fields: only('eyebrow', 'heading', 'subheading'), ...TITLE_ONLY },
      testimonials: { fields: only('eyebrow'), ...TITLE_ONLY },
      // Its own section: a heading, and a button that opens the recording.
      video: { fields: only('heading', 'ctaLabel'), image: false },
      // Text beside the enquiry form. No button of its own — the form has one.
      contact: { fields: only('eyebrow', 'heading', 'subheading', 'body'), image: false },
    },
    note:
      'Početna strana je složen raspored. Svaki blok ispod uređuje jednu njenu ' +
      'sekciju, istim redom kojim se pojavljuju na strani. Kod sekcija koje imaju ' +
      'svoj meni (usluge, vesti, brojke, reference, izjave) ovde se uređuje samo ' +
      'naslov iznad njih. Novi blokovi se ovde ne mogu dodavati jer ih stranica ' +
      'ne bi prikazala.',
  },
};

/**
 * On a page with a fixed layout, list the blocks in the order the page
 * renders them rather than by the stored sort order.
 *
 * The home page's rows were created at different times, so their sort order
 * is the order they were added to the seed — hero, video, contact, then the
 * five section titles. Reading down the admin would then bear no relation to
 * reading down the site, which is the only map anyone has of what they are
 * editing. Keys the page does not read sort last, next to their badge.
 */
function orderBlocks(blocks: Block[], fixed: FixedPage | undefined) {
  if (!fixed) return blocks;
  const keys = Object.keys(fixed.blocks);
  const rank = (key: string) => {
    const index = keys.indexOf(key);
    return index === -1 ? keys.length : index;
  };
  return [...blocks].sort((a, b) => rank(a.blockKey) - rank(b.blockKey));
}

function readTranslations(rows: Translation[], fields: FieldConfig[]) {
  const values: Record<string, Record<string, FieldValue>> = {};
  for (const locale of ADMIN_LOCALES) {
    const row = rows.find((candidate) => candidate.locale === locale);
    values[locale] = {};
    for (const field of fields) {
      values[locale]![field.name] = (row?.[field.name] as FieldValue) ?? '';
    }
  }
  return values;
}

/** Empty strings mean "cleared" to a person and null to the API. */
function toPayload(values: Record<string, Record<string, FieldValue>>) {
  const translations: Record<string, Record<string, unknown>> = {};
  for (const locale of ADMIN_LOCALES) {
    const row = values[locale] ?? {};
    translations[locale] = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ]),
    );
  }
  return translations;
}

export default function PageEditor({ page }: { page: PageData }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const heading =
    (page.translations.find((t) => t.locale === DEFAULT_LOCALE)?.title as string) ?? page.key;
  const fixed = FIXED_BLOCK_PAGES[page.key];
  const path = pagePath(page.key);
  // The home page renders no PageHero, so it has no slot for an intro.
  const pageFields = page.key === 'home' ? PAGE_FIELDS_NO_INTRO : PAGE_FIELDS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/pages"
            className="inline-flex items-center gap-1.5 text-sm text-ts-muted hover:text-ts-fg transition-colors mb-1">
            <Icon name="ArrowLeftIcon" size={14} />
            Stranice
          </Link>
          <h1 className="admin-title truncate">{heading}</h1>
          {/* The address, not the key. They differ for every page on this
              site, and printing the key here sent somebody to a 404. */}
          {path ? (
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-subtitle inline-flex items-center gap-1.5 hover:text-ts-fg transition-colors">
              {path}
              <Icon name="ArrowTopRightOnSquareIcon" size={12} />
            </a>
          ) : (
            <p className="admin-subtitle">Nema stranice na sajtu ({page.key})</p>
          )}
        </div>

        <div className="inline-flex rounded-full border border-ts-border bg-ts-surface p-1">
          {ADMIN_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={code === locale}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                code === locale ? 'bg-ts-red text-black' : 'text-ts-muted hover:text-ts-fg'
              }`}>
              {LOCALE_LABELS[code] ?? code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <Section
        title="Osnovno"
        description={
          pageFields === PAGE_FIELDS
            ? 'Naslov stranice, kratak uvod ispod njega i podaci za pretraživače.'
            : 'Naslov stranice i podaci za pretraživače. Uvodni tekst početne strane ' +
              'je tekst u glavnom bloku (hero) ispod.'
        }
        fields={pageFields}
        initial={readTranslations(page.translations, pageFields)}
        locale={locale}
        save={(translations) => adminApi.patch(`site/pages/${page.key}`, { translations })}
        onSaved={() => router.refresh()}
      />

      {fixed && (
        <p className="admin-card p-5 text-sm text-ts-muted leading-relaxed border-l-2 border-ts-blue">
          {fixed.note}
        </p>
      )}

      {page.blocks.length === 0 ? (
        <p className="admin-card p-6 text-sm text-ts-muted">
          Ova stranica još nema blokova teksta. Dodajte prvi ispod.
        </p>
      ) : (
        orderBlocks(page.blocks, fixed).map((block) => {
          const info = BLOCK_INFO[block.blockKey];
          // Part of the page's fixed layout. There is no "add block" on
          // these pages, so deleting one would remove it from the admin for
          // good — the section would quietly revert to the text built into
          // the code, with no way back short of re-seeding the database.
          const layout = fixed?.blocks[block.blockKey];
          const structural = layout !== undefined;
          const fields = layout?.fields ?? BLOCK_FIELDS;

          return (
          <Section
            key={block.id}
            title={info?.label ?? block.blockKey}
            unused={fixed ? !structural : false}
            description={info?.description ?? `Blok: ${block.blockKey}`}
            fields={fields}
            image={layout?.image ?? true}
            video={layout?.video ?? true}
            canHide={layout?.visible ?? true}
            initial={readTranslations(block.translations, fields)}
            locale={locale}
            imageId={block.imageId}
            videoUrl={block.videoUrl}
            isVisible={block.isVisible}
            save={(translations, extra) =>
              adminApi.patch(`site/blocks/${block.id}`, { ...extra, translations })
            }
            onSaved={() => router.refresh()}
            {...(structural
              ? {}
              : { onDelete: () => adminApi.delete(`site/blocks/${block.id}`) })}
          />
          );
        })
      )}

      {!fixed && (
        <AddBlock pageKey={page.key} existingKeys={page.blocks.map((b) => b.blockKey)} />
      )}
    </div>
  );
}

function Section({
  title,
  description,
  unused = false,
  fields,
  image: showImage = true,
  video: showVideo = true,
  canHide = true,
  initial,
  locale,
  imageId: initialImageId,
  videoUrl: initialVideoUrl,
  isVisible: initialIsVisible,
  save,
  onSaved,
  onDelete,
}: {
  title: string;
  description: string;
  /** The page does not read this block's key, so it renders nowhere. */
  unused?: boolean;
  fields: FieldConfig[];
  /** Whether this block's section renders an image, a video, and whether
      hiding the block hides anything. */
  image?: boolean;
  video?: boolean;
  canHide?: boolean;
  initial: Record<string, Record<string, FieldValue>>;
  locale: Locale;
  imageId?: string | null;
  videoUrl?: string | null;
  isVisible?: boolean;
  save: (
    translations: Record<string, Record<string, unknown>>,
    extra?: Record<string, unknown>,
  ) => Promise<unknown>;
  onSaved: () => void;
  onDelete?: (() => Promise<unknown>) | undefined;
}) {
  const [values, setValues] = useState(initial);
  const [imageId, setImageId] = useState<FieldValue>(initialImageId ?? null);
  const [videoUrl, setVideoUrl] = useState<FieldValue>(initialVideoUrl ?? null);
  const [isVisible, setIsVisible] = useState(initialIsVisible ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const hasBlockExtras = initialIsVisible !== undefined;

  const update = (name: string, value: FieldValue) => {
    setSaved(false);
    setValues((current) => ({
      ...current,
      [locale]: { ...current[locale], [name]: value },
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await save(
        toPayload(values),
        hasBlockExtras
          ? { imageId: imageId ?? null, videoUrl: videoUrl ?? null, isVisible }
          : undefined,
      );
      setSaved(true);
      onSaved();
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setError('Čuvanje nije uspelo.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="admin-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-ts-fg">
            {title}
            {unused && (
              <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider text-[#ef6b6b] border border-[#ef6b6b]/40 rounded-full px-2 py-0.5">
                Ne prikazuje se
              </span>
            )}
          </h2>
          <p className="text-xs text-ts-muted mt-0.5">{description}</p>
          {unused && (
            <p className="text-xs text-[#ef6b6b] mt-1.5 leading-relaxed">
              Ova stranica ne čita blok sa ovim ključem, pa se njegov sadržaj nigde ne
              prikazuje. Možete ga obrisati.
            </p>
          )}
        </div>
        {hasBlockExtras && canHide && (
          <label className="flex items-center gap-2 text-sm text-ts-muted cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => {
                setIsVisible(e.target.checked);
                setSaved(false);
              }}
            />
            Prikazano
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {fields.map((field) => (
          <div key={field.name} className={field.span === 2 ? 'md:col-span-2' : ''}>
            <FormField
              field={field}
              value={values[locale]?.[field.name] ?? ''}
              onChange={(value) => update(field.name, value)}
              error={fieldErrors[`translations.${locale}.${field.name}`]}
              disabled={saving}
            />
          </div>
        ))}

        {hasBlockExtras && showImage && (
          <div className="md:col-span-2">
            <FormField
              field={{
                name: 'imageId',
                label: 'Slika',
                type: 'image',
                help: 'Prikazuje se pored teksta ovog bloka.',
              }}
              value={imageId}
              onChange={(value) => {
                setImageId(value);
                setSaved(false);
              }}
              disabled={saving}
            />
          </div>
        )}

        {hasBlockExtras && showVideo && (
          <div className="md:col-span-2">
            <FormField
              field={{
                name: 'videoUrl',
                label: 'Video (YouTube ili Vimeo)',
                type: 'url',
                help:
                  'Nalepite link ka snimku, npr. https://www.youtube.com/watch?v=… — ' +
                  'dugme „Pogledajte video“ se pojavljuje u OVOM bloku, uz dugme ' +
                  'poziva na akciju ako ga ima. Prazno polje znači da nema dugmeta. ' +
                  'Video se učitava tek kada posetilac klikne na njega.',
              }}
              value={videoUrl}
              onChange={(value) => {
                setVideoUrl(value);
                setSaved(false);
              }}
              disabled={saving}
            />
            {/* A link saved before this check existed, or pasted from a
                channel or playlist page, is accepted by the field and then
                renders nothing on the site. Saying so here is the difference
                between a two-second fix and an afternoon wondering why the
                button never appeared. */}
            {typeof videoUrl === 'string' &&
              videoUrl.trim() !== '' &&
              parseVideoEmbed(videoUrl) === null && (
                <p role="alert" className="mt-1.5 text-xs text-[#ef6b6b] leading-relaxed">
                  {VIDEO_URL_HELP}
                </p>
              )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="admin-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving ? 'Čuvanje…' : 'Sačuvaj'}
        </button>
        {saved && !saving && (
          <span className="text-sm text-emerald-400 inline-flex items-center gap-1.5">
            <Icon name="CheckIcon" size={14} />
            Sačuvano
          </span>
        )}

        {onDelete && (
          <span className="ml-auto flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-sm text-ts-muted">Obrisati blok?</span>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onDelete();
                      onSaved();
                    } catch (cause) {
                      setError(
                        cause instanceof AdminApiError ? cause.message : 'Brisanje nije uspelo.',
                      );
                    } finally {
                      setSaving(false);
                      setConfirmingDelete(false);
                    }
                  }}>
                  Da
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setConfirmingDelete(false)}>
                  Ne
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}>
                <Icon name="TrashIcon" size={14} />
                Obriši blok
              </button>
            )}
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * Adds a section to the page.
 *
 * blockKey is how the front end addresses a block — the homepage asks for
 * "hero" — so it is a slug, and it has to be unique within the page. The
 * field is checked here as well as by the API because the API's answer to a
 * duplicate is a constraint violation, which is not a sentence anybody wants
 * to read.
 */
function AddBlock({ pageKey, existingKeys }: { pageKey: string; existingKeys: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blockKey, setBlockKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = blockKey.trim().toLowerCase();
  const duplicate = existingKeys.includes(slug);
  const malformed = slug !== '' && !/^[a-z0-9-]+$/.test(slug);
  const valid = slug !== '' && !duplicate && !malformed;

  if (!open) {
    return (
      <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="PlusIcon" size={14} />
        Dodaj blok
      </button>
    );
  }

  return (
    <div className="admin-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-ts-fg">Novi blok</h2>
        <p className="text-xs text-ts-muted mt-0.5">
          Ključ se koristi samo interno — npr. istorija, misija, kontakt-info.
        </p>
      </div>

      <label className="block max-w-sm">
        <span className="admin-label">Ključ bloka</span>
        <input
          className="admin-input font-mono text-sm"
          value={blockKey}
          onChange={(e) => setBlockKey(e.target.value)}
          placeholder="istorija"
          disabled={saving}
          autoFocus
        />
      </label>

      {duplicate && <p className="admin-error">Blok sa tim ključem već postoji na ovoj stranici.</p>}
      {malformed && (
        <p className="admin-error">Dozvoljena su mala slova, brojevi i crtice.</p>
      )}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await adminApi.post(`site/pages/${pageKey}/blocks`, { blockKey: slug });
              setBlockKey('');
              setOpen(false);
              router.refresh();
            } catch (cause) {
              setError(cause instanceof AdminApiError ? cause.message : 'Dodavanje nije uspelo.');
            } finally {
              setSaving(false);
            }
          }}>
          {saving ? 'Dodavanje…' : 'Dodaj'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => {
            setOpen(false);
            setBlockKey('');
            setError(null);
          }}>
          Odustani
        </button>
      </div>
    </div>
  );
}
