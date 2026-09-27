'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { ADMIN_LOCALES, type AdminCollection } from '@/lib/admin/collections';
import FormField, { type FieldValue } from './FormField';

/**
 * The edit screen for every collection, generated from its config.
 *
 * Translatable fields appear once per language behind tabs; the rest sit in a
 * shared panel. On save the two halves are split back apart into the base
 * fields and the per-locale `translations` map the API expects.
 */

type Row = Record<string, unknown>;

interface Props {
  collection: AdminCollection;
  /** Existing entity, or null when creating. */
  entity: Row | null;
}

type BaseValues = Record<string, FieldValue>;
type TranslatedValues = Record<string, Record<string, FieldValue>>;

function buildInitialValues(collection: AdminCollection, entity: Row | null) {
  const base: BaseValues = {};
  const translated: TranslatedValues = {};

  for (const locale of ADMIN_LOCALES) translated[locale] = {};

  for (const field of collection.fields) {
    if (field.translatable) {
      const rows = (entity?.translations as Array<Record<string, unknown>> | undefined) ?? [];
      for (const locale of ADMIN_LOCALES) {
        const row = rows.find((candidate) => candidate.locale === locale);
        translated[locale]![field.name] = (row?.[field.name] as FieldValue) ?? '';
      }
    } else {
      base[field.name] = (entity?.[field.name] as FieldValue) ?? null;
    }
  }

  if (collection.publishable) {
    base.isPublished = Boolean(entity?.isPublished);
  }

  return { base, translated };
}

/**
 * The field that decides whether a language has been filled in — used for the
 * heading, for slug derivation, and to know which locales to write.
 *
 * It is the FIRST TRANSLATABLE field, whatever it happens to be called:
 * `title` on a service, `name` on a team member, `quote` on a testimonial,
 * `label` on a statistic.
 *
 * This used to be hardcoded to `title` or `name`. Statistics have neither —
 * theirs is `label` — so the form read an undefined value, concluded that no
 * language had been filled in, and refused every single save with "Unesite
 * naziv bar na jednom jeziku" no matter what had been typed. Clients failed
 * the same way for the opposite reason: they have no translatable fields at
 * all, which is what null means here.
 */
function titleFieldName(collection: AdminCollection): string | null {
  return collection.fields.find((field) => field.translatable)?.name ?? null;
}

