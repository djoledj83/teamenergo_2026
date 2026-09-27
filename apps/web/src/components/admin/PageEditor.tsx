'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { ADMIN_LOCALES, type FieldConfig } from '@/lib/admin/collections';
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
  { name: 'seoTitle', label: 'SEO naslov', type: 'text', translatable: true, span: 2 },
  { name: 'seoDescription', label: 'SEO opis', type: 'textarea', translatable: true, span: 2 },
];

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
  cta: { label: 'Poziv na akciju', description: 'Traka sa dugmetom.' },
};

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
          <p className="admin-subtitle">/{page.key}</p>
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
        description="Naslov stranice i podaci za pretraživače."
        fields={PAGE_FIELDS}
        initial={readTranslations(page.translations, PAGE_FIELDS)}
        locale={locale}
        save={(translations) => adminApi.patch(`site/pages/${page.key}`, { translations })}
        onSaved={() => router.refresh()}
      />

      {page.blocks.length === 0 ? (
        <p className="admin-card p-6 text-sm text-ts-muted">
          Ova stranica još nema blokova teksta. Dodajte prvi ispod.
        </p>
      ) : (
        page.blocks.map((block) => (
          <Section
            key={block.id}
            title={BLOCK_INFO[block.blockKey]?.label ?? block.blockKey}
            description={BLOCK_INFO[block.blockKey]?.description ?? `Blok: ${block.blockKey}`}
            fields={BLOCK_FIELDS}
            initial={readTranslations(block.translations, BLOCK_FIELDS)}
            locale={locale}
            imageId={block.imageId}
            isVisible={block.isVisible}
            save={(translations, extra) =>
              adminApi.patch(`site/blocks/${block.id}`, { ...extra, translations })
            }
            onSaved={() => router.refresh()}
            onDelete={() => adminApi.delete(`site/blocks/${block.id}`)}
          />
        ))
      )}

      <AddBlock pageKey={page.key} existingKeys={page.blocks.map((b) => b.blockKey)} />
    </div>
  );
}

function Section({
  title,
  description,
  fields,
  initial,
  locale,
  imageId: initialImageId,
  isVisible: initialIsVisible,
  save,
  onSaved,
  onDelete,
}: {
  title: string;
  description: string;
  fields: FieldConfig[];
  initial: Record<string, Record<string, FieldValue>>;
  locale: Locale;
  imageId?: string | null;
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
        hasBlockExtras ? { imageId: imageId ?? null, isVisible } : undefined,
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
          <h2 className="font-semibold text-ts-fg">{title}</h2>
          <p className="text-xs text-ts-muted mt-0.5">{description}</p>
        </div>
        {hasBlockExtras && (
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

        {hasBlockExtras && (
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
