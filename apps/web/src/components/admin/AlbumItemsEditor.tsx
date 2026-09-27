'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale, type ReorderInput } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { ADMIN_LOCALES } from '@/lib/admin/collections';
import { mediaAlt, mediaSrc, type MediaItem } from '@/lib/admin/media';
import MediaLibraryDialog from './MediaLibraryDialog';

/**
 * The photos inside one album.
 *
 * Kept out of CollectionForm on purpose. The album's own fields are a form
 * that is saved as a whole; its photos are a list where each change is its own
 * request the moment it is made — adding twenty images should not depend on
 * remembering to press Save, and removing one should not be undone by a stale
 * form field. The two also cannot nest: CollectionForm renders a <form>, and a
 * form inside a form is invalid HTML.
 *
 * Ordering is move-up/move-down rather than drag and drop, matching the
 * navigation editor: it works on a touch screen and with a keyboard, and each
 * move sends the whole order in one request so positions cannot end up
 * half-applied.
 */

interface ItemTranslation {
  locale: string;
  caption: string | null;
}

export interface AlbumItem {
  id: string;
  mediaId: string;
  sortOrder: number;
  translations: ItemTranslation[];
  media: MediaItem | null;
}

interface Props {
  albumId: string;
  initialItems: AlbumItem[];
  /** Read-only: the cover is chosen in the form above. */
  coverImageId: string | null;
}

const byOrder = (a: AlbumItem, b: AlbumItem) => a.sortOrder - b.sortOrder;