export default function CollectionForm({ collection, entity }: Props) {
  const router = useRouter();
  const isNew = entity === null;

  const initial = useMemo(() => buildInitialValues(collection, entity), [collection, entity]);
  const [base, setBase] = useState<BaseValues>(initial.base);
  const [translated, setTranslated] = useState<TranslatedValues>(initial.translated);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const titleField = titleFieldName(collection);
  const heading = isNew
    ? `Novi unos — ${collection.labelSingular}`
    : ((titleField ? (translated[DEFAULT_LOCALE]?.[titleField] as string) : undefined) ??
      (base.name as string) ??
      collection.labelSingular);

  const translatableFields = collection.fields.filter((field) => field.translatable);
  const baseFields = collection.fields.filter((field) => !field.translatable);

  /** Languages with no title entered yet — surfaced so gaps are visible. */
  // With no translatable fields there is nothing per-language to be missing.
  const incompleteLocales = titleField
    ? ADMIN_LOCALES.filter(
        (candidate) => !String(translated[candidate]?.[titleField] ?? '').trim(),
      )
    : [];

  function buildPayload() {
    const translations: Record<string, Record<string, unknown>> = {};

    for (const candidate of ADMIN_LOCALES) {
      const values = translated[candidate] ?? {};
      if (titleField) {
        const hasTitle = String(values[titleField] ?? '').trim().length > 0;
        // A language with no title is skipped entirely rather than written as
        // empty strings, so partial translation stays a first-class state.
        if (!hasTitle) continue;
      }

      const copy: Record<string, unknown> = {};
      for (const field of translatableFields) {
        const value = values[field.name];
        copy[field.name] = value === '' ? null : value;
      }
      // The title itself must not be nulled by the loop above.
      if (titleField) copy[titleField] = values[titleField];
      translations[candidate] = copy;
    }

    const payload: Record<string, unknown> = {};
    // A collection with no translatable fields sends no translations key at
    // all, rather than an empty object the API would have to interpret.
    if (titleField) payload.translations = translations;
    for (const field of baseFields) {
      payload[field.name] = base[field.name] ?? null;
    }
    if (collection.publishable) payload.isPublished = Boolean(base.isPublished);

    return payload;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    if (incompleteLocales.length === ADMIN_LOCALES.length) {
      const fieldLabel =
        collection.fields.find((field) => field.name === titleField)?.label.toLowerCase() ??
        'naziv';
      setError(`Unesite ${fieldLabel} bar na jednom jeziku.`);
      setSaving(false);
      return;
    }

    try {
      const payload = buildPayload();
      if (isNew) {
        const created = await adminApi.post<{ id: string }>(collection.key, payload);
        router.replace(`/admin/${collection.key}/${created.id}`);
      } else {
        await adminApi.patch(`${collection.key}/${entity.id as string}`, payload);
      }
      router.refresh();
    } catch (caught) {
      if (caught instanceof AdminApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError('Čuvanje nije uspelo.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entity) return;
    if (!window.confirm(`Obrisati "${heading}"? Ova radnja se ne može poništiti.`)) return;

    setDeleting(true);
    setError(null);
    try {
      await adminApi.delete(`${collection.key}/${entity.id as string}`);
      router.replace(`/admin/${collection.key}`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 409) {
        // The API refuses when something still references this row; offer
        // the override rather than leaving the editor stuck.
        const details = JSON.stringify(caught.details ?? {});
        if (window.confirm(`${caught.message}\n${details}\n\nSvejedno obrisati?`)) {
          await adminApi.delete(`${collection.key}/${entity.id as string}?force=true`);
          router.replace(`/admin/${collection.key}`);
          router.refresh();
          return;
        }
      } else {
        setError(caught instanceof AdminApiError ? caught.message : 'Brisanje nije uspelo.');
      }
    } finally {
      setDeleting(false);
    }
  }

  const busy = saving || deleting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/admin/${collection.key}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ts-muted hover:text-ts-fg transition-colors mb-2"
          >
            <Icon name="ArrowLeftIcon" size={14} />
            {collection.label}
          </Link>
          <h1 className="font-display text-2xl font-bold text-ts-fg truncate">{heading}</h1>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              <Icon name="TrashIcon" size={15} />
              {deleting ? 'Brisanje…' : 'Obriši'}
            </button>
          )}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            <Icon name="CheckIcon" size={15} />
            {saving ? 'Čuvanje…' : 'Sačuvaj'}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-[#ef6b6b] bg-[rgba(212,41,41,0.08)] border border-[rgba(212,41,41,0.3)] rounded-lg px-4 py-3"
        >
          <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Translatable copy */}
      {translatableFields.length > 0 && (
        <section className="admin-card overflow-hidden">
          <div
            role="tablist"
            aria-label="Jezik sadržaja"
            className="flex items-center gap-1 px-4 pt-3 border-b border-ts-border"
          >
            {ADMIN_LOCALES.map((candidate) => {
              const incomplete = incompleteLocales.includes(candidate);
              const active = locale === candidate;
              return (
                <button
                  key={candidate}
                  type="button"
                  role="tab"
                  id={`locale-tab-${candidate}`}
                  aria-selected={active}
                  aria-controls="locale-panel"
                  // Only the active tab is in the tab order; arrow keys move
                  // between them, which is the expected tablist behaviour.
                  tabIndex={active ? 0 : -1}
                  onClick={() => setLocale(candidate)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                    event.preventDefault();
                    const index = ADMIN_LOCALES.indexOf(candidate);
                    const delta = event.key === 'ArrowRight' ? 1 : -1;
                    const next =
                      ADMIN_LOCALES[(index + delta + ADMIN_LOCALES.length) % ADMIN_LOCALES.length];
                    if (next) {
                      setLocale(next);
                      document.getElementById(`locale-tab-${next}`)?.focus();
                    }
                  }}
                  className={`relative px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                    active ? 'bg-ts-surface-2 text-ts-fg' : 'text-ts-muted hover:text-ts-fg'
                  }`}
                >
                  {LOCALE_LABELS[candidate]}
                  {incomplete && (
                    <span
                      title="Nije prevedeno"
                      className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-ts-accent align-middle"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            id="locale-panel"
            role="tabpanel"
            aria-labelledby={`locale-tab-${locale}`}
            className="p-5 grid gap-5 md:grid-cols-2"
          >
            {translatableFields.map((field) => (
              <FormField
                key={`${locale}-${field.name}`}
                field={field}
                value={translated[locale]?.[field.name]}
                error={fieldErrors[`translations.${locale}.${field.name}`]}
                disabled={busy}
                slugSource={
                  titleField ? (translated[locale]?.[titleField] as string | undefined) : undefined
                }
                onChange={(value) =>
                  setTranslated((current) => ({
                    ...current,
                    [locale]: { ...current[locale], [field.name]: value },
                  }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Language-independent fields */}
      {(baseFields.length > 0 || collection.publishable) && (
        <section className="admin-card p-5">
          <div className="grid gap-5 md:grid-cols-2">
            {baseFields.map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={base[field.name]}
                error={fieldErrors[field.name]}
                disabled={busy}
                onChange={(value) =>
                  setBase((current) => ({ ...current, [field.name]: value }))
                }
              />
            ))}

            {collection.publishable && (
              <FormField
                field={{
                  name: 'isPublished',
                  label: 'Objavljeno',
                  type: 'boolean',
                  help: 'Neobjavljeni unosi se ne prikazuju na sajtu.',
                }}
                value={base.isPublished}
                disabled={busy}
                onChange={(value) => setBase((current) => ({ ...current, isPublished: value }))}
              />
            )}
          </div>
        </section>
      )}
    </form>
  );
}
