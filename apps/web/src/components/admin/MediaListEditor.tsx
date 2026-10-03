'use client';

import { useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { mediaAlt, mediaSrc, type MediaItem } from '@/lib/admin/media';
import MediaLibraryDialog from './MediaLibraryDialog';
import type { ReorderInput } from '@teamenergo/shared';

/**
 * An ordered list of library images attached to one record.
 *
 * Articles and references both have exactly this — pick several photos, set
 * their order, detach one — against identical endpoints (`<collection>/<id>/
 * images`, `…/reorder`, `…/<imageId>`). One component rather than two that
 * drift.
 *
 * Gallery albums keep their own editor: an album item carries a translated
 * caption of its own, which is a different thing to edit and a different
 * endpoint shape. The two could merge later behind an optional captions prop;
 * copying this one to add captions is what should not happen.
 *
 * Saves on every change rather than with the form above it. A <form> cannot
 * be nested inside another, and "add six photos, then remember to press save"
 * is a way to lose six photos.
 */

export interface MediaListItem {
  id: string;
  mediaId: string;
  sortOrder: number;
  media: MediaItem | null;
}

const byOrder = (a: MediaListItem, b: MediaListItem) => a.sortOrder - b.sortOrder;

export default function MediaListEditor({
  endpoint,
  initialItems,
  title,
  emptyText,
}: {
  /** Admin API path for the parent, e.g. `posts/<id>`. */
  endpoint: string;
  initialItems: MediaListItem[];
  title: string;
  emptyText: string;
}) {
  const [items, setItems] = useState<MediaListItem[]>([...initialItems].sort(byOrder));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (caught: unknown, fallback: string) =>
    setError(caught instanceof AdminApiError ? caught.message : fallback);

  async function add(picked: MediaItem[]) {
    setPicking(false);
    setBusy('add');
    setError(null);
    try {
      // The endpoint answers with the whole list, already ordered, so there
      // is nothing to merge by hand.
      const result = await adminApi.post<{ items: MediaListItem[] }>(`${endpoint}/images`, {
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

    // Shown moved straight away, and put back if the request fails, so the
    // list never claims an order the database does not have.
    const previous = items;
    setItems(next.map((item, position) => ({ ...item, sortOrder: position })));
    setBusy(current.id);
    setError(null);
    try {
      const payload: ReorderInput = { ids: next.map((item) => item.id) };
      await adminApi.post(`${endpoint}/images/reorder`, payload);
    } catch (caught) {
      setItems(previous);
      fail(caught, 'Promena redosleda nije uspela.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: MediaListItem) {
    setBusy(item.id);
    setError(null);
    try {
      await adminApi.delete(`${endpoint}/images/${item.id}`);
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
            {title}
            {items.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ts-muted">({items.length})</span>
            )}
          </h2>
          <p className="text-xs text-ts-muted mt-0.5">
            Izmene se čuvaju odmah. Redosled je redosled prikaza na sajtu.
          </p>
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

      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-[#ef6b6b] border-b border-ts-border">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="py-14 text-center">
          <Icon name="PhotoIcon" size={30} className="mx-auto text-ts-muted-2 mb-3" />
          <p className="text-sm text-ts-muted">{emptyText}</p>
          <p className="text-xs text-ts-muted-2 mt-1">Možete dodati više slika odjednom.</p>
        </div>
      ) : (
        <ul className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item, index) => (
            <li key={item.id} className="space-y-2">
              <div className="relative aspect-square rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2">
                {item.media && (
                  <Image
                    src={mediaSrc(item.media.path)}
                    alt={mediaAlt(item.media)}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                )}
                {busy === item.id && (
                  <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="w-5 h-5 rounded-full border-2 border-ts-blue border-t-transparent animate-spin" />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0 || busy !== null}
                    aria-label="Pomeri ulevo"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-ts-muted enabled:hover:text-ts-fg disabled:opacity-30"
                  >
                    <Icon name="ArrowLeftIcon" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(index, 1)}
                    disabled={index === items.length - 1 || busy !== null}
                    aria-label="Pomeri udesno"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-ts-muted enabled:hover:text-ts-fg disabled:opacity-30"
                  >
                    <Icon name="ArrowRightIcon" size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={busy !== null}
                  aria-label="Ukloni sliku"
                  title="Uklanja sliku odavde; fajl ostaje u biblioteci."
                  className="w-7 h-7 rounded-md flex items-center justify-center text-ts-muted hover:text-[#ef6b6b] disabled:opacity-30"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <MediaLibraryDialog
          multiple
          excludeIds={items.map((item) => item.mediaId)}
          onClose={() => setPicking(false)}
          onPick={(picked) => void add(picked)}
          title="Dodaj fotografije"
        />
      )}
    </section>
  );
}