export default function AlbumItemsEditor({ albumId, initialItems, coverImageId }: Props) {
  const [items, setItems] = useState<AlbumItem[]>([...initialItems].sort(byOrder));
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (caught: unknown, fallback: string) =>
    setError(caught instanceof AdminApiError ? caught.message : fallback);

  async function addMedia(picked: MediaItem[]) {
    setPicking(false);
    setBusy('add');
    setError(null);
    try {
      // The endpoint returns the album's whole item list, already ordered, so
      // there is nothing to merge by hand.
      const result = await adminApi.post<{ items: AlbumItem[] }>(`gallery/${albumId}/items`, {
        mediaIds: picked.map((media) => media.id),
      });
      setItems([...result.items].sort(byOrder));
    } catch (caught) {
      fail(caught, 'Dodavanje slika nije uspelo.');
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    const current = items[index];
    const other = items[target];
    if (!current || !other) return;

    const next = [...items];
    [next[index], next[target]] = [other, current];

    // Shown moved straight away; put back if the request fails, so the list
    // never claims an order the database does not have.
    setItems(next.map((item, position) => ({ ...item, sortOrder: position })));
    setBusy(current.id);
    setError(null);
    try {
      const payload: ReorderInput = { ids: next.map((item) => item.id) };
      await adminApi.post(`gallery/${albumId}/items/reorder`, payload);
    } catch (caught) {
      setItems(items);
      fail(caught, 'Promena redosleda nije uspela.');
    } finally {
      setBusy(null);
    }
  }

  async function saveCaption(item: AlbumItem, caption: string) {
    setBusy(item.id);
    setError(null);
    try {
      await adminApi.patch(`gallery/${albumId}/items/${item.id}`, {
        captions: { [locale]: caption },
      });
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                translations: [
                  ...row.translations.filter((t) => t.locale !== locale),
                  { locale, caption },
                ],
              }
            : row,
        ),
      );
    } catch (caught) {
      fail(caught, 'Čuvanje potpisa nije uspelo.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: AlbumItem) {
    setBusy(item.id);
    setError(null);
    try {
      await adminApi.delete(`gallery/${albumId}/items/${item.id}`);
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (caught) {
      fail(caught, 'Uklanjanje slike nije uspelo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="admin-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-ts-border">
        <div>
          <h2 className="font-display text-lg font-bold text-ts-fg">
            Fotografije u albumu
            {items.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ts-muted">({items.length})</span>
            )}
          </h2>
          <p className="text-xs text-ts-muted mt-0.5">
            Izmene se čuvaju odmah. Naslovna slika se bira u formi iznad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-ts-border bg-ts-surface p-1">
            {ADMIN_LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={code === locale}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  code === locale ? 'bg-ts-red text-black' : 'text-ts-muted hover:text-ts-fg'
                }`}
              >
                {LOCALE_LABELS[code] ?? code.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setPicking(true)}
            disabled={busy !== null}
          >
            <Icon name="PlusIcon" size={15} />
            {busy === 'add' ? 'Dodavanje…' : 'Dodaj slike'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-[#ef6b6b] border-b border-ts-border">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="py-14 text-center">
          <Icon name="PhotoIcon" size={30} className="mx-auto text-ts-muted-2 mb-3" />
          <p className="text-sm text-ts-muted">Album još nema fotografije.</p>
          <p className="text-xs text-ts-muted-2 mt-1">
            Možete dodati više slika odjednom.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-ts-border">
          {items.map((item, index) => (
            <AlbumItemRow
              key={item.id}
              item={item}
              locale={locale}
              busy={busy === item.id}
              isCover={coverImageId !== null && item.mediaId === coverImageId}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMove={(direction) => void move(index, direction)}
              onSaveCaption={(caption) => void saveCaption(item, caption)}
              onRemove={() => void remove(item)}
            />
          ))}
        </ul>
      )}

      {picking && (
        <MediaLibraryDialog
          multiple
          title="Dodaj slike u album"
          excludeIds={items.map((item) => item.mediaId)}
          onClose={() => setPicking(false)}
          onPick={(picked) => void addMedia(picked)}
        />
      )}
    </section>
  );
}

function AlbumItemRow({
  item,
  locale,
  busy,
  isCover,
  canMoveUp,
  canMoveDown,
  onMove,
  onSaveCaption,
  onRemove,
}: {
  item: AlbumItem;
  locale: Locale;
  busy: boolean;
  isCover: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaveCaption: (caption: string) => void;
  onRemove: () => void;
}) {
  const stored = item.translations.find((t) => t.locale === locale)?.caption ?? '';
  const [draft, setDraft] = useState(stored);
  const [confirming, setConfirming] = useState(false);

  // The language tabs swap which caption this row is editing. Without this the
  // input would keep showing the Serbian text while saving it as English.
  const [editedLocale, setEditedLocale] = useState<Locale>(locale);
  if (editedLocale !== locale) {
    setEditedLocale(locale);
    setDraft(stored);
  }

  const dirty = draft !== stored;

  return (
    <li className="p-4 flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!canMoveUp || busy}
          aria-label="Pomeri gore"
          className="p-1 rounded text-ts-muted hover:text-ts-fg disabled:opacity-30"
        >
          <Icon name="ChevronUpIcon" size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!canMoveDown || busy}
          aria-label="Pomeri dole"
          className="p-1 rounded text-ts-muted hover:text-ts-fg disabled:opacity-30"
        >
          <Icon name="ChevronDownIcon" size={14} />
        </button>
      </div>

      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2 flex-shrink-0">
        {item.media ? (
          <Image
            src={mediaSrc(item.media.path)}
            alt={mediaAlt(item.media)}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ts-muted-2">
            <Icon name="PhotoIcon" size={20} />
          </div>
        )}
        {isCover && (
          <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-center text-black bg-ts-red py-0.5">
            NASLOVNA
          </span>
        )}
      </div>

      <div className="flex-1 min-w-[12rem] space-y-1">
        <label className="text-[10px] font-bold text-ts-muted uppercase tracking-wider block">
          Potpis ({LOCALE_LABELS[locale] ?? locale})
        </label>
        <input
          className="admin-input w-full"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Opciono — kratak opis fotografije"
          disabled={busy}
        />
        {item.media && (
          <p className="text-[11px] text-ts-muted-2 truncate" title={item.media.originalName}>
            {item.media.originalName}
            {item.media.width && item.media.height
              ? ` — ${item.media.width}×${item.media.height}`
              : ''}
          </p>
        )}
      </div>

      <button
        type="button"
        className="admin-btn admin-btn-primary"
        disabled={!dirty || busy}
        onClick={() => onSaveCaption(draft.trim())}
      >
        {busy ? '…' : 'Sačuvaj'}
      </button>

      {confirming ? (
        <span className="flex items-center gap-2 text-sm">
          <span className="text-ts-muted">Ukloniti?</span>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={onRemove}
            disabled={busy}
          >
            Da
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => setConfirming(false)}
          >
            Ne
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Ukloni iz albuma"
          title="Ukloni iz albuma — fajl ostaje u biblioteci"
          className="p-2 rounded text-ts-muted hover:text-[#ef6b6b] transition-colors"
          disabled={busy}
        >
          <Icon name="TrashIcon" size={16} />
        </button>
      )}
    </li>
  );
}
