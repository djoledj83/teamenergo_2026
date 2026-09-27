'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale, type ReorderInput } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { ADMIN_LOCALES } from '@/lib/admin/collections';

/**
 * Header and footer menus.
 *
 * Order is edited with move-up/move-down rather than drag and drop: the list
 * is short, the two buttons work on a touch screen and with a keyboard, and
 * there is no ambiguity about where an item landed. Each move sends the whole
 * order in one /nav/reorder request, so the positions can never end up
 * half-applied.
 *
 * Links are stored without a language prefix — "/usluge", not "/sr/usluge" —
 * because one row serves both languages and the prefix is added when the link
 * is rendered.
 */

interface NavTranslation {
  locale: string;
  label: string;
}

export interface NavItem {
  id: string;
  location: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  opensInNew: boolean;
  translations: NavTranslation[];
}

const LOCATIONS = [
  { key: 'header', label: 'Glavni meni' },
  { key: 'footer', label: 'Podnožje' },
];

const emptyDraft = () => ({
  href: '',
  labels: Object.fromEntries(ADMIN_LOCALES.map((l) => [l, ''])) as Record<string, string>,
});

export default function NavigationEditor({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Izmena nije uspela.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">Navigacija</h1>
          <p className="admin-subtitle">
            Stavke menija. Link se upisuje bez oznake jezika — /usluge, ne /sr/usluge.
          </p>
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

      {error && <p role="alert" className="admin-error">{error}</p>}

      {LOCATIONS.map((location) => {
        const rows = items
          .filter((item) => item.location === location.key)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <section key={location.key} className="admin-card">
            <div className="p-4 border-b border-ts-border">
              <h2 className="font-semibold text-ts-fg">{location.label}</h2>
            </div>

            {rows.length === 0 ? (
              <p className="p-4 text-sm text-ts-muted">Nema stavki.</p>
            ) : (
              <ul className="divide-y divide-ts-border">
                {rows.map((item, index) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    busy={busy === item.id}
                    canMoveUp={index > 0}
                    canMoveDown={index < rows.length - 1}
                    onMove={(direction) => {
                      const next = [...rows];
                      const target = index + direction;
                      [next[index], next[target]] = [next[target]!, next[index]!];
                      // Typed as the API's own input, so a change to the
                      // contract fails the build instead of silently 400ing.
                      // This previously sent { items: [{ id, sortOrder }] }
                      // while the endpoint expected { ids }, so every move was
                      // rejected and nothing ever changed position.
                      const payload: ReorderInput = { ids: next.map((row) => row.id) };
                      return run(item.id, () => adminApi.post('site/nav/reorder', payload));
                    }}
                    onSave={(payload) =>
                      run(item.id, () => adminApi.patch(`site/nav/${item.id}`, payload))
                    }
                    onDelete={() => run(item.id, () => adminApi.delete(`site/nav/${item.id}`))}
                  />
                ))}
              </ul>
            )}

            <AddRow
              location={location.key}
              nextSortOrder={rows.length}
              onCreate={(payload) => run(`new-${location.key}`, () => adminApi.post('site/nav', payload))}
              busy={busy === `new-${location.key}`}
            />
          </section>
        );
      })}
    </div>
  );
}

function NavRow({
  item,
  locale,
  busy,
  canMoveUp,
  canMoveDown,
  onMove,
  onSave,
  onDelete,
}: {
  item: NavItem;
  locale: Locale;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onSave: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const label = item.translations.find((t) => t.locale === locale)?.label ?? '';
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftHref, setDraftHref] = useState(item.href);
  const [confirming, setConfirming] = useState(false);

  const dirty = draftLabel !== label || draftHref !== item.href;

  return (
    <li className="p-4 flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!canMoveUp || busy}
          aria-label="Pomeri gore"
          className="p-1 rounded text-ts-muted hover:text-ts-fg disabled:opacity-30">
          <Icon name="ChevronUpIcon" size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!canMoveDown || busy}
          aria-label="Pomeri dole"
          className="p-1 rounded text-ts-muted hover:text-ts-fg disabled:opacity-30">
          <Icon name="ChevronDownIcon" size={14} />
        </button>
      </div>

      <input
        className="admin-input flex-1 min-w-[10rem]"
        value={draftLabel}
        onChange={(e) => setDraftLabel(e.target.value)}
        placeholder="Naziv"
        disabled={busy}
        aria-label={`Naziv (${locale})`}
      />
      <input
        className="admin-input flex-1 min-w-[10rem] font-mono text-sm"
        value={draftHref}
        onChange={(e) => setDraftHref(e.target.value)}
        placeholder="/usluge"
        disabled={busy}
        aria-label="Link"
      />

      <label className="flex items-center gap-2 text-sm text-ts-muted">
        <input
          type="checkbox"
          checked={item.isVisible}
          disabled={busy}
          onChange={(e) => onSave({ isVisible: e.target.checked })}
        />
        Prikazano
      </label>

      <button
        type="button"
        className="admin-btn admin-btn-primary"
        disabled={!dirty || busy || draftLabel.trim() === '' || draftHref.trim() === ''}
        onClick={() =>
          onSave({ href: draftHref.trim(), translations: { [locale]: { label: draftLabel.trim() } } })
        }>
        {busy ? '…' : 'Sačuvaj'}
      </button>

      {confirming ? (
        <span className="flex items-center gap-2 text-sm">
          <span className="text-ts-muted">Obrisati?</span>
          <button type="button" className="admin-btn admin-btn-danger" onClick={onDelete} disabled={busy}>
            Da
          </button>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setConfirming(false)}>
            Ne
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Obriši"
          className="p-2 rounded text-ts-muted hover:text-red-400 transition-colors"
          disabled={busy}>
          <Icon name="TrashIcon" size={16} />
        </button>
      )}
    </li>
  );
}

function AddRow({
  location,
  nextSortOrder,
  onCreate,
  busy,
}: {
  location: string;
  nextSortOrder: number;
  onCreate: (payload: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(emptyDraft());

  // A new item needs a label in every language, because the API requires a
  // translation per locale and a missing one would leave a blank gap in the
  // other language's menu.
  const complete =
    draft.href.trim() !== '' && ADMIN_LOCALES.every((l) => draft.labels[l]?.trim() !== '');

  return (
    <div className="p-4 border-t border-ts-border bg-ts-surface-2/40 flex flex-wrap items-end gap-3">
      {ADMIN_LOCALES.map((code) => (
        <label key={code} className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-ts-muted uppercase tracking-wider">
            Naziv ({LOCALE_LABELS[code] ?? code})
          </span>
          <input
            className="admin-input"
            value={draft.labels[code] ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, labels: { ...d.labels, [code]: e.target.value } }))
            }
            disabled={busy}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
        <span className="text-[10px] font-bold text-ts-muted uppercase tracking-wider">Link</span>
        <input
          className="admin-input font-mono text-sm"
          value={draft.href}
          onChange={(e) => setDraft((d) => ({ ...d, href: e.target.value }))}
          placeholder="/kontakt"
          disabled={busy}
        />
      </label>

      <button
        type="button"
        className="admin-btn admin-btn-primary"
        disabled={!complete || busy}
        onClick={() => {
          onCreate({
            location,
            href: draft.href.trim(),
            sortOrder: nextSortOrder,
            translations: Object.fromEntries(
              ADMIN_LOCALES.map((l) => [l, { label: draft.labels[l]!.trim() }]),
            ),
          });
          setDraft(emptyDraft());
        }}>
        Dodaj
      </button>
    </div>
  );
}
